import{captureReferenceFlows}from'./medical-b1-reference.js';
import{referenceFlow}from'./medical-reference-flow.js';
import{stepCareMovement}from'./medical-hemostasis.js';
import{stepDrugsAndBlood,createDrugSlots,careSafetyAfter}from'./medical-care-drugs.js';
import{setCareTime,systemicCarePain}from'./medical-care-systemic.js';
import{bleedingWounds}from'./medical-bleeding-wounds.js';
import{recordWorkOpening}from'./medical-work.js';
import{careClinicalBefore,careClinicalAfter,activeTreatment}from'./medical-care-state.js';
import{clearMedicalSurfaces,recordMedicalSurface,medicalSurfaces}from'./medical-surface.js';
import {MedicalActivity} from './medical-d2.js';
import {registerBleedingWoundB1,finalizeBleedingSources} from './medical-b1.js';
import {advanceStructuralHitS2} from './medical-s2-effects.js';
import {installMedicalS3Adapter} from './medical-s3-effects.js';
import { createMedicalV2Slots, ensureMedicalV2 } from './medical-v2.js';
import { CATALOG } from './catalog.js';
import { createLegacyMedical } from './generated/legacy-medical.js';
import { mapMedicalAddress } from './medical-address.js';
import { Vector3 } from 'three';
import { resolveBodyAddress } from './human-targets.js';
// Read-only recorder for the selected model; legacy retains the v15 field set.
export function medicalObservation(actor,time){
  const m=actor.medical;
  return {time,bloodMl:m.bloodMl,bloodPercent:m.bloodMl/m.bloodMax*100,
    externalBleedRate:m.externalBleedRate,internalBleedRate:m.internalBleedRate,
    consciousness:m.consciousness,pain:m.pain,shock:m.shock,heartRate:m.heartRate,
    systolicBP:m.systolicBP,diastolicBP:m.diastolicBP,breathingEfficiency:m.breathingEfficiency,
    lifeStatus:m.lifeStatus,combatState:actor.combatState,combatEffectiveness:m.combatEffectiveness,mobility:m.mobility,
    isDowned:m.isDowned,isUnconscious:m.isUnconscious,isDead:m.isDead,downReason:m.downReason,deathReason:m.deathReason,
    partPain:Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.pain])),
    ...(m.medicalModel==='v2'?{medicalModel:'v2',bleedingModel:structuredClone(m.bleedingModel),bleedSources:structuredClone(m.bleedSources),bleedRateMlPerS:m.bleedRateMlPerS,bloodLossMl:m.bloodLossMl||0,linkedBleedingWounds:structuredClone(m.bleedingWounds||[]),vesselContusions:structuredClone(m.vesselContusions),structuralTrauma:structuredClone(m.structuralTrauma||null),concussionRisk:m.concussionRisk||0,partStructuralState:Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,{state:p.structuralState||'intact',functionDisabled:!!p.functionDisabled,irreversibleWithoutTreatment:!!p.irreversibleWithoutTreatment}])),brainInjury:structuredClone(m.brainInjury||null),heartInjury:structuredClone(m.heartInjury||null),weightBearingFracture:structuredClone(m.weightBearingFracture||null),spinalCordInjury:structuredClone(m.spinalCordInjury||null),canShoot:m.canShoot,canWalk:m.canWalk,canCrawl:m.canCrawl,partFunction:Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.functionRatio])),cardiacArrest:m.cardiacArrest,arrestReason:m.arrestReason,arrestElapsedS:m.arrestElapsedS,arrestDetails:m.arrestDetails,downReasonDetails:m.downReasonDetails,ischemicLoad:Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.ischemicLoad])),acutePain:m.acutePain,painFloor:m.painFloor,abdomenPainFloor:m.abdomenPainFloor||0,perceivedPain:m.stressResponse.perceivedPain,consciousnessTarget:m.consciousnessTarget,shockTarget:m.shockTarget,hemodynamics:structuredClone(m.hemodynamics),adrenaline:m.stressResponse.adrenaline,painMasking:m.stressResponse.painMasking}:{}),
    partDestruction:Object.fromEntries(Object.entries(m.partDestruction).map(([k,p])=>[k,p.state]))};
}
export class TrainingMedical {
  constructor({medicalModel='v2',targetId='H01',team='enemy'}={}){this.targetId=targetId;this.team=team;this.medicalModel=medicalModel;this.reset();}
  get referenceFlows(){return bleedingWounds(this.actor.medical).map(w=>({woundId:w.id,...referenceFlow(w)}));}
  get surfaceRecords(){return medicalSurfaces(this);}
  setMedicalModel(model){if(!['legacy','v2'].includes(model))throw Error('Unknown medical model');if(model!==this.medicalModel){this.medicalModel=model;this.reset();}}
  reset(){
    clearMedicalSurfaces(this);
    this.seed=0x6d656469;this.time=0;this.events=[];this.timeline=[];this.seen=new Set();this.current=null;
    this.legacy=createLegacyMedical(CATALOG,()=>{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;},()=>this.rearProjection());
    if(this.medicalModel==='v2'){this.legacy.installMedicalSlots(createMedicalV2Slots);installMedicalS3Adapter(this.legacy);this.legacy.installMedicalSlots(createDrugSlots);}
    this.actor=this.legacy.makeUnit({team:this.team,name:this.targetId,x:0,y:0,loadout:{},bodyArmorId:'none',helmetId:'none',frontPlateId:'none',backPlateId:'none'});
    if(this.medicalModel==='v2')ensureMedicalV2(this.actor);
    this.legacy.ensureMedicalExtensions(this.actor);this.legacy.recalcMedicalSummary(this.actor);this.legacy.syncLegacyCombatState(this.actor);
    this.activity=new MedicalActivity(this.actor.medical);
  }
  rearProjection(){
    const r=this.current?.rearArmor;
    if(!r)return {candidate:'none',rearArmorResult:'no_rear_armor',penAfter:this.current?.body.penAfterBody||0,armorValue:0};
    const stopped=/block$/.test(r.outcome),plate=r.kind==='plate';
    return {candidate:plate?'rear_plate':'rear_soft',rearArmorResult:stopped?(plate?'stopped_by_rear_plate':'stopped_by_rear_soft'):'rear_armor_penetrated',
      penAfter:r.after.penetration,armorValue:r.effectiveArmor,material:r.material,durabilitySlotKey:r.ownerId,exitAspect:r.slot,source:'completed-3d-trace'};
  }
  record(event, physics){
    if(this.seen.has(event.shotId))return [];this.seen.add(event.shotId);
    if((event.trace.bodyHits||[]).some(b=>b.targetId===this.targetId)||(event.trace.armorResults||[]).some(r=>r.targetId===this.targetId))this.onEquipmentHit?.(event);
    const care=activeTreatment(this.actor.medical);if(care&&((event.trace.bodyHits||[]).some(b=>b.targetId===this.targetId)||(event.trace.armorResults||[]).some(r=>r.targetId===this.targetId))){care.status='interrupted';care.interruptedAtS=event.time;care.interruptionReason='피격';}
    this.time=event.time;this.legacy.setTime(this.time);
    // Independent medical stream is seeded only AFTER traceShot has completed.
    this.seed=(event.shotId^0x6d656469)>>>0;
    const records=[],ammo=CATALOG.AMMO_PRESETS[event.ammoId],structuralPrefixes=new Map();let order=0;
    const pending=event.trace.armorResults.filter(r=>r.targetId===this.targetId&&r.outcome==='ricochet').sort((a,b)=>a.distance-b.distance);
    const deflectionsBefore=distance=>{
      while(pending.length&&pending[0].distance<=distance){
        const record=this.recordDeflection(pending.shift(),event,physics,ammo,order+1);
        if(record){order++;records.push(record);this.events.push(record);}
      }
    };
    for(const body of event.trace.bodyHits||[]){
      deflectionsBefore(body.distance);
      for(const part of body.parts||[]){
      if(body.targetId!==this.targetId)continue;
      const mapping=mapMedicalAddress(part.address),earlier=event.trace.armorResults.filter(r=>r.targetId===this.targetId&&r.distance<=body.distance);
      const rearArmor=event.trace.armorResults.find(r=>r.targetId===this.targetId&&r.distance>body.distance+body.pathLengthM-1e-5);
      const originalK=this.legacy.computeProjectileKinetics(ammo,part.velocityInMps,event.ballistics.muzzleVelocityMps),mass=part.massInKg??originalK.massKg;
      const k=part.massInKg==null?originalK:{...originalK,massKg:mass,impactEnergyJ:.5*mass*part.velocityInMps**2,impactMomentumNs:mass*part.velocityInMps};
      const metadata={shotId:event.shotId,order:++order,time:event.time,skinContact:true,ammoId:event.ammoId,
        address:structuredClone(part.address),mappedAddress:structuredClone(mapping.impactAddress),bodyPart:part.bodyPart,
        entryVelocityMps:part.velocityInMps,energyDepositedJ:part.energyShareJ,pathLengthM:part.lengthM,depth:part.depth,exitWound:part.exitWound,
        armorHistory:structuredClone(earlier),residual:{penIn:part.penIn,damageIn:part.damageIn,stability:body.before.stability},ruleId:body.ruleId};
      if(this.medicalModel==='v2'){
        const start=part.entryDistance-body.entryDistance,end=part.exitDistance-body.entryDistance;
        const hits=(body.internalHits||[]).flatMap(h=>{const intervals=h.intervals.map(([a,b])=>[Math.max(start,a),Math.min(end,b)]).filter(([a,b])=>b>a);return intervals.length?[{...h,intervals,entryDepthM:intervals[0][0],exitDepthM:intervals.at(-1)[1],traversedLengthM:intervals.reduce((n,[a,b])=>n+b-a,0)}]:[];});
        metadata.internalGeometry={source:'completed 3D occupied body segment, clipped to this part',internalHits:hits,nearMisses:(body.nearMisses||[]).filter(h=>h.closestDepthM>=start&&h.closestDepthM<=end)};
        // S2 has already integrated this exact occupied segment in traceShot.
        // Reusing its result keeps HP, physiology and actual projectile energy
        // on one calculation. An explicit legacy trace has no S2 channel.
        metadata.woundChannel=part.woundChannel||null;
        metadata.structuralHit=advanceStructuralHitS2(structuralPrefixes,{shotId:event.shotId,targetId:body.targetId,partKey:part.bodyPart,channel:metadata.woundChannel});
        metadata.velocityOutMps=part.velocityOutMps??null;
        metadata.projectileMassInKg=mass;metadata.projectileMassOutKg=part.massOutKg??mass;
        metadata.concussionRisk=part.woundChannel?.concussionRisk||0;
      }
      const ev={sourceType:'bullet',hitPart:mapping.hitPart,isLeft:mapping.isLeft,hitZone:mapping.location,
        ammoId:event.ammoId,weaponId:event.ballistics.weaponId||'m4a1',rawDamage:part.damageIn,armorResult:body.bodyEntered?'penetrated':'stopped',penetration:part.penIn,
        ammoMedicalProfile:this.legacy.getAmmoMedicalProfile(ammo),impactAddress:mapping.impactAddress,
        _shotVelocity:part.velocityInMps,_shotInitialVelocity:event.ballistics.muzzleVelocityMps,
        impactPacket:{kineticBasis:true,impactVelocityMps:part.velocityInMps,impactEnergyJ:k.impactEnergyJ,impactMomentumNs:k.impactMomentumNs,
          energyRatio:k.energyRatio,residualPen:part.penIn,residualIntegrity:body.before.stability},trainingMetadata:metadata};
      if(metadata.woundChannel)ev.tissueDamage=part.damageIn*(ev.ammoMedicalProfile.tissueDamageMul||1)*metadata.woundChannel.damageMultiplier;
      this.current={body,rearArmor};const count=this.actor.medical.wounds.length;
      if(this.medicalModel==='v2'&&part.bodyPart==='head')this.actor.medical._s0ImpactContext={consciousness:this.actor.medical.consciousness,handled:false};
      try{this.legacy.applyDamageEvent(this.actor,ev);}finally{delete this.actor.medical._s0ImpactContext;}
      const wound=this.actor.medical.wounds.length>count?this.actor.medical.wounds.at(-1):null;
      if(wound&&this.medicalModel==='v2'){registerBleedingWoundB1(this.actor.medical,wound);}
      if(wound){wound.trainingMetadata=structuredClone(metadata);if(this.medicalModel==='v2')wound.trainingMetadata.internalInputMapping=structuredClone(wound.bodyTrajectory.internalInputMapping);}
      const record={...metadata,woundId:wound?.id||null,partKey:part.bodyPart,
        bleedSourceIds:structuredClone(wound?.bleedSourceIds||[]),vesselContusions:structuredClone(wound?.vesselContusions||[]),
        medicalDepth:wound?.bodyTrajectory?.woundDepthClass||null,bleedingClass:wound?.bleedingClass||null,bleedGrade:wound?.bleedingClass||null,
        skippedAfterDeath:!wound&&this.actor.isDead};
      records.push(record);this.events.push(record);
      if(wound){const surface=recordMedicalSurface(this,wound,{body,part,physics,event});recordWorkOpening(this.actor.medical,wound,surface);}
      }
    }
    deflectionsBefore(Infinity);
    const blocked=event.trace.armorResults.findLast(r=>r.targetId===this.targetId&&/block$/.test(r.outcome));
    if(blocked){
      const reflected=event.trace.armorResults.some(r=>r.outcome==='ricochet'&&r.distance<blocked.distance);
      const projected=physics?.bodyPaths(reflected?new Vector3(...blocked.point):event.origin,
        reflected?new Vector3(...blocked.incomingDirection):event.direction,90).find(p=>p.actor.id===this.targetId);
      if(projected){
        const mapping=mapMedicalAddress(projected.address),backer=event.trace.armorResults.find(r=>r.targetId===this.targetId&&r.backer)?.backer||{};
        const ctx={bodyPart:mapping.hitPart,location:mapping.location,isLeft:mapping.isLeft,impactAddress:mapping.impactAddress,
          stopStage:blocked.outcome==='backer_block'?'hard_pen_soft_block':blocked.outcome,blockMaterial:blocked.material,penetrated:false,
          bluntModifier:backer.bluntModifier,shockModifier:backer.shockModifier,painModifier:backer.painModifier};
        this.current={body:{penAfterBody:0}};
        this.legacy.applyOutcome(this.actor,this.legacy.OUTCOME.BLOCK,{id:event.ballistics.weaponId==='ak74m'?'ak74':'m4a1',_ammo:ammo,ammoId:ammo.id,ammoMedicalProfile:this.legacy.getAmmoMedicalProfile(ammo)},ctx);
        const record={shotId:event.shotId,order:++order,time:event.time,skinContact:false,label:'피부 미접촉',
          address:structuredClone(projected.address),armorLayerId:blocked.layerId,bluntSource:'original applyOutcome(BLOCK) → applyDamageEvent',
          damageEvent:structuredClone(this.actor.medical._lastDamageEvent||null)};
        this.events.push(record);records.push(record);
      }
    }
    if(this.medicalModel==='v2'){finalizeBleedingSources(this.actor.medical);this.legacy.syncLegacyCombatState(this.actor);captureReferenceFlows(this.actor);}
    this.current=null;
    if(this.events.length>256)this.events.splice(0,this.events.length-256);
    this.activity.recordWounds();return structuredClone(records);
  }
  recordDeflection(deflected,event,physics,ammo,order){
    const head=physics?.humanSensors.find(s=>s.actor.id===this.targetId&&s.shape.id==='head');
    if(!head)return null;
    // Lost projectile energy is a bounded coupling proxy, not measured head energy.
    const response=deflected.ricochet,transfer=Math.max(0,Math.min(1,response.energyDepositedJ/response.energyInJ));
    const address=resolveBodyAddress(head.actor,head.shape,new Vector3(...deflected.point),
      new Vector3(...deflected.incomingDirection),physics.humanRigs.get(this.targetId));
    const mapping=mapMedicalAddress(address),velocity=deflected.before.velocityMps*Math.sqrt(transfer);
    const k=this.legacy.computeProjectileKinetics(ammo,velocity,event.ballistics.muzzleVelocityMps);
    const ctx={bodyPart:mapping.hitPart,location:mapping.location,isLeft:mapping.isLeft,
      impactAddress:{...mapping.impactAddress,ricochetHint:{ricocheted:true}},
      stopStage:'hard_block',blockMaterial:deflected.material,penetrated:false,
      bluntModifier:transfer,shockModifier:transfer,painModifier:transfer,
      shotVelocity:velocity,shotInitialVelocity:event.ballistics.muzzleVelocityMps,
      impactPacket:{kineticBasis:true,impactVelocityMps:velocity,impactEnergyJ:k.impactEnergyJ,
        impactMomentumNs:k.impactMomentumNs,energyRatio:k.energyRatio,residualPen:0,residualIntegrity:0}};
    this.current={body:{penAfterBody:0}};
    this.legacy.applyOutcome(this.actor,this.legacy.OUTCOME.BLOCK,{id:event.ballistics.weaponId==='ak74m'?'ak74':'m4a1',_ammo:ammo,ammoId:ammo.id,
      ammoMedicalProfile:this.legacy.getAmmoMedicalProfile(ammo)},ctx);
    return {shotId:event.shotId,order,time:event.time,skinContact:false,label:'헬멧 도탄 · 피부 미접촉',
      address:structuredClone(address),armorLayerId:deflected.layerId,ricochet:structuredClone(response),
      bluntCouplingProxy:transfer,bluntSource:'original applyOutcome(BLOCK), deflected; projectile energy-loss coupling proxy',
      damageEvent:structuredClone(this.actor.medical._lastDamageEvent||null)};
  }
  tick(dt,time,active=true){if(!active)return;if(this.medicalModel==='v2')captureReferenceFlows(this.actor);setCareTime(this.actor.medical,time);this.time=time;this.legacy.setTime(time);this.activity.step(dt,time);stepCareMovement(this,dt);
    if(!this.actor.isDead&&(this.actor.alive||this.actor.isDowned)){
      stepDrugsAndBlood(this,dt);systemicCarePain(this.actor.medical);careClinicalBefore(this.actor.medical);
      this.legacy.tickUnitMedicalBefore(this.actor,dt);
      this.legacy.tickMedical(this.actor,dt);
      this.legacy.tickUnitMedicalAfter(this.actor,dt);
      careClinicalAfter(this.actor.medical);careSafetyAfter(this);
    }
    if(this.events.length&&Math.floor(time)>Math.floor(this.timeline.at(-1)?.time??-1)){
      this.timeline.push(medicalObservation(this.actor,time));
      if(this.timeline.length>600)this.timeline.shift();
    }
  }
  validate(){const report={errors:[],error(k,message){this.errors.push({k,message});}};this.legacy.validatePartDestructionFoundation(report,this.actor);
    return [...report.errors,...this.legacy.validateWoundPipelineInvariants(this.actor,{noThrow:true}),...this.legacy.validateWoundUiProjection(this.actor),...this.legacy.diagnostics().pipelineErrors];}
  snapshot(){return structuredClone({targetId:this.targetId,time:this.time,combatState:this.actor.combatState,medical:this.actor.medical,events:this.events,timeline:this.timeline,errors:this.validate()});}
}
