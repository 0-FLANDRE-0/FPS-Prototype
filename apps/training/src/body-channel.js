import {computeWoundChannel} from './wound-channel.js';
import {createLegacyProtection} from './generated/legacy-protection.js';
import {snapshotResidual} from './protection.js';

// 3D-only adapter. The original resolveBodyPath remains the legacy/comparison
// implementation; its penetration-cost losses never run on this path.
export const BODY_CHANNEL_RULE_ID='body-channel-s2';
const tiny=1e-9;
export function clipInternalGeometry(geometry,lengthM){
 const clip=intervals=>(intervals||[]).map(([a,b])=>[Math.max(0,a),Math.min(lengthM,b)]).filter(([a,b])=>b>a+tiny);
 const hits=(geometry.internalHits||[]).flatMap(h=>{const intervals=clip(h.intervals);return intervals.length?[{...h,intervals,entryDepthM:intervals[0][0],exitDepthM:intervals.at(-1)[1],traversedLengthM:intervals.reduce((n,[a,b])=>n+b-a,0)}]:[];});
 return {internalHits:hits,nearMisses:(geometry.nearMisses||[]).filter(h=>h.closestDepthM<=lengthM),
  cavityCandidates:(geometry.cavityCandidates||[]).flatMap(h=>{const cavityIntervals=clip(h.cavityIntervals);return cavityIntervals.length?[{...h,cavityIntervals}]:[];}),
  tissueIntervals:(geometry.tissueIntervals||[]).flatMap(h=>{const intervals=clip(h.intervals);return intervals.length?[{...h,intervals}]:[];}),
  enclosureHits:(geometry.enclosureHits||[]).flatMap(h=>{const intervals=clip(h.intervals);return intervals.length?[{...h,intervals}]:[];})};
}
function occupiedParts(path){
 const result=[];
 for(const cell of path.cells){
  const lengthM=cell.exit-cell.entry;if(lengthM<=tiny)continue;
  const previous=result.at(-1);
  if(previous?.bodyPart===cell.shape.part&&Math.abs(previous.exitDistance-cell.entry)<1e-7){previous.lengthM+=lengthM;previous.exitDistance=cell.exit;if(!previous.shapeIds.includes(cell.shape.id))previous.shapeIds.push(cell.shape.id);}
  else result.push({bodyPart:cell.shape.part,address:cell.address||path.address,shapeIds:[cell.shape.id],entryDistance:cell.entry,exitDistance:cell.exit,lengthM});
 }
 return result;
}
export function resolveBodyChannel(path,s,{ammoId=s.ammo.id,geometry={},stateIn=null}={}){
 const before=snapshotResidual(s),legacy=createLegacyProtection();
 const massInKg=stateIn?.massKg??s.massKg??legacy.computeProjectileKinetics(s.ammo,before.velocityMps,s.initialVelocity).massKg;
 const fragmentEnergyInJ=stateIn?.fragmentEnergyJ||0,projectileEnergyInJ=.5*massInKg*before.velocityMps**2;
 const parts=[],cells=path.cells.map(c=>({entryDistance:c.entry,exitDistance:c.exit,lengthM:c.exit-c.entry,shapeId:c.shape.id,bodyPart:c.shape.part,address:c.address||path.address}));
 let state=stateIn,velocity=before.velocityMps,mass=massInKg,damage=before.damage,pen=before.penetration,energyDepositedJ=0,exitDistance=path.entry,stopped=velocity<=0;
 for(const original of occupiedParts(path)){
  if(stopped)break;
  const start=original.entryDistance-path.entry,end=original.exitDistance-path.entry;
  const internalHits=(geometry.internalHits||[]).flatMap(h=>{const intervals=(h.intervals||[]).map(([a,b])=>[Math.max(start,a),Math.min(end,b)]).filter(([a,b])=>b>a+tiny);return intervals.length?[{...h,intervals,entryDepthM:intervals[0][0],exitDepthM:intervals.at(-1)[1],traversedLengthM:intervals.reduce((n,[a,b])=>n+b-a,0)}]:[];});
  const origin=path.point.clone().addScaledVector(path.direction,start).toArray(),energyBefore=.5*mass*velocity**2;
  const channel=computeWoundChannel({ammoId,entryVelocityMps:velocity,massKg:mass,lengthM:original.lengthM,bodyPart:original.bodyPart,startDepthM:start,
   internalHits,cavityCandidates:geometry.cavityCandidates||[],tissueIntervals:geometry.tissueIntervals||[],enclosureHits:geometry.enclosureHits||[],
   origin,direction:path.direction.toArray(),stateIn:state});
  const traversedLengthM=channel.stopped?(channel.traversedLengthM??original.lengthM):original.lengthM,velocityOutMps=channel.exitVelocityMps??channel.predictedExitVelocityMps;
  const outState=channel.stateOut,massOutKg=outState.massKg,energyAfter=.5*massOutKg*velocityOutMps**2;
  const ratio=energyBefore>0?Math.min(1,Math.max(0,energyAfter/energyBefore)):0;
  const part={...original,lengthM:traversedLengthM,exitDistance:original.entryDistance+traversedLengthM,
   velocityInMps:velocity,velocityOutMps,massInKg:mass,massOutKg,energyShareJ:channel.energyLostJ,
   projectileEnergyInJ:energyBefore,projectileEnergyOutJ:energyAfter,fragmentEnergyInJ:state?.fragmentEnergyJ||0,fragmentEnergyOutJ:outState.fragmentEnergyJ||0,
   penIn:pen,damageIn:damage,cost:0,woundChannel:channel};
  parts.push(part);energyDepositedJ+=channel.energyLostJ;exitDistance=part.exitDistance;
  state=outState;velocity=velocityOutMps;mass=massOutKg;pen*=ratio;damage*=ratio;stopped=!!channel.stopped||velocity<=0;
 }
 const through=!stopped&&path.completeExit,incomplete=!stopped&&!path.completeExit;
 const depth=through?'body_through_and_through':incomplete?'incomplete_body_path':exitDistance-path.entry<=tiny?'surface_only':path.exit-exitDistance<=.001?'near_exit_lodged':exitDistance-path.entry<(path.exit-path.entry)/2?'shallow_entry':'deep_penetration';
 for(const [index,part]of parts.entries()){part.depth=index<parts.length-1?'body_through_and_through':depth;part.exitWound=index<parts.length-1||through;}
 s.velocity=velocity;s.massKg=mass;s.pen=stopped?0:pen;s.damage=stopped?0:damage;
 s.yawRad=state?.yawRad||0;s.fragmented=!!state?.fragmented;s.fragmentMassKg=state?.fragmentMassKg||0;
 // Feed the remaining primary mass into unchanged armor kinetic/wear helpers.
 // This shot-local copy never mutates registry damage, HP, or ammunition data.
 if(mass>0&&s.ammo.projectileMassG!==mass*1000)s.ammo={...s.ammo,projectileMassG:mass*1000};
 const projectileEnergyOutJ=.5*mass*velocity**2,fragmentEnergyOutJ=state?.fragmentEnergyJ||0;
 const occupiedLengthM=Math.max(0,exitDistance-path.entry),clipped=clipInternalGeometry(geometry,occupiedLengthM);
 return {targetId:path.actor.id,address:path.address,point:path.point.toArray(),normal:path.normal.toArray(),incomingDirection:path.direction.toArray(),
  ruleId:BODY_CHANNEL_RULE_ID,bodyEntered:parts.some(p=>p.lengthM>tiny),deepTissue:depth!=='surface_only'&&depth!=='shallow_entry',nearExit:depth==='near_exit_lodged',
  depth,bttt:through,exitWound:through,retained:stopped,outcome:depth,continued:through&&velocity>0,cells,parts,
  pathLengthM:path.exit-path.entry,traversedLengthM:occupiedLengthM,entryDistance:path.entry,exitDistance,completeExit:path.completeExit,
  penIn:before.penetration,penAfterBody:s.pen,velocityInMps:before.velocityMps,velocityOutMps:velocity,massKg:massInKg,massOutKg:mass,
  projectileEnergyInJ,projectileEnergyOutJ,fragmentEnergyInJ,fragmentEnergyOutJ,
  energyInJ:projectileEnergyInJ+fragmentEnergyInJ,energyOutJ:projectileEnergyOutJ+fragmentEnergyOutJ,energyDepositedJ,energyAccountingComplete:true,
  stopDepthM:stopped?occupiedLengthM:null,stateOut:state,internalGeometryCached:true,...clipped,before,after:snapshotResidual(s)};
}
