// Presentation tuning: a hand/shoulder servo tries to recover the intended
// sight line. Coherent disturbances weaken that hold briefly; ADS input stays on.
import{medicalNoise,medicalFractal}from'./medical-noise.js';
export{medicalNoise}from'./medical-noise.js';
export const AIM_HOLD=Object.freeze({frequencyRadS:9,dampingRatio:.82,minimumStrength:.28,lapsePeriodS:3.8,maxAlignmentLoss:.42,alignmentResponse:5,maxErrorRad:.012,fractalGain:.96,adrenalineImpairment:.075});
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export class MedicalAimHold{
 constructor(){this.reset();}
 reset(){this.yaw=this.pitch=this.yawVelocity=this.pitchVelocity=0;this.alignment=1;this.lapse=0;this.strength=1;}
 step(dt,time,input,signals={breath:0,heartbeat:0}){
  // The legacy >0.7 adrenaline aim penalty remains an AI/performance value.
  // Player tremor and its slow disturbance use continuous adrenaline instead.
  const bodyAimMul=Math.min(1,input.aimMul/Math.max(.01,input.factors?.adrenaline??1));
  const impairment=clamp((1-bodyAimMul)/.8+input.amplitudes.partArms*50+input.crash*.15+input.adrenaline*AIM_HOLD.adrenalineImpairment+(input.armFatigue||0)*.8);
  if(impairment===0&&input.adrenaline===0&&input.panic===0&&!signals.breath&&!signals.heartbeat){this.reset();return;}
  const a=input.amplitudes,noise=(medicalNoise(time,AIM_HOLD.lapsePeriodS,7)+1)/2;
  this.lapse=smooth((noise-.45)/.43)*clamp((impairment-.18)/.65);
  this.strength=(1-this.lapse*(1-AIM_HOLD.minimumStrength))*(1-.6*(input.armFatigue||0));
  const omega=AIM_HOLD.frequencyRadS*Math.sqrt(this.strength),kp=omega*omega,kd=2*AIM_HOLD.dampingRatio*omega;
  const slow=a.pain+a.arms+a.consciousness+a.perfusion+a.crash+a.partArms+a.panic*.125+input.adrenaline*.00008+(input.armFatigue||0)*.0035;
  const targetYaw=slow*medicalFractal(time,1.7,2)*AIM_HOLD.fractalGain*(1+this.lapse),targetPitch=slow*.75*medicalFractal(time,2.3,3)*AIM_HOLD.fractalGain+this.lapse*impairment*.003+signals.breath+signals.heartbeat;
  // Same fixed-time integration for both axes; subdivision keeps QA dt changes
  // stable. Forces remain bounded and aim is always drawn back toward zero.
  const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
  for(let i=0;i<count;i++)for(const axis of['yaw','pitch']){
   const target=axis==='yaw'?targetYaw:targetPitch,key=axis+'Velocity';
   this[key]+=(AIM_HOLD.frequencyRadS**2*target-kp*this[axis]-kd*this[key])*h;
   this[axis]+=this[key]*h;
   if(Math.abs(this[axis])>AIM_HOLD.maxErrorRad){this[axis]=Math.sign(this[axis])*AIM_HOLD.maxErrorRad;this[key]*=.5;}
  }
  const loss=AIM_HOLD.maxAlignmentLoss*this.lapse*clamp((impairment-.2)/.8);
  this.alignment+=(1-loss-this.alignment)*(1-Math.exp(-AIM_HOLD.alignmentResponse*dt));
 }
 snapshot(){return{yaw:this.yaw,pitch:this.pitch,yawVelocity:this.yawVelocity,pitchVelocity:this.pitchVelocity,alignment:this.alignment,lapse:this.lapse,strength:this.strength};}
}
