import {AI1,FIRE_STYLES,fireStyle} from './ai1-config.js';
// Replaceable AI2 boundary: evidence in -> movement/aim/trigger requests out.
// No target actors, world positions, colliders or player state are available here.
export class AI1Brain{
 constructor(random,skill){this.random=random;this.skill=skill;this.state='enter';this.since=0;this.nextShot=0;this.reloadUntil=0;this.transitions=[];this.style='ads';this.lastTarget=null;this.pair=0;}
 change(state,time){if(this.state===state)return;this.transitions.push({from:this.state,to:state,time});if(this.transitions.length>40)this.transitions.shift();this.state=state;this.since=time;if(state==='aim')this.aimSince=time;}
 step({time,senses,arrived,rounds,medical,down,behavior={},reloadDurationS,forcedStyle=null,canReload=true}){
  const seen=senses.target&&time-senses.target.time<AI1.sensePeriodS+.025?senses.target:null;
  this.lastTarget=seen||senses.memory||(senses.noise?{part:'noise',point:senses.noise.point.clone(),confidence:senses.noise.confidence,time:senses.noise.time}:null);
  if(down){this.change('down',time);return{state:'down',move:false,aim:false,fire:false};}
  if(rounds<=0&&!canReload){this.change('empty',time);return{state:'empty',move:false,aim:false,fire:false,target:this.lastTarget};}
  if(this.state==='reload'){
   if(time>=this.reloadUntil){this.change(seen?'aim':'watch',time);return{state:this.state,reloaded:true,move:false,aim:!!this.lastTarget,target:this.lastTarget};}
   return{state:'reload',move:false,aim:false,target:this.lastTarget,reloadProgress:Math.max(0,1-(this.reloadUntil-time)/this.reloadDuration)};
  }
  if(!seen){if(this.lastTarget)this.change('watch',time);else if(this.state!=='enter')this.change(arrived?'guard':'patrol',time);return{state:this.state,move:!this.lastTarget&&!arrived,aim:!!this.lastTarget,target:this.lastTarget,fire:false};}
  if(['enter','guard','patrol','watch'].includes(this.state)){
   this.style=forcedStyle||fireStyle(seen.distance,this.skill,seen.eccentricity>.65);const eccentric=1+seen.eccentricity*.6,startle=seen.eccentricity>.6?1.2:1,medicalRate=behavior.reactionS?behavior.reactionS[0]/.25:1,mult=this.skill.reaction*eccentric*startle*medicalRate;
   this.delays={noticeS:(.19+.05*this.random())*mult,recognizeS:(.10+.10*this.random())*mult,decideS:(.08+.13*this.random())*mult};this.change('notice',time);
  }
  if(this.state==='notice'&&time-this.since>=this.delays.noticeS)this.change('recognize',time);
  else if(this.state==='recognize'&&time-this.since>=this.delays.recognizeS)this.change('decide',time);
  else if(this.state==='decide'&&time-this.since>=this.delays.decideS)this.change('aim',time);
  else if(this.state==='aim'&&time-this.since>=FIRE_STYLES[this.style].readyS/this.skill.turn){this.change('fire',time);this.nextShot=time;}
  if(this.state==='fire'&&rounds<=0){this.change('reload',time);this.reloadDuration=reloadDurationS;this.reloadUntil=time+reloadDurationS;return{state:'reload',move:false,aim:false,target:this.lastTarget,reloadProgress:0};}
  const shoot=this.state==='fire'&&medical.canShoot!==false&&time>=this.nextShot;
  if(shoot){if(seen.distance<AI1.nearAutoM)this.nextShot=time+AI1.autoIntervalS;else{this.pair++;this.nextShot=time+(this.pair%2?AI1.pairIntervalS:seen.distance>15?.75/this.skill.turn:.45/this.skill.turn);}}
  return{state:this.state,move:false,aim:['aim','fire'].includes(this.state),fire:shoot,target:this.lastTarget,style:this.style};
 }
 snapshot(){return{state:this.state,since:this.since,aimSince:this.aimSince??null,style:this.style,delays:this.delays??null,nextShot:this.nextShot,reloadUntil:this.reloadUntil,lastTarget:this.lastTarget?{part:this.lastTarget.part,point:this.lastTarget.point.toArray(),time:this.lastTarget.time,confidence:this.lastTarget.confidence}:null,transitions:this.transitions};}
}
