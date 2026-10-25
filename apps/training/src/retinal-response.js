// Presentation only: gait/IK and collision-resolved exercise samples must not
// switch the whole-screen dimmer immediately. Raw physiology stays untouched.
export const RETINAL_RESPONSE=Object.freeze({ruleId:'medical-vision-stability-v56',attackTauS:.18,recoveryTauS:.45,settleEpsilon:1e-6,classification:'튜닝 / 화면 표현; 생리 수식 아님'});
export class RetinalResponse{
 constructor(){this.reset();}
 reset(){this.tunnel=this.blackout=null;}
 step(dt,retina){
  for(const key of ['tunnel','blackout']){
   const target=retina[key];
   if(this[key]===null)this[key]=target;
   else if(dt>0){
    const tau=target>this[key]?RETINAL_RESPONSE.attackTauS:RETINAL_RESPONSE.recoveryTauS;
    this[key]=target+(this[key]-target)*Math.exp(-dt/tau);
    if(Math.abs(this[key]-target)<RETINAL_RESPONSE.settleEpsilon)this[key]=target;
   }
  }
  return{tunnel:this.tunnel,blackout:this.blackout,rawTunnel:retina.tunnel,rawBlackout:retina.blackout};
 }
}
