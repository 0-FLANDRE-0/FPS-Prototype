import {COMBAT} from './combat-config.js';
// Replaceable judgment module. No original 2D CQB AI is claimed here.
export class CombatDecision{
 constructor(random){this.random=random;this.state='enter';this.since=0;this.lastTarget=null;this.reaction=0;this.nextShot=0;this.reloadUntil=0;this.transitions=[];}
 change(state,time){if(state===this.state)return;this.transitions.push({from:this.state,to:state,time});this.state=state;this.since=time;if(state==='aim')this.aimSince=time;}
 step({time,senses,arrived,rounds,medical,down,reloadDurationS,behavior=null}){
  const reaction=behavior?.reactionS||COMBAT.reactionS,interval=behavior?.shotIntervalS||COMBAT.shotIntervalS;
  if(down){this.change('down',time);return{state:this.state,move:false,aim:false,fire:false};}
  if(!senses.target&&!senses.noise&&this.lastTarget?.part==='noise'){this.lastTarget=null;if(this.state==='watch')this.change(arrived?'detect':'enter',time);}
  if(!senses.target&&senses.noise){this.lastTarget={part:'noise',point:senses.noise.point.clone()};if(this.state==='enter'||this.state==='detect')this.change('watch',time);}
  if(senses.target)this.lastTarget={part:senses.target.part,point:senses.target.point.clone()};
  if(this.state==='enter'){
   if(senses.target){this.change('reaction',time);this.reaction=reaction[0]+this.random()*(reaction[1]-reaction[0]);}
   else if(arrived)this.change('detect',time);
  }else if(this.state==='reload'){
   if(this.reloadDuration>0&&this.reloadDuration!==reloadDurationS){this.reloadUntil=time+(this.reloadUntil-time)*reloadDurationS/this.reloadDuration;this.reloadDuration=reloadDurationS;this.reloadMedical=true;}
   if(time>=this.reloadUntil){this.change(senses.target?'aim':'watch',time);return{state:this.state,reloaded:true,aim:!!this.lastTarget,target:this.lastTarget};}
  }else if(!senses.target){if(this.state!=='detect')this.change('watch',time);}
  else if(this.state==='detect'||this.state==='watch'){
   this.change('reaction',time);this.reaction=reaction[0]+this.random()*(reaction[1]-reaction[0]);
  }else if(this.state==='reaction'&&time-this.since>=this.reaction)this.change('aim',time);
  else if(this.state==='aim'&&time-this.since>=(behavior?.aimWaitS??.4)){this.change('fire',time);this.nextShot=time;}
  if(this.state==='fire'&&rounds===0){this.change('reload',time);this.reloadUntil=time+reloadDurationS;this.reloadDuration=reloadDurationS;this.reloadMedical=!!behavior&&behavior.reloadRate!==1;}
  const shoot=this.state==='fire'&&!!senses.target&&medical.canShoot!==false&&time>=this.nextShot;
  if(shoot)this.nextShot=time+interval[0]+this.random()*(interval[1]-interval[0]);
  return{state:this.state,move:this.state==='enter',aim:['aim','fire','watch'].includes(this.state),fire:shoot,target:this.lastTarget,reloadProgress:this.reloadMedical&&this.state==='reload'?Math.max(0,Math.min(1,1-(this.reloadUntil-time)/this.reloadDuration)):null};
 }
 snapshot(){return{state:this.state,since:this.since,aimSince:this.aimSince??null,reactionS:this.reaction,nextShot:this.nextShot,reloadUntil:this.reloadUntil,lastTarget:this.lastTarget?{part:this.lastTarget.part,point:this.lastTarget.point.toArray()}:null,transitions:structuredClone(this.transitions)};}
}
