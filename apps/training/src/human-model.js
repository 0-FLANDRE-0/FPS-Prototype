import{createEquipmentMeshes}from'./equipment-mesh.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BODY_PROFILE, HUMAN_HEIGHT, HUMAN_TARGETS, shapePose, actorRotation, bodyMesh } from './human-targets.js';
import { BODY_MESH_SOURCE } from './generated/body-mesh.js';
import { createSoldierRig } from './soldier-rig.js';

export async function loadHumanTargets(scene,{rigs=null,targets=HUMAN_TARGETS,source=null,labels=true}={}) {
  let gltf=source;
  if(!gltf){const binary=Uint8Array.from(atob(document.getElementById('soldier-data').textContent.trim()),c=>c.charCodeAt(0));gltf=await new GLTFLoader().parseAsync(binary.buffer,'');}
  const sourceMeshes=[];gltf.scene.traverse(node=>{if(node.isSkinnedMesh)sourceMeshes.push(node);});
  if(sourceMeshes.length!==6||!sourceMeshes.some(m=>m.name.endsWith('TorsoUnderlayer')))throw new Error('Expected five original primitives and the authored inner uniform');
  const actors=new Map(),diagnostic=new T.Group(),skeletons=new T.Group(),ownedRigs=[];
  diagnostic.name='BodyHitRegions';diagnostic.visible=false;scene.add(diagnostic);
  skeletons.name='SoldierSkeletons';skeletons.visible=false;scene.add(skeletons);
  const colors={head:'#edbc78',neck:'#ffb7a1',chest:'#f4e9ad',abdomen:'#e6c374',leftArm:'#59d9ff',rightArm:'#ae9fff',leftLeg:'#63dfb2',rightLeg:'#ff7b9c'};
  for(const actor of targets){
    const rig=rigs?.get(actor.id)||createSoldierRig();if(!rigs)ownedRigs.push(rig);
    const group=new T.Group();group.name=actor.id;group.position.fromArray(actor.at);group.quaternion.copy(actorRotation(actor));
    const equipment=createEquipmentMeshes(sourceMeshes,rig,group);
    scene.add(group);group.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(group),regions=[];
    for(const shape of BODY_PROFILE){const data=bodyMesh(shape),geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(data.vertices,3)).setIndex(new T.BufferAttribute(data.indices,1));
      const material=new T.MeshBasicMaterial({color:colors[shape.part],wireframe:true,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
      const mesh=new T.Mesh(geometry,material);mesh.name=`${actor.id}:${shape.id}`;mesh.renderOrder=10;diagnostic.add(mesh);regions.push({mesh,shape});}
    const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array((rig.bones.length-1)*6),3));
    const joints=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#ff4a52',depthTest:false,transparent:true,opacity:1}));
    joints.name=`${actor.id}:skeleton`;joints.renderOrder=15;joints.position.fromArray(actor.at);joints.quaternion.copy(actorRotation(actor));skeletons.add(joints);
    actors.set(actor.id,{actor,rig,group,equipment,regions,joints,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
    if(labels){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const context=canvas.getContext('2d');context.fillStyle='#172921';context.fillRect(0,0,512,128);
    context.fillStyle='#eee0b3';context.font='bold 46px sans-serif';context.textAlign='center';context.fillText('H01 / 병사 표적',256,56);context.font='24px sans-serif';context.fillText('고정 A 자세 · 피격·방호 확인',256,100);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const sign=new T.Mesh(new T.PlaneGeometry(1.8,.45),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));sign.position.set(0,2.15,0);group.add(sign);
    const line=new T.Mesh(new T.BoxGeometry(1.8,.012,.07),new T.MeshBasicMaterial({color:'#b5a66a'}));line.position.set(actor.at[0],.008,actor.at[2]+7.5);scene.add(line);
    }
  }
  function syncPose(){for(const {actor,rig,regions,joints}of actors.values()){
    rig.root.updateMatrixWorld(true);rig.skeleton.update();
    for(const {mesh,shape}of regions){const pose=shapePose(actor,shape,rig);mesh.position.copy(pose.position);mesh.quaternion.copy(pose.rotation);}
    const buffer=joints.geometry.attributes.position;let i=0;
    for(const bone of rig.bones)if(bone.parent?.isBone){for(const b of[bone.parent,bone]){const p=b.getWorldPosition(new T.Vector3());buffer.setXYZ(i++,p.x,p.y,p.z);}}
    buffer.needsUpdate=true;joints.geometry.computeBoundingSphere();}}
  syncPose();
  return {actors,source:gltf,diagnostic,skeletons,syncPose,setRegionsVisible:visible=>{diagnostic.visible=visible;},setSkeletonVisible:visible=>{skeletons.visible=visible;},
    snapshot:()=>({height:HUMAN_HEIGHT,profile:structuredClone(BODY_PROFILE),meshSource:structuredClone(BODY_MESH_SOURCE),regionsVisible:diagnostic.visible,skeletonVisible:skeletons.visible,
      diagnosticShapes:diagnostic.children.length,targets:[...actors.values()].map(({actor,rig,bounds})=>({...structuredClone(actor),bounds:structuredClone(bounds),boundsMode:'bind-pose',rig:rig.snapshot()}))}),
    dispose:()=>{const geometries=new Set(),materials=new Set(),textures=new Set();
      for(const group of [...actors.values()].map(a=>a.group).concat(diagnostic,skeletons))group.traverse(node=>{if(!node.isMesh&&!node.isLineSegments)return;if(node.userData.m6Part&&!node.userData.m6Authored)return;if(source&&sourceMeshes.some(m=>m.geometry===node.geometry))return;geometries.add(node.geometry);
        for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
      for(const item of[...geometries,...materials,...textures])item.dispose();for(const rig of ownedRigs)rig.dispose();for(const group of [...actors.values()].map(a=>a.group).concat(diagnostic,skeletons))group.removeFromParent();
    }};
}
