import {SOUND,NOISE_TYPE_PROFILE} from './sound-acoustics.js';
import {AUDIO_TUNING as T} from './sound-tuning.js';
import {D1} from './medical-feedback.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function newHearing(){return{dose:0,loss:0,maskDb:0,lastExposureDb:null,exposures:0};}
export function tickHearing(h,dt){h.dose*=Math.exp(-dt/T.doseRecoveryS);h.loss=1-Math.exp(-h.dose);h.maskDb=Math.max(0,h.maskDb-dt*12);}
export function exposeHearing(h,event,physical){
 if(!['gunshot','crack'].includes(event.type)||physical.exposureDb<95)return;
 // Physical impulse duration stays independent of the longer recording tail.
 const duration=event.durationS??.125;h.dose=clamp(h.dose+T.dosePer140DbImpulse*10**((physical.exposureDb-140)/10)*(duration/T.referenceImpulseS),0,8);h.loss=1-Math.exp(-h.dose);h.maskDb=Math.max(h.maskDb,physical.exposureDb-55);h.lastExposureDb=physical.exposureDb;h.exposures++;
}
export function hearingPresentation(h){
 const loss=clamp(h.loss,0,1),ring=clamp((loss-T.tinnitusOnsetLoss)/(T.tinnitusFullLoss-T.tinnitusOnsetLoss),0,1);
 return{lowpassHz:20000*(1-loss)+900*loss,gain:1-loss*.65,tinnitusGain:ring*ring*(3-2*ring)*T.tinnitusMaxGain};
}
export function combinedHearingPresentation(h,feedback){
 const p=hearingPresentation(h);p.tinnitusGain=Math.max(p.tinnitusGain,feedback?.concussionTinnitusGain||0);const exclusion=clamp(feedback?.auditoryExclusionDb||0,0,D1.maxAuditoryExclusionDb);
 if(!exclusion)return p;
 return{...p,lowpassHz:Math.min(p.lowpassHz,20000-(20000-D1.minimumAuditoryHz)*exclusion/D1.maxAuditoryExclusionDb),gain:Math.min(p.gain,10**(-exclusion/20))};
}
// Port of the original 2D probability/error/confidence skeleton. d/r is replaced
// by uncompressed dB margin; original suppression/pain/deafness multipliers retained.
export function hearNoise(event,physical,hearing,medical,random,feedback=null){
 const profile=NOISE_TYPE_PROFILE[event.type],thresholdDb=Math.max(SOUND.backgroundDb+SOUND.hearingMarginDb,hearing.maskDb)+Math.max(hearing.loss*25,feedback?.auditoryExclusionDb||0),marginDb=physical.levelDb-thresholdDb;
 const blocked=physical.dominant==='wall'&&physical.components.some(c=>c.wallHits.length),factor=clamp(marginDb/SOUND.levelMarginRangeDb,0,1);
 let probability=marginDb>=0?Math.min(1,.35+.65*factor*Math.max(.3,profile.loudness)):0;
 if((medical.suppression??0)>50)probability*=.7;if((feedback?.perceivedPain??medical.pain??0)>60)probability*=.75;if(blocked)probability*=.7;if(hearing.loss>.65)probability*=.12;
 const heard=probability>0&&random()<probability;let estimatedPosition=null,positionErrorM=null,confidence=0;
 if(heard){positionErrorM=(.4+(1-factor)*1.75)*(blocked?1.6:1)*(event.type.startsWith('footstep')?1.3:1);const angle=(random()-.5)*Math.PI*2,radius=random()*positionErrorM,p=physical.apparentPosition;estimatedPosition=[p[0]+Math.cos(angle)*radius,p[1],p[2]+Math.sin(angle)*radius];confidence=profile.conf*(.6+.4*factor)*(blocked?.7:1);}
 return{heard,probability,thresholdDb,marginDb,levelDb:physical.levelDb,blocked,factor,estimatedPosition,positionErrorM,confidence,arrivalKind:physical.dominant,arrivalPosition:physical.apparentPosition};
}
