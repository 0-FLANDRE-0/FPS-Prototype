import {relaxSoldierHands} from './soldier-grip.js';
import {SOLDIER_FINGERS} from './generated/soldier-fingers.js';
import { Bone, Skeleton, Matrix4, Vector3, Quaternion, Euler } from 'three';

// Authored joints in the source model's normalized 1.8m A pose. No anatomy or
// armor rating is inferred from them. Names form a stable animation contract.
export const SOLDIER_BONES = [
  { name: 'root', parent: null, at: [0,0,0] },
  { name: 'pelvis', parent: 'root', at: [0,.92,0] },
  { name: 'spine', parent: 'pelvis', at: [0,1.08,0] },
  { name: 'chest', parent: 'spine', at: [0,1.34,0] },
  { name: 'neck', parent: 'chest', at: [0,1.52,0] },
  { name: 'head', parent: 'neck', at: [0,1.61,.035] },
  ...[['left',1],['right',-1]].flatMap(([side,s]) => [
    { name: `${side}Clavicle`, parent: 'chest', at: [s*.15,1.44,0] },
    { name: `${side}UpperArm`, parent: `${side}Clavicle`, at: [s*.18,1.435,0] },
    { name: `${side}Forearm`, parent: `${side}UpperArm`, at: [s*.370,1.205,.012] },
    { name: `${side}Hand`, parent: `${side}Forearm`, at: [s*.524,1.0,.017] },
    { name: `${side}UpperLeg`, parent: 'pelvis', at: [s*.09,.89,0] },
    { name: `${side}LowerLeg`, parent: `${side}UpperLeg`, at: [s*.142,.51,-.005] },
    { name: `${side}KneeCover`, parent: `${side}LowerLeg`, at: [s*.142,.51,-.005] },
    { name: `${side}Foot`, parent: `${side}LowerLeg`, at: [s*.183,.17,-.015] },
    { name: `${side}Toes`, parent: `${side}Foot`, at: [s*.233,.055,.165] },
  ]),
];
export const TARGET_POSES = Object.freeze({ rest: 'A 자세', standing: '서기', aim: '조준 자세', crouch: '웅크리기', walk: '제자리 걷기' });
export const BODY_BONES = Object.freeze({ head:'head',neck:'neck',chest:'chest',abdomen:'spine',pelvis:'pelvis',
  ...Object.fromEntries(['left','right'].flatMap(s => [[`${s}-upper-arm`,`${s}UpperArm`],[`${s}-forearm`,`${s}Forearm`],[`${s}-hand`,`${s}Hand`],
    [`${s}-thigh`,`${s}UpperLeg`],[`${s}-lower-leg`,`${s}LowerLeg`],[`${s}-foot`,`${s}Foot`],[`${s}-elbow`,`${s}Forearm`],[`${s}-knee`,`${s}LowerLeg`]])) });
export function armorBone(shape) { return shape.kind==='helmet' ? 'head' : shape.slot==='groin' ? 'pelvis'
  : shape.slot==='shoulder-left' ? 'leftUpperArm' : shape.slot==='shoulder-right' ? 'rightUpperArm' : 'chest'; }
const restPoint = name => new Vector3(...(SOLDIER_BONES.find(b=>b.name===name)||SOLDIER_FINGERS.bones.find(b=>b.name===name)).at);
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth = v => { const t=clamp(v);return t*t*(3-2*t); };
function blend(a,b,t) { const n=smooth(t);return n<=0?[[a,1]]:n>=1?[[b,1]]:[[a,1-n],[b,n]]; }
function along(point,a,b) { const start=restPoint(a),d=restPoint(b).sub(start);return point.clone().sub(start).dot(d)/d.lengthSq(); }
// Body cloth uses blended joints; rigid equipment is assigned separately by the
// asset generator using reviewed connected source components.
export function bodyWeights(point,region=null) {
  const side=point.x>=0?'left':'right',x=Math.abs(point.x),y=point.y;
  if(region==='arm'||(region===null&&y>.885&&x>.075)) {
    const u=`${side}UpperArm`,f=`${side}Forearm`,h=`${side}Hand`;
    const elbow=along(point,u,f);
    if(elbow<.22)return blend('chest',u,(elbow+.22)/.44);
    if(elbow<1.15)return blend(u,f,(elbow-.82)/.36);
    return blend(f,h,(along(point,f,h)-.80)/.20);
  }
  if(y>.96)return [['pelvis',1]];
  const u=`${side}UpperLeg`,l=`${side}LowerLeg`,f=`${side}Foot`;
  if(y>.80)return blend('pelvis',u,(.95-y)/.15);
  if(y>.40&&y<.63&&point.z>.075)return [[`${side}KneeCover`,1]];
  if(y>.40)return blend(u,l,(along(point,u,l)-.82)/.36);
  return blend(l,f,(.29-y)/.045);
}
export function packedWeights(influences) {
  const ids=[0,0,0,0],weights=[0,0,0,0];
  influences.forEach(([name,w],i)=>{ids[i]=SOLDIER_BONES.findIndex(b=>b.name===name);if(ids[i]<0)throw new Error(`Unknown joint ${name}`);weights[i]=w;});
  return { ids,weights };
}
export function createSoldierRig({fingers=true}={}) {
  const definitions=fingers?SOLDIER_BONES.concat(SOLDIER_FINGERS.bones):SOLDIER_BONES;
  const bones=definitions.map(d=>{const b=new Bone();b.name=d.name;return b;}),byName=new Map(bones.map(b=>[b.name,b]));
  for(const d of definitions){const b=byName.get(d.name);b.position.copy(restPoint(d.name));if(d.parent){b.position.sub(restPoint(d.parent));byName.get(d.parent).add(b);}}
  for(const d of definitions){if(!d.worldRestQ)continue;const b=byName.get(d.name),parentQ=b.parent.getWorldQuaternion(new Quaternion());b.position.copy(new Vector3(...d.at).sub(new Vector3(...definitions.find(p=>p.name===d.parent).at)).applyQuaternion(parentQ.clone().invert()));b.quaternion.copy(parentQ.invert().multiply(new Quaternion(...d.worldRestQ)));b.updateMatrixWorld(true);}
  const root=byName.get('root');root.updateMatrixWorld(true);
  const rest=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  const inverses=bones.map(b=>b.matrixWorld.clone().invert()),skeleton=new Skeleton(bones,inverses);
  let pose='rest',time=0;
  const rotate=(name,x=0,y=0,z=0)=>byName.get(name).quaternion.setFromEuler(new Euler(x,y,z,'YXZ'));
  function solveChain(upperName,lowerName,endName,target,pole) {
    root.updateMatrixWorld(true);
    const upper=byName.get(upperName),lower=byName.get(lowerName),end=byName.get(endName),start=upper.getWorldPosition(new Vector3()),axis=target.clone().sub(start),distance=axis.length();axis.normalize();
    const a=restPoint(lowerName).distanceTo(restPoint(upperName)),b=restPoint(endName).distanceTo(restPoint(lowerName));
    const d=clamp(distance,Math.abs(a-b)+.001,a+b-.001),h=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-h*h));
    const forward=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize(),joint=start.clone().addScaledVector(axis,h).addScaledVector(forward,height);
    const parent=upper.parent.getWorldQuaternion(new Quaternion());
    upper.quaternion.copy(parent.invert().multiply(new Quaternion().setFromUnitVectors(restPoint(lowerName).sub(restPoint(upperName)).normalize(),joint.clone().sub(start).normalize())));
    root.updateMatrixWorld(true);
    const lowerParent=lower.parent.getWorldQuaternion(new Quaternion());
    lower.quaternion.copy(lowerParent.invert().multiply(new Quaternion().setFromUnitVectors(restPoint(endName).sub(restPoint(lowerName)).normalize(),target.clone().sub(joint).normalize())));
    root.updateMatrixWorld(true);end.quaternion.copy(end.parent.getWorldQuaternion(new Quaternion()).invert());
  }
  function solveLeg(side) {solveChain(`${side}UpperLeg`,`${side}LowerLeg`,`${side}Foot`,restPoint(`${side}Foot`),new Vector3(0,0,1));}
  function setPose(id='rest',seconds=0) {
    if(!Object.hasOwn(TARGET_POSES,id))throw new Error(`Unknown target pose: ${id}`);
    if(id===pose&&seconds===time)return false;
    pose=id;time=seconds;
    for(let i=0;i<bones.length;i++){bones[i].position.copy(rest[i].p);bones[i].quaternion.copy(rest[i].q);bones[i].scale.set(1,1,1);}
    if(id!=='rest')for(const [side,s]of[['left',1],['right',-1]])rotate(`${side}UpperArm`,0,0,-s*.62);
    if(id==='aim')for(const[side,s]of[['left',1],['right',-1]]){solveChain(`${side}UpperArm`,`${side}Forearm`,`${side}Hand`,new Vector3(s*.095,1.31,.46),new Vector3(s*.7,-.7,0));const hand=byName.get(`${side}Hand`);hand.quaternion.multiply(new Quaternion().setFromUnitVectors(new Vector3(s*.058,-.106,-.020).normalize(),new Vector3(0,-.1,1).normalize()));}
    if(id==='crouch'){byName.get('pelvis').position.y-=.38;rotate('spine',.18);rotate('chest',-.08);solveLeg('left');solveLeg('right');}
    if(id==='walk') {const phase=seconds*Math.PI*2/1.2;for(const[side,s]of[['left',1],['right',-1]]){const swing=Math.sin(phase)*s;rotate(`${side}UpperLeg`,swing*.35);rotate(`${side}LowerLeg`,Math.max(0,-swing)*.55);rotate(`${side}UpperArm`,-swing*.28,0,-s*.62);rotate(`${side}Forearm`,-.18);root.updateMatrixWorld(true);const foot=byName.get(`${side}Foot`);foot.quaternion.copy(foot.parent.getWorldQuaternion(new Quaternion()).invert());}}
    root.updateMatrixWorld(true);
    for(const side of ['left','right']){const lower=byName.get(`${side}LowerLeg`),upper=byName.get(`${side}UpperLeg`),cover=byName.get(`${side}KneeCover`);
      const rotation=upper.getWorldQuaternion(new Quaternion()).slerp(lower.getWorldQuaternion(new Quaternion()),.5);cover.quaternion.copy(lower.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));}
    if(fingers)relaxSoldierHands({byName,root});root.updateMatrixWorld(true);skeleton.update();return true;
  }
  if(fingers)relaxSoldierHands({byName,root});
  const delta=name=>{const index=definitions.findIndex(b=>b.name===name);if(index<0)throw new Error(`Unknown joint ${name}`);return bones[index].matrixWorld.clone().multiply(inverses[index]);};
  return {root,bones,byName,skeleton,setPose,solveChain,delta,get pose(){return pose;},get time(){return time;},
    snapshot:()=>({pose,time,boneCount:bones.length,joints:bones.map((b,i)=>({name:b.name,parent:definitions[i].parent,rest:definitions[i].at,position:b.getWorldPosition(new Vector3()).toArray(),rotation:b.getWorldQuaternion(new Quaternion()).toArray()}))}),
    dispose:()=>skeleton.dispose()};
}
