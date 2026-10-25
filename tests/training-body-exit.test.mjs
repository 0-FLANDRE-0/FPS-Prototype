import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { resolveBodyPath, BODY_EXIT_RULE_ID } from '../apps/training/src/protection.js';
import { BODY_PROFILE, HUMAN_TARGETS } from '../apps/training/src/human-targets.js';
import { CATALOG } from '../apps/training/src/catalog.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} ≈ ${b}`);
const state = (pen=46) => ({ pen, velocity:879, initialVelocity:879, damage:52, stability:.8, barrierCount:1, ammo:CATALOG.AMMO_PRESETS['556_m855'] });
function path(shapes) {
  let distance=1;
  const cells=shapes.map(([id,length])=>{const entry=distance;distance+=length;return {entry,exit:distance,shape:BODY_PROFILE.find(s=>s.id===id)};});
  return {actor:HUMAN_TARGETS[0],entry:1,exit:distance,completeExit:true,cells,point:new Vector3(17,1.3,-4),normal:new Vector3(0,0,1),direction:new Vector3(0,0,-1),address:{}};
}
test('body exit slows monotonically with actual cost and preserves bounded energy and stability',()=>{
  let prior=Infinity;
  for(const length of [.04,.09,.15,.24,.40,.8]){
    const s=state(),r=resolveBodyPath(path([['chest',length]]),s);
    assert.ok(r.velocityOutMps<=prior);prior=r.velocityOutMps;
    assert.ok(s.velocity>=0&&s.velocity<=879);assert.ok(s.damage>=0&&s.damage<=52);assert.equal(s.stability,.8);
    near(r.energyInJ-r.energyOutJ,r.energyDepositedJ);assert.ok(r.energyDepositedJ>=0);
    if(r.bodyEntered)near(r.parts.reduce((n,p)=>n+p.energyShareJ,0),r.energyDepositedJ);
    assert.equal(r.ruleId,BODY_EXIT_RULE_ID);
  }
  const arm=resolveBodyPath(path([['left-forearm',.09]]),state()),chest=resolveBodyPath(path([['chest',.24]]),state());
  assert.ok(arm.velocityOutMps>chest.velocityOutMps);
});
test('several parts and separate crossings use final person penetration once, with cost-weighted deposits',()=>{
  const joined=resolveBodyPath(path([['left-forearm',.09],['chest',.24]]),state());
  const s=state(),anchor={penetration:s.pen,velocityMps:s.velocity,damage:s.damage};
  const arm=resolveBodyPath(path([['left-forearm',.09]]),s,anchor),chest=resolveBodyPath(path([['chest',.24]]),s,anchor);
  near(joined.velocityOutMps,chest.velocityOutMps);near(joined.after.damage,chest.after.damage);
  near(joined.energyDepositedJ,arm.energyDepositedJ+chest.energyDepositedJ);
  near(joined.parts[0].energyShareJ/joined.parts[1].energyShareJ,joined.parts[0].cost/joined.parts[1].cost);
});
