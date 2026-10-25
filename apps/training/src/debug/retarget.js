import { AnimationClip, AnimationMixer, BufferGeometry, Matrix4, MeshBasicMaterial, Quaternion, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { retargetClip } from 'three/addons/utils/SkeletonUtils.js';
import { SOLDIER_BONES } from '../soldier-rig.js';
export const MIXAMO_TO_V9 = Object.freeze({
 'mixamorig:Hips':'pelvis','mixamorig:Spine':'spine','mixamorig:Spine2':'chest','mixamorig:Neck':'neck','mixamorig:Head':'head',
 ...Object.fromEntries(['Left','Right'].flatMap(side=>Object.entries({Shoulder:'Clavicle',Arm:'UpperArm',ForeArm:'Forearm',Hand:'Hand',UpLeg:'UpperLeg',Leg:'LowerLeg',Foot:'Foot',ToeBase:'Toes'})
  .map(([from,to])=>[`mixamorig:${side}${from}`,side.toLowerCase()+to])))
});
const key=name=>name.replaceAll(':','').replace(/_\d+$/,'');
export function auditBoneMap(skeleton){
 const rows=SOLDIER_BONES.map(b=>{const mixamo=Object.keys(MIXAMO_TO_V9).find(k=>MIXAMO_TO_V9[k]===b.name)||null;
  const matches=mixamo?skeleton.bones.filter(s=>key(s.name)===key(mixamo)):[];
  if(mixamo&&matches.length!==1)throw Error(`Expected unique Mixamo joint ${mixamo}, found ${matches.length}`);
  return {v9:b.name,v9Parent:b.parent,mixamo,sourceName:matches[0]?.name||null,sourceParent:matches[0]?.parent?.name||null,
   role:mixamo?'mapped':b.name==='root'?'placement-only':'parent-following helper'};
 });return rows;
}
// Test-only GLB loading: retain the original skeleton/animation/accessors, remove
// rendered meshes and images before parsing. No texture decode, network or output GLB.
export async function loadRigOnlyGLB(buffer,clipName='Idle_Animation'){
 const data=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(view.getUint32(0,true)!==0x46546c67)throw Error('Expected GLB');
 const jsonLength=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(data.subarray(20,20+jsonLength)));
 const skin=json.skins?.[0];if(!skin)throw Error('No source skin');
 for(const n of json.nodes){delete n.mesh;delete n.skin;}
 json.meshes=[];json.materials=[];json.images=[];json.textures=[];json.samplers=[];
 const encoded=new TextEncoder().encode(JSON.stringify(json)),padded=new Uint8Array(Math.ceil(encoded.length/4)*4);padded.fill(32);padded.set(encoded);
 const binaryChunk=data.subarray(20+jsonLength),glb=new Uint8Array(20+padded.length+binaryChunk.length),dv=new DataView(glb.buffer);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,glb.length,true);dv.setUint32(12,padded.length,true);dv.setUint32(16,0x4e4f534a,true);
 glb.set(padded,20);glb.set(binaryChunk,20+padded.length);
 const gltf=await new GLTFLoader().parseAsync(glb.buffer,''),bones=await Promise.all(skin.joints.map(i=>gltf.parser.getDependency('node',i)));
 gltf.scene.updateMatrixWorld(true);const inverse=skin.inverseBindMatrices!==undefined?await gltf.parser.getDependency('accessor',skin.inverseBindMatrices):null;
 const skeleton=new Skeleton(bones,inverse?bones.map((_,i)=>new Matrix4().fromArray(inverse.array,i*16)):undefined);
 gltf.scene.skeleton=skeleton;
 const original=gltf.animations.find(c=>c.name===clipName);if(!original)throw Error(`Missing ${clipName}`);
 const clip=new AnimationClip(original.name,original.duration,original.tracks.filter(t=>bones.some(b=>t.name.startsWith(b.name+'.'))));
 return {root:gltf.scene,skeleton,clip,originalTrackCount:original.tracks.length,
   originalChannelCount:json.animations.find(a=>a.name===clipName).channels.length,json};
}
export function retargetMixamoIdle(rig,source,{fps=30}={}){
 const mapping=auditBoneMap(source.skeleton),names=Object.fromEntries(mapping.filter(r=>r.mixamo).map(r=>[r.v9,r.sourceName]));
 rig.setPose('standing');rig.setPose('rest');source.root.updateMatrixWorld(true);
 const target=new SkinnedMesh(new BufferGeometry(),new MeshBasicMaterial());target.add(rig.root);target.bindMode='detached';target.bind(rig.skeleton,new Matrix4());
 const offsets={},restSource=new Map(source.skeleton.bones.map(b=>[b.name,{position:b.getWorldPosition(new Vector3()),quaternion:b.getWorldQuaternion(new Quaternion())}]));
 // SkeletonUtils supports explicit localOffsets. Correct the exported bone
 // axes using mapped child directions; do not assume this GLB's initial pose is T.
 for(const row of mapping.filter(r=>r.mixamo)){
  const src=source.skeleton.bones.find(b=>b.name===row.sourceName),dst=rig.byName.get(row.v9);
  const child=mapping.find(r=>r.v9Parent===row.v9&&r.mixamo);
  let rotation=restSource.get(src.name).quaternion.clone().invert().multiply(dst.getWorldQuaternion(new Quaternion()));
  if(child&&row.v9!=='pelvis'&&!/Foot$/.test(row.v9)){
   const targetDir=rig.byName.get(child.v9).getWorldPosition(new Vector3()).sub(dst.getWorldPosition(new Vector3())).normalize();
   const sourceDir=restSource.get(child.sourceName).position.clone().sub(restSource.get(src.name).position).normalize();
   sourceDir.applyQuaternion(restSource.get(src.name).quaternion.clone().invert());
   rotation=new Quaternion().setFromUnitVectors(targetDir,sourceDir);
  }
  offsets[row.v9]=new Matrix4().makeRotationFromQuaternion(rotation);
 }
 const sourceHip=restSource.get(names.pelvis).position.y,scale=.92/sourceHip;
 const clip=retargetClip(target,source.root,source.clip,{names,hip:names.pelvis,scale,localOffsets:offsets,preserveBonePositions:true,fps,useFirstFramePosition:false});
 target.remove(rig.root);target.geometry.dispose();target.material.dispose();
 const restore=()=>{rig.setPose('standing');rig.setPose('rest');};restore();
 // Convert SkeletonUtils' .bones binding to this stable Bone tree for debug playback.
 clip.tracks.forEach(t=>{t.name=t.name.replace(/^\.bones\[([^\]]+)\]/,'$1');});
 const hipTrack=clip.tracks.find(t=>t.name==='pelvis.position'),first=Array.from(hipTrack.values.slice(0,3));
 for(let i=0;i<hipTrack.values.length;i+=3){hipTrack.values[i]-=first[0];hipTrack.values[i+1]+=.92-first[1];hipTrack.values[i+2]-=first[2];}
 const grounded=groundIdleClip(rig,clip,fps);
 if(clip.tracks.some(t=>Array.from(t.values).some(v=>!Number.isFinite(v))))throw Error('Non-finite retarget samples');
 return {clip:grounded,mapping,method:'SkeletonUtils.retargetClip + bone-local rest direction offsets + stationary idle foot IK',scale,restore};
}
function groundIdleClip(rig,clip,fps){
 const mixer=new AnimationMixer(rig.root);mixer.clipAction(clip).play();
 const rows=rig.bones.map(b=>({bone:b,times:[],positions:[],rotations:[]})),anchors={};
 const frames=Math.max(2,Math.round(clip.duration*fps));
 for(let i=0;i<=frames;i++){
  const time=i*clip.duration/frames;mixer.setTime(Math.min(time,clip.duration-1e-6));rig.root.updateMatrixWorld(true);
  for(const side of ['left','right'])if(!anchors[side]){const foot=rig.byName.get(side+'Foot').getWorldPosition(new Vector3());foot.y=.17;anchors[side]=foot;}
  // Different limb lengths need an explicit stationary-idle plant. It is a
  // debug adapter constraint, not source animation data or a general gait solver.
  for(const side of ['left','right']){
   const start=rig.byName.get(side+'UpperLeg').getWorldPosition(new Vector3()),target=anchors[side];
   const a=rig.byName.get(side+'LowerLeg').position.length(),b=rig.byName.get(side+'Foot').position.length(),horizontal=Math.hypot(start.x-target.x,start.z-target.z);
   const top=target.y+Math.sqrt(Math.max(0,(a+b-.001)**2-horizontal**2));
   if(start.y>top){rig.byName.get('pelvis').position.y-=start.y-top;rig.root.updateMatrixWorld(true);}
  }
  for(const side of ['left','right']){rig.solveChain(side+'UpperLeg',side+'LowerLeg',side+'Foot',anchors[side],new Vector3(0,0,1));rig.byName.get(side+'Toes').quaternion.identity();rig.byName.get(side+'KneeCover').quaternion.identity();}
  rig.root.updateMatrixWorld(true);
  for(const r of rows){r.times.push(time);r.bone.position.toArray(r.positions,r.positions.length);r.bone.quaternion.toArray(r.rotations,r.rotations.length);}
 }
 mixer.stopAllAction();mixer.uncacheRoot(rig.root);
 const tracks=rows.flatMap(r=>[new QuaternionKeyframeTrack(r.bone.name+'.quaternion',r.times,r.rotations),...(r.bone.name==='pelvis'?[new VectorKeyframeTrack(r.bone.name+'.position',r.times,r.positions)]:[])]);
 rig.setPose('standing');rig.setPose('rest');return new AnimationClip(clip.name+'-v9-debug-idle',clip.duration,tracks);
}
export function debugRetargetPlayer(rig,clip){
 const mixer=new AnimationMixer(rig.root),action=mixer.clipAction(clip);action.play();
 return {sample(time){mixer.setTime(time);rig.root.updateMatrixWorld(true);rig.skeleton.update();},dispose(){mixer.stopAllAction();mixer.uncacheRoot(rig.root);rig.setPose('standing');rig.setPose('rest');}};
}
