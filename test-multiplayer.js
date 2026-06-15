/**
 * Raja Rani — Automated Multi-player Test (Playwright)
 * Simulates 4 players going through a full 3-round game.
 * Reports console errors, unexpected states, and logic bugs.
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── HTTP Server ─────────────────────────────────────────────────────────
const PORT = 8788;
const GAME_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      const file = path.join(GAME_DIR, url === '/' ? 'raja-rani.html' : url);
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(file);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
      });
    });
    server.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForScreen(page, screenId, timeout = 20000, label = '') {
  try {
    await page.waitForFunction(
      id => document.getElementById(id)?.classList.contains('active'),
      screenId, { timeout }
    );
  } catch {
    const active = await page.evaluate(() => {
      const el = document.querySelector('.screen.active');
      return el ? el.id : 'none';
    });
    throw new Error(`[${label}] Timeout waiting for ${screenId}, currently on: ${active}`);
  }
}

async function activeScreen(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.screen.active');
    return el ? el.id : 'none';
  });
}

// ── Main Test ────────────────────────────────────────────────────────────
async function runTest() {
  const server = await startServer();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ]
  });

  const errors = [];
  const pages = [];
  const names = ['Host', 'Player2', 'Player3', 'Player4'];
  const NUM_PLAYERS = 4;
  const NUM_ROUNDS = 3;

  // CDN → local redirect map
  const CDN_MAP = {
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js':
      path.join(GAME_DIR, 'vendor/firebase/firebase-app-compat.js'),
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js':
      path.join(GAME_DIR, 'vendor/firebase/firebase-database-compat.js'),
  };

  console.log('\n══════════════════════════════════════════════');
  console.log('  RAJA RANI — MULTIPLAYER TEST  (4 players, 3 rounds)');
  console.log('══════════════════════════════════════════════\n');

  try {
    // ── Open 4 browser contexts ──────────────────────────────────────
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

      // Redirect Firebase CDN to local files
      await ctx.route('**/*', async (route) => {
        const url = route.request().url();
        if (CDN_MAP[url]) {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: fs.readFileSync(CDN_MAP[url]),
          });
        } else {
          await route.continue();
        }
      });

      const page = await ctx.newPage();
      page._playerName = names[i];
      page._idx = i;

      // Capture only real errors (skip resource-load noise)
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Skip Firebase routine errors and resource load noise
          if (text.includes('Failed to load resource') ||
              text.includes('QUIC_PROTOCOL_ERROR') ||
              text.includes('net::ERR')) return;
          errors.push(`[${names[i]}] ${text}`);
          console.error(`  ❌ [${names[i]}] ${text}`);
        }
      });
      page.on('pageerror', err => {
        errors.push(`[${names[i]}] PAGE ERROR: ${err.message}`);
        console.error(`  💥 [${names[i]}] PAGE ERROR: ${err.message}`);
      });

      pages.push(page);
    }

    const BASE = `http://localhost:${PORT}/raja-rani.html`;

    // ── Navigate & wait for Firebase ─────────────────────────────────
    console.log('📱 Opening game for all players…');
    await Promise.all(pages.map(p => p.goto(BASE, { waitUntil: 'domcontentloaded' })));

    // Wait for Firebase Connected indicator
    let connectedCount = 0;
    await Promise.all(pages.map(async (p, i) => {
      try {
        await p.waitForFunction(
          () => document.getElementById('conn-txt')?.textContent?.includes('Connected'),
          { timeout: 20000 }
        );
        connectedCount++;
      } catch {
        console.warn(`  ⚠️  ${names[i]} Firebase connection timeout`);
        errors.push(`[${names[i]}] Firebase did not connect within 20s`);
      }
    }));
    console.log(`✅ ${connectedCount}/${NUM_PLAYERS} players connected to Firebase\n`);
    if (connectedCount < NUM_PLAYERS) throw new Error('Not all players connected to Firebase');

    // ── Player 0: Create room ─────────────────────────────────────────
    console.log('🏠 Host creating room…');
    const host = pages[0];
    await host.fill('#myname', 'Host');
    await host.click('button:has-text("Create room")');
    await waitForScreen(host, 'scr-lobby', 12000, 'Host');

    const roomCode = await host.$eval('#lobby-code', el => el.textContent.trim());
    if (!roomCode || roomCode.length !== 4) throw new Error(`Invalid room code: "${roomCode}"`);
    console.log(`✅ Room created: ${roomCode}`);

    // Set rounds to 3 for a shorter test
    const roundBtns = await host.$$('#rounds-picker button');
    for (const btn of roundBtns) {
      if ((await btn.textContent()).trim() === '3') { await btn.click(); break; }
    }
    console.log('✅ Rounds set to 3\n');

    // ── Players 1-3: Join ─────────────────────────────────────────────
    console.log('👥 Players joining…');
    // Give Firebase a moment to propagate the new room before joiners read it
    await sleep(2000);

    // Debug: check room state from host's perspective
    const hostRoomDebug = await host.evaluate(async (code) => {
      try {
        const snap = await db.ref('rooms/' + code + '/state').once('value');
        const val = snap.val();
        return val ? { exists: true, players: val.players?.length, numPlayers: val.numPlayers, phase: val.phase } : { exists: false };
      } catch (e) { return { error: e.message }; }
    }, roomCode);
    console.log(`  Debug host sees room: ${JSON.stringify(hostRoomDebug)}`);

    // Debug: read room state from Player2's browser before join
    const p2Check = await pages[1].evaluate(async (code) => {
      try {
        const snap = await db.ref('rooms/' + code + '/state').once('value');
        const val = snap.val();
        return val ? { exists: true, players: val.players?.length, numPlayers: val.numPlayers, phase: val.phase } : { exists: false };
      } catch (e) { return { error: e.message }; }
    }, roomCode);
    console.log(`  Debug P2 sees room: ${JSON.stringify(p2Check)}`);

    // Debug: run a diagnostic transaction to see what curr contains
    const txDebug = await pages[1].evaluate(async (code) => {
      const log = [];
      let callCount = 0;
      try {
        await db.ref('rooms/' + code + '/state').transaction(curr => {
          callCount++;
          log.push({
            call: callCount,
            currIsNull: curr === null,
            currType: typeof curr,
            players: curr?.players?.length,
            numPlayers: curr?.numPlayers,
            playersGteNumPlayers: curr ? (curr.players?.length >= curr.numPlayers) : 'n/a'
          });
          return; // always abort so we don't actually modify data
        });
      } catch (e) {
        log.push({ error: e.message });
      }
      return { calls: callCount, log };
    }, roomCode);
    console.log(`  Debug transaction: ${JSON.stringify(txDebug)}`);

    for (let i = 1; i < NUM_PLAYERS; i++) {
      const page = pages[i];
      let joined = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await page.fill('#myname', names[i]);
        // Use type() so oninput fires for the room code field
        await page.click('#joincode', { clickCount: 3 });
        await page.type('#joincode', roomCode);
        await page.click('button:has-text("Join room")');

        // Wait up to 10s for lobby or an error message
        try {
          await Promise.race([
            waitForScreen(page, 'scr-lobby', 10000, names[i]),
            page.waitForFunction(
              () => {
                const err = document.getElementById('home-err');
                return err && err.textContent && !err.textContent.includes('Joining');
              },
              { timeout: 10000 }
            )
          ]);
        } catch { /* timeout — check state below */ }

        const screen = await activeScreen(page);
        if (screen === 'scr-lobby') { joined = true; break; }

        const errMsg = await page.$eval('#home-err', el => el.textContent).catch(() => '');
        console.log(`  ⚠️  ${names[i]} join attempt ${attempt} failed (screen:${screen}, err:"${errMsg}") — retrying…`);
        await sleep(1500);
      }
      if (!joined) throw new Error(`${names[i]} could not join after 3 attempts`);
      await sleep(400);
      console.log(`  ✅ ${names[i]} joined`);
    }
    console.log('');

    // ── Host: Start game ──────────────────────────────────────────────
    console.log('🚀 Starting game…');
    await host.waitForFunction(
      () => {
        const btn = document.getElementById('lobby-start');
        return btn && btn.style.display !== 'none' && !btn.disabled;
      },
      { timeout: 20000 }
    );

    // Verify start button state on non-host
    const p2StartVisible = await pages[1].evaluate(() => {
      const btn = document.getElementById('lobby-start');
      return btn ? btn.style.display !== 'none' : false;
    });
    if (p2StartVisible) {
      errors.push('BUG: Start button is visible to non-host Player2');
      console.error('  ❌ BUG: Start button visible for non-host!');
    }

    await host.click('#lobby-start');
    console.log('✅ Game started\n');

    // ── Round loop ───────────────────────────────────────────────────
    for (let round = 1; round <= NUM_ROUNDS; round++) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎮  ROUND ${round} / ${NUM_ROUNDS}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // ── Dice ────────────────────────────────────────────────────
      const rollerIdx = (round - 1) % NUM_PLAYERS;
      console.log(`🎲 Dice screen (roller: ${names[rollerIdx]})…`);
      await Promise.all(pages.map((p, i) =>
        waitForScreen(p, 'scr-dice', 15000, names[i])
      ));

      // Verify dice permissions
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const canTap = await pages[i].evaluate(() =>
          document.getElementById('dice-el')?.style.pointerEvents !== 'none'
        );
        if (i === rollerIdx && !canTap) {
          errors.push(`BUG R${round}: ${names[i]} is dice roller but dice is disabled`);
          console.error(`  ❌ BUG: Roller ${names[i]} has dice disabled!`);
        }
        if (i !== rollerIdx && canTap) {
          errors.push(`BUG R${round}: ${names[i]} is NOT dice roller but dice is enabled`);
          console.error(`  ❌ BUG: Non-roller ${names[i]} has dice enabled!`);
        }
      }

      await pages[rollerIdx].click('#dice-el');
      console.log(`  ✅ ${names[rollerIdx]} tapped dice`);

      // ── My card ─────────────────────────────────────────────────
      await Promise.all(pages.map((p, i) =>
        waitForScreen(p, 'scr-mycard', 8000, names[i])
      ));

      const roles = await Promise.all(pages.map(p =>
        p.evaluate(() => document.getElementById('mc-en')?.textContent?.trim() || '?')
      ));
      console.log(`  Cards: ${roles.map((r, i) => `${names[i]}=${r}`).join(', ')}`);

      const EXPECTED_ROLES_4 = ['RAJA','RANI','MANTHIRI','THIRUDAN'].sort();
      if (JSON.stringify([...roles].sort()) !== JSON.stringify(EXPECTED_ROLES_4)) {
        errors.push(`BUG R${round}: Wrong role set. Got [${roles.join(',')}]`);
        console.error(`  ❌ BUG: Wrong roles distributed!`);
      } else {
        console.log('  ✅ All 4 roles correctly distributed');
      }

      // ── Declare ──────────────────────────────────────────────────
      console.log('  ⏳ Waiting for declare phase (~3s auto-advance)…');
      await Promise.all(pages.map((p, i) =>
        waitForScreen(p, 'scr-declare', 10000, names[i])
      ));

      let rajaIdx = -1;
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const hasBtn = await pages[i].$('button:has-text("Declare yourself")');
        if (hasBtn) rajaIdx = i;
      }

      // Count how many have the Declare button
      let rajaCount = 0;
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const hasBtn = await pages[i].$('button:has-text("Declare yourself")');
        if (hasBtn) rajaCount++;
      }

      if (rajaCount === 0) {
        errors.push(`BUG R${round}: No player has Declare button`);
        console.error('  ❌ BUG: Declare button missing for everyone!');
        // Dump declare screen content for debug
        for (let i = 0; i < NUM_PLAYERS; i++) {
          const txt = await pages[i].$eval('#decl-content', el => el.textContent.trim()).catch(() => '?');
          console.error(`    ${names[i]} decl: "${txt.slice(0,80)}"`);
        }
        break;
      }
      if (rajaCount > 1) {
        errors.push(`BUG R${round}: ${rajaCount} players have Declare button (should be 1)`);
        console.error(`  ❌ BUG: ${rajaCount} players have Declare button!`);
      }

      if (roles[rajaIdx] !== 'RAJA') {
        errors.push(`BUG R${round}: ${names[rajaIdx]} has role ${roles[rajaIdx]} but has Declare button`);
        console.error(`  ❌ BUG: Role/button mismatch for ${names[rajaIdx]}`);
      }

      await pages[rajaIdx].click('button:has-text("Declare yourself")');
      console.log(`  ✅ ${names[rajaIdx]} (RAJA) declared`);

      // ── Chain ────────────────────────────────────────────────────
      await Promise.all(pages.map((p, i) =>
        waitForScreen(p, 'scr-chain', 8000, names[i])
      ));
      console.log('  ✅ Chain phase started');

      let guessCount = 0;
      let chainDone = false;
      const MAX_GUESSES = 60;

      while (guessCount < MAX_GUESSES) {
        const screen0 = await activeScreen(pages[0]);
        if (screen0 !== 'scr-chain') { chainDone = true; break; }

        let guessedThisTurn = false;
        for (let i = 0; i < NUM_PLAYERS; i++) {
          const result = await pages[i].evaluate(() => {
            try {
              // Guard: only click if this player is the current chain finder
              // state and me are declared in the game script's global scope
              if (typeof state === 'undefined' || typeof me === 'undefined') return null;
              if (state?.phase !== 'chain') return null;
              if (state?.chainFinder !== me) return null;
            } catch { return null; }

            const candidates = [...document.querySelectorAll('#chain-candidates .candidate')]
              .filter(c => !c.classList.contains('passive') && !c.classList.contains('revealed'));
            if (!candidates.length) return null;
            // Random pick to avoid deterministic cycling
            const c = candidates[Math.floor(Math.random() * candidates.length)];
            const name = c?.querySelector('.cname')?.textContent || '?';
            c.click();
            return { name };
          });

          if (result) {
            guessCount++;
            console.log(`  🔍 ${names[i]} → "${result.name}" (#${guessCount})`);
            guessedThisTurn = true;
            // Wait for Firebase to propagate and DOM to update before next guess
            await sleep(1000);
            break;
          }
        }

        if (!guessedThisTurn) {
          await sleep(500);
          const s = await activeScreen(pages[0]);
          if (s !== 'scr-chain') { chainDone = true; break; }
          guessCount++;
        }
      }

      if (!chainDone && guessCount >= MAX_GUESSES) {
        errors.push(`BUG R${round}: Chain did not complete after ${MAX_GUESSES} guesses`);
        console.error(`  ❌ BUG: Chain stuck after ${MAX_GUESSES} guesses!`);
        break;
      }

      // ── Result ───────────────────────────────────────────────────
      await Promise.all(pages.map((p, i) =>
        waitForScreen(p, 'scr-result', 8000, names[i])
      ));

      const banner = await pages[0].$eval('#res-banner', el => el.textContent.trim());
      const roleRows = await pages[0].$$('#res-roles > *');
      console.log(`  ✅ Result: "${banner}" (${roleRows.length} role rows shown)`);
      if (roleRows.length !== NUM_PLAYERS) {
        errors.push(`BUG R${round}: Result shows ${roleRows.length} role rows, expected ${NUM_PLAYERS}`);
        console.error(`  ❌ BUG: Wrong number of role rows in result!`);
      }

      // Host always clicks the result button (says "Next Round →" or "🏆 Final result")
      const hostNextVisible = await host.$eval('#res-next', el => el.style.display !== 'none').catch(() => false);
      const p2NextVisible = await pages[1].$eval('#res-next', el => el.style.display !== 'none').catch(() => false);
      if (!hostNextVisible) {
        errors.push(`BUG R${round}: Next/Final button not visible for host`);
        console.error('  ❌ BUG: Next/Final button missing for host!');
      }
      if (p2NextVisible) {
        errors.push(`BUG R${round}: Next/Final button visible for non-host`);
        console.error('  ❌ BUG: Next/Final button shown to non-host!');
      }
      const btnLabel = await host.$eval('#res-next', el => el.textContent).catch(() => '?');
      await host.click('#res-next');
      console.log(`  ✅ Host clicked "${btnLabel}"\n`);
      await sleep(400);
    } // end round loop

    // ── Winner screen ──────────────────────────────────────────────
    console.log('🏆 Waiting for winner screen…');
    await Promise.all(pages.map((p, i) =>
      waitForScreen(p, 'scr-winner', 15000, names[i])
    ));

    const winnerName = await pages[0].$eval('#w-name', el => el.textContent.trim());
    const winnerPts = await pages[0].$eval('#w-pts', el => el.textContent.trim());
    console.log(`✅ Winner: ${winnerName} — ${winnerPts}`);

    // Only host has rematch button
    const hostRematch = await host.$eval('#w-rematch', el => el.style.display).catch(() => 'unknown');
    const p2Rematch = await pages[1].$eval('#w-rematch', el => el.style.display).catch(() => 'unknown');
    if (hostRematch === 'none') {
      errors.push('BUG: Rematch button hidden for host on winner screen');
      console.error('  ❌ BUG: Rematch button missing for host!');
    }
    if (p2Rematch !== 'none') {
      errors.push('BUG: Rematch button visible for non-host');
      console.error('  ❌ BUG: Rematch button showing for non-host!');
    }

    // ── Verify new-game fix: sessionStorage cleared ────────────────
    console.log('\n🔄 Checking sessionStorage cleared after game over…');
    const hostSS = await host.evaluate(() => sessionStorage.getItem('rr-room'));
    if (hostSS) {
      errors.push(`BUG: sessionStorage still has "${hostSS}" after game over`);
      console.error(`  ❌ BUG: sessionStorage not cleared! Value: ${hostSS}`);
    } else {
      console.log('  ✅ sessionStorage cleared — new-game fix works');
    }

    // ── Verify Leave / New game button visible in lobby ────────────
    // We can't easily navigate back to lobby in this test, but we can check DOM
    console.log('\n🔄 Checking lobby "Leave / New game" button exists in DOM…');
    const leaveBtn = await pages[0].evaluate(() => {
      const btns = [...document.querySelectorAll('#scr-lobby button')];
      return btns.some(b => b.textContent.includes('Leave') || b.textContent.includes('New game'));
    });
    if (!leaveBtn) {
      errors.push('BUG: Lobby has no Leave / New game button');
      console.error('  ❌ BUG: Leave / New game button missing from lobby!');
    } else {
      console.log('  ✅ Lobby Leave / New game button present');
    }

  } catch (err) {
    errors.push(`FATAL: ${err.message}`);
    console.error(`\n💥 FATAL: ${err.message}`);
    if (process.env.VERBOSE) console.error(err.stack);
  } finally {
    await browser.close();
    server.close();
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('══════════════════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅  ALL CHECKS PASSED — no bugs found!\n');
  } else {
    console.log(`❌  ${errors.length} ISSUE(S):\n`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log('');
  }
  return errors;
}

runTest().then(errs => process.exit(errs.length > 0 ? 1 : 0));
