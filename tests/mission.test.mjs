import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Three from '../dist/vendor/three.module.js';
import * as rules from '../dist/rules.js';

// Run the real mission controller with a clock, DOM and visual adapter, without WebGL.
function mission(){
  const elements=new Map(),listeners=new Map();
  function element(){const classes=new Set();return {textContent:'',innerHTML:'',style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,value)=>{if(value===undefined)value=!classes.has(x);value?classes.add(x):classes.delete(x);},contains:x=>classes.has(x)},setAttribute(){},appendChild(){},addEventListener(){},focus(){},setPointerCapture(){},querySelector:()=>({focus(){}}),querySelectorAll:()=>[]};}
  const document={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[],createElement:element,body:element(),addEventListener:(name,fn)=>listeners.set(name,fn),hidden:false};
  const createPerson=(kind,x,z,index,variant)=>({kind,x,z,homeX:x,homeZ:z,variant,state:'active',hits:0,maxHits:2,stagger:0,attackCooldown:1,attack:0,phase:index*.71,root:new Three.Object3D(),body:new Three.Object3D(),arms:[new Three.Object3D(),new Three.Object3D()],elbows:[new Three.Object3D(),new Three.Object3D()]});
  const THREE={...Three,Clock:class{getDelta(){return .05;}}};
  const env={THREE,document,renderer:{domElement:element(),render(){}},scene:new Three.Scene(),camera:new Three.PerspectiveCamera(),colliders:[],damage:{visible:true},civicFlag:{visible:false},shutter:new Three.Object3D(),shopCrates:{visible:false},updateWorld(){},createPerson,animatePerson(){},disposePerson(){},skins:['#fff','#aaa'],...rules,matchMedia:()=>({matches:false}),navigator:{maxTouchPoints:0},localStorage:{getItem(){return null;},setItem(){}},innerWidth:1280,requestAnimationFrame(){},addEventListener:(name,fn)=>listeners.set(name,fn)};
  const source=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const boot=new Function('env',`const {${Object.keys(env).join(',')}}=env;\n${source}\nreturn {launch,endCinema,updateSchool,updateCapture,updateActors,updatePlayer,strike,finish,frame,pause,closeModal,actors,player:()=>player,state:()=>({stage,ko,score,remaining,schoolRestored,captured,graduates,scientists,hp,modal,mode})};`);
  const game=boot(env);game.launch();game.endCinema();return game;
}
function knockDown(game,actor){const p=game.player();p.x=actor.x;p.z=actor.z+1.4;game.updatePlayer(.6,0);game.strike();game.updatePlayer(.6,0);game.strike();}
function restoreSchool(game){
  game.player().x=-6;game.player().z=-12;game.updateSchool(0);assert.equal(game.state().stage,'initial');
  for(const actor of game.actors.filter(a=>a.zone==='initial'))knockDown(game,actor);
  game.updateSchool(0);assert.equal(game.state().stage,'cinematic');game.endCinema();
  for(const actor of game.actors.filter(a=>a.zone==='wave'))knockDown(game,actor);
  game.updateSchool(0);assert.equal(game.state().stage,'rebuilding');game.updateSchool(3.1);assert.equal(game.state().schoolRestored,true);
}
test('real mission controller: school, reconstruction, capture and exact KO count',()=>{
  const game=mission();restoreSchool(game);assert.equal(game.state().ko,11);
  const p=game.player();p.x=10;p.z=8;game.updateCapture(.1);
  assert.equal(game.actors.filter(a=>a.zone==='monument').length,6);
  for(const actor of game.actors.filter(a=>a.zone==='monument'))knockDown(game,actor);
  p.x=10;p.z=8;game.updateCapture(13);assert.equal(game.state().captured,true);assert.equal(game.state().ko,17);
  const score=game.state().score;game.updateCapture(13);assert.equal(game.state().score,score);
});
test('a student entering the restored school is counted only once',()=>{
  const game=mission();restoreSchool(game);
  const students=game.actors.filter(a=>a.entering);const count=students.length;assert.ok(count>=4);
  students.forEach(a=>{a.x=-6;a.z=-17.55;});game.updateActors(.1,1);
  assert.equal(game.state().graduates+game.state().scientists,count);
  for(let i=0;i<50;i++)game.updateActors(.1,i);
  assert.equal(game.state().graduates+game.state().scientists,count);
});
test('pause stops both the actual timer and mission simulation',()=>{
  const game=mission();game.pause();const before=game.state();
  for(let i=0;i<50;i++)game.frame();
  assert.equal(game.state().remaining,before.remaining);assert.equal(game.state().hp,before.hp);assert.equal(game.state().stage,before.stage);
  game.closeModal();game.frame();assert.ok(game.state().remaining<before.remaining);
});
