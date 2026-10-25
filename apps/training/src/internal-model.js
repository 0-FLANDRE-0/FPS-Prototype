import {Group,Mesh,MeshBasicMaterial,SphereGeometry,CylinderGeometry,Vector3,Matrix4,Quaternion,BufferGeometry,Float32BufferAttribute,DoubleSide,Sprite,SpriteMaterial,CanvasTexture,SRGBColorSpace} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {actorRotation,BODY_PROFILE} from './human-targets.js';
const V=a=>new Vector3(...a);
// Display-only tuning: this bounds debug geometry, never the clinical samples.
export const WOUND_CHANNEL_DEBUG=Object.freeze({maxSamples:96,ringSides:8,
 permanent:Object.freeze({color:0x31e6dd,opacity:.86}),temporary:Object.freeze({color:0xff982f,opacity:.14}),fragment:Object.freeze({color:0xbd75ff,opacity:.24})});
const partBones={head:'head',neck:'neck',chest:'chest',abdomen:'spine',leftArm:'leftUpperArm',rightArm:'rightUpperArm',leftLeg:'leftUpperLeg',rightLeg:'rightUpperLeg'};
const partLabels={head:'머리',neck:'목',chest:'흉부',abdomen:'복부',leftArm:'왼팔',rightArm:'오른팔',leftLeg:'왼다리',rightLeg:'오른다리'};
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const radiusKeys={permanent:'permanentRadiusM',temporary:'temporaryRadiusM',fragment:'fragmentRadiusM'};
function boneWorld(actor,anatomy,bone){
 const world=new Matrix4().makeRotationFromQuaternion(actorRotation(actor)).setPosition(V(actor.at)),joint=anatomy.rig.byName.get(bone);
 return joint?world.multiply(joint.matrixWorld):world;
}
function releaseChannels(group){group.traverse(node=>{node.geometry?.dispose();if(node.material){node.material.map?.dispose();node.material.dispose();}});group.clear();}
// A contiguous depth bucket keeps its maximum measured radius. Decimation is
// only a conservative visual envelope; wound volumes use all original steps.
function displaySpans(steps,count){
 const spans=[];for(let i=0;i<count;i++){
  const start=Math.floor(i*steps.length/count),end=Math.floor((i+1)*steps.length/count),bucket=steps.slice(start,end);
  const span={from:bucket[0].depthM,to:bucket.at(-1).depthM+bucket.at(-1).dxM};
  for(const key of Object.values(radiusKeys))span[key]=Math.max(0,...bucket.map(s=>Number.isFinite(s[key])?s[key]:0));
  spans.push(span);
 }return spans;
}
function tubePositions(output,origin,direction,inverse,from,to,radius){
 if(!(radius>0)||!(to>from))return;
 const a=origin.clone().addScaledVector(direction,from).applyMatrix4(inverse),b=origin.clone().addScaledVector(direction,to).applyMatrix4(inverse);
 const axis=Math.abs(direction.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),u=new Vector3().crossVectors(direction,axis).normalize().transformDirection(inverse).multiplyScalar(radius),v=new Vector3().crossVectors(direction,axis).normalize().cross(direction).normalize().transformDirection(inverse).multiplyScalar(radius);
 const ring=Array.from({length:WOUND_CHANNEL_DEBUG.ringSides},(_,i)=>u.clone().multiplyScalar(Math.cos(i*Math.PI*2/WOUND_CHANNEL_DEBUG.ringSides)).addScaledVector(v,Math.sin(i*Math.PI*2/WOUND_CHANNEL_DEBUG.ringSides)));
 const push=(p,offset=null)=>{output.push(p.x+(offset?.x||0),p.y+(offset?.y||0),p.z+(offset?.z||0));};
 for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;
  push(a,ring[i]);push(b,ring[i]);push(b,ring[j]);push(a,ring[i]);push(b,ring[j]);push(a,ring[j]);
  push(a);push(a,ring[j]);push(a,ring[i]);push(b);push(b,ring[i]);push(b,ring[j]);
 }
}
function multiplierLabel(part,m){
 if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=320;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='rgba(8,16,25,.85)';ctx.fillRect(0,0,320,64);ctx.fillStyle='#a5fffa';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${partLabels[part]||part}  m=${m.toFixed(3)}`,160,32);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;const label=new Sprite(new SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));label.name=`wound multiplier ${part}`;label.scale.set(.36,.072,1);label.renderOrder=24;return label;
}
export function createInternalRegions(scene,physics){
 const root=new Group(),entries=[];root.name='internal diagnostic regions';root.visible=false;scene.add(root);
 const channelRoot=new Group();channelRoot.name='last wound channels';root.add(channelRoot);let channels=[],channelGroups=[],channelDirty=false,sampleCount=0;
 for(const [actorId,anatomy]of physics.internalAnatomies){const actor=physics.internalActors.get(actorId);
  for(const shape of anatomy.shapes){let geometry;
   if(shape.type==='capsuleChain'){
    const parts=[];for(const segment of shape.segments){const a=V(segment.a),b=V(segment.b),delta=b.clone().sub(a),length=delta.length();
     const cylinder=new CylinderGeometry(segment.radius,segment.radius,length,6,1);cylinder.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()));cylinder.translate(...a.clone().lerp(b,.5).toArray());parts.push(cylinder);
     for(const point of [a,b]){const sphere=new SphereGeometry(segment.radius,6,4);sphere.translate(...point.toArray());parts.push(sphere);}
    }geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
   }else{geometry=new SphereGeometry(1,12,8);const matrix=new Matrix4().makeBasis(...shape.axes.map(V));matrix.scale(V(shape.radii));matrix.setPosition(V(shape.center));geometry.applyMatrix4(matrix);}
   const color=shape.kind==='bone'?0xeeeecc:shape.kind==='organ'?0xb977ff:shape.vesselKind==='artery'?0xff4343:0x3377ff;
   const material=new MeshBasicMaterial({color,transparent:true,opacity:.24,depthTest:false,depthWrite:false}),mesh=new Mesh(geometry,material);mesh.name=shape.id;mesh.renderOrder=20;mesh.matrixAutoUpdate=false;root.add(mesh);entries.push({mesh,shape,actor,anatomy,color});
  }
 }
 function drawChannels(){
  releaseChannels(channelRoot);channelGroups=[];sampleCount=0;channelDirty=false;
  for(let i=0;i<channels.length;i++){
   const channel=channels[i],remaining=channels.length-i,count=Math.min(channel.steps.length,Math.max(1,Math.floor((WOUND_CHANNEL_DEBUG.maxSamples-sampleCount)/remaining))),spans=displaySpans(channel.steps,count);sampleCount+=count;
   let row=channelGroups.find(r=>r.actor===channel.actor&&r.bone===channel.bone);
   if(!row){const group=new Group();group.name=`wound channels ${channel.actor.id}:${channel.bone}`;group.matrixAutoUpdate=false;channelRoot.add(group);row={group,actor:channel.actor,anatomy:channel.anatomy,bone:channel.bone,positions:{permanent:[],temporary:[],fragment:[]}};channelGroups.push(row);}
   for(const [kind,key]of Object.entries(radiusKeys))for(const span of spans)tubePositions(row.positions[kind],channel.origin,channel.direction,channel.inverse,span.from,span.to,span[key]);
   const label=multiplierLabel(channel.bodyPart,channel.damageMultiplier);if(label){label.position.copy(channel.origin).addScaledVector(channel.direction,(spans[0].from+spans.at(-1).to)/2).applyMatrix4(channel.inverse);label.position.y+=.045;row.group.add(label);}
  }
  for(const row of channelGroups)for(const [kind,positions]of Object.entries(row.positions))if(positions.length){
   const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)),mesh=new Mesh(geometry,new MeshBasicMaterial({...WOUND_CHANNEL_DEBUG[kind],transparent:true,depthTest:false,depthWrite:false,side:DoubleSide}));
   mesh.name=`${kind} wound cavity`;mesh.renderOrder=kind==='permanent'?23:kind==='fragment'?22:21;mesh.frustumCulled=false;row.group.add(mesh);
  }
 }
 function rememberChannels(trace,records){
  if(!trace){channels=[];channelDirty=false;sampleCount=0;releaseChannels(channelRoot);channelGroups=[];return;}
  const targetIds=new Set(physics.internalActors.keys()),scopedRecords=(records||[]).map(record=>record.metadata||record).filter(record=>targetIds.has(record.address?.targetId||record.targetId));
  const touched=scopedRecords.length||(trace.bodyHits||[]).some(hit=>targetIds.has(hit.targetId))||(trace.armorResults||[]).some(hit=>targetIds.has(hit.targetId));
  if(!touched)return;channels=[];
  for(const record of scopedRecords){const c=record.woundChannel,targetId=record.address?.targetId||record.targetId,actor=physics.internalActors.get(targetId),anatomy=physics.internalAnatomies.get(targetId);
   if(!c||!actor||!anatomy||!finitePoint(c.origin)||!finitePoint(c.direction)||!Number.isFinite(c.damageMultiplier))continue;
   const steps=(c.steps||[]).filter(s=>Number.isFinite(s.depthM)&&Number.isFinite(s.dxM)&&s.dxM>0);if(!steps.length)continue;
   const direction=V(c.direction);if(direction.lengthSq()<1e-12)continue;direction.normalize();
   const bone=record.address?.bone||BODY_PROFILE.find(s=>s.id===record.address?.shapeId)?.bone||partBones[c.bodyPart||record.bodyPart];if(!bone||!anatomy.rig.byName.has(bone))continue;
   channels.push({actor,anatomy,bone,bodyPart:c.bodyPart||record.bodyPart,damageMultiplier:c.damageMultiplier,origin:V(c.origin),direction,inverse:boneWorld(actor,anatomy,bone).invert(),steps});
   if(channels.length===WOUND_CHANNEL_DEBUG.maxSamples)break;
  }
  channelDirty=true;if(root.visible)drawChannels();else{releaseChannels(channelRoot);channelGroups=[];sampleCount=0;}
 }
 function syncPose(){for(const e of entries){e.mesh.matrix.copy(boneWorld(e.actor,e.anatomy,e.shape.bone));e.mesh.matrixWorldNeedsUpdate=true;}
  if(root.visible&&channelDirty)drawChannels();for(const e of channelGroups){e.group.matrix.copy(boneWorld(e.actor,e.anatomy,e.bone));e.group.matrixWorldNeedsUpdate=true;}}
 syncPose();
 return {root,entries,syncPose,setVisible(value){root.visible=!!value;syncPose();},highlight(trace,records=null){const ids=new Set((trace?.bodyHits||[]).flatMap(b=>(b.internalHits||[]).map(h=>h.id)));for(const e of entries){e.mesh.material.color.setHex(ids.has(e.shape.id)?0xffff00:e.color);e.mesh.material.opacity=ids.has(e.shape.id)?.80:.24;}rememberChannels(trace,records);if(root.visible)syncPose();},
  woundSnapshot:()=>({sampleCount,maximumSamples:WOUND_CHANNEL_DEBUG.maxSamples,displaySampling:'maximum-radius envelope of contiguous depth buckets',channels:channels.map(c=>({targetId:c.actor.id,bodyPart:c.bodyPart,bone:c.bone,damageMultiplier:c.damageMultiplier,clinicalStepCount:c.steps.length}))}),
  dispose(){root.removeFromParent();releaseChannels(channelRoot);channels=[];channelGroups=[];for(const e of entries){e.mesh.geometry.dispose();e.mesh.material.dispose();}}};
}
