import{bleedingWounds,bleedingWound,anatomicalPart,sourceOwner,reconcileSourceOwners}from'./medical-bleeding-wounds.js';
import{vesselFlowSpec}from'./medical-vessel-flows.js';
import{treatmentControlFactor,prepareCareFlows,hasCareEffects}from'./medical-care-effects.js';
import{carePlans}from'./medical-care-state.js';
import {exerciseBleedingFactor} from './medical-d2.js';
import {MEDICAL_B1C_VALUES,unionSeverityB1c,updateParenchymalB1c} from './medical-b1c.js';
import {MEDICAL_B1B_VALUES} from './medical-b1b.js';
import {SOLDIER_BONES} from './soldier-rig.js';
// Independent 3D bleeding. Sources are treatment attachment points, not care
// actions. Original 2D declarations, HP and wound-channel volumes are untouched.
export const MEDICAL_B1_VALUES=Object.freeze({
  ruleId:'bleed-sources-mo3',bloodDensityKgM3:1060,dischargeCoefficient:.62,mmHgToPa:133.322,
  restingCardiacOutputMlMin:5250,venousPressureMmHg:5,flowReserve:1.7,
  transectionCoverage:.8,transectionTauS:8,majorTransectionAreaFloor:.35,
  branchArteryTauS:90,branchVeinTauS:45,lowMapClotGain:2,
  estimatedReferenceDiameterMm:8,estimatedReferenceFlowMlMin:350,
  mixedWoundOozeMlS:.5,organOpeningAreaMm2:8,

});
const K=MEDICAL_B1_VALUES,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const isMajor=id=>/aorta|vena.cava|carotid|jugular|subclavian|axillary|brachial|iliac|femoral|hepatic-vein|portal-vein/.test(id);
const limb=part=>/Arm|Leg/.test(part);
const organsWithBlood=new Set(['liver','spleen','kidney','lung','heart_hook_only','bowel','stomach','bladder']);
export function ensureBleedingB1(m){
  m.bleedSources??=[];m.vesselContusions??=[];
  m.bleedingModel??={ruleId:K.ruleId,cardiacOutputMlPerS:K.restingCardiacOutputMlMin/60,uncappedFlowMlPerS:0,totalFlowMlPerS:0,globalScale:1,integratedLossMl:0,lastIntegratedLossMl:0};
}
function address(w,h){
  const a=w.bodyTrajectory?.entryAddress||{},partKey=w.partKey,bone=a.bone||h?.bone||null,bind=SOLDIER_BONES.find(b=>b.name===bone),point=a.localPoint?[...a.localPoint]:null;
  if(point&&h&&a.localIncomingDirection){const along=Math.max(0,(h.closestDepthM||0)-(w.bodyTrajectory?.woundChannel?.startDepthM||0));for(let i=0;i<3;i++)point[i]+=a.localIncomingDirection[i]*along;}
  const position={partKey,bone,boneLocalPoint:point&&bind?point.map((v,i)=>v-bind.at[i]):null,bindActorPoint:point,
    boneReferenceConvention:'original body address unposed with rig.delta inverse, then subtract named bind bone origin; metres',actorLocalPoint:a.actorLocalPoint?[...a.actorLocalPoint]:null,proximalPoint:null};
  if(limb(partKey)){
    const proximal=partKey.replace('Arm','UpperArm').replace('Leg','UpperLeg'),joint=SOLDIER_BONES.find(b=>b.name===proximal);
    position.proximalPoint={partKey,bone:proximal,boneLocalPoint:[0,0,0],bindActorPoint:[...joint.at],landmark:'proximal limb root toward heart',chainOrder:0,classification:'original24bone bind landmark; future care must compare chain order, not world y'};
  }
  return position;
}
// Width of the permanent cavity across the fitted vessel diameter at the
// closest occupied slice. This is a geometric tuning proxy, not a measured tear.
export function vesselOpeningB1(h,channel){
  const rv=Math.max(.0001,(h.diameterM||.004)/2),d=h.centerlineDistanceM||0,depth=h.closestDepthM||0;
  const steps=channel?.steps||[];let rp=h.bulletRadiusM||.00285,best=Infinity;
  for(const s of steps){const gap=Math.abs((s.depthM+(channel.startDepthM||0)+s.dxM/2)-depth);if(gap<best){best=gap;rp=s.permanentRadiusM;}}
  const coverage=clamp(Math.min(2*rp,rp+rv-d)/(2*rv));
  return {coverage,orificeAreaMm2:Math.PI*(rv*1000)**2*coverage,injuryType:coverage>=K.transectionCoverage?'complete_transection':'partial_laceration',diameterMm:rv*2000,permanentRadiusM:rp};
}
export function normalVesselFlowB1(h){const r=vesselFlowSpec(h);return{mlMin:r.normalFlowMlMin,classification:r.classification};}
function source(m,w,h,options){
  const id=options.id;let s=m.bleedSources.find(s=>s.id===id);
  const part=options.partKey||anatomicalPart(h,w.partKey),owner=sourceOwner(m,w,part);
  if(!s){s={id,vesselName:h.id||'muscle/capillary ooze',vesselKind:h.vesselKind||'capillary',injuryType:options.injuryType||'partial_laceration',orificeAreaMm2:0,partKey:part,position:address(owner,h),flowMlPerS:0,cumulativeMl:0,controlFactor:1,normalFlowMlMin:options.normalFlowMlMin||0,flowEstimate:options.flowEstimate||null,majorNamed:!!options.majorNamed,evidence:options.evidence,lesions:[],woundIds:[]};m.bleedSources.push(s);}
  if(!owner.bleedSourceIds)owner.bleedSourceIds=[];if(!owner.bleedSourceIds.includes(id))owner.bleedSourceIds.push(id);if(!s.woundIds.includes(owner.id))s.woundIds.push(owner.id);
  s.pendingOwner=owner.id;s.pendingOrigin=w.id;
  return s;
}
export function registerBleedingWoundB1(m,w){
  ensureBleedingB1(m);if(w.b1Registered)return;w.b1Registered=true;w.bleedSourceIds=[];w.vesselContusions=[];
  const channel=w.bodyTrajectory?.woundChannel,organs=w.s1OrganDamage||[],direct=organs.filter(h=>h.kind==='vessel'&&h.direct&&h.permanentVolumeM3>0);
  for(const h of organs.filter(h=>h.kind==='vessel'&&!h.direct)){
    const c={vessel:h.id,identifier2D:h.identifier,severity:h.severity,woundId:w.id,position:address(w,h),physiologyApplied:false,source:'B1 cavity-only exposure; HP volume retained unchanged'};w.vesselContusions.push(c);m.vesselContusions.push(c);
  }
  for(const h of direct){
    const opening=vesselOpeningB1(h,channel);if(!(opening.orificeAreaMm2>0))continue;
    const normal=normalVesselFlowB1(h),s=source(m,w,h,{id:'vessel/'+vesselFlowSpec(h).canonicalId,injuryType:opening.injuryType,normalFlowMlMin:normal.mlMin,flowEstimate:normal.classification,majorNamed:isMajor(h.id),evidence:'direct permanent cavity / fitted vessel diameter'});
    s.lesions.push({...opening,baseAreaMm2:opening.orificeAreaMm2,currentAreaMm2:opening.orificeAreaMm2,ageS:0,woundId:s.pendingOwner,originWoundId:w.id,anatomicalPart:s.partKey,position:address(sourceOwner(m,w,s.partKey),h)});
    if(opening.injuryType==='complete_transection')s.injuryType='complete_transection';
  }
  if(w.vascularEvidence?.s2AmputationSeverance){
    // Preserve S2's energy-qualified severance without falsely adding an
    // anatomical intersection. No new amputation/HP threshold is introduced.
    const diameterM=w.partKey.endsWith('Arm')?.006:.008,h={id:'modeled-severance-'+w.partKey,identifier:w.vascularEvidence.s2AmputationSeverance.identifier,vesselKind:'artery',domain:w.partKey,bone:w.bodyTrajectory?.entryAddress?.bone,diameterM},normal=normalVesselFlowB1(h),area=Math.PI*(diameterM*500)**2;
    const s=source(m,w,h,{id:'modeled-severance/'+w.partKey,normalFlowMlMin:normal.mlMin,flowEstimate:normal.classification,majorNamed:true,injuryType:'complete_transection',evidence:'existing S2 energy-qualified modeled amputation severance; not a fabricated direct anatomy intersection'});
    s.lesions.push({baseAreaMm2:area,currentAreaMm2:area,ageS:0,injuryType:'complete_transection',coverage:1,woundId:s.pendingOwner,originWoundId:w.id,anatomicalPart:s.partKey,position:address(sourceOwner(m,w,s.partKey),h)});
  }
  for(const h of organs.filter(h=>h.kind==='organ'&&organsWithBlood.has(h.organ)&&h.effectiveVolumeM3>0)){
    if(Object.hasOwn(MEDICAL_B1B_VALUES.organFlowFractions,h.organ)){
      // One source per organ; actual wounds become lesions, like named vessels.
      const s=source(m,w,{...h,vesselKind:'parenchymal'},{id:'parenchymal/'+h.id,injuryType:'parenchymal',evidence:'S1/S2 effective-volume organ injuries; per-lesion direct/cavity evidence retained'});
      s.organ=h.organ;s.organFlowFraction=MEDICAL_B1B_VALUES.organFlowFractions[h.organ];
      s.lesions.push({woundId:s.pendingOwner,originWoundId:w.id,anatomicalPart:s.partKey,severity:clamp(h.severity),ageS:0,closureFactor:1,position:address(sourceOwner(m,w,s.partKey),h),direct:!!h.direct,effectiveVolumeM3:h.effectiveVolumeM3,organVolumeM3:h.volumeM3});
      s.orificeAreaMm2=null;s.flowEstimate='sourced current organ CO fraction × user maximum2/3 × tuning probability-union damage';
      continue;
    }
    // The model has organ volumes, not intra-organ vessel trees. Name this
    // explicitly as an equivalent microvascular bed, never a confirmed vessel.
    const s=source(m,w,{...h,vesselKind:'vein'},{id:'organ-bed/'+h.id,normalFlowMlMin:K.restingCardiacOutputMlMin*.2,flowEstimate:'tuning: equivalent organ vascular bed ceiling20% of reference CO',evidence:h.direct?'direct organ injury; estimated microvascular bleeding':'modeled cavity organ injury; estimated microvascular bleeding'}),area=K.organOpeningAreaMm2*clamp(h.severity);
    s.organBed=true;s.organ=h.organ;s.organFlowFraction=MEDICAL_B1C_VALUES.organBedReferenceOutputFraction;
    s.lesions.push({baseAreaMm2:area,currentAreaMm2:area,ageS:0,injuryType:'partial_laceration',coverage:h.severity,woundId:s.pendingOwner,originWoundId:w.id,anatomicalPart:s.partKey,position:address(sourceOwner(m,w,s.partKey),h)});
  }
  const bp=w.bleedingProfile;
  if(bp&&bp.bleedingType!=='none'){
    const mixed=direct.length||organs.some(h=>h.kind==='organ'&&organsWithBlood.has(h.organ));
    const ext=mixed?K.mixedWoundOozeMlS:Math.max(0,bp.initialExternal??bp.currentExternal??0),int=mixed?0:Math.max(0,bp.initialInternal??bp.currentInternal??0);
    // R3-a is the legacy small-wound exponential to sustained*0.001;
    // fracture/major/organ bleeding is accounted for by explicit sources above.
    const s=source(m,w,{id:'muscle/capillary ooze',bone:w.bodyTrajectory?.entryAddress?.bone},{id:'ooze/'+w.id,injuryType:'ooze',evidence:'retained R3-a anonymous natural-decay terms; no destination split'});
    const floorA=mixed?ext*.001:(bp.naturalReductionTargetExternal??(bp.sustainedExternal??ext)*.001),floorB=mixed?0:(bp.naturalReductionTargetInternal??(bp.sustainedInternal??int)*.001),rate=Math.min(bp.selfReductionRate||.08,.08);
    s.ooze={terms:[{value:ext,floor:floorA,rate},{value:int,floor:floorB,rate:rate*.6}],legacyR3:!mixed,costTwoParts:ext>0&&int>0};
    s.lesions.push({woundId:s.pendingOwner,originWoundId:w.id,anatomicalPart:s.partKey,position:s.position});

  }
  w.b1BleedingRule=K.ruleId;
}
function collect(m){for(const w of m.wounds)registerBleedingWoundB1(m,w);}
export function finalizeBleedingSources(m){ensureBleedingB1(m);collect(m);reconcileSourceOwners(m);for(const s of m.bleedSources){delete s.pendingOwner;delete s.pendingOrigin;}}
export function cardiacOutputMlPerSB1(m){return m.cardiacArrest||m.isDead?0:Math.max(0,(m.hemodynamics?.cardiacOutputMul??1)*K.restingCardiacOutputMlMin/60);}
export function updateBleedingB1(unit,dt,{pulseModel=null}={}){
  const m=unit.medical;ensureBleedingB1(m);collect(m);
  const map=Math.max(0,m.hemodynamics?.map??93),cap=cardiacOutputMlPerSB1(m),before=m.bloodMl,lowMap=1+K.lowMapClotGain*clamp((93-map)/93);let raw=0;
  for(const s of m.bleedSources){
    s.controlFactor=1; // M3: persistent care is read after current lesion areas.
    if(s.injuryType==='ooze'){
      const o=s.ooze,w=bleedingWound(m,s.woundIds[0]),moving=unit.isMoving||unit.beingDragged||unit._draggeeId,gain=(moving?.35:1)*(m.shockState==='decompensated'||m.map<55?.5:1);
      for(const t of o.terms)t.value=t.floor+(t.value-t.floor)*Math.exp(-t.rate*gain*dt);
      const origin=m.wounds.find(w=>w.id===s.lesions[0]?.originWoundId)||w,pulse=o.legacyR3&&pulseModel?pulseModel(unit,origin,origin.bleedingProfile,1):{extPulse:Math.sqrt(map/93),intPulse:Math.sqrt(map/93)};
      s.rawFlowMlPerS=o.terms.reduce((n,t,i)=>n+t.value*(i===0?pulse.extPulse:pulse.intPulse),0);
      s.orificeAreaMm2=s.rawFlowMlPerS/(K.dischargeCoefficient*Math.sqrt(2*K.venousPressureMmHg*K.mmHgToPa/K.bloodDensityKgM3));
    }else if(s.injuryType==='parenchymal'){
      updateParenchymalB1c(s,dt,cap*exerciseBleedingFactor(m,s),MEDICAL_B1B_VALUES);
    }else{
      let area=0;for(const l of s.lesions){l.ageS+=dt;let floor=0,tau=s.vesselKind==='artery'?K.branchArteryTauS:K.branchVeinTauS;
        if(s.majorNamed){floor=l.injuryType==='complete_transection'&&s.vesselKind==='artery'?K.majorTransectionAreaFloor:1;tau=K.transectionTauS;}
        else if(l.injuryType==='complete_transection'&&s.vesselKind==='artery')tau=Math.min(tau,K.transectionTauS);
        l.clotExposureS=(l.clotExposureS||0)+dt*(s.majorNamed?1:lowMap);
        l.currentAreaMm2=l.baseAreaMm2*(floor+(1-floor)*Math.exp(-l.clotExposureS/tau));area+=l.currentAreaMm2;}
      if(s.organBed){s.severity=unionSeverityB1c(s.lesions.map(l=>l.coverage));s.effectiveSeverity=unionSeverityB1c(s.lesions.map(l=>l.currentAreaMm2/K.organOpeningAreaMm2));area=K.organOpeningAreaMm2*s.effectiveSeverity;s.organPerfusionMlPerS=cap*s.organFlowFraction*exerciseBleedingFactor(m,s);}
      s.orificeAreaMm2=area;s.pressureMmHg=s.vesselKind==='artery'?map:s.id==='vessel/portal-vein'?MEDICAL_B1C_VALUES.portalPressureMmHg:s.id==='vessel/hepatic-vein-trunk'?MEDICAL_B1C_VALUES.hepaticPressureMmHg:K.venousPressureMmHg;
      s.orificeFlowMlPerS=K.dischargeCoefficient*area*1e-6*Math.sqrt(2*s.pressureMmHg*K.mmHgToPa/K.bloodDensityKgM3)*1e6;
      // MO3 named vessel ceiling: resting regional flow × tuned open-vessel k.
      // The orifice equation and shared current-CO allocation are retained.
      const spec=vesselFlowSpec({id:s.vesselName,vesselKind:s.vesselKind,diameterM:s.lesions[0]?.diameterMm/1000});s.vesselCapMlPerS=s.organBed?s.normalFlowMlMin/60*K.flowReserve:(s.normalFlowMlMin||spec.normalFlowMlMin)/60*spec.multiplier;s.capEvidence=s.organBed?'original organ-bed cap':{...spec,normalFlowMlMin:s.normalFlowMlMin||spec.normalFlowMlMin,capMlPerS:s.vesselCapMlPerS};
      s.rawFlowMlPerS=s.vesselCapMlPerS===null?s.orificeFlowMlPerS:Math.min(s.orificeFlowMlPerS,s.vesselCapMlPerS);
      if(s.organBed)s.rawFlowMlPerS=Math.min(s.rawFlowMlPerS,s.organPerfusionMlPerS);
    }
    if(s.injuryType==='ooze')s.rawFlowMlPerS*=exerciseBleedingFactor(m,s);
    raw+=s.rawFlowMlPerS;
  }
  const allocation=prepareCareFlows(m,cap,before,dt);
  if(hasCareEffects(m)){raw=0;for(const s of m.bleedSources){s.controlFactor=treatmentControlFactor(m,s);raw+=s.controlFactor===1?s.rawFlowMlPerS:s.rawFlowMlPerS*s.controlFactor;}}
  const scale=allocation.scale,available=allocation.available;
  const model=m.bleedingModel;Object.assign(model,{cardiacOutputMlPerS:cap,uncappedFlowMlPerS:raw,globalScale:scale,bloodAvailabilityScale:available,totalFlowMlPerS:0});
  for(const p of Object.values(m.bodyParts)){p.bleedRateMlPerS=0;p.externalBleedRate=0;p.internalBleedRate=0;}
  for(const w of bleedingWounds(m)){w.bleedRateMlPerS=0;w._effExternal=0;w._effInternal=0;}
  m.externalBleedRate=0;m.internalBleedRate=0;let loss=0;
  for(const s of m.bleedSources){s.flowMlPerS=s.rawFlowMlPerS*scale*available*s.controlFactor;const volume=s.flowMlPerS*dt;s.cumulativeMl+=volume;loss+=volume;model.totalFlowMlPerS+=s.flowMlPerS;
    m.externalBleedRate+=s.flowMlPerS;
    // A shared vessel is reported once globally; compatibility wound/part
    // totals partition its flow across actual lesions, rather than duplicating it.
    const plan=carePlans.get(m)?.get(s.id),controlled=!!plan;
    const shares=controlled?plan.segments.map(r=>({woundId:r.woundId,currentAreaMm2:r.shareAfter})):s.injuryType==='ooze'?[{woundId:s.woundIds[0],currentAreaMm2:1}]:s.injuryType==='parenchymal'?s.lesions.map(l=>({woundId:l.woundId,currentAreaMm2:l.severity*l.closureFactor})):s.lesions,total=shares.reduce((n,l)=>n+l.currentAreaMm2,0);
    for(const l of shares){const w=bleedingWound(m,l.woundId);if(!w)continue;const f=s.flowMlPerS*l.currentAreaMm2/Math.max(1e-30,total);w.bleedRateMlPerS+=f;w._effExternal+=f;if(m.bodyParts[w.partKey]){m.bodyParts[w.partKey].bleedRateMlPerS+=f;m.bodyParts[w.partKey].externalBleedRate+=f;}}
  }
  m.bleedRateMlPerS=model.totalFlowMlPerS;m.bloodLossMl=(m.bloodLossMl||0)+loss;
  m.bloodMl=Math.max(0,before-loss);m._bleedSource=K.ruleId;
  if(dt>0){model.integratedLossMl+=loss;model.lastIntegratedLossMl=loss;model.lastIntegration={dt,beforeBloodMl:before,lossMl:loss,cardiacOutputMlPerS:cap,totalFlowMlPerS:model.totalFlowMlPerS};}
}
