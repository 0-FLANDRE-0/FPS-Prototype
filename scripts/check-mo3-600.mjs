import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {migrationSession} from './migration-session.mjs';
const out='artifacts/qa/mo3';await mkdir(out,{recursive:true});
const reports=[],hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const weapon of ['m4a1','ak74m']) {
  const s=await migrationSession();
  try {
    const rows=await s.page.evaluate(weapon=>{const q=__CQBTest;q.reset();if(weapon==='ak74m'){q.inventory.primaryId='weapon-02';q.aim.setWeapon('ak74m');}q.settings.sound=false;q.syncPreferences();q.state.phase='active';q.bag.open=false;const rows=[],idle={move:{x:0,y:0},crouch:false,sprint:false,firing:false,firePressed:false};for(let i=0;i<600;i++){q.tick({...idle,firing:i%100===50,firePressed:i%100===50});q.render(0,1,true);rows.push({camera:{p:q.view.camera.position.toArray(),q:q.view.camera.quaternion.toArray(),fov:q.view.camera.fov},muzzle:q.aim.muzzle.toArray(),direction:q.aim.shotPose().direction.toArray(),recoil:q.aim.recoilState.snapshot(),shots:q.state.shots,medical:q.fieldMedical.snapshot()});}return rows;},weapon);
    const file=weapon==='ak74m'?'regression-ak.json.gz':'regression.json.gz';
    const golden=JSON.parse(gunzipSync(await readFile('tests/fixtures/v69/'+file))).runs.find(r=>r.version==='v69').rows;
    const kinetic=rs=>rs.map(({medical,...r})=>r);assert.equal(hash(kinetic(rows)),hash(kinetic(golden)),weapon+' camera, muzzle, direction, recoil');const clinicalKeys=['bloodMl','consciousness','pain','shock','heartRate','breathingEfficiency','isDead','isDowned','isUnconscious'];for(let i=0;i<600;i++)for(const k of clinicalKeys)assert.deepEqual(rows[i].medical.medical[k],golden[i].medical.medical[k],weapon+' healthy numeric clinical '+k);assert.equal(rows.at(-1).shots,6);
    reports.push({weapon,ticks:600,shots:6,kineticExact:true,healthyClinicalKeysExact:true,fullMedicalSchemaIntentionallyChanged:true,sha256:hash(kinetic(rows))});
    console.log('v69 browser exact',weapon);
  } finally {await s.close();}
}
await writeFile(out+'/600-tick.json',JSON.stringify({passed:true,reports},null,2)+'\n');
