import{drugPresentation}from'./medical-care-drugs.js';
import {activityFor} from './medical-d2.js';
// D1 is a read-only consumer. Never writes physiology, damage or collapse flags.
// Aim factor decomposition mirrors updateMedicalPerformanceMultipliers in the
// untouched legacy-medical.js. All actuator/vision mappings are game tuning.
import {COMBAT} from './combat-config.js';
import {MedicalAimHold} from './medical-aim-hold.js';
import {MedicalWaveforms} from './medical-waveforms.js';
import {MedicalEyelids} from './medical-eyelids.js';
import {retinalVision} from './retinal-vision.js';
import {RetinalResponse} from './retinal-response.js';
export const D1=Object.freeze({ruleId:'medical-feedback-d2-v55',tremorHz:10,panicHz:8.7,painHz:.37,driftHz:.13,curveRad:.0025,curvePower:.7,maxSwayRad:.012,armDropM:.012,sprintLegFunction:.65,limpAsymmetry:.25,limpDipM:.025,orthostaticS:30,orthostaticRiseS:1.5,maxAuditoryExclusionDb:12,minimumAuditoryHz:2500,minimumFovDeg:30,impairedSightM:50,bloodLossVisionStart:.15,bloodLossVisionFull:.445,bloodLossDesaturation:[.15,.40],bloodLossPeripheral:[.20,.445],bloodLossTunnel:[.30,.445],bloodLossBlackout:[.38,.445],adrenalineSharpenRange:[.15,.85],adrenalineSharpenGain:1.65,adrenalineDarkOvershootRatio:.22,adrenalineLocalContrast:.08});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=(a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x);},finite=(v,d)=>Number.isFinite(v)?v:d;
export const painStage=p=>p<30?1:p<60?2:p<80?3:4;
const partKeys=['leftArm','rightArm','leftLeg','rightLeg','chest','abdomen'];
export function readMedicalFeedback(m){
 const s=m?.stressResponse||{},h=m?.hemodynamics||{},mask=clamp(finite(s.painMasking,0)),perceived=clamp(finite(s.perceivedPain,finite(m?.pain,0)*(1-mask)),0,100),adrenaline=clamp(finite(s.adrenaline,0)),panic=clamp(finite(s.panic,0)),arousal=clamp(finite(s.combatArousal,0)),crash=clamp(finite(s.postCombatCrash,0)),cons=clamp(finite(m?.consciousness,100),0,100),perfusion=clamp(finite(h.tissuePerfusion,1)),oxygen=clamp(finite(h.oxygenDelivery,1)),map=finite(h.map,93),breathing=clamp(finite(m?.breathingEfficiency,100),0,100),heartRate=finite(m?.heartRate,75);
 const fn=k=>clamp(finite(m?.bodyParts?.[k]?.functionRatio,1)),parts={};
 for(const k of partKeys){const p=m?.bodyParts?.[k],matching=(m?.wounds||[]).filter(w=>w.partKey===k||w.bodyPart===k),raw=Math.max(k==='abdomen'?finite(m?.abdomenPainFloor,0):0,finite(p?.pain,matching.length?finite(m?.pain,0)*matching.length/Math.max(1,m.wounds.length):0)),pain=clamp(raw*(1-mask),0,100);parts[k]={pain,rawPain:raw,stage:painStage(pain),functionRatio:fn(k)};}
 const armFn=Math.min(fn('leftArm'),fn('rightArm'))*.4+(fn('leftArm')+fn('rightArm'))/2*.6;
 const factors={arms:.4+armFn*.6,pain:1-perceived/100*.35,adrenaline:adrenaline>.7?1-(adrenaline-.7)*.6:1,panic:1-panic*.4,breathing:.5+breathing/100*.5,consciousness:.4+cons/100*.6,heartRate:heartRate>150?1-Math.min(.25,(heartRate-150)/100):1,perfusion:.5+Math.min(.5,perfusion*.5)};
 const contribution=Object.fromEntries(Object.entries(factors).map(([k,v])=>[k,1-v])),reconstructedAimMul=clamp(Object.values(factors).reduce((a,b)=>a*b,1),.05,1),aimMul=clamp(finite(m?.aimMul,reconstructedAimMul),.05,1),scale=Math.min(D1.maxSwayRad,D1.curveRad*(1/aimMul-1)**D1.curvePower),total=Math.hypot(...Object.values(contribution));
 const amplitudes=Object.fromEntries(Object.entries(contribution).map(([k,v])=>[k,total?scale*v/total:0]));
 const armPain=Math.max(parts.leftArm.pain,parts.rightArm.pain)/100,thoraxPain=Math.max(parts.chest.pain,parts.abdomen.pain)/100,stage=painStage(perceived),severe=stage===4?.35:1;
 // Per-side pain and crash add presentation/handling penalties. Existing move
 // and reload multipliers are read as performance (1=normal), not durations.
 amplitudes.partArms=armPain*.0015;amplitudes.crash=crash*.002;amplitudes.thorax=thoraxPain*.0012;
 const handlingRate=Math.min(finite(m?.weaponHandlingMul,1),severe)/(1+armPain*.5+crash*.6),reloadRate=Math.min(finite(m?.reloadMul,1),severe)/(1+armPain*.5+crash*.65),stanceRate=Math.min(finite(m?.stanceChangeMul,1),severe),moveRate=Math.min(finite(m?.moveMul,1),severe);
 const limb=k=>clamp(parts[k].pain/100*.7+(1-parts[k].functionRatio)*.8),limp={left:limb('leftLeg'),right:limb('rightLeg')};
 const attention=clamp(Math.max(0,adrenaline-.55,arousal-.55)/.45*.6+panic*.5),auditoryExclusionDb=D1.maxAuditoryExclusionDb*attention;
 const bloodLoss=clamp(1-finite(m?.bloodMl,1)/Math.max(1e-9,finite(m?.bloodMax,1))),visionDrive=clamp((bloodLoss-D1.bloodLossVisionStart)/(D1.bloodLossVisionFull-D1.bloodLossVisionStart)),sprintAllowed=stage<4&&parts.leftLeg.stage<2&&parts.rightLeg.stage<2&&fn('leftLeg')>=D1.sprintLegFunction&&fn('rightLeg')>=D1.sprintLegFunction;
 const output={unconscious:!!(m?.isUnconscious||m?.isDead),perceivedPain:perceived,painMasking:mask,painStage:stage,parts,armFn,adrenaline,arousal,panic,crash,consciousness:cons,map,perfusion,oxygen,heartRate,breathing,thoraxPain,factors,contribution,amplitudes,aimMul,reconstructedAimMul,handlingRate,reloadRate,stanceRate,moveRate,sprintAllowed,limp,attention,auditoryExclusionDb,visionDrive,bloodLoss,reactionRate:clamp(finite(m?.reactionMul,1),.25,1.2)};
 return output;
}
export function feedbackVision(input,time,orthostatic=0,{posture={},eyelids=null,waves=null,retinalResponse=null}={}){
 const v=clamp(input.visionDrive),loss=input.bloodLoss??D1.bloodLossVisionStart+v*(D1.bloodLossVisionFull-D1.bloodLossVisionStart),retina=retinalVision(input,posture),response=retinalResponse||retina,volumeTunnel=smooth(...D1.bloodLossTunnel,loss),volumeBlackout=smooth(...D1.bloodLossBlackout,loss),tunnel=Math.max(volumeTunnel,response.tunnel),blackout=Math.max(volumeBlackout,response.blackout),eyelid=eyelids?.closure||0;
 return{unconscious:!!input.unconscious,drive:v,stage:blackout>=.99?'blackout':tunnel>0?'tunnel':loss>=D1.bloodLossPeripheral[0]?'peripheral-dark':loss>=D1.bloodLossDesaturation[0]?'desaturation':'normal',desaturation:smooth(...D1.bloodLossDesaturation,loss),peripheralDark:smooth(...D1.bloodLossPeripheral,loss)*.98,tunnel,blackout,volumeTunnel,volumeBlackout,perfusionTunnel:response.tunnel,perfusionBlackout:response.blackout,tunnelDriver:response.tunnel>volumeTunnel?'perfusion':'blood-volume',blackoutDriver:response.blackout>volumeBlackout?'perfusion':'blood-volume',retina,retinalResponse,blur:input.attention*.65,concussionBlur:input.concussionBlur||0,concussionBloom:input.concussionBloom||0,stressDark:input.attention*.12,eyelid,eyelidDrowsy:eyelids?.drowsy||0,eyelidPain:eyelids?.pain||0,eyelids,adrenalineSharpness:smooth(...D1.adrenalineSharpenRange,input.adrenaline),screenJitterCssPx:waves?.screenJitterCssPx||[0,0],white:orthostatic*.8,orthostatic};
}
export function convertedAI(input,vision){
 const impaired=vision.drive>0,vis=1-smooth(.15,.92,vision.drive),reaction=input.reactionRate;
 return{aimWaitS:.4/Math.max(.1,input.handlingRate),aimStartDeg:COMBAT.aimStartDeg/Math.sqrt(input.aimMul),aimFloorDeg:COMBAT.aimFloorDeg/input.aimMul*(1+3*(input.armFatigue||0)),aimConvergencePerS:COMBAT.aimConvergencePerS*input.aimMul*(input.concussionHandlingRate??1)*(1-.65*(input.armFatigue||0)),reactionS:COMBAT.reactionS.map(v=>v/reaction),shotIntervalS:COMBAT.shotIntervalS.map(v=>v/Math.max(.1,input.handlingRate)),reloadRate:input.reloadRate,moveMul:input.moveRate,walkSpeedMps:COMBAT.walkSpeedMps*input.moveRate,visionFovDeg:Math.max(D1.minimumFovDeg,COMBAT.visionFovDeg*(1-input.attention*.4)*(1-vision.tunnel*.5)),visionDistanceM:impaired?D1.impairedSightM*vis:Infinity,visionDetection:impaired?vis:1,auditoryExclusionDb:input.auditoryExclusionDb};
}
export class MedicalFeedback{
 constructor(){this.time=0;this.previousCrouched=null;this.riseAt=-Infinity;this.risePeak=0;this.dip=0;this.hold=new MedicalAimHold();this.eyelids=new MedicalEyelids();this.waveforms=new MedicalWaveforms();this.retinalResponse=new RetinalResponse();this.output=this.sample(null,0,false);}
 sample(m,time,sprinting,input=readMedicalFeedback(m),context={}){
  const age=time-this.riseAt,orthostatic=age>=0&&age<D1.orthostaticS?this.risePeak*(1-Math.exp(-age/D1.orthostaticRiseS))*(1-age/D1.orthostaticS)**2:0,waves=context.waves||this.waveforms.step(0,time,input,sprinting),vision=feedbackVision(input,time,orthostatic,{...context,waves}),hold=this.hold.snapshot();
  const drug=drugPresentation(m,time);if(drug){Object.assign(vision,drug);vision.blur=Math.max(vision.blur,drug.drugBlur);}
  const angles={yaw:waves.tremor.yaw+hold.yaw,pitch:waves.tremor.pitch+hold.pitch,roll:(input.parts.rightArm.pain-input.parts.leftArm.pain)/100*.002};
  for(const k of Object.keys(angles))if(angles[k]===0)angles[k]=0;
  const dropM=(1-input.armFn)*D1.armDropM+Math.max(input.parts.leftArm.pain,input.parts.rightArm.pain)/100*.003;
  // AI keeps the v52 volume-only sight mapping. D1b changes player presentation.
  return{...input,angles,aimHold:hold,waves,dropM,cameraDropM:this.dip,vision,orthostaticRemainingS:orthostatic?Math.max(0,D1.orthostaticS-age):0,ai:convertedAI(input,{...vision,tunnel:vision.volumeTunnel}),active:Object.values(angles).some(v=>v!==0)||dropM>0||vision.drive>0||vision.tunnel>0||vision.blackout>0||vision.eyelid>0||input.attention>0};
 }
 step(dt,time,m,{crouched=false,sprinting=false,eyeHeightM,lying=false}={}){
  if(time<this.time){this.hold.reset();this.eyelids=new MedicalEyelids();this.waveforms=new MedicalWaveforms();this.retinalResponse.reset();this.riseAt=-Infinity;this.previousCrouched=null;this.dip=0;}
  if(this.previousCrouched===true&&!crouched){const input=readMedicalFeedback(m);this.riseAt=time;this.risePeak=clamp(input.bloodLoss/.35)*clamp(Math.max(0,(95-input.map)/45)+input.bloodLoss*.4)*.55;}
  const input=readMedicalFeedback(m),activity=activityFor(m)?.feedback();
  if(activity){Object.assign(input,activity);const rate=activity.concussionHandlingRate;input.handlingRate*=rate;input.reloadRate*=rate;input.reactionRate*=rate;input.auditoryExclusionDb=Math.max(input.auditoryExclusionDb,activity.concussionHearingDb);}
  const eyelids=this.eyelids.step(dt,time,input,m),waves=this.waveforms.step(dt,time,input,sprinting);this.hold.step(dt,time,input,waves);
  if(input.unconscious)this.retinalResponse.reset();
  const posture={crouched,eyeHeightM,lying},retinalResponse=this.retinalResponse.step(dt,retinalVision(input,posture));
  this.previousCrouched=crouched;this.time=time;this.dip*=Math.exp(-dt/ .12);this.output=this.sample(m,time,sprinting,input,{posture,eyelids,waves,retinalResponse});return this.output;
 }
 contacts(events){for(const e of events){const strength=this.output.limp[e.side];if(strength){this.dip=-D1.limpDipM*strength;this.output.cameraDropM=this.dip;}}}
 snapshot(){return structuredClone({ruleId:D1.ruleId,time:this.time,...this.output});}
}
export const HEALTHY_FEEDBACK=Object.freeze(new MedicalFeedback().output);
