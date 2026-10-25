import{medicalNoise,noiseKnot}from'./medical-noise.js';
export const MEDICAL_WAVES=Object.freeze({classification:'튜닝; 생리적 떨림 8–12Hz 대역만 문헌 근거',tremorBandHz:[8,12],tremorComponents:48,tremorYawRmsAtAdrenaline1Rad:.00045,tremorPitchRatio:.7,panicTremorRad:.0003,amplitudeModulation:.18,breathInhaleFraction:.38,breathPeriodJitter:.08,heartbeatIntervalJitter:.035,screenRmsAtAdrenaline1CssPx:.65});
const TAU=2*Math.PI,components=Array.from({length:MEDICAL_WAVES.tremorComponents},(_,i)=>({hz:8+(i+.5+.35*noiseKnot(i,64))/MEDICAL_WAVES.tremorComponents*4,phase:Math.PI*(noiseKnot(i,65)+1),other:Math.PI*(noiseKnot(i,66)+1)}));
export function tremorSignal(time){let x=0,y=0;for(const c of components){x+=Math.sin(TAU*c.hz*time+c.phase);y+=Math.sin(TAU*c.hz*time+c.other);}const norm=Math.sqrt(2/components.length)*(1+MEDICAL_WAVES.amplitudeModulation*medicalNoise(time,4.9,71));return{x:x*norm,y:y*norm};}
export function breathWave(phase){const p=((phase%1)+1)%1,inhale=MEDICAL_WAVES.breathInhaleFraction;return p<inhale?-Math.cos(Math.PI*p/inhale):Math.cos(Math.PI*(p-inhale)/(1-inhale));}
// Short beat, small recoil and a quiet diastole; zero mean and sine-like RMS.
export function heartbeatWave(phase){const p=((phase%1)+1)%1;return(Math.exp(-p/.055)-.055*(1-Math.exp(-1/.055)))*4.52;}
export class MedicalWaveforms{
 constructor(){this.breathPhase=this.heartPhase=0;}
 step(dt,time,input,sprinting=false){
  const breathHz=.35+(100-input.breathing)/100*.5+input.thoraxPain*.3+(input.exerciseIntensity||0)*.5+(input.legFatigue||0)*.18;
  this.breathPhase+=Math.max(0,dt)*breathHz*(1+MEDICAL_WAVES.breathPeriodJitter*medicalNoise(time,7.1,81));
  this.heartPhase+=Math.max(0,dt)*Math.max(0,input.heartRate)/60*(1+MEDICAL_WAVES.heartbeatIntervalJitter*medicalNoise(time,3.7,83));
  const amplitude=input.adrenaline*MEDICAL_WAVES.tremorYawRmsAtAdrenaline1Rad+input.panic*MEDICAL_WAVES.panicTremorRad,fast=amplitude?tremorSignal(time):{x:0,y:0};
  const breath=(input.amplitudes.breathing+input.amplitudes.thorax*(sprinting?1.5:1)+(input.exerciseIntensity||0)*.0007+(input.legFatigue||0)*.00025)*breathWave(this.breathPhase),heartbeat=input.amplitudes.heartRate*.3*heartbeatWave(this.heartPhase),screenGain=MEDICAL_WAVES.screenRmsAtAdrenaline1CssPx*(input.adrenaline+input.panic*.4);
  return{tremor:{yaw:fast.x*amplitude,pitch:fast.y*amplitude*MEDICAL_WAVES.tremorPitchRatio},breath,heartbeat,screenJitterCssPx:[fast.x*screenGain,fast.y*screenGain],breathPhase:this.breathPhase,heartPhase:this.heartPhase};
 }
}
