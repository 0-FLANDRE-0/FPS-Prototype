import{createScarFPS}from'./scar-fps.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SWITCH_LOWER_S,STOCK_CONTACTS} from './weapon-data.js';
import {worldPosition} from './arm-ik.js';
import {createSharedFPSArms} from './fps-shared-arms.js';
import {createRunPose} from './fps-run-pose.js';
export {solveArm} from './arm-ik.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),M=()=>new T.Matrix4();
export async function createFPSArms(rig){
 const encoded=document.getElementById('fps-data').textContent.trim(),data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),gltf=await new GLTFLoader().parseAsync(data.buffer,''),pack=gltf.scene,attachment=new T.Group();attachment.name='AKAnimationDriver';attachment.matrixAutoUpdate=false;attachment.add(pack);rig.add(attachment);rig.updateMatrixWorld(true);
 const get=name=>{const n=pack.getObjectByName(name.replaceAll('.',''));if(!n)throw Error('FPS joint missing: '+name);return n;};
 const rifle=get('Rif_059'),head=get('Head_Cam_014'),safety=get('Safety_061'),gun=get('Object_97'),spare=get('Object_99'),skin=gun.skeleton,rest=new Map(skin.bones.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 pack.traverse(n=>{if(n.isMesh)n.frustumCulled=false;});const localMatrix=node=>rig.matrixWorld.clone().invert().multiply(node.matrixWorld),restRifle=localMatrix(rifle),restHead=localMatrix(head),sourceRows=['L','R'].map(side=>({side,hand:get(`Hand_${side}_${side==='R'?'037':'016'}`)})),grips=Object.fromEntries(sourceRows.map(r=>[r.side,worldPosition(r.hand).applyMatrix4(rig.matrixWorld.clone().invert())]));
 const mixer=new T.AnimationMixer(pack),clips=Object.fromEntries(gltf.animations.map(c=>[c.name.split('AK_')[1],c])),shot=clips.Shot.clone();shot.name='TriggerOnly';shot.tracks=shot.tracks.filter(t=>/^(Bone_R|Trigger_)/.test(t.name));const actions=Object.fromEntries(Object.entries({...clips,TriggerOnly:shot}).map(([name,clip])=>[name,mixer.clipAction(clip)]));
 const runPose=createRunPose(gltf),shared=await createSharedFPSArms(rig);shared.bindAKSource(sourceRows);const scar=await createScarFPS(rig,shared);let lastTime=0,selector=0,snapshot={};const startSafety=safety.quaternion.clone();
 function reset(){lastTime=selector=0;shared.reset();}
 function render(pose){
  const {inventory,aim,camera,time=0,speed=0,sprint=false,shotAge=100}=pose,id=inventory.weapon?.definitionId||'m4a1',ak=id==='ak74m',action=inventory.action,dt=Math.max(0,time-lastTime);lastTime=time;gun.visible=spare.visible=ak;
  if(scar?.render(pose)){gun.visible=spare.visible=false;snapshot=scar.snapshot();return;}
  if(!ak){gun.visible=spare.visible=false;shared.render(pose);snapshot=shared.snapshot();return;}
  mixer.stopAllAction();for(const [b,r]of rest){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}for(const a of Object.values(actions)){a.play();a.setEffectiveWeight(0);a.enabled=true;}
  const phase=(aim.gaitPhase/(2*Math.PI))%1,walking=T.MathUtils.clamp(speed/2.7,0,1),run=(aim.sprintPose??0)*walking;let mode='Idle',sampleTime=time%clips.Idle.duration;
  const reloading=action&&['reload','insert','remove'].includes(action.kind);
  if(action?.kind==='switch'){mode=action.switched?'Draw':'Hide';sampleTime=Math.min(clips.Draw.duration-1e-6,action.switched?action.elapsed-(action.lowerDuration??SWITCH_LOWER_S):Math.max(0,clips.Draw.duration-action.elapsed));}
  else if(reloading){mode=action.animation.clip;sampleTime=Math.min(clips[mode].duration-1e-6,action.elapsed+action.animation.sourceStart);}
  else{actions.Idle.time=sampleTime;actions.Idle.setEffectiveWeight(1-walking);actions.Walk.time=phase*clips.Walk.duration;actions.Walk.setEffectiveWeight(walking-run);actions.Run.time=phase*clips.Run.duration;actions.Run.setEffectiveWeight(run);mode=run>.001?'Run':walking>.02?'Walk':'Idle';if(mode==='Run')sampleTime=phase*clips.Run.duration;}
  if(reloading||mode==='Draw'||mode==='Hide'){actions[mode==='Hide'?'Draw':mode].time=sampleTime;actions[mode==='Hide'?'Draw':mode].setEffectiveWeight(1);}if(shotAge>=0&&shotAge<clips.Shot.duration){actions.TriggerOnly.time=shotAge;actions.TriggerOnly.setEffectiveWeight(1);}
  mixer.update(0);attachment.matrix.identity();rig.updateMatrixWorld(true);attachment.matrix.copy(restHead.clone().multiply(localMatrix(head).invert()));rig.updateMatrixWorld(true);if(!reloading&&mode!=='Draw'&&mode!=='Hide')attachment.matrix.premultiply(restRifle.clone().multiply(localMatrix(rifle).invert()));rig.updateMatrixWorld(true);
  const desired={safe:-.42,full:0,semi:.22}[inventory.weapon?.fireMode]??0;selector=T.MathUtils.lerp(selector,desired,1-Math.exp(-20*dt));safety.quaternion.copy(startSafety).multiply(Q().setFromAxisAngle(new T.Vector3(1,0,0),selector));spare.visible=Boolean(reloading);if((!inventory.magazine&&!inventory.isDebugWeapon&&!reloading)||action?.kind==='insert')get('Pmag_062').scale.setScalar(0);
  const currentRifle=localMatrix(rifle),gripFrame=currentRifle.clone().multiply(restRifle.clone().invert()),externalHands={};
  for(const {side,hand}of sourceRows){let goal;if(!reloading&&mode!=='Draw'&&mode!=='Hide')goal=grips[side].clone().applyMatrix4(gripFrame).applyMatrix4(rig.matrixWorld);else if(side==='R'&&mode!=='Reload_full')goal=grips.R.clone().applyMatrix4(gripFrame).applyMatrix4(rig.matrixWorld);else goal=worldPosition(hand);externalHands[side]={goal,quaternion:hand.getWorldQuaternion(Q()),sourceHand:hand};}
  shared.render({...pose,externalHands,externalPose:{mode,sourceClip:mode,clipTime:sampleTime,nativeReloadDuration:reloading?clips[mode].duration:null,stockContact:V().fromArray(STOCK_CONTACTS.ak74m).applyMatrix4(gripFrame).applyMatrix4(rig.matrixWorld)}});rig.updateMatrixWorld(true);skin.update();snapshot={...shared.snapshot(),selectorAngle:selector,shotTracks:shot.tracks.map(t=>t.name),rifleFrame:currentRifle.toArray()};
 }
 return{render,reset,gun,pack,scar,arms:shared.meshes[0],shared,m4:shared,rifle,head,grips,restRifle,runPose,snapshot:()=>snapshot};
}
