'use strict';
/* ═══════════════════════════════════════════════════════════════════
   GAME ZONE realtime server — Neon Racer rooms
   Rooms live in memory. Trust-the-client relay for casual play.
   ═══════════════════════════════════════════════════════════════════ */
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'https://robokks.github.io',
  'http://localhost:8000', 'http://localhost:8080', 'http://localhost:3000',
  'http://127.0.0.1:8000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000',
];

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      // allow no-origin (health checks), localhost dev, GitHub Pages, and Render-hosted portal
      if (!origin || ALLOWED_ORIGINS.includes(origin)
        || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        || /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) cb(null, true);
      else cb(new Error('CORS blocked: ' + origin));
    },
  },
});

// Health endpoint — also used by clients to wake a sleeping free dyno
app.get('/', (_req, res) => res.type('text').send('ok'));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() | 0 }));

/* ── Ephemeral TURN credentials (coturn use-auth-secret / TURN REST) ──────
   Mints a short-lived username+HMAC credential so no static password is ever
   shipped to the (public) client. The shared secret lives ONLY here, as the
   TURN_SECRET env var, and must byte-match coturn's static-auth-secret. */
const TURN_HOST = process.env.TURN_HOST || '140.245.220.65';
function allowOrigin(origin) {
  return !!origin && (ALLOWED_ORIGINS.includes(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    || /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin));
}
app.get('/turn', (req, res) => {
  const origin = req.get('origin');
  if (allowOrigin(origin)) res.set('Access-Control-Allow-Origin', origin);
  const secret = process.env.TURN_SECRET;
  if (!secret) return res.status(503).json({ error: 'TURN not configured' });
  const ttl = 12 * 3600;
  const username = (Math.floor(Date.now() / 1000) + ttl) + ':walkie';
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  res.json({
    username, credential, ttl,
    urls: ['turn:' + TURN_HOST + ':3478', 'turn:' + TURN_HOST + ':3478?transport=tcp'],
  });
});

/* ── Rooms ─────────────────────────────────────────────────────────── */
const rooms = new Map(); // code -> room

const MAX_PLAYERS = 6;
const TICK_MS = 50;          // 20 Hz state broadcast
const LOBBY_TTL_MS = 30 * 60 * 1000;   // GC stale rooms after 30 min
const FINISH_GRACE_MS = 25 * 1000;     // everyone gets 25s after first finisher

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let c = '';
  for (let i = 0; i < 4; i++) c += A[(Math.random() * A.length) | 0];
  return rooms.has(c) ? makeCode() : c;
}

function lobbyView(room) {
  return {
    code: room.code,
    phase: room.phase,
    laps: room.laps,
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [id, { name: p.name, color: p.color, host: id === room.host, ready: true }])
    ),
    host: room.host,
  };
}

function newRoom(code, hostId) {
  return {
    code,
    host: hostId,
    phase: 'lobby',          // lobby | countdown | racing | results
    laps: 3,
    players: {},             // id -> {name,color,pos:{x,y,angle,speed,lap,cp},finished,lapTimes}
    created: Date.now(),
    raceStartAt: 0,
    firstFinishAt: 0,
    tick: null,
  };
}

function startTick(room) {
  stopTick(room);
  room.tick = setInterval(() => {
    const snap = {};
    for (const [id, p] of Object.entries(room.players)) {
      if (p.pos) snap[id] = p.pos;
    }
    io.to(room.code).volatile.emit('state', { t: Date.now(), players: snap });
    // finish-grace timeout
    if (room.phase === 'racing' && room.firstFinishAt && Date.now() - room.firstFinishAt > FINISH_GRACE_MS) {
      endRace(room);
    }
  }, TICK_MS);
}
function stopTick(room) {
  if (room.tick) { clearInterval(room.tick); room.tick = null; }
}

function endRace(room) {
  if (room.phase !== 'racing') return;
  room.phase = 'results';
  stopTick(room);
  const results = Object.entries(room.players)
    .map(([id, p]) => ({
      id, name: p.name, color: p.color,
      finished: !!p.finished,
      totalMs: p.finished ? p.lapTimes.reduce((a, b) => a + b, 0) : Infinity,
      lapTimes: p.lapTimes || [],
      bestLap: p.lapTimes && p.lapTimes.length ? Math.min(...p.lapTimes) : null,
    }))
    .sort((a, b) => (a.totalMs - b.totalMs));
  io.to(room.code).emit('results', { results: results.map(r => ({ ...r, totalMs: r.finished ? r.totalMs : null })) });
}

function deleteRoomIfEmpty(room) {
  if (Object.keys(room.players).length === 0) {
    stopTick(room);
    rooms.delete(room.code);
  }
}

// periodic GC of abandoned rooms
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (now - room.created > LOBBY_TTL_MS && room.phase === 'lobby') {
      io.to(room.code).emit('room-closed');
      stopTick(room);
      rooms.delete(room.code);
    }
  }
}, 5 * 60 * 1000);

/* ── Socket wiring ─────────────────────────────────────────────────── */
io.on('connection', (socket) => {
  let myRoom = null;

  socket.on('create', ({ name, color, laps }, ack) => {
    const code = makeCode();
    const room = newRoom(code, socket.id);
    room.laps = [1, 3, 5].includes(+laps) ? +laps : 3;
    room.players[socket.id] = { name: clean(name), color: cleanColor(color), pos: null, finished: false, lapTimes: [] };
    rooms.set(code, room);
    myRoom = room;
    socket.join(code);
    ack && ack({ ok: true, code, lobby: lobbyView(room) });
    io.to(code).emit('lobby', lobbyView(room));
  });

  socket.on('join', ({ code, name, color }, ack) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, err: 'Room not found' });
    if (room.phase !== 'lobby') return ack && ack({ ok: false, err: 'Race already started' });
    if (Object.keys(room.players).length >= MAX_PLAYERS) return ack && ack({ ok: false, err: 'Room is full (6 max)' });
    room.players[socket.id] = { name: clean(name), color: cleanColor(color), pos: null, finished: false, lapTimes: [] };
    myRoom = room;
    socket.join(code);
    ack && ack({ ok: true, code, lobby: lobbyView(room) });
    io.to(code).emit('lobby', lobbyView(room));
  });

  socket.on('start', () => {
    const room = myRoom;
    if (!room || socket.id !== room.host || room.phase !== 'lobby') return;
    if (Object.keys(room.players).length < 1) return;
    room.phase = 'countdown';
    const startAt = Date.now() + 3500; // 3-2-1-GO
    room.raceStartAt = startAt;
    room.firstFinishAt = 0;
    for (const p of Object.values(room.players)) { p.finished = false; p.lapTimes = []; p.pos = null; }
    io.to(room.code).emit('countdown', { startAt, laps: room.laps, lobby: lobbyView(room) });
    setTimeout(() => {
      if (rooms.get(room.code) !== room) return;
      room.phase = 'racing';
      startTick(room);
      io.to(room.code).emit('go', { t: Date.now() });
    }, startAt - Date.now());
  });

  socket.on('pos', (p) => {
    const room = myRoom;
    if (!room || room.phase !== 'racing') return;
    const me = room.players[socket.id];
    if (!me || me.finished) return;
    // minimal sanitation
    me.pos = {
      x: +p.x || 0, y: +p.y || 0, a: +p.a || 0, s: +p.s || 0,
      lap: Math.min(Math.max(+p.lap || 0, 0), room.laps),
      cp: (+p.cp || 0) & 7,
      n: me.name, c: me.color,
    };
  });

  socket.on('finish', ({ lapTimes }) => {
    const room = myRoom;
    if (!room || room.phase !== 'racing') return;
    const me = room.players[socket.id];
    if (!me || me.finished) return;
    me.finished = true;
    me.lapTimes = Array.isArray(lapTimes) ? lapTimes.slice(0, room.laps).map(t => Math.max(0, +t || 0)) : [];
    if (!room.firstFinishAt) room.firstFinishAt = Date.now();
    io.to(room.code).emit('finished', { id: socket.id, name: me.name });
    if (Object.values(room.players).every(p => p.finished)) endRace(room);
  });

  socket.on('rematch', () => {
    const room = myRoom;
    if (!room || socket.id !== room.host || room.phase !== 'results') return;
    room.phase = 'lobby';
    room.created = Date.now();
    for (const p of Object.values(room.players)) { p.finished = false; p.lapTimes = []; p.pos = null; }
    io.to(room.code).emit('lobby', lobbyView(room));
  });

  socket.on('leave', () => leave());
  socket.on('disconnect', () => leave());

  function leave() {
    const room = myRoom;
    if (!room) return;
    myRoom = null;
    delete room.players[socket.id];
    socket.leave(room.code);
    if (room.host === socket.id) {
      const rest = Object.keys(room.players);
      room.host = rest[0] || null;
    }
    if (room.phase === 'racing' && Object.values(room.players).length && Object.values(room.players).every(p => p.finished)) {
      endRace(room);
    }
    io.to(room.code).emit('lobby', lobbyView(room));
    deleteRoomIfEmpty(room);
  }
});

function clean(s) { return String(s || 'Player').replace(/[<>]/g, '').slice(0, 12).trim() || 'Player'; }
function cleanColor(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#ff6b6b'; }

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Game server listening on :' + PORT));
