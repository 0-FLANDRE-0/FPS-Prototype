import{medicalNoise,noiseKnot}from'./medical-noise.js';
export const EYELIDS=Object.freeze({classification:'정성 근거: Lempert/Caffier/Prkachin; 모든 시간·속도 문턱·형상: 튜닝',declineSmoothingS:5,rapidDeclinePointsPerS:4,drowsyConfirmationS:4.2,drowsyConsciousness:[80,22],painSquintRange:[30,95],painSquintMaximum:.65,painRiseThresholdPerS:10,painReflexPainPower:.7,painReflexRateScale:180,painReflexRefractoryS:.35,painReflexS:[.035,.045,.12],shapeReferenceAspect:16/9,boundaryFeather:.13});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
export class MedicalEyelids{
 constructor(){this.previousCons=100;this.filteredDecline=0;this.previousPain=0;this.event=0;this.stage=0;this.age=0;this.duration=0;this.rapid=false;this.slowAge=0;this.painAt=-Infinity;this.painPeak=0;this.lastClosure=0;}
 enter(stage,severity){this.stage=stage;this.age=0;const n=(noiseKnot(++this.event,91)+1)/2;this.duration=stage===1?mix(3.2,1.3,severity)*mix(.7,1.4,n):stage===2?mix(.3,.8,severity)*mix(.8,1.2,n):stage===3?mix(1.4,.55,severity)*mix(.7,1.3,n):stage===4?mix(.65,1.65,severity)*mix(.8,1.2,n):stage===5?mix(.09,.22,severity)*mix(.8,1.2,n):mix(.8,1.6,n);}
 step(dt,time,input,m){
  const h=Math.max(0,dt),rawDecline=Math.max(0,this.previousCons-input.consciousness)/Math.max(1/120,h),alpha=1-Math.exp(-h/EYELIDS.declineSmoothingS);
  this.filteredDecline+=(rawDecline-this.filteredDecline)*alpha;this.previousCons=input.consciousness;
  if(m?.brainInjury||this.filteredDecline>EYELIDS.rapidDeclinePointsPerS)this.rapid=true;
  if(input.consciousness>90&&this.filteredDecline<.15&&!m?.brainInjury)this.rapid=false;
  const severity=smooth(...EYELIDS.drowsyConsciousness,input.consciousness),unconscious=Boolean(m?.isUnconscious||m?.isDead||m?.cardiacArrest),candidate=severity>0&&!this.rapid;
  // Wait for a sustained slow decline before the first drowsy blink. This
  // avoids a false blink while the rate smoother catches an acute collapse.
  this.slowAge=candidate?this.slowAge+h:0;const slow=candidate&&this.slowAge>=EYELIDS.drowsyConfirmationS;
  let drowsy=0;
  if(slow){
   if(!this.stage)this.enter(1,severity);this.age+=h;
   if(this.age>=this.duration){const next=this.stage===1?2:this.stage===2?(severity>.3?3:1):this.stage===3?(severity>.48?4:1):this.stage===4?5:this.stage===5?6:severity>.4?3:1;this.enter(next,severity);}
   const p=clamp(this.age/this.duration),base=severity*.5;
   if(this.stage===1){const blink=p<.085?smooth(0,.085,p):p<.12?1-smooth(.085,.12,p):0;drowsy=blink*mix(.2,.5,severity);}
   else if(this.stage===2){const close=.72;drowsy=(p<close?smooth(0,close,p):1-smooth(close,1,p))*mix(.35,.82,severity);}
   else if(this.stage===3)drowsy=base+.025*medicalNoise(time,.12,93)*severity;
   else if(this.stage===4)drowsy=mix(base,.98,smooth(0,1,p));
   else if(this.stage===5)drowsy=mix(.98,base*.35,1-(1-p)**3);
   else drowsy=mix(base*.35,base,smooth(0,1,p));
   drowsy=Math.max(drowsy,smooth(34,22,input.consciousness)*.95);
   if(unconscious)drowsy=1;
  }else{this.stage=0;this.age=0;}
  const painRise=Math.max(0,input.perceivedPain-this.previousPain)/Math.max(1/120,h);this.previousPain=input.perceivedPain;
  if(!unconscious&&painRise>EYELIDS.painRiseThresholdPerS&&time-this.painAt>EYELIDS.painReflexRefractoryS){this.painAt=time;this.painPeak=clamp((input.perceivedPain/100)**EYELIDS.painReflexPainPower*(.4+.6*clamp(painRise/EYELIDS.painReflexRateScale)));}
  const age=time-this.painAt,[close,hold,open]=EYELIDS.painReflexS,reflex=age<0||age>=close+hold+open?0:age<close?smooth(0,close,age):age<close+hold?1:1-smooth(close+hold,close+hold+open,age);
  const sustained=smooth(...EYELIDS.painSquintRange,input.perceivedPain)*EYELIDS.painSquintMaximum,pain=unconscious?0:Math.max(sustained,reflex*this.painPeak);
  const result={drowsy:clamp(drowsy),pain:clamp(pain),closure:Math.max(clamp(drowsy),clamp(pain)),stage:this.stage,stageName:['open','occasional-blink','long-blink','struggle','slow-close','startle-open','redroop'][this.stage],stageAgeS:this.age,stageDurationS:this.duration,slowCandidateS:this.slowAge,declinePointsPerS:this.filteredDecline,rawDeclinePointsPerS:rawDecline,rapidDecline:this.rapid,drowsyEnabled:slow,severity,painRisePerS:painRise,painReflex:reflex*this.painPeak,painSustained:sustained};this.lastClosure=result.closure;return result;
 }
}
