// A-1: build-time Mixamo -> original soldier animation-only derivative.
// FBX is never shipped to the browser. Geometry, skin and finger assets are not
// inputs to this writer and cannot be changed by it.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {AnimationClip,Quaternion,Vector3,QuaternionKeyframeTrack,VectorKeyframeTrack} from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {SOLDIER_BONES} from '../apps/training/src/soldier-rig.js';
import {readGLB} from './training-soldier-skin.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const ZIP=new URL('apps/training/assets/source/Mixamo_Rifle_Anims.zip',root);
const MODULE=new URL('apps/training/src/generated/enemy-animations.js',root);
const DATA=new URL('dist/enemy-animation-data.json',root),INFO=new URL('dist/training-enemy-animations-info.json',root);
const BOOTS=new URL('dist/soldier-fingers.glb',root);
const MAP=new URL('docs/enemy-animation-retarget-map.json',root);
const M=.01,Q=()=>new Quaternion(),V=a=>new Vector3(...a);
const at=new Map(SOLDIER_BONES.map(d=>[d.name,V(d.at)]));
export const ENEMY_BONE_MAP=Object.freeze({pelvis:'Hips',spine:'Spine',chest:'Spine2',neck:'Neck',head:'Head',
 ...Object.fromEntries(['left','right'].flatMap(side=>{const s=side==='left'?'Left':'Right';return[['Clavicle','Shoulder'],['UpperArm','Arm'],['Forearm','ForeArm'],['Hand','Hand'],['UpperLeg','UpLeg'],['LowerLeg','Leg'],['Foot','Foot'],['Toes','ToeBase']].map(([a,b])=>[side+a,s+b]);}))});
const endpoint={spine:'chest',chest:'neck',neck:'head',
 ...Object.fromEntries(['left','right'].flatMap(s=>[['Clavicle','UpperArm'],['UpperArm','Forearm'],['Forearm','Hand'],['UpperLeg','LowerLeg'],['LowerLeg','Foot'],['Foot','Toes']].map(([a,b])=>[s+a,s+b])))};
export const ENEMY_RETARGET_POLICY=Object.freeze({version:'mixamo-soldier-animation-v37',sourceUnitM:M,
 rest:'Uploaded X Bot.fbx T pose; target original normalized 1.8m A-pose bind skeleton.',
 rotation:'World rotation delta relative to X Bot T rest, multiplied by shortest-arc target-bind-segment to source-T-segment correction; convert corrected world rotations to target parent locals.',
 spine:'Spine -> spine; cumulative Spine1+Spine2 -> chest. Chest world delta includes both source joints, rather than dropping Spine1.',
 pelvis:'Ankle-landmark calibrated fixed target pelvis baseline + (source animated Hips Y - source X Bot rest Hips Y) * sourceUnitM * target/source leg-length ratio; target X/Z stay at original rest. Baseline = target original ankle Y + scaled source rest Hips-to-ankle vertical distance.',
 legIK:'Build-time two-bone IK: source animated ankle trajectory scaled/recentered at Hips, target original thigh/shin lengths, source knee plane. Original retargeted foot world orientation is retained. Actual immutable target boot-sole geometry supplies floor clearance; unreachable goals are measured, never hidden by moving Hips or changing bones.',
 hands:'Source hand world delta with forearm segment rest correction; no finger track is emitted. Existing fixed AK grip overrides fingers at runtime.',
 kneeCovers:'Original helper rule: midpoint slerp of target upper/lower leg world rotations, converted to lower-leg local frame.',
 heading:'No rotation/root heading is removed; only horizontal Hips translation is removed. Turn rootYawDeltaRad is reported for runtime actor-heading composition.',
 keys:'Original source key times plus60Hz build-time leg IK samples and adaptive midpoint refinement where actual target FK boot clearance is below1mm; times within1microsecond merge to avoid duplicate Float32 times (FBX submicrosecond export noise). No motion key decimation or skin edits. JSON components rounded to seven decimal places (<=5e-8 component error).',
 loaderCompatibility:'Three r180 footer-length heuristic misreads three valid FBX7700 files with 202-byte footer. Build-time parser keeps all original FBX node bytes + terminal null record and supplies 160 ignored footer bytes; original ZIP/FBX are unchanged.',
 classification:'Source = uploaded Adobe Mixamo files/user license statement; original = soldier24 skeleton,54-joint skin and fixed finger assets; tuning = segment frame correspondence/Spine chain collapse.'});

// Read the ZIP central directory (names without UTF-8 flag are immaterial to
// FBX entries; their ASCII paths are exact). No extraction or external process.
export function unzipEntries(bytes){
 const entries=new Map();let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--;
 assert.ok(end>=0,'ZIP end of central directory missing');const count=bytes.readUInt16LE(end+10);let p=bytes.readUInt32LE(end+16);
 for(let i=0;i<count;i++){assert.equal(bytes.readUInt32LE(p),0x02014b50);const method=bytes.readUInt16LE(p+10),size=bytes.readUInt32LE(p+20),raw=bytes.readUInt32LE(p+24),n=bytes.readUInt16LE(p+28),x=bytes.readUInt16LE(p+30),c=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42),name=bytes.subarray(p+46,p+46+n).toString('utf8');
  assert.equal(bytes.readUInt32LE(offset),0x04034b50);const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),compressed=bytes.subarray(start,start+size),data=method===8?inflateRawSync(compressed):method===0?Buffer.from(compressed):null;assert.ok(data,`Unsupported ZIP method ${method}`);assert.equal(data.length,raw);if(!name.endsWith('/'))entries.set(name,data);p+=46+n+x+c;}
 return entries;
}
export function parseFBX(bytes){
 // FBXLoader's footer-size heuristic overruns several uploaded files by one
 // byte. A top-level NULL record is the authoritative end of FBX nodes. Keep
 // every data byte through that record and normalize only ignored footer data.
 const version=bytes.readUInt32LE(23),wide=version>=7500,header=wide?25:13;let p=27;
 while(p+header<=bytes.length){const end=wide?Number(bytes.readBigUInt64LE(p)):bytes.readUInt32LE(p);if(end===0)break;assert.ok(end>p&&end<=bytes.length,'Invalid FBX top-level node offset');p=end;}
 assert.ok(p+header<=bytes.length,'FBX terminal NULL record missing');
 const normalized=Buffer.concat([bytes.subarray(0,p+header),Buffer.alloc(160)]);
 return new FBXLoader().parse(normalized.buffer.slice(normalized.byteOffset,normalized.byteOffset+normalized.byteLength),'');
}
export function referenceBones(scene){
 scene.updateMatrixWorld(true);const bones=new Map();scene.traverse(b=>{if(b.isBone&&!bones.has(b.name))bones.set(b.name,b);});
 // X Bot contains zero-length duplicate NodeAttribute children; the first
 // transform-bearing node is the real animation target, not its namesake child.
 return bones;
}
const sourceName=n=>'mixamorig'+n;
function world(bones,n){const b=bones.get(sourceName(n));assert.ok(b,`Missing source reference bone ${n}`);return{p:b.getWorldPosition(new Vector3()),q:b.getWorldQuaternion(Q())};}
export function retargetReference(scene){
 const bones=referenceBones(scene),rest=new Map([...bones].map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),worldP:b.getWorldPosition(new Vector3()),worldQ:b.getWorldQuaternion(Q()),parent:b.parent?.isBone?b.parent.name:null}]));
 const corrections=new Map();
 for(const [name,src]of Object.entries(ENEMY_BONE_MAP)){
  let correction=Q();const child=endpoint[name];
  if(child)correction.setFromUnitVectors(at.get(child).clone().sub(at.get(name)).normalize(),world(bones,ENEMY_BONE_MAP[child]).p.sub(world(bones,src).p).normalize());
  corrections.set(name,correction);
 }
 for(const side of ['left','right']){corrections.set(side+'Hand',corrections.get(side+'Forearm').clone());corrections.set(side+'Toes',corrections.get(side+'Foot').clone());}
 const lengths=['left','right'].map(s=>({target:at.get(s+'UpperLeg').distanceTo(at.get(s+'LowerLeg'))+at.get(s+'LowerLeg').distanceTo(at.get(s+'Foot')),
  source:(world(bones,ENEMY_BONE_MAP[s+'UpperLeg']).p.distanceTo(world(bones,ENEMY_BONE_MAP[s+'LowerLeg']).p)+world(bones,ENEMY_BONE_MAP[s+'LowerLeg']).p.distanceTo(world(bones,ENEMY_BONE_MAP[s+'Foot']).p))*M}));
 const targetLegM=(lengths[0].target+lengths[1].target)/2,sourceLegM=(lengths[0].source+lengths[1].source)/2;
 const legScale=targetLegM/sourceLegM,sourceHipsRestY=rest.get('mixamorigHips').worldP.y,sourceAnkleRestY=(world(bones,'LeftFoot').p.y+world(bones,'RightFoot').p.y)/2;
 const targetHipsRestY=(at.get('leftFoot').y+at.get('rightFoot').y)/2+(sourceHipsRestY-sourceAnkleRestY)*M*legScale;
 const targetTPositions=targetPositions(corrections,V([0,targetHipsRestY,0]));
 return{rest,corrections,targetLegM,sourceLegM,legScale,sourceUniqueBones:bones.size,sourceHipsRestY,sourceAnkleRestY,targetHipsRestY,pelvisBaselineCorrectionM:targetHipsRestY-at.get('pelvis').y,targetTPositions};
}
function targetPositions(rotations,hips){const p=new Map([['root',new Vector3()]]);for(const d of SOLDIER_BONES){if(d.name==='root')continue;p.set(d.name,d.name==='pelvis'?hips.clone():at.get(d.name).clone().sub(at.get(d.parent)).applyQuaternion(rotations.get(d.parent)??Q()).add(p.get(d.parent)));}return p;}
export function readBootSoles(bytes){
 const {g,access}=readGLB(bytes),joints=g.skins[0].joints.map(i=>g.nodes[i].name),points={left:[],right:[]};
 for(const mesh of g.meshes)for(const p of mesh.primitives){if(p.attributes.JOINTS_0===undefined)continue;const positions=access(p.attributes.POSITION),ids=access(p.attributes.JOINTS_0),weights=access(p.attributes.WEIGHTS_0);
  positions.forEach((v,i)=>{for(const side of ['left','right']){let weight=0;for(let k=0;k<4;k++)if(joints[ids[i][k]]===side+'Foot')weight+=weights[i][k];if(weight>.7)points[side].push(V(v));}});}
 for(const side of ['left','right']){const minimum=Math.min(...points[side].map(p=>p.y));points[side]=points[side].filter(p=>p.y<=minimum+.015).map(p=>p.sub(at.get(side+'Foot')));assert.ok(points[side].length>20,'Missing actual target boot sole vertices');}
 return points;
}
function solveRetargetLeg(side,goal,pole,targetWorld,hips){
 const u=side+'UpperLeg',l=side+'LowerLeg',f=side+'Foot',positions=targetPositions(targetWorld,hips),start=positions.get(u),a=at.get(l).distanceTo(at.get(u)),b=at.get(f).distanceTo(at.get(l)),offset=goal.clone().sub(start),requested=offset.length(),d=Math.max(Math.abs(a-b)+1e-6,Math.min(a+b-1e-6,requested)),axis=offset.normalize();
 let bend=pole.clone().addScaledVector(axis,-pole.dot(axis));if(bend.lengthSq()<1e-10){bend=positions.get(l).clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis));}if(bend.lengthSq()<1e-10)bend=new Vector3(0,0,1).addScaledVector(axis,-axis.z);bend.normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),knee=start.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=start.clone().addScaledVector(axis,d);
 for(const [name,restDirection,direction]of [[u,at.get(l).clone().sub(at.get(u)),knee.clone().sub(start)],[l,at.get(f).clone().sub(at.get(l)),end.clone().sub(knee)]]){const original=targetWorld.get(name);targetWorld.set(name,Q().setFromUnitVectors(restDirection.applyQuaternion(original).normalize(),direction.normalize()).multiply(original).normalize());}
 return{errorM:targetPositions(targetWorld,hips).get(f).distanceTo(goal),unreachable:Math.abs(requested-d)>.0001};
}
function midpointSoleAudit(clip,soles){const tracks=new Map(clip.tracks.map(t=>[t.name,t.createInterpolant()])),times=[...new Set(clip.tracks.flatMap(t=>Array.from(t.times)))].sort((a,b)=>a-b),extra=[],p=new Vector3();let min=Infinity;
 for(let i=1;i<times.length;i++){const t=(times[i-1]+times[i])/2,world=new Map([['root',Q()]]);for(const d of SOLDIER_BONES){if(d.name==='root')continue;world.set(d.name,world.get(d.parent).clone().multiply(new Quaternion().fromArray(tracks.get(d.name+'.quaternion').evaluate(t))).normalize());}p.fromArray(tracks.get('pelvis.position').evaluate(t));const positions=targetPositions(world,p);
  let sole=Infinity;for(const side of ['left','right'])for(const v of soles[side])sole=Math.min(sole,v.clone().applyQuaternion(world.get(side+'Foot')).y+positions.get(side+'Foot').y);min=Math.min(min,sole);if(sole<.001)extra.push(t);
 }return{minM:min,extra};}
function angle(q){const y=new Vector3(0,0,1).applyQuaternion(q);return Math.atan2(y.x,y.z);}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function direction(name){const n=name.replace(/^walk crouching /,'').replace(/^(walk|run|sprint) /,'');return({'forward':0,'forward left':Math.PI/4,'left':Math.PI/2,'backward left':3*Math.PI/4,'backward':Math.PI,'backward right':-3*Math.PI/4,'right':-Math.PI/2,'forward right':-Math.PI/4})[n]??null;}
function category(name){return name.startsWith('walk crouching ')?'crouch-walk':/^(walk|run|sprint) /.test(name)?name.split(' ')[0]:name.includes('turn 90')?'turn':name.startsWith('reload_')?'reload':name==='fire_single_stand'?'fire':name.startsWith('idle')?'idle':'extra';}
export function retargetClip(scene,reference,name,{legIK=!!reference.bootSoles,extraTimes=[],refinement=0}={}){
 const clip=scene.animations.find(c=>c.tracks.length);assert.ok(clip,`No animation: ${name}`);
 const bones=referenceBones(scene),rest=reference.rest,tracks=new Map(clip.tracks.map(t=>[t.name,t.createInterpolant()]));
 const originalTimes=[...new Set(clip.tracks.flatMap(t=>Array.from(t.times)))].sort((a,b)=>a-b),times=[];for(const t of originalTimes.concat(extraTimes,legIK?Array.from({length:Math.ceil(clip.duration*60)},(_,i)=>Math.min(i/60,clip.duration)):[]).sort((a,b)=>a-b))if(!times.length||t-times.at(-1)>1e-6)times.push(t);assert.ok(times.length>0&&times[0]===0);
 const values=new Map(SOLDIER_BONES.filter(d=>d.name!=='root').map(d=>[d.name,[]])),hips=[],originalRoot=[];
 const ik={enabled:legIK,samples:0,unreachableSamples:0,maxAnkleGoalErrorM:0,maxSoleClearanceCorrectionM:0,maxSourceToRotationOnlyAnkleErrorM:0,floorClearanceM:.003,refinementPasses:refinement};const sourceTargetSamples=[];
 for(const t of times){
  // Source rotations/positions in each FBX have the same reference skeleton.
  // Use direct interpolants rather than a mixer binding duplicate X Bot names.
  const sw=new Map();
  const calc=n=>{if(sw.has(n))return sw.get(n);const b=bones.get(n),r=rest.get(n);assert.ok(b&&r,`Missing animated bone ${n}`);const p=tracks.has(n+'.position')?V(tracks.get(n+'.position').evaluate(t)):b.position.clone(),q=tracks.has(n+'.quaternion')?new Quaternion().fromArray(tracks.get(n+'.quaternion').evaluate(t)):b.quaternion.clone();
   const parent=b.parent?.isBone?calc(b.parent.name):null,w=parent?{p:p.applyQuaternion(parent.q).add(parent.p),q:parent.q.clone().multiply(q).normalize()}:{p,q:q.normalize()};sw.set(n,w);return w;};
  const targetWorld=new Map([['root',Q()]]);
  for(const d of SOLDIER_BONES){if(d.name==='root')continue;let desired;
   if(d.name.endsWith('KneeCover')){const side=d.name.startsWith('left')?'left':'right';desired=targetWorld.get(side+'UpperLeg').clone().slerp(targetWorld.get(side+'LowerLeg'),.5);}
   else{const n=sourceName(ENEMY_BONE_MAP[d.name]),src=calc(n);desired=src.q.clone().multiply(rest.get(n).worldQ.clone().invert()).multiply(reference.corrections.get(d.name)).normalize();}
   targetWorld.set(d.name,desired);
  }
  const raw=calc('mixamorigHips').p,hipPosition=new Vector3(0,reference.targetHipsRestY+(raw.y-reference.sourceHipsRestY)*M*reference.legScale,0);originalRoot.push(raw.clone());hips.push(...hipPosition.toArray());
  if(legIK){const before=targetPositions(targetWorld,hipPosition),sample={time:t,sourceHipsM:raw.clone().multiplyScalar(M).toArray(),targetHipsM:hipPosition.toArray(),feet:{}};for(const side of ['left','right']){
    const foot=side+'Foot',src=calc(sourceName(ENEMY_BONE_MAP[foot])).p,refFoot=rest.get(sourceName(ENEMY_BONE_MAP[foot])).worldP,refHips=rest.get('mixamorigHips').worldP,scaled=reference.legScale*M;
    const baseline=reference.targetTPositions.get(foot).clone().sub(new Vector3((refFoot.x-refHips.x)*scaled,refFoot.y*scaled,(refFoot.z-refHips.z)*scaled)),horizontalBaseline=new Vector3(baseline.x,0,baseline.z).applyQuaternion(targetWorld.get('pelvis'));
    const goal=new Vector3((src.x-raw.x)*scaled+horizontalBaseline.x,src.y*scaled+baseline.y,(src.z-raw.z)*scaled+horizontalBaseline.z),rotation=targetWorld.get(foot);
    const soleMin=Math.min(...reference.bootSoles[side].map(p=>p.clone().applyQuaternion(rotation).y)),clearance=Math.max(0,ik.floorClearanceM-soleMin-goal.y);goal.y+=clearance;
    ik.maxSoleClearanceCorrectionM=Math.max(ik.maxSoleClearanceCorrectionM,clearance);ik.maxSourceToRotationOnlyAnkleErrorM=Math.max(ik.maxSourceToRotationOnlyAnkleErrorM,before.get(foot).distanceTo(goal));
    const upper=calc(sourceName(ENEMY_BONE_MAP[side+'UpperLeg'])).p,knee=calc(sourceName(ENEMY_BONE_MAP[side+'LowerLeg'])).p,pole=knee.clone().sub(upper),result=solveRetargetLeg(side,goal,pole,targetWorld,hipPosition);
    ik.samples++;ik.unreachableSamples+=+result.unreachable;ik.maxAnkleGoalErrorM=Math.max(ik.maxAnkleGoalErrorM,result.errorM);
    sample.feet[side]={sourceAnkleM:src.clone().multiplyScalar(M).toArray(),targetGoalM:goal.toArray(),targetAchievedM:targetPositions(targetWorld,hipPosition).get(foot).toArray(),clearanceCorrectionM:clearance};
   }
   if(t===times[0]||t===times.at(-1)||t===times.reduce((a,b)=>Math.abs(a-clip.duration/2)<Math.abs(b-clip.duration/2)?a:b))sourceTargetSamples.push(sample);
   for(const side of ['left','right'])targetWorld.set(side+'KneeCover',targetWorld.get(side+'UpperLeg').clone().slerp(targetWorld.get(side+'LowerLeg'),.5));
  }
  for(const d of SOLDIER_BONES){if(d.name==='root')continue;const q=targetWorld.get(d.parent).clone().invert().multiply(targetWorld.get(d.name)).normalize(),v=values.get(d.name);if(v.length&&q.dot(new Quaternion().fromArray(v,v.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);v.push(...q.toArray());}
 }
 const rootDelta=originalRoot.at(-1).clone().sub(originalRoot[0]);rootDelta.y=0;
 let rawPath=0;for(let i=1;i<originalRoot.length;i++){const d=originalRoot[i].clone().sub(originalRoot[i-1]);d.y=0;rawPath+=d.length()*M;}
 const rawDistance=rootDelta.length()*M,sourceRawSpeedMps=rawDistance/clip.duration,sourceSpeedMps=sourceRawSpeedMps*reference.legScale;
 const targetTracks=[...values].map(([n,v])=>new QuaternionKeyframeTrack(n+'.quaternion',times,v));targetTracks.push(new VectorKeyframeTrack('pelvis.position',times,hips));
 const output=new AnimationClip(name,clip.duration,targetTracks);output.optimize();
 if(legIK){const audit=midpointSoleAudit(output,reference.bootSoles);if(audit.extra.length&&refinement<3)return retargetClip(scene,reference,name,{legIK,extraTimes:extraTimes.concat(audit.extra),refinement:refinement+1});ik.minBetweenKeySoleHeightM=audit.minM;ik.remainingBetweenKeySamplesBelow1mm=audit.extra.length;}
 const sourceHips=clip.tracks.find(t=>t.name==='mixamorigHips.quaternion'),first=new Quaternion().fromArray(sourceHips.values),last=new Quaternion().fromArray(sourceHips.values,sourceHips.values.length-4),rootYawDeltaRad=wrap(angle(last)-angle(first));
 const quaternionSeamRad=Math.max(...[...values.values()].map(v=>new Quaternion().fromArray(v).angleTo(new Quaternion().fromArray(v,v.length-4))));
 const steps=originalTimes.slice(1).map((t,i)=>t-originalTimes[i]).filter(d=>d>1e-6).sort((a,b)=>a-b),sourceCadence={userNominalFPS:30,minDistinctStepS:steps[0],medianDistinctStepS:steps[Math.floor(steps.length/2)],maxDistinctStepS:steps.at(-1),sourceKeyTimes:originalTimes.length};
 const cat=category(name),loop=['idle','walk','run','sprint','crouch-walk'].includes(cat)||['aim_idle_stand_alt','crouch_walk_alt','crouch_walk_back_alt','kneel_idle','run_alt','run_alt2','strafe_left','strafe_right','walk_alt','walk_fire_forward'].includes(name);
 return{clip:output,metadata:{name,duration:clip.duration,category:cat,loop,sourceRawDistanceM:rawDistance,sourceRawPathM:rawPath,sourceRawSpeedMps,sourceScaledDistanceM:rawDistance*reference.legScale,sourceSpeedMps,sourceScale:reference.legScale,movementAngleRad:direction(name),sourceMovementAngleRad:rawDistance>.05?Math.atan2(rootDelta.x,rootDelta.z):null,rootYawDeltaRad,
  sourceTrackCount:clip.tracks.length,sourceKeyTimes:originalTimes.length,sourceCadence,targetKeyTimes:times.length,additionalIKEvaluationHz:legIK?60:0,sourceFingerTrackCount:clip.tracks.filter(t=>/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(t.name)).length,targetTrackCount:output.tracks.length,horizontalRootRemoved:true,verticalMinM:Math.min(...hips.filter((_,i)=>i%3===1)),verticalMaxM:Math.max(...hips.filter((_,i)=>i%3===1)),legIK:ik,sourceTargetSamples,loopSeam:{maxQuaternionRad:quaternionSeamRad,hipsYDifferenceM:Math.abs(hips[1]-hips.at(-2))}}};
}
// JSON numbers are rounded to Float32-safe seven decimals for compact textual
// embedding. Absolute quaternion component error <=5e-8 (far below source FBX
// precision); normalization is retained on playback by Three's interpolation.
const compactFloat=x=>Math.round(x*1e7)/1e7;
export function compactClipJSON(clip){const j=AnimationClip.toJSON(clip);delete j.uuid;for(const t of j.tracks){t.times=t.times.map(compactFloat);t.values=t.values.map(compactFloat);}
 // AnimationClip.parse assigns json.uuid verbatim; omitting it aliases every
 // clip under "undefined" in AnimationMixer. Stable content UUIDs also make
 // consecutive builds byte-identical instead of emitting random Three UUIDs.
 const h=hash(Buffer.from(JSON.stringify(j)));j.uuid=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;return j;}
export async function generateEnemyAnimations({force=false}={}){
 const zip=await readFile(ZIP),generatorBytes=await readFile(new URL(import.meta.url)),rigBytes=await readFile(new URL('apps/training/src/soldier-rig.js',root)),parserBytes=await readFile(new URL('scripts/training-soldier-skin.mjs',root)),bootBytes=await readFile(BOOTS),sourceSHA256=hash(zip),generatorSHA256=hash(Buffer.concat([generatorBytes,rigBytes,parserBytes,Buffer.from(hash(bootBytes))]));
 if(!force){const old=JSON.parse(await readFile(INFO,'utf8').catch(()=>'{}'));if(old.generatorSHA256===generatorSHA256&&old.sourceSHA256===sourceSHA256){const json=await readFile(DATA).catch(()=>null),module=await readFile(MODULE).catch(()=>null);if(json&&module&&hash(json)===old.dataSHA256&&hash(module)===old.moduleSHA256){const data=JSON.parse(json);return{clips:data.clips.map(c=>AnimationClip.parse(c)),meta:old,json:data,buffer:json};}}}
 const entries=unzipEntries(zip),base='Mixamo_Rifle_Anims/',reference=retargetReference(parseFBX(entries.get(base+'X Bot.fbx'))),clips=[],metadata={},excluded=[],sourceMap=[];reference.bootSoles=readBootSoles(bootBytes);
 for(const [path,bytes]of [...entries].sort(([a],[b])=>a.localeCompare(b,'en'))){if(!path.endsWith('.fbx')||path===base+'X Bot.fbx')continue;const name=path.split('/').at(-1).replace(/\.fbx$/i,'');if(/^(death|jump)\b/.test(name)){excluded.push({name,path,sourceSHA256:hash(bytes),reason:'Explicit user exclusion: physics supplies falling/death; jumping out of scope.'});continue;}
  const result=retargetClip(parseFBX(bytes),reference,name);clips.push(result.clip);metadata[name]={...result.metadata,sourcePath:path,sourceSHA256:hash(bytes)};sourceMap.push({name,path,sha256:hash(bytes),bytes:bytes.length});
 }
 const data={version:ENEMY_RETARGET_POLICY.version,clips:clips.map(compactClipJSON),metadata};const buffer=Buffer.from(JSON.stringify(data)),module=Buffer.from('// Generated by scripts/training-enemy-animations.mjs; animation data only.\nexport const ENEMY_ANIMATIONS='+buffer.toString()+';\n');
 const meta={version:ENEMY_RETARGET_POLICY.version,source:'Adobe Mixamo (user-supplied rifle animation ZIP)',sourceURL:'https://www.mixamo.com/',license:'User supplied Adobe Mixamo royalty-free assets; see Adobe Mixamo FAQ. Animation derivative embedded in game, original ZIP kept as build source.',licenseURL:'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html',policy:ENEMY_RETARGET_POLICY,sourceSHA256,sourceBytes:zip.length,generatorSHA256,generatorFileSHA256:hash(generatorBytes),targetRigFileSHA256:hash(rigBytes),dataSHA256:hash(buffer),clipDataSHA256:hash(Buffer.from(JSON.stringify(data.clips))),moduleSHA256:hash(module),dataBytes:buffer.length,moduleBytes:module.length,sourceFBXFiles:65,sourceAnimationFiles:64,sourceTReferencePath:base+'X Bot.fbx',sourceTReferenceSHA256:hash(entries.get(base+'X Bot.fbx')),sourceUniqueBones:reference.sourceUniqueBones,targetStructuralBones:24,targetSkinBones:54,fingerTracksEmitted:0,sourceLegM:reference.sourceLegM,targetLegM:reference.targetLegM,legLengthScale:reference.legScale,
  pelvisBaselineCorrectionM:reference.pelvisBaselineCorrectionM,targetHipsRestY:reference.targetHipsRestY,sourceAnkleRestY:reference.sourceAnkleRestY,bootGeometry:{sha256:hash(bootBytes),unchanged:true,soleVertices:Object.fromEntries(Object.entries(reference.bootSoles).map(([side,p])=>[side,p.length]))},
  boneMap:SOLDIER_BONES.map(d=>({target:d.name,parent:d.parent,source:ENEMY_BONE_MAP[d.name]?sourceName(ENEMY_BONE_MAP[d.name]):null,sourceChain:d.name==='chest'?['mixamorigSpine1','mixamorigSpine2']:undefined,restCorrectionWorld:reference.corrections.get(d.name)?.toArray()??null,role:d.name==='root'?'Original root unchanged':d.name.endsWith('KneeCover')?'Original knee-cover helper rule':'Retargeted structural joint'})),sourceMap,clipCount:clips.length,metadata,excluded,
  unsupported:['Source reloads are generic Mixamo rifle motions, not AK-74M-specific magazine handling. Runtime timing/grip composition must be reported separately.','Crouched source pose and kneeling reload differ; transition quality requires rendered verification.','Finger animations are intentionally discarded; original soldier fixed AK finger poses remain authoritative.'],unchanged:['Original uploaded soldier GLB','54-joint derivative GLB/skin/weights','Finger bones/mesh/AK grip assets','P01/native4 animation clips','Clinical/ballistic/armor/ragdoll physics']};
 await mkdir(new URL('dist/',root),{recursive:true});await mkdir(new URL('apps/training/src/generated/',root),{recursive:true});await writeFile(DATA,buffer);await writeFile(MODULE,module);await writeFile(INFO,JSON.stringify(meta,null,2)+'\n');await writeFile(MAP,JSON.stringify(meta,null,2)+'\n');return{clips,meta,json:data,buffer};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await generateEnemyAnimations({force:process.argv.includes('--force')});console.log(JSON.stringify({version:r.meta.version,clips:r.meta.clipCount,dataBytes:r.meta.dataBytes,moduleBytes:r.meta.moduleBytes,legScale:r.meta.legLengthScale,excluded:r.meta.excluded.length},null,2));}
