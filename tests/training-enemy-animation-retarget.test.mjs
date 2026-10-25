import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationClip,AnimationMixer,Quaternion,QuaternionKeyframeTrack,VectorKeyframeTrack,Vector3} from 'three';
import {createSoldierRig,SOLDIER_BONES} from '../apps/training/src/soldier-rig.js';
import {generateEnemyAnimations,unzipEntries,parseFBX,retargetReference,retargetClip,compactClipJSON,readBootSoles,ENEMY_BONE_MAP} from '../scripts/training-enemy-animations.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=await readFile(new URL('../apps/training/assets/source/Mixamo_Rifle_Anims.zip',import.meta.url)),entries=unzipEntries(source);
const referenceScene=parseFBX(entries.get('Mixamo_Rifle_Anims/X Bot.fbx')),reference=retargetReference(referenceScene);
const asset=await generateEnemyAnimations();
function sample(clip,t=0,rig=createSoldierRig()){const mixer=new AnimationMixer(rig.root),a=mixer.clipAction(clip).play();a.time=t;mixer.update(0);rig.root.updateMatrixWorld(true);return{rig,mixer};}
function restScene(){const scene=parseFBX(entries.get('Mixamo_Rifle_Anims/X Bot.fbx'));scene.animations=[new AnimationClip('exact-source-reference',1,[...reference.rest].map(([name,r])=>new QuaternionKeyframeTrack(name+'.quaternion',[0],r.q.toArray())).concat([new VectorKeyframeTrack('mixamorigHips.position',[0],reference.rest.get('mixamorigHips').p.toArray())]))];return scene;}
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('all 55 eligible source clips load, including the three FBX7700 long-footer files',()=>{
 assert.equal([...entries.keys()].filter(n=>n.endsWith('.fbx')).length,65);
 assert.equal(asset.clips.length,55);assert.equal(asset.meta.excluded.length,9);
 for(const n of ['fire_single_stand','walk_alt','strafe_left','reload_stand','reload_kneel'])assert.ok(asset.clips.find(c=>c.name===n));
 assert.ok(asset.clips.every(c=>! /^(death|jump)\b/.test(c.name)));
 assert.equal(asset.meta.sourceUniqueBones,65);assert.equal(asset.meta.sourceBytes,5272852);
 assert.equal(asset.meta.sourceSHA256,sha(source));
});

test('T-rest correction aligns actual A-bind upper-arm and leg segments with X Bot T-rest',()=>{
 const {clip}=retargetClip(restScene(),reference,'rest-reference-test'),{rig}=sample(clip);
 const point=n=>rig.byName.get(n).getWorldPosition(new Vector3());
 for(const side of ['left','right'])for(const [a,b]of [['UpperArm','Forearm'],['Forearm','Hand'],['UpperLeg','LowerLeg'],['LowerLeg','Foot']]){
  const out=point(side+b).sub(point(side+a)).normalize(),start=reference.rest.get('mixamorig'+ENEMY_BONE_MAP[side+a]).worldP,end=reference.rest.get('mixamorig'+ENEMY_BONE_MAP[side+b]).worldP;
  assert.ok(out.angleTo(end.clone().sub(start).normalize())<1e-5,side+a+' segment does not match source rest direction');
 }
 // Plain quaternion copies would leave the original diagonal A-pose arms.
 assert.ok(Math.abs(point('leftForearm').y-point('leftUpperArm').y)<1e-5);
 assert.ok(Math.abs(point('rightForearm').y-point('rightUpperArm').y)<1e-5);
});

test('source Spine1 rotation is retained in chest while the original spine mapping stays independent',()=>{
 const scene=restScene(),base=retargetClip(scene,reference,'base').clip;
 const original=scene.animations[0],sourceTrack=original.tracks.find(t=>t.name==='mixamorigSpine1.quaternion'),q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.2).multiply(new Quaternion().fromArray(sourceTrack.values));
 scene.animations=[new AnimationClip('spine-chain-test',original.duration,original.tracks.map(t=>t===sourceTrack?new QuaternionKeyframeTrack(t.name,[0],q.toArray()):t))];
 const changed=retargetClip(scene,reference,'changed').clip,a=sample(base).rig,b=sample(changed).rig;
 assert.ok(a.byName.get('spine').quaternion.clone().normalize().angleTo(b.byName.get('spine').quaternion.clone().normalize())<1e-6);
 assert.ok(a.byName.get('chest').getWorldQuaternion(new Quaternion()).angleTo(b.byName.get('chest').getWorldQuaternion(new Quaternion()))>.19);
});

test('Hips horizontal motion is removed, exact source vertical bob and measured scaled cycle speed survive',()=>{
 const scene=parseFBX(entries.get('Mixamo_Rifle_Anims/pro_rifle_pack/walk forward.fbx')),raw=scene.animations[0],{clip,metadata}=retargetClip(scene,reference,'walk forward'),p=clip.tracks.find(t=>t.name==='pelvis.position'),src=raw.tracks.find(t=>t.name==='mixamorigHips.position'),interpolate=src.createInterpolant();
 assert.ok(src.values.at(-1)-src.values[2]>190);
 for(let i=0;i<p.times.length;i++){const s=interpolate.evaluate(p.times[i]);assert.equal(p.values[i*3],0);assert.equal(p.values[i*3+2],0);close(p.values[i*3+1],reference.targetHipsRestY+(s[1]-reference.sourceHipsRestY)*.01*reference.legScale);}
 assert.ok(metadata.verticalMaxM-metadata.verticalMinM>.01);
 const first=new Vector3().fromArray(src.values),last=new Vector3().fromArray(src.values,src.values.length-3);first.y=last.y=0;
 close(metadata.sourceRawSpeedMps,last.distanceTo(first)*.01/raw.duration);close(metadata.sourceSpeedMps,metadata.sourceRawSpeedMps*reference.legScale);
 assert.ok(metadata.sourceSpeedMps>1.57&&metadata.sourceSpeedMps<1.59);
});

test('all 32 movement directions agree with measured original horizontal Hips displacement',()=>{
 let count=0;for(const m of Object.values(asset.meta.metadata))if(m.movementAngleRad!==null){assert.ok(Math.abs(Math.atan2(Math.sin(m.sourceMovementAngleRad-m.movementAngleRad),Math.cos(m.sourceMovementAngleRad-m.movementAngleRad)))<.01,m.name);count++;}
 assert.equal(count,32);
 for(const name of ['turn 90 left','turn 90 right'])close(Math.abs(asset.meta.metadata[name].rootYawDeltaRad),Math.PI/2,.001);
});

test('24 structural skeleton, all 30 fixed finger locals and existing soldier source bytes are untouched',async()=>{
 const paths=['apps/training/assets/soldier-character.glb','apps/training/src/generated/soldier-fingers.js','apps/training/src/generated/soldier-ak-grip.js','docs/soldier-finger-layout.json'];
 const before=await Promise.all(paths.map(async p=>sha(await readFile(new URL('../'+p,import.meta.url)))));
 const rig=createSoldierRig(),fingers=rig.bones.slice(24).map(b=>({b,p:b.position.toArray(),q:b.quaternion.toArray()})),mixer=new AnimationMixer(rig.root);
 assert.equal(rig.bones.length,54);assert.equal(SOLDIER_BONES.length,24);
 for(const clip of asset.clips){assert.ok(clip.tracks.every(t=>! /Thumb|Index|Middle|Ring|Pinky|\.scale/.test(t.name)));mixer.stopAllAction();const action=mixer.clipAction(clip).play();action.time=clip.duration*.43;mixer.update(0);
  for(const {b,p,q}of fingers){assert.deepEqual(b.position.toArray(),p);assert.deepEqual(b.quaternion.toArray(),q);}}
 assert.deepEqual(await Promise.all(paths.map(async p=>sha(await readFile(new URL('../'+p,import.meta.url))))),before);
});

test('compact clips have deterministic distinct UUIDs and switch correctly in the same actual Three mixer',()=>{
 const compact=asset.clips.map(compactClipJSON);assert.equal(new Set(compact.map(c=>c.uuid)).size,55);
 assert.deepEqual(compactClipJSON(asset.clips[0]),compactClipJSON(asset.clips[0]));
 const rig=createSoldierRig({fingers:false}),mixer=new AnimationMixer(rig.root),clips=compact.map(c=>AnimationClip.parse(c)),heights={};
 for(const name of ['idle','idle aiming','idle crouching','reload_kneel']){mixer.stopAllAction();const clip=clips.find(c=>c.name===name),action=mixer.clipAction(clip).play();action.time=clip.duration*.5;mixer.update(0);heights[name]=rig.byName.get('pelvis').position.y;}
 assert.ok(heights.idle-heights['idle crouching']>.35);assert.ok(heights.idle-heights.reload_kneel>.35);
});

test('build-time leg IK preserves original leg lengths and keeps real boot soles above the floor at sampled source keys',async()=>{
 const soles=readBootSoles(await readFile(new URL('../dist/soldier-fingers.glb',import.meta.url))),rig=createSoldierRig({fingers:false}),mixer=new AnimationMixer(rig.root);
 for(const c of asset.clips){mixer.stopAllAction();const a=mixer.clipAction(c).play(),meta=asset.meta.metadata[c.name];assert.equal(meta.legIK.enabled,true);assert.equal(meta.legIK.unreachableSamples,0);assert.ok(meta.legIK.maxAnkleGoalErrorM<1e-6);
  // Union all generated key times: this verifies the actual Three FK result,
  // not merely the IK function's requested reach bound.
  const times=[...new Set(c.tracks.flatMap(t=>Array.from(t.times)))];for(const t of times){a.time=Math.min(t,c.duration-1e-7);mixer.update(0);rig.root.updateMatrixWorld(true);
   for(const side of ['left','right']){const p=n=>rig.byName.get(side+n).getWorldPosition(new Vector3()),foot=rig.byName.get(side+'Foot'),q=foot.getWorldQuaternion(new Quaternion()),y=Math.min(...soles[side].map(v=>v.clone().applyQuaternion(q).add(p('Foot')).y));assert.ok(y>=.0028,c.name+' '+side+' boot penetrates at key '+t+': '+y);
    close(p('UpperLeg').distanceTo(p('LowerLeg')),new Vector3(...SOLDIER_BONES.find(b=>b.name===side+'UpperLeg').at).distanceTo(new Vector3(...SOLDIER_BONES.find(b=>b.name===side+'LowerLeg').at)));}}
 }
});

test('between-key real Three FK stays above the floor at120Hz across all55 converted clips',async()=>{
 const soles=readBootSoles(await readFile(new URL('../dist/soldier-fingers.glb',import.meta.url))),rig=createSoldierRig({fingers:false}),mixer=new AnimationMixer(rig.root);
 for(const c of asset.clips){mixer.stopAllAction();const a=mixer.clipAction(c).play();for(let t=0;t<c.duration;t+=1/120){a.time=t;mixer.update(0);rig.root.updateMatrixWorld(true);for(const side of ['left','right']){const b=rig.byName.get(side+'Foot'),p=b.getWorldPosition(new Vector3()),q=b.getWorldQuaternion(new Quaternion()),y=Math.min(...soles[side].map(v=>v.clone().applyQuaternion(q).add(p).y));assert.ok(y>.0009,`${c.name} ${side} boot dips through floor between keys at${t}: ${y}`);}}}
});

test('quaternions stay finite and normalized, no horizontal/scale/finger tracks are smuggled into output',()=>{
 const structural=new Set(SOLDIER_BONES.map(d=>d.name));for(const c of asset.clips){for(const t of c.tracks){const [bone,property]=t.name.split('.');assert.ok(structural.has(bone));assert.ok(property==='quaternion'||t.name==='pelvis.position');assert.ok(Array.from(t.times).every(Number.isFinite));assert.ok(Array.from(t.values).every(Number.isFinite));
   if(property==='quaternion')for(let i=0;i<t.values.length;i+=4)close(Math.hypot(...t.values.slice(i,i+4)),1,2e-6);}}
});
