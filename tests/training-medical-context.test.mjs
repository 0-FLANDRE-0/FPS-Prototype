import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{TrainingMedical,medicalObservation}from'../apps/training/src/medical.js';import{original2DReference}from'../scripts/training-p-reference.mjs';
test('original full unit tick and 3D medical connection match all 60-second outputs for captured forearm/neck/torso inputs',async()=>{
 const cases=JSON.parse(await readFile(new URL('./fixtures/training-p-damage-events.json',import.meta.url)));
 for(const f of cases){const m=new TrainingMedical({medicalModel:'legacy'}),r=await original2DReference();for(let i=1;i<=f.startTick;i++){m.tick(1/60,i*(1/60));r.tick(1/60,i*(1/60));}m.seed=r.seed=f.tape[0].seed;
  // Replay captured arguments, including internal rear-armor blunt damage.
  for(const e of f.tape){assert.equal(m.seed,e.seed);assert.equal(r.seed,e.seed);r.rear=e.rear;m.current=null;
   const rear=m.rearProjection;m.rearProjection=()=>e.rear;
   m.legacy.applyDamageEvent(m.actor,e.ev);r.legacy.applyDamageEvent(r.actor,e.ev);m.rearProjection=rear;
  }r.rear=null;
  for(let i=1;i<=3600;i++){const t=(f.startTick+i)*(1/60);m.tick(1/60,t);r.tick(1/60,t);if(i%60===0)assert.deepEqual(medicalObservation(m.actor,i/60),JSON.parse(JSON.stringify(medicalObservation(r.actor,i/60))),f.name+' '+i/60);}
  assert.equal(m.seed,r.seed);assert.equal(m.actor.medical.pain,0);assert.ok(Object.values(m.actor.medical.bodyParts).some(p=>p.pain>0),'original part pain does not automatically decay');
  assert.equal(m.actor.suppression,0);assert.equal(m.actor.stoppingTimer,0);assert.equal(m.actor.impactKnockdownTimer||0,0);
 }
});
