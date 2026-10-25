import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {migrationSession} from './migration-session.mjs';
const out='artifacts/qa/medical-overhaul-1';await mkdir(out,{recursive:true});
const report={passed:false,method:'Offline QA bundle, real bare P01 traceShot; scarce3-unit bandage fixture, no normalized injuries. Native PC click / touch selection, cancel and second-instance continuation. Manual fixed medical ticks with RAF disabled; production HTML smoke tested separately.',devices:[]};
for(const viewport of [{width:1280,height:720},{width:844,height:390}]){
 const s=await migrationSession({viewport,hasTouch:viewport.width===844,medicalOverhaul:true});
 try{
  const p=s.page,tap=async sel=>{const e=p.locator(sel).last();await e.scrollIntoViewIfNeeded();await(viewport.width===844?e.tap():e.click());await refresh();};
  const refresh=()=>p.evaluate(()=>{__CQBTest.medicalUI.dirty=true;__CQBTest.medicalUI.update(true);__CQBTest.render(0,1);});
  const shot=await p.evaluate(async()=>{
   const q=__CQBTest;q.settings.sound=false;q.syncPreferences();q.reset();await q.moveCombat();q.physics.relocate({x:40,z:-30});const idle={move:{x:0,y:0},crouch:false,sprint:false,firing:false,firePressed:false};for(let i=0;i<90;i++)q.tick(idle);
   const player=q.combat.player;player.rig.setPose('rest',1);player.sync();q.physics.armorSensors=[];
   const shapes=q.internalWorldShapes(q.physics.internalAnatomies.get('P01'),player.actor),shape=shapes.find(s=>s.id==='left-brachial');
   const point=new q.T.Vector3(...(shape.center||shape.segments[0].a));point.x+=.025;
   const direction=new q.T.Vector3(0,0,-1).applyQuaternion(new q.T.Quaternion().setFromAxisAngle(new q.T.Vector3(0,1,0),player.actor.yaw)),ballistics=q.shotBallistics('545_ps_gs','ak74m'),origin=point.clone().addScaledVector(direction,-.6);origin.y+=4.905*(.6/ballistics.muzzleVelocityMps)**2;
   const trace=q.traceShot(q.physics,origin,direction,ballistics,{shotId:97001,random:()=>.001,simulateFlight:true,maxDistance:1.5,bodyModel:'s2'});q.combat.record({shotId:97001,time:q.combat.clock,origin,direction,ballistics,ammoId:'545_ps_gs',trace});
   const m=player.medical.actor.medical,w=m.wounds.find(w=>w.partKey==='leftArm');if(!w)throw Error('No actual left arm wound');if(m.isUnconscious||m.isDead||m.cardiacArrest)throw Error('Fixture cannot self-treat');
   q.inventory.items.get('medical:bandage').remaining=3;q.command('medical');q.medicalUI.update(true);q.render(0,1);
   return{woundId:w.id,hp:m.bodyParts.leftArm.hp,maxHp:m.bodyParts.leftArm.maxHp,parts:m.wounds.map(w=>w.partKey),injuries:w.s1OrganDamage};
  });
  console.log('bandage UI real shot',viewport.width,shot.hp);
  await tap('#playerGrid [data-item="ifak-01"]');await tap('#playerGrid [data-item="ifak-01"]');
  await tap('.medical-container-window [data-item="medical:bandage"]');await tap(`#medicalWounds [data-select-wound="${shot.woundId}"]`);
  assert.equal(await p.evaluate(()=>__CQBTest.care.active?.remainingSeconds),4);
  await p.evaluate(()=>{const q=__CQBTest;q.care.step(2);const b=q.combat.player.medical;b.tick(2,b.time+2);});await refresh();
  const early=await p.evaluate(()=>{const q=__CQBTest;return{remaining:q.inventory.items.get('medical:bandage').remaining,hp:q.combat.player.medical.actor.medical.bodyParts.leftArm.hp};});assert.equal(early.remaining,3);assert.equal(early.hp,shot.hp);
  await sharp(await p.screenshot()).webp({quality:80}).toFile(`${out}/${viewport.width}-applying.webp`);
  await tap('#medicalCareControls [data-bandage] button:has-text("처치 취소")');assert.equal(await p.evaluate(()=>__CQBTest.care.active),null);
  await tap('#medicalCareControls [data-bandage] button:has-text("처음부터 다시 사용")');assert.equal(await p.evaluate(()=>__CQBTest.care.active.remainingSeconds),4);
  await p.evaluate(()=>{const q=__CQBTest;window.__BandageTemplate=structuredClone(q.inventory.items.get('medical:bandage'));q.care.step(4);const b=q.combat.player.medical;b.tick(4,b.time+4);});await refresh();
  const partial=await p.evaluate(id=>{const q=__CQBTest,m=q.combat.player.medical.actor.medical;return{wound:m.wounds.find(w=>w.id===id).bandageRepair,remainingItem:q.inventory.items.has('medical:bandage'),hp:m.bodyParts.leftArm.hp};},shot.woundId);assert.equal(partial.remainingItem,false);assert.ok(partial.wound.workDone>0&&partial.wound.workDone<partial.wound.requiredWork);
  await sharp(await p.screenshot()).webp({quality:80}).toFile(`${out}/${viewport.width}-partial.webp`);
  await p.evaluate(()=>{const q=__CQBTest,item={...window.__BandageTemplate,instanceId:'medical:bandage-next',remaining:100};q.inventory.items.set(item.instanceId,item);q.inventory.changed();q.bag.refresh();});await refresh();
  await tap('.medical-container-window [data-item="medical:bandage-next"]');await tap(`#medicalWounds [data-select-wound="${shot.woundId}"]`);
  await p.evaluate(()=>{const q=__CQBTest;q.care.step(4);const b=q.combat.player.medical;b.tick(4,b.time+4);});await refresh();
  assert.match(await p.locator('#medicalCareControls').innerText(),/겉 지혈 100%/);
  await sharp(await p.screenshot()).webp({quality:80}).toFile(`${out}/${viewport.width}-recovering.webp`);
  const final=await p.evaluate(()=>{const q=__CQBTest,b=q.combat.player.medical,m=b.actor.medical;for(let i=0;i<20000&&m.partRecovery?.leftArm?.active;i++)b.tick(1/60,b.time+1/60);return{hp:m.bodyParts.leftArm.hp,maxHp:m.bodyParts.leftArm.maxHp,bloodMl:m.bloodMl,recovery:m.partRecovery.leftArm,treatments:q.care.snapshot(),remaining:q.inventory.items.get('medical:bandage-next')?.remaining};});
  assert.equal(final.hp,final.maxHp);assert.equal(final.maxHp,shot.maxHp);await refresh();assert.match(await p.locator('#medicalCareControls').innerText(),/회복 완료/);
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await sharp(await p.screenshot()).webp({quality:80}).toFile(`${out}/${viewport.width}-recovered.webp`);
  report.devices.push({viewport,shot,early,partial,final,overflow});console.log('bandage UI passed',viewport.width);
 }finally{await s.close();}
}
report.passed=true;await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');
