'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
// Execute the real lifecycle functions in isolated, deterministic environments.
function functions(file, names, globals) {
  const ctx = vm.createContext(globals);
  const source = read(file);
  for (const name of names) {
    const match = source.match(new RegExp('^(?:async )?function '+name+'\\([^\\n]*\\{[\\s\\S]*?^}', 'm'));
    assert.ok(match, 'Function found: '+name);
    vm.runInContext(match[0], ctx);
  }
  return ctx;
}
const element = () => ({textContent:'',style:{},classList:{add(){},remove(){}},hidden:false});

test('all classic inline scripts parse, and local script dependencies exist', () => {
  let scripts = 0;
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    for (const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = m[1].match(/src=["']([^"']+)["']/);
      if(src && !/^(https?:)?\/\//.test(src[1])) assert.ok(fs.existsSync(path.join(root,src[1])), file+': '+src[1]);
      if(/type=["'](?:module|importmap|application\/)/.test(m[1])||!m[2].trim())continue;
      new vm.Script(m[2],{filename:file});scripts++;
    }
  }
  assert.ok(scripts>15);
  new vm.Script(read('lib/game-pause.js'));
});

test('Fruit Slash restart clears transient state and stale swipe', () => {
  const ctx=functions('fruit-slash.html',['startGame'],{
    state:'over',score:42,lives:0,combo:8,difficulty:9,elapsed:20,spawnTimer:0,
    comboTimer:.4,shake:8,flash:1,slowmo:3,waveTimer:2,slicing:true,
    fruits:[1],halves:[1],particles:[1],floats:[1],splats:[1],trail:[1]
  });
  ctx.startGame();
  for(const key of ['score','combo','difficulty','elapsed','comboTimer','shake','flash','slowmo','waveTimer'])assert.equal(ctx[key],0,key);
  for(const key of ['fruits','halves','particles','floats','splats','trail'])assert.equal(ctx[key].length,0,key);
  assert.equal(ctx.lives,3);assert.equal(ctx.state,'play');assert.equal(ctx.slicing,false);
});

test('Highway Rush replay restores road segments and resets controls', () => {
  const ctx=functions('highway-rush.html',['startRun'],{
    resetControls(){ctx.reset=true;},segments:[{position:{z:-9000}},{position:{z:-9100}}],SEG_LEN:100,
    document:{getElementById:element},running:false,laneX:i=>i*4,px:4,pz:-9000,speed:60,targetSpeed:67,
    score:999,dist:9000,combo:5,topCombo:5,comboT:2,shake:1,
    traffic:[{active:true,mesh:{visible:true}}],localStorage:{getItem:()=>10},best:0,mode:'one',updBest(){}
  });
  ctx.startRun();
  assert.equal(ctx.reset,true);assert.equal(ctx.pz,0);assert.equal(ctx.dist,0);
  assert.deepEqual(ctx.segments.map(s=>s.position.z),[-0,-100]);
  assert.equal(ctx.traffic[0].active,false);assert.equal(ctx.running,true);
});

test('Highway Rush crash is idempotent and stores one final score', () => {
  let saves=0,timers=0;
  const ctx=functions('highway-rush.html',['crash'],{
    running:true,shake:0,score:100,dist:70,best:0,topCombo:3,mode:'one',resetControls(){},
    document:{getElementById:element},localStorage:{setItem(){saves++;}},updBest(){},setTimeout(){timers++;}
  });
  ctx.crash();ctx.crash();assert.equal(saves,1);assert.equal(timers,1);assert.equal(ctx.best,170);
});

test('Space Blaster honours invulnerability for all damage sources', () => {
  const ctx=functions('space-blaster.html',['loseLife'],{
    gs:'play',lives:3,P:{x:10,y:10,invuln:0},explode(){},beep(){},CLR:{bang:[]}
  });
  ctx.loseLife();ctx.loseLife();assert.equal(ctx.lives,2);
  ctx.P.invuln=0;ctx.loseLife();assert.equal(ctx.lives,1);
  ctx.P.invuln=0;ctx.loseLife();ctx.loseLife();assert.equal(ctx.lives,0);assert.equal(ctx.gs,'over');
});

function roomClient(backend) {
  const ctx=functions('raja-rani.html',['writeRoom'],{
    pendingWrite:false,deepCopy:clone,_enc:x=>'encoded:'+x,_decRoles:x=>x,
    roomCode:'TEST',myId:'host',lastVer:0,state:null,me:0,render(){},notices:[],
    roomNotice(msg){ctx.notices.push(msg);},
    db:{ref(){return {async transaction(update){
      if(backend.fail)throw Error('offline');
      // Give simultaneous callers the opportunity to submit the same version.
      await Promise.resolve();
      const next=update(clone(backend.state));
      if(next!==undefined)backend.state=clone(next);
      return {committed:next!==undefined,snapshot:{val:()=>clone(backend.state)}};
    }}}}
  });return ctx;
}

test('Raja Rani rejects a stale move without losing a concurrent join', async () => {
  const backend={state:{version:2,players:[{id:'host'},{id:'guest'}],phase:'lobby'}};
  const ctx=roomClient(backend);
  const stale={version:1,players:[{id:'host'}],phase:'dice'};
  assert.equal(await ctx.writeRoom(stale),false);
  assert.equal(backend.state.players.length,2);assert.equal(backend.state.phase,'lobby');
  assert.equal(ctx.state.version,2);assert.equal(stale.version,1);assert.equal(ctx.pendingWrite,false);
});

test('Raja Rani simultaneous actions commit exactly once', async () => {
  const backend={state:{version:4,players:[{id:'host'}],phase:'result'}};
  const a=roomClient(backend), b=roomClient(backend);
  const next={...clone(backend.state),phase:'dice',round:2};
  const result=await Promise.all([a.writeRoom(next),b.writeRoom(next)]);
  assert.equal(result.filter(Boolean).length,1);assert.equal(backend.state.version,5);
});

test('Raja Rani failed writes preserve local state and release pending lock', async () => {
  const ctx=roomClient({state:null,fail:true});ctx.state={phase:'dice'};
  assert.equal(await ctx.writeRoom({version:0,players:[{id:'host'}]}),false);
  assert.equal(ctx.state.phase,'dice');assert.equal(ctx.pendingWrite,false);assert.equal(ctx.notices.length,1);
});

test('Raja Rani room creation cannot overwrite an occupied code', async () => {
  const backend={state:{version:9,players:[{id:'other'}]}};const ctx=roomClient(backend);
  assert.equal(await ctx.writeRoom({version:0,players:[{id:'host'}]},true),false);
  assert.equal(backend.state.version,9);
  backend.state=null;
  assert.equal(await ctx.writeRoom({version:0,players:[{id:'host'}]},true),true);
  assert.equal(backend.state.version,1);
});

test('Pause clears controls, freezes until explicit resume, and handles keyboard', () => {
  const docEvents={},winEvents={},nodes=[];let resets=0,playing=true;
  function node(){return {style:{},hidden:false,setAttribute(){},append(){},focus(){},addEventListener(type,fn){this[type]=fn;}};}
  const doc={hidden:false,createElement(){const n=node();nodes.push(n);return n;},body:{append(){}},addEventListener(t,f){docEvents[t]=f;}};
  const win={addEventListener(t,f){winEvents[t]=f;}};
  vm.runInNewContext(read('lib/game-pause.js'),{document:doc,window:win});
  const ctl=win.GamePause.install({isPlaying:()=>playing,resetInput:()=>resets++});
  ctl.sync();assert.equal(nodes[0].hidden,false);
  winEvents.blur();assert.equal(ctl.paused,true);assert.ok(resets>0);
  doc.hidden=false;docEvents.visibilitychange();assert.equal(ctl.paused,true);
  nodes[4].click();assert.equal(ctl.paused,false);
  const key={code:'KeyP',repeat:false,preventDefault(){},stopImmediatePropagation(){}};
  docEvents.keydown(key);assert.equal(ctl.paused,true);
  docEvents.keydown({...key,repeat:true});assert.equal(ctl.paused,true);
  docEvents.keydown(key);assert.equal(ctl.paused,false);
  playing=false;ctl.sync();assert.equal(nodes[0].hidden,true);
});
