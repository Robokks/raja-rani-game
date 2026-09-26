'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Three=require('../lib/three.min.js');
// Use the real geometry/material code, with only the GPU and 2D rasterizer stubbed.
// Browser shader compilation and visual appearance still require a browser check.
function build(mobile=false){
  const ctx2d={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){},fillText(){},createRadialGradient(){return{addColorStop(){}};}};
  const window={};
  const context=vm.createContext({window,document:{createElement:()=>({width:0,height:0,getContext:()=>ctx2d}),getElementById:()=>({textContent:''})},
    matchMedia:q=>({matches:q.includes('coarse')&&mobile}),innerWidth:mobile?390:1366,innerHeight:mobile?844:768,devicePixelRatio:mobile?3:1});
  vm.runInContext(fs.readFileSync(require.resolve('../lib/highway-scene.js'),'utf8'),context);
  class Renderer{constructor(){this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};}setPixelRatio(value){this.pixelRatio=value;}setSize(w,h){this.width=w;this.height=h;}}
  class PMREM{fromScene(){return{texture:new Three.Texture()};}dispose(){}}
  const T={...Three,WebGLRenderer:Renderer,PMREMGenerator:PMREM};
  return window.HighwayScene.create(T,{}, {roadWidth:14,laneWidth:3.5,lanes:4,segmentLength:100,segmentCount:9});
}

test('coastal scene creates finite geometry, valid bounds and outward car surfaces',()=>{
  const world=build();const car=world.makeCar(0xd94032,true);world.scene.add(car);
  assert.equal(world.segments.length,9);assert.equal(car.userData.wheels.length,4);
  let triangles=0;
  world.scene.traverse(o=>{
    if(!o.geometry)return;
    for(const attr of Object.values(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite),'No invalid geometry coordinates');
    o.geometry.computeBoundingSphere();assert.ok(Number.isFinite(o.geometry.boundingSphere.radius));
    triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
  });
  assert.ok(triangles<150000,'Keep the static mesh budget suitable for phones');
  const body=car.children.find(o=>o.material===car.userData.paint);
  const p=body.geometry.attributes.position,n=body.geometry.attributes.normal;
  let outside=0,total=0;
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>.9){total++;if(n.getX(i)*p.getX(i)>0)outside++;}
  assert.ok(outside/total>.65,'Body side faces point outward');
});

test('scene follows the driver and recycles after long-distance play and restart',()=>{
  const world=build();const car=world.makeCar(0xd94032,true);world.scene.add(car);
  for(const pz of [0,-420,-15000,0]){
    if(pz===0)world.segments.forEach((s,i)=>{s.position.z=-i*100;s.visible=true;});
    world.recycleSegments(pz);
    world.update({px:1.75,pz,speed:40,steer:.5,brake:false,time:10,dt:1/60,running:true,started:true,shake:0});
    assert.ok(world.segments.some(s=>Math.abs(s.position.z-pz)<=100),'Road remains under player');
    assert.ok(world.segments.every(s=>s.position.z-pz<=100));
    assert.ok(Math.abs(world.camera.position.z-pz)<15);
    assert.equal(car.position.z,pz);
  }
  assert.ok(Number.isFinite(world.camera.projectionMatrix.elements[0]));
});

test('mobile graphics cap resolution, support high detail and adapt to slow frames',()=>{
  const world=build(true);const car=world.makeCar(0xd94032,true);world.scene.add(car);
  assert.equal(world.renderer.pixelRatio,1.35);assert.equal(world.renderer.shadowMap.enabled,false);
  world.setQuality('high');assert.equal(world.renderer.pixelRatio,2);assert.equal(world.renderer.shadowMap.enabled,true);
  world.setQuality('smooth');assert.equal(world.renderer.pixelRatio,1);assert.equal(world.renderer.shadowMap.enabled,false);
  world.setQuality('auto');
  for(let i=0;i<300;i++)world.update({px:0,pz:-i,speed:30,steer:0,brake:true,time:i*.04,dt:.04,running:true,started:true,shake:0});
  assert.equal(world.renderer.pixelRatio,1);assert.equal(car.userData.tail.emissiveIntensity,4);
});
