import test from 'node:test';
import assert from 'node:assert/strict';
import {VARIANTS,SCHOOL,MONUMENT,CAPTURE_SECONDS,inZone,inCone,strikeOutcome,captureStep,canFinishCapture,schoolTransition} from '../dist/rules.js';
test('melee reaches only the short forward cone, including after a turn',()=>{
  const p={x:0,z:0};assert.ok(inCone(p,{x:0,z:-2},0));assert.ok(!inCone(p,{x:0,z:2},0));assert.ok(!inCone(p,{x:2,z:0},0));assert.ok(!inCone(p,{x:0,z:-3},0));assert.ok(inCone(p,{x:2,z:0},Math.PI/2));
});
test('three rioter variants take two blows, each KO counts exactly one OQTF',()=>{
  for(const variant of VARIANTS){const a={kind:'threat',variant,state:'active',hits:0,maxHits:2};assert.equal(strikeOutcome(a).oqtf,0);assert.equal(strikeOutcome(a).ko,false);a.hits++;const hit=strikeOutcome(a);assert.equal(hit.oqtf,1);assert.equal(hit.ko,true);assert.equal(hit.score,variant==='classic'?1:2);a.state='down';assert.equal(strikeOutcome(a).oqtf,0);assert.equal(strikeOutcome(a).score,0);}
});
test('bystanders and emergency services never increase OQTF',()=>{
  for(const kind of ['student','civilian','fire','medic','police']){const result=strikeOutcome({kind,state:'active',hits:0});assert.ok(result.mistake);assert.equal(result.oqtf,0);assert.equal(result.ko,false);assert.equal(result.score,kind==='police'?-3:-2);}
});
test('school encounter begins only inside the red circle',()=>{
  const s={inside:false,initial:3,wave:0,hp:100,rebuildTime:0};assert.equal(schoolTransition('approach',s),'approach');s.inside=true;assert.equal(schoolTransition('approach',s),'initial');assert.ok(inZone({x:-6,z:-8},SCHOOL));assert.ok(!inZone({x:0,z:10},SCHOOL));
});
test('school requires both lines defeated, then three seconds of reconstruction',()=>{
  const s={inside:true,initial:1,wave:8,hp:70,rebuildTime:0};assert.equal(schoolTransition('initial',s),'initial');s.initial=0;assert.equal(schoolTransition('initial',s),'cinematic');assert.equal(schoolTransition('wave',s),'wave');s.wave=0;assert.equal(schoolTransition('wave',s),'rebuilding');assert.equal(schoolTransition('rebuilding',s),'rebuilding');s.rebuildTime=3;assert.equal(schoolTransition('rebuilding',s),'restored');
});
test('school cannot be restored after its health reaches zero',()=>{assert.equal(schoolTransition('wave',{hp:0,wave:0}),'failed');});
test('capture freezes outside, while contested, or before school unlock',()=>{
  for(const flags of [{inside:false,contested:false,unlocked:true},{inside:true,contested:true,unlocked:true},{inside:true,contested:false,unlocked:false}])assert.equal(captureStep(4,1,flags),4);
  assert.equal(captureStep(4,1,{inside:true,contested:false,unlocked:true}),5);assert.ok(inZone({x:12,z:6},MONUMENT));
});
test('flag changes only after twelve seconds AND all six defenders are down',()=>{
  const flags={inside:true,contested:false,unlocked:true};const progress=captureStep(11,4,flags);assert.equal(progress,CAPTURE_SECONDS);assert.ok(!canFinishCapture(progress,1));assert.ok(!canFinishCapture(11,0));assert.ok(canFinishCapture(progress,0));
});
