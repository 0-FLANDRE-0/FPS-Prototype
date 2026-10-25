import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {M4_ATTACHMENTS,SWITCH_LOWER_S,DRAW_S,STOCK_CONTACTS} from './weapon-data.js';
import {worldPosition,setWorldPosition,solveArm,weaponShoulders,reachableHandGoal} from './arm-ik.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
export async function createSharedFPSArms(rig){
 const element=document.getElementById('shared-arms-data');if(!element)return null;
 const data=Uint8Array.from(atob(element.textContent.trim()),c=>c.charCodeAt(0)),gltf=await new GLTFLoader().parseAsync(data.buffer,''),pack=gltf.scene,attachment=new T.Group();
 attachment.name='SharedFPSArms';attachment.matrixAutoUpdate=false;attachment.add(pack);rig.add(attachment);
 const get=name=>{const n=pack.getObjectByName(name.replaceAll('.',''));if(!n)throw Error('M4 arm joint missing: '+name);return n;};
 const meshes=[];pack.traverse(n=>{if(n.isMesh){n.frustumCulled=false;meshes.push(n);}});
 const skins=[...new Set(meshes.map(m=>m.skeleton))],bones=[...new Set(skins.flatMap(s=>s.bones))],rest=new Map(bones.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 const mixer=new T.AnimationMixer(pack),clips=Object.fromEntries(gltf.animations.map(c=>[c.name.split('|')[1],c]));
 const hold=clips.Shoot.clone();hold.name='Hold';
 const actions=Object.fromEntries(Object.entries({...clips,Hold:hold}).map(([name,c])=>[name,mixer.clipAction(c)]));
 actions.Hold.play();actions.Hold.time=0;mixer.update(0);rig.updateMatrixWorld(true);
 const base=get('Base_078'),nativeMag=get('Mag_079'),localMatrix=n=>rig.matrixWorld.clone().invert().multiply(n.matrixWorld),restBase=localMatrix(base),restNativeMag=localMatrix(nativeMag);
 const handRows=[{side:'R',upper:get('UpperArm.R_04'),fore:get('LowerArm.R_05'),hand:get('Hand.R_06'),twists:[30,31,32,33].map((n,i)=>get(`Wrist_${i}.R_0${n}`))},{side:'L',upper:get('UpperArm.L_036'),fore:get('LowerArm.L_037'),hand:get('Hand.L_038'),twists:[62,63,64,65].map((n,i)=>get(`Wrist_${i}.L_0${n}`))}];
 const restHands=Object.fromEntries(handRows.map(r=>[r.side,worldPosition(r.hand).applyMatrix4(rig.matrixWorld.clone().invert())]));
 const calibrations={ak74m:{}};let akCalibration=calibrations.ak74m;
 const palmFrame=(hand,index,middle,pinky)=>{const forward=worldPosition(middle).sub(worldPosition(hand)).normalize(),radial=worldPosition(index).sub(worldPosition(pinky));radial.addScaledVector(forward,-radial.dot(forward)).normalize();return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(radial,forward,radial.clone().cross(forward)));};
 function bindAKSource(sourceRows,weaponId="ak74m"){
  akCalibration=calibrations[weaponId]||={};
  for(const row of handRows){const source=sourceRows.find(r=>r.side===row.side),digits=source.digits||source.hand.children,side=row.side,ids=side==='R'?{Index:[7,8,9,10],Middle:[15,16,17,18],Ring:[20,21,22,23],Pinky:[25,26,27,28],Thumb:[12,13,14]}:{Index:[39,40,41,42],Middle:[47,48,49,50],Ring:[52,53,54,55],Pinky:[57,58,59,60],Thumb:[44,45,46]},names={Index:['Metacarpal_0','Index_0','Index_1','Index_2'],Middle:['Metacarpal_1','Middle_0','Middle_1','Middle_2'],Ring:['Metacarpal_2','Ring_0','Ring_1','Ring_2'],Pinky:['Metacarpal_3','Pinky_0','Pinky_1','Pinky_2'],Thumb:['Thumb_0','Thumb_1','Thumb_2']},target=(digit,k)=>get(`${names[digit][k]}.${side}_0${ids[digit][k]}`),sourceMcp=digits[1].children[0],targetMcp=target('Middle',1),alignment=palmFrame(source.hand,digits[0].children[0],sourceMcp,digits[3].children[0]).multiply(palmFrame(row.hand,target('Index',1),targetMcp,target('Pinky',1)).invert()),sourceQ=source.hand.getWorldQuaternion(Q()),targetQ=row.hand.getWorldQuaternion(Q()),correction=sourceQ.clone().invert().multiply(alignment).multiply(targetQ),offset=worldPosition(sourceMcp).sub(worldPosition(source.hand)).sub(worldPosition(targetMcp).sub(worldPosition(row.hand)).applyQuaternion(alignment)).applyQuaternion(sourceQ.clone().invert()),fingers=[];
   for(const [digit,chain]of Object.entries(ids)){let bone=digits[{Index:0,Middle:1,Ring:2,Pinky:3,Thumb:4}[digit]];for(let k=0;k<chain.length;k++){const t=target(digit,k);let targetRest=targetQ.clone().invert().multiply(t.getWorldQuaternion(Q()));
    if(weaponId==='scar_h'&&bone.children[0]){const targetDirection=t.children[0]?worldPosition(t.children[0]).sub(worldPosition(t)).normalize():new T.Vector3(0,1,0).applyQuaternion(t.getWorldQuaternion(Q())),sourceDirection=worldPosition(bone.children[0]).sub(worldPosition(bone)).normalize().applyQuaternion(alignment.clone().invert()),desired=Q().setFromUnitVectors(targetDirection,sourceDirection).multiply(t.getWorldQuaternion(Q()));targetRest=targetQ.clone().invert().multiply(desired);}
    fingers.push({source:bone,target:t,sourceRest:sourceQ.clone().invert().multiply(bone.getWorldQuaternion(Q())),targetRest});bone=bone.children[0];}}
   akCalibration[side]={correction,offset,fingers};
  }
 }
 function retargetFingers(side,external,handQ){const c=akCalibration[side],sourceQ=external.sourceHand.getWorldQuaternion(Q());for(const f of c.fingers){const relative=sourceQ.clone().invert().multiply(f.source.getWorldQuaternion(Q())),delta=relative.multiply(f.sourceRest.clone().invert()),mapped=c.correction.clone().invert().multiply(delta).multiply(c.correction),desired=handQ.clone().multiply(mapped).multiply(f.targetRest);f.target.quaternion.copy(f.target.parent.getWorldQuaternion(Q()).invert().multiply(desired));f.target.updateMatrixWorld(true);}}
 let magazineFrame=null;
 let snapshot={weaponId:'m4a1',model:'shared-fps-arms'};
 function reset(){snapshot={weaponId:'m4a1',model:'shared-fps-arms'};}
 function setVisible(visible){attachment.visible=visible;}
 function render({inventory,aim,camera,time=0,shotAge=100,m4Root,m4RootRest,m4Magazine,m4MagazineRest,m4Spare,externalHands=null,externalPose=null}){
  const action=inventory.action,id=inventory.weapon?.definitionId||'m4a1';akCalibration=calibrations[id]||calibrations.ak74m;setVisible(Boolean(inventory.weapon));
  // Rebind each absolute sample: IK modifies these same bones, and a repeated
  // render time must not let AnimationMixer's unchanged-value cache skip writes.
  mixer.stopAllAction();
  for(const b of bones){const r=rest.get(b);b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
  let mode='Idle',sourceClip='Hold',sampleTime=0;
  if(externalHands){mode=externalPose.mode;}else if(action?.kind==='switch'){
   mode=action.switched?'Draw':'Hide';sourceClip=action.switched?'Take':'Hide';sampleTime=action.switched?(action.elapsed-(action.lowerDuration??SWITCH_LOWER_S))*clips.Take.duration/(action.drawDuration??DRAW_S):action.elapsed;
  }else if(action&&['reload','insert','remove'].includes(action.kind)){
   mode='Reload';sourceClip='Reload';
   sampleTime=action.animation?action.elapsed+action.animation.sourceStart:clips.Reload.duration*action.elapsed/action.duration;
  }else if(shotAge>=0&&shotAge<clips.Shoot.duration){sourceClip='Shoot';sampleTime=shotAge;}
  if(!externalHands&&!action&&(aim.sprintPose??0)>.001)mode='Run';
  sampleTime=T.MathUtils.clamp(sampleTime,0,actions[sourceClip].getClip().duration-1e-6);actions[sourceClip].play();actions[sourceClip].time=sampleTime;mixer.update(0);
  attachment.matrix.identity();rig.updateMatrixWorld(true);
  const posed=!externalHands&&['Reload','Draw','Hide'].includes(mode),gunFrame=posed?localMatrix(base).multiply(restBase.clone().invert()):new T.Matrix4();
  // Native rifle/camera motion cannot add a second recoil or alter logical aim.
  attachment.matrix.copy(restBase.clone().multiply(localMatrix(base).invert()));rig.updateMatrixWorld(true);
  if(!externalHands&&m4Root){m4Root.matrix.copy(gunFrame).multiply(m4RootRest);rig.updateMatrixWorld(true);}
  const rigQ=rig.getWorldQuaternion(Q()),gunQ=Q().setFromRotationMatrix(gunFrame),worldGunQ=rigQ.clone().multiply(gunQ).multiply(rigQ.clone().invert());
  const bodyFrame=camera?.matrixWorld||new T.Matrix4().compose(aim.eye,Q().setFromEuler(new T.Euler(aim.viewPitch,aim.viewYaw,0,'YXZ')),new T.Vector3(1,1,1));
  const bodyShoulders=weaponShoulders(rig,bodyFrame,id),stockContact=externalPose?.stockContact??V().fromArray(STOCK_CONTACTS.m4a1).applyMatrix4(gunFrame).applyMatrix4(rig.matrixWorld);
  const goals={},errors={},unreachable={},shoulders={},nativeHands={},reachCorrections={};let leftMagazineCorrection=V();
  for(const row of handRows){
   const {side,upper,fore,hand,twists}=row,native=worldPosition(hand).applyMatrix4(rig.matrixWorld.clone().invert());let handQ=hand.getWorldQuaternion(Q()).premultiply(worldGunQ);nativeHands[side]=native.toArray();
   let goal=V().fromArray(M4_ATTACHMENTS[side==='R'?'rightGrip':'leftGrip']);
   if(!externalHands&&side==='L'&&(mode==='Reload'||mode==='Draw'||mode==='Hide'))goal=native.clone().add(V().fromArray(M4_ATTACHMENTS.leftGrip).sub(restHands.L));
   if(!externalHands&&side==='L'&&mode==='Reload'){
    const phase=sampleTime/clips.Reload.duration,contact=T.MathUtils.smoothstep(phase,0,.12)*(1-T.MathUtils.smoothstep(phase,.64,.9)),magOffset=V().fromArray(M4_ATTACHMENTS.magazineWell).sub(V().setFromMatrixPosition(restNativeMag)),holdOffset=V().fromArray(M4_ATTACHMENTS.leftGrip).sub(restHands.L);
    goal.add(magOffset.sub(holdOffset).multiplyScalar(contact));
    if(action.kind==='remove')goal.lerp(V().fromArray(M4_ATTACHMENTS.leftGrip),T.MathUtils.smoothstep(action.elapsed/action.duration,.65,1));
   }
   if(externalHands){const e=externalHands[side],c=akCalibration[side];goal=e.goal.clone().add(c.offset.clone().multiplyScalar(rig.scale.x).applyQuaternion(e.quaternion));handQ=e.quaternion.clone().multiply(c.correction);}else goal.applyMatrix4(gunFrame).applyMatrix4(rig.matrixWorld);
   const shoulder=bodyShoulders[side];setWorldPosition(upper,shoulder);shoulders[side]=shoulder.toArray();
   const requested=goal.clone();goal=reachableHandGoal(upper,fore,hand,goal);const correction=goal.clone().sub(requested);reachCorrections[side]=correction.length();
   if(side==='L'&&mode==='Reload')leftMagazineCorrection.copy(correction);
   unreachable[side]=solveArm(upper,fore,hand,goal,bodyShoulders.poles[side]).unreachableM;
   // Preserve native palm/finger orientation, keeping the hand on the connected
   // forearm chain. Distribute only wrist twist through the authored cuff bones.
   const inherited=hand.getWorldQuaternion(Q()),delta=handQ.clone().multiply(inherited.invert()),axis=worldPosition(hand).sub(worldPosition(fore)).normalize(),dot=delta.x*axis.x+delta.y*axis.y+delta.z*axis.z,twist=Q().set(axis.x*dot,axis.y*dot,axis.z*dot,delta.w).normalize();
   const start=worldPosition(fore),length=start.distanceTo(worldPosition(hand)),twistRows=twists.map(n=>({n,q:n.getWorldQuaternion(Q()),t:T.MathUtils.clamp(worldPosition(n).sub(start).dot(axis)/length,0,1)}));
   for(const r of twistRows){const desired=Q().slerp(twist,r.t).multiply(r.q);r.n.quaternion.copy(r.n.parent.getWorldQuaternion(Q()).invert().multiply(desired));r.n.updateMatrixWorld(true);}
   hand.quaternion.copy(hand.parent.getWorldQuaternion(Q()).invert().multiply(handQ));hand.updateMatrixWorld(true);if(externalHands)retargetFingers(side,externalHands[side],handQ);goals[side]=goal.toArray();errors[side]=worldPosition(hand).distanceTo(goal);
  }
  rig.updateMatrixWorld(true);for(const s of skins)s.update();
  // Retarget the authored magazine motion to the original M4A1 magazine mesh.
  // The outgoing/incoming mesh visibility follows actual inventory ownership.
  if(!externalHands&&m4Magazine){
   if(!magazineFrame){const restLocal=new T.Matrix4().compose(m4MagazineRest,new T.Quaternion(),m4Magazine.scale);magazineFrame=rig.matrixWorld.clone().invert().multiply(m4Magazine.parent.matrixWorld).multiply(restLocal);}
   const moving=mode==='Reload'&&!action.inserted,targetLocal=magazineFrame.clone();
   if(moving){const current=localMatrix(nativeMag),position=V(),rotation=Q(),scale=V(),restPosition=V(),restRotation=Q(),restScale=V(),oldPosition=V(),oldRotation=Q(),oldScale=V();current.decompose(position,rotation,scale);restNativeMag.decompose(restPosition,restRotation,restScale);magazineFrame.decompose(oldPosition,oldRotation,oldScale);targetLocal.compose(oldPosition.add(position.sub(restPosition)),rotation.multiply(restRotation.invert()).multiply(oldRotation),oldScale.multiply(scale.divide(restScale)));}
   const target=rig.matrixWorld.clone().multiply(gunFrame).multiply(targetLocal);if(moving)target.setPosition(V().setFromMatrixPosition(target).add(leftMagazineCorrection));const parentInverse=m4Magazine.parent.matrixWorld.clone().invert();
   parentInverse.multiply(target).decompose(m4Magazine.position,m4Magazine.quaternion,m4Magazine.scale);
   m4Magazine.visible=Boolean(inventory.magazine);m4Spare.visible=Boolean(mode==='Reload'&&action.incomingId&&!action.inserted&&action.removed&&sampleTime/clips.Reload.duration>.24);
   m4Spare.position.copy(m4Magazine.position);m4Spare.quaternion.copy(m4Magazine.quaternion);m4Spare.scale.copy(m4Magazine.scale);
  }
  snapshot={weaponId:id,model:'shared-fps-arms',mode,sourceClip:externalPose?.sourceClip??(sourceClip==='Hold'?'Shoot@0':sourceClip),clipTime:externalPose?.clipTime??sampleTime,nativeReloadDuration:externalPose?.nativeReloadDuration??(mode==='Reload'?clips.Reload.duration:null),inventoryReloadDuration:action?.duration??null,gaitPhase:aim.gaitPhase,sprintPose:aim.sprintPose??0,sprintSource:(aim.sprintPose??0)>.001?'Rig|AK_Run':null,headCameraApplied:false,nativeGunRecoilApplied:false,sourceGunPoseApplied:posed,gunFrame:gunFrame.toArray(),bodyShoulders:shoulders,shoulderSurface:bodyShoulders.surface.toArray(),stockContact:stockContact.toArray(),stockShoulderGapM:stockContact.distanceTo(bodyShoulders.surface),handGoals:goals,handErrorsM:errors,unreachableM:unreachable,reachCorrectionsM:reachCorrections,armsVisible:attachment.visible,nativeHands,connectedHandChains:true};
 }
 return{render,reset,setVisible,bindAKSource,pack,meshes,handRows,attachment,snapshot:()=>snapshot};
}
