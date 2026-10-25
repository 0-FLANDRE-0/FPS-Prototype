import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion,WebGLRenderTarget} from 'three';
import {prepareRagdollSolver} from './combat-ragdoll.js';
import {CombatProfile} from './combat-profile.js';
import {medicalMuscleStrength} from './muscle-data.js';
import {traceShot} from './ballistics.js';
import {shotBallistics} from './catalog.js';
import {TrainingMedical} from './medical.js';
import {ArmorCondition} from './protection.js';
import {COMBAT} from './combat-config.js';
import {createCombatZone} from './combat-zone.js';
import {createCombatActor} from './combat-actor.js';
import {combatAKSource,aimCombatAK} from './combat-weapon.js';
import {AI1Senses,sensoryPoints} from './ai1-senses.js';
import {AI1Brain} from './ai1-brain.js';
import {AI1Aim} from './ai1-aim.js';
import {AI1,aiSkill,wrap} from './ai1-config.js';
import {mountAI1AK,applyAILean,fireAI1} from './ai1-weapon.js';
import {KILLHOUSE,KH_PLACEMENTS,KH_PATROLS,KH_GUARD_LOOKS} from './killhouse-config.js';
import {createKillhouseZone} from './killhouse-zone.js';
import {KillhouseNavigation} from './killhouse-navigation.js';
import {AI1Debug} from './ai1-debug.js';
import {moveCombatActor,COMBAT_RELOAD_S} from './combat-actions.js';
import {AK74M} from './weapon-data.js';
import {PlayerFallView,playerCollapseStream,PLAYER_FALL} from './player-fall.js';
import {PlayerWeaponDrop} from './player-weapon-drop.js';
import {PLAYER_BODY_LAYER} from './combat-pose.js';
const V=p=>new Vector3(p.x,p.y,p.z),Q=p=>new Quaternion(p.x,p.y,p.z,p.w);
export class CombatTraining{
 constructor({view,physics,weapon,humans,effects,settings,inventory=null,onPlayerDown,onPlayerSettled}){
  Object.assign(this,{view,physics,weapon,humans,effects,settings,inventory,onPlayerDown,onPlayerSettled});this.zones={'04':createCombatZone(view.scene,physics),'05':createKillhouseZone(view.scene,physics)};this.sector='04';this.zone=this.zones['04'];this.config=COMBAT;this.extraEnemies=[];this.readyExtras=[];this.deployment={count:1,skill:'regular',placement:'rooms',behavior:'patrol',posture:'stand'};this.aiDebug=new AI1Debug(view.scene);this.ak=combatAKSource(weapon);this.active=false;this.player=null;this.enemy=null;this.spawning=false;this.generation=0;this.enemySerial=0;this.shots=0;this.clock=0;this.events=[];this.profile=new CombatProfile();this.readyEnemy=null;this.hitLife=0;this.hitAngle=0;this.playerDown=false;this.playerFall=null;this.playerDrop=null;
 }
 listEnemies(){return[this.enemy,...this.extraEnemies].filter(Boolean);}
 async enter(sector='04'){this.leave();this.sector=sector==='05'?'05':'04';this.config=this.sector==='05'?KILLHOUSE:COMBAT;this.zone=this.zones[this.sector];this.active=true;this.zone.show(true);if(this.sector==='05'&&!this.navigation)this.navigation=new KillhouseNavigation(this.physics);const generation=this.generation;
  const player=await createCombatActor({scene:this.view.scene,physics:this.physics,source:this.humans.source,id:'P01',at:[this.physics.feet.x,this.physics.feet.y,this.physics.feet.z],player:true});
  if(generation!==this.generation){player.dispose();return;}this.player=player;player.debug(this.settings);player.prepareRagdoll();this.playerDrop=new PlayerWeaponDrop(this.view.scene,this.physics,this.weapon,this.ak);await this.prepareEnemy();if(generation!==this.generation)return false;this.effects.prewarm?.(this.view.renderer,this.view.camera);this.events.push({type:'enter-sector',time:this.clock});return true;
 }
 leave(){this.generation++;this.active=false;for(const e of[this.readyEnemy,...this.readyExtras])this.disposeEnemy(e);this.readyEnemy=null;this.readyExtras=[];this.cleanup();this.playerDrop?.dispose();this.playerDrop=null;this.player?.dispose();this.player=null;this.playerFall=null;this.playerLocomotion=null;this.playerInterfaceShown=false;this.view.camera.layers.disable(PLAYER_BODY_LAYER);if(this.savedPlayerCollider){this.physics.collider.setSensor(this.savedPlayerCollider.sensor);this.physics.collider.setCollisionGroups(this.savedPlayerCollider.groups);this.savedPlayerCollider=null;}this.weapon.rig.visible=Boolean(this.inventory?.weapon??true);this.active=false;this.playerDown=false;this.spawning=false;this.hitLife=0;this.events=[];this.clock=0;this.shots=0;this.frameCost=null;for(const z of Object.values(this.zones))z.show(false);this.aiDebug.clear();}
 async prepareEnemy(){
  if(!this.active||!this.player||this.spawning)return false;this.spawning=true;const generation=this.generation;
  try{while(generation===this.generation&&[this.readyEnemy,...this.readyExtras].filter(Boolean).length<this.config.maximumEnemies){const e=await this.prepareOneEnemy(generation);if(!e)return false;if(!this.readyEnemy)this.readyEnemy=e;else this.readyExtras.push(e);}return true;}finally{if(generation===this.generation)this.spawning=false;}
 }
 async prepareOneEnemy(generation){
  const id='E'+String(++this.enemySerial).padStart(2,'0');
  const enemy=await createCombatActor({scene:this.view.scene,physics:this.physics,source:this.humans.source,id,at:COMBAT.enemySpawn});
  if(generation!==this.generation){enemy.dispose();return false;}
  let seed=0x41490000+this.enemySerial;enemy.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  Object.assign(enemy,{decision:new AI1Brain(enemy.random,aiSkill()),routeIndex:0,walkSeconds:0,velocity:new Vector3(),rounds:30,totalFired:0,magazinesLoaded:1,recoil:0,hitImpulse:null,lastSenses:null,lastShot:null,errorDeg:COMBAT.aimStartDeg,droppedBody:null});
  enemy.lastHeardNoise=null;enemy.threatDirection=null;
  enemy.gun=this.ak.mesh();this.view.scene.add(enemy.gun);enemy.pose.sample('standing',0);enemy.shotPose=aimCombatAK(enemy.actor,enemy.pose,this.ak,enemy.gun,{target:new Vector3(...enemy.actor.at).add(new Vector3(0,1.4,5)),lowered:true});enemy.pose.remember(enemy.actor,this.clock);enemy.sync();prepareRagdollSolver(enemy.pose,enemy.actor);enemy.prepareRagdoll();this.prepareWeaponDrop(enemy);this.prewarmShot(enemy);const renderer=this.view.renderer,previous=renderer.getRenderTarget(),target=new WebGLRenderTarget(16,16),prewarmCamera=this.view.camera.clone();prewarmCamera.layers.enable(PLAYER_BODY_LAYER);try{renderer.compile(this.view.scene,prewarmCamera);renderer.setRenderTarget(target);renderer.render(this.view.scene,prewarmCamera);renderer.getContext().finish();}finally{renderer.setRenderTarget(previous);target.dispose();}enemy.debug(this.settings);enemy.actor.queryEnabled=false;enemy.registered.disableMovement();
  enemy.copyPose(enemy.rig,enemy.targetPose.rig);enemy.visual.actors.get(id).group.visible=false;enemy.gun.visible=false;enemy.visual.setRegionsVisible(false);enemy.visual.setSkeletonVisible(false);enemy.armor.setVisible(false,false,false);enemy.internals.setVisible(false);return enemy;
 }
 prewarmShot(e){const scope=Object.create(this.physics);scope.armorCondition=new ArmorCondition(this.physics.armorSensors);const medical=new TrainingMedical({targetId:e.actor.id,medicalModel:'v2'}),ballistics=shotBallistics('545_ps_gs','ak74m');for(const bone of ['head','chest','leftUpperLeg']){const point=e.pose.point(e.actor,bone),origin=point.clone().add(new Vector3(0,0,3)),direction=new Vector3(0,0,-1),trace=traceShot(scope,origin,direction,ballistics,{shotId:0x70000000,simulateFlight:true,maxDistance:8,bodyModel:'s2'});medical.record({trace,origin,direction,ballistics,ammoId:'545_ps_gs',shotId:0x70000000,time:0},scope);medical.tick(1/60,1/60);}}
 async deploy(){if(!this.active||this.listEnemies().length||this.spawning||!this.readyEnemy)return false;return this.profile.measure('deploy',()=>{
  const count=this.sector==='05'?Math.max(1,Math.min(4,Number(this.deployment.count)||1)):1,ready=[this.readyEnemy,...this.readyExtras],chosen=ready.splice(0,count);this.readyEnemy=ready.shift()||null;this.readyExtras=ready;this.enemy=chosen[0];this.extraEnemies=chosen.slice(1);
  for(const[index,enemy]of chosen.entries()){
   const skill=aiSkill(this.deployment.skill);enemy.skill=skill;enemy.medical.actor.skill={...enemy.medical.actor.skill,presetId:skill.id};enemy.senses=new AI1Senses({phase:this.clock+index*AI1.sensePeriodS/4});enemy.decision=new AI1Brain(enemy.random,skill);enemy.aimController=new AI1Aim(enemy.random,skill,enemy.actor.yaw);enemy.behavior=this.sector==='05'?this.deployment.behavior:'entry';enemy.patrolIndex=index;enemy.patrolUntil=0;enemy.crouched=this.deployment.posture==='crouch';enemy.lean=this.deployment.posture==='left'?-1:this.deployment.posture==='right'?1:0;
   if(this.sector==='05'){enemy.actor.at=[...(KH_PLACEMENTS[this.deployment.placement]||KH_PLACEMENTS.rooms)[index]];const look=(KH_GUARD_LOOKS[this.deployment.placement]||KH_GUARD_LOOKS.rooms)[index];enemy.actor.yaw=Math.atan2(look[0]-enemy.actor.at[0],look[2]-enemy.actor.at[2]);enemy.aimController=new AI1Aim(enemy.random,skill,enemy.actor.yaw);}
   enemy.actor.queryEnabled=true;enemy.registered.enableMovement();this.onEnemyDeployed?.(enemy);enemy.visual.actors.get(enemy.actor.id).group.visible=true;enemy.gun.visible=true;enemy.debug(this.settings);enemy.pose.history=[];enemy.targetPose.sample(enemy.crouched?'crouch':'standing',0);enemy.copyPose(enemy.targetPose.rig,enemy.rig);enemy.sync();enemy.pose.remember(enemy.actor,this.clock);this.events.push({type:'deploy',id:enemy.actor.id,skill:skill.id,sector:this.sector,time:this.clock});
  }return true;});}
 disposeEnemy(e){if(!e)return;this.effects.soundEngine?.removeListener(e.actor.id);if(e.preparedDropBody){for(let i=0;i<e.preparedDropBody.numColliders();i++)this.physics.surface.delete(e.preparedDropBody.collider(i).handle);this.physics.world.removeRigidBody(e.preparedDropBody);}e.gun.removeFromParent();e.dispose();}
 cleanup(){const enemies=this.listEnemies();this.enemy=null;this.extraEnemies=[];for(const e of enemies){this.onEnemyCleanup?.(e);this.disposeEnemy(e);this.events.push({type:'cleanup',id:e.actor.id,time:this.clock});}this.aiDebug.clear();if(this.active&&enemies.length)queueMicrotask(()=>this.prepareEnemy().catch(error=>{this.spawning=false;console.error(error);}));}
 nearby(feet,height){if(!this.active||!this.player)return null;
  const panel=new Vector3(...this.config.panel.at),eye=feet.clone().add(new Vector3(0,height,0)),delta=panel.clone().sub(eye),distance=Math.hypot(feet.x-panel.x,feet.z-panel.z);
  const visible=distance<=this.config.panel.range&&this.physics.ray(eye,delta.clone().normalize(),delta.length()+.07)?.id===this.config.panel.id;
  if(visible&&!this.spawning&&(!this.enemy||this.listEnemies().every(e=>e.collapsed||medicalMuscleStrength(e.medical.actor).collapse)))return{kind:'combat-panel',targetId:this.config.panel.id,label:this.enemy?'정리':'적 투입',action:''};
  const near=this.listEnemies().find(e=>feet.distanceTo(new Vector3(...e.actor.at))<2.1);if(near)return{kind:'combat-medical',targetId:near.actor.id,label:near.actor.id,action:'의료 상태'};
  return null;
 }
 interact(){if(this.enemy&&this.listEnemies().every(e=>e.collapsed||medicalMuscleStrength(e.medical.actor).collapse)){this.cleanup();return Promise.resolve(true);}return this.deploy();}
 syncPlayer({camera,aim,lean,crouched,time,locomotion}){
  if(!this.active||!this.player||this.playerDown)return;this.playerLocomotion=locomotion;this.profile.measure('skinning',()=>{this.player.pose.player({actor:this.player.actor,feet:this.physics.feet,camera,aim,lean,handRows:this.weapon.fps.shared.handRows,time,crouched,locomotion});this.player.sync();this.player.followRagdoll();});
 }
 fallPlayer(time){
  const p=this.player,velocity=this.physics.movementVelocity.clone();this.playerDrop?.drop(p,this.inventory);
  p.pose.releaseGrip();if(!p.muscles(time,{clip:p.pose.clip,velocity,animationStream:this.playerLocomotion?playerCollapseStream(p,this.playerLocomotion):null}))p.fall();
  // The old movement capsule must not hold up or obstruct its own body.
  this.savedPlayerCollider={sensor:this.physics.collider.isSensor(),groups:this.physics.collider.collisionGroups()};this.physics.collider.setSensor(true);this.physics.collider.setCollisionGroups(0);
  if(p.pendingImpact){const hit=p.pendingImpact;if(time-hit.time<=.25)p.ragdoll.impulse(hit.bone,hit.impulse,hit.point);p.pendingImpact=null;}
  this.playerPassiveDamping=false;this.playerFall=new PlayerFallView(p,this.physics,this.view.camera);this.weapon.rig.visible=false;this.onPlayerDown?.(p.medical.snapshot());
  this.events.push({type:'player-down',time,reason:p.medical.actor.medical.downReason||p.medical.actor.medical.deathReason});
 }
 applyPlayerView(camera,alpha){if(!this.playerFall)return false;this.playerFall.apply(camera,alpha);return true;}
 tick(dt,time){
  if(!this.active||!this.player)return;time=this.clock+dt;this.clock=time;this.hitLife=Math.max(0,this.hitLife-dt);if(this.playerDown)this.player.medical.activity.setInput({speedMps:0,sprinting:false,ads:false});this.profile.measure('medical',()=>this.player.medical.tick(dt,time));this.player.feedback.step(dt,time,this.player.medical.actor.medical,{crouched:this.physics.crouched,sprinting:this.physics.sprinting,eyeHeightM:this.player.visionEyeHeight()});
  if(!this.playerDown&&this.player.down()){this.playerDown=true;this.fallPlayer(time);}
  if(this.playerDown){this.player.control(dt,time);if(this.player.ragdoll.mode==='passive'&&!this.playerPassiveDamping){for(const part of this.player.ragdoll.parts.values()){part.body.setAngularDamping(PLAYER_FALL.passiveAngularDamping);part.body.setLinearDamping(PLAYER_FALL.passiveLinearDamping);}this.playerPassiveDamping=true;}this.player.syncMuscles();this.playerDrop?.sync(dt);this.playerFall.capture(dt);if(this.playerFall.interfaceReady&&!this.playerInterfaceShown){this.playerInterfaceShown=true;this.onPlayerSettled?.(this.player.medical.snapshot());this.events.push({type:'player-fall-interface',time,lying:this.playerFall.lying});}}
  for(const e of this.listEnemies())this.tickEnemy(e,dt,time);this.aiDebug.update(this.settings.aiDisplay?this.listEnemies():[],time);
 }
 tickEnemy(e,dt,time){
  this.effects.soundEngine?.setListener(e.actor.id,e.pose.eye(e.actor),{medical:e.medical.actor.medical,feedback:e.feedback.output,random:e.random,onHeard:noise=>{const current=e.lastHeardNoise;if(!current||current.confidence<noise.confidence||this.effects.soundEngine.time-current.time>3){e.lastHeardNoise=noise;e.aimController?.suppress(noise);e.threatDirection=Math.atan2(noise.estimatedPosition[0]-e.actor.at[0],noise.estimatedPosition[2]-e.actor.at[2]);e.threatTimer=2;}}});e.medical.activity.setInput({equipmentMassKg:e.actor.loadWeightKg??18.3,speedMps:e.collapsed?0:e.velocity.length(),ads:!e.collapsed&&['aim','fire','watch'].includes(e.decision.state),crouched:!!e.crouched,weaponId:'ak74m',weaponMassKg:3.6,yaw:e.actor.yaw});this.profile.measure('medical',()=>e.medical.tick(dt,time));e.feedback.step(dt,time,e.medical.actor.medical,{crouched:!!e.crouched,eyeHeightM:e.visionEyeHeight()});const condition=e.feedback.output,behavior=condition.ai;e.recoil*=Math.exp(-dt*25);
  const strength=medicalMuscleStrength(e.medical.actor);
  if(strength.collapse&&!e.collapsed){
   this.profile.measure('fall',()=>e.muscles(time,{clip:e.pose.clip,walkSeconds:e.walkSeconds,velocity:e.velocity.clone()}));
   e.collapsed=true;e.pose.releaseGrip();e.targetPose.releaseGrip();this.dropWeapon(e);
   if(e.pendingImpact){const hit=e.pendingImpact;if(time-hit.time<=.25)e.prepareRagdoll().impulse(hit.bone,hit.impulse,hit.point);e.pendingImpact=null;}
   this.events.push({type:'enemy-down',id:e.actor.id,time,reason:strength.reason});
  }
  if(e.collapsed){
   e.decision.step({time,senses:{target:null},down:true});
   if(!e.ragdoll.frozen||e.ragdoll.finalSyncPending){this.profile.measure('muscles',()=>e.control(dt,time));this.profile.measure('skinning',()=>{e.syncMuscles();e.pose.remember(e.actor,time);});}
   this.syncDroppedWeapon(e);return;
  }
  if(e.lastHeardNoise){e.lastHeardNoise.confidence-=dt*.08;if(e.lastHeardNoise.confidence<=.05)e.lastHeardNoise=null;}e.threatTimer=Math.max(0,(e.threatTimer||0)-dt);if(!e.threatTimer)e.threatDirection=null;
  const senses=this.profile.measure('sight',()=>e.senses.sample({time,actor:e.actor,eye:e.pose.eye(e.actor),targetPoints:time+1e-9>=e.senses.nextSample?sensoryPoints(this.player):null,physics:this.physics,crouched:this.physics.crouched,behavior}));senses.memory=e.senses.memory(time);if(e.lastHeardNoise&&this.effects.soundEngine.time-e.lastHeardNoise.time<20)senses.noise={...e.lastHeardNoise,point:new Vector3(...e.lastHeardNoise.estimatedPosition)};else senses.noise=null;e.lastSenses=senses;
  const arrived=this.sector==='05'?e.behavior==='guard':e.routeIndex>=COMBAT.route.length;
  const intent=this.profile.measure('ai',()=>e.decision.step({time,senses,arrived,rounds:e.rounds,medical:e.medical.actor.medical,down:false,behavior,reloadDurationS:COMBAT_RELOAD_S/Math.max(.1,condition.reloadRate),forcedStyle:e.forcedStyle,canReload:!e.noAmmo}));
  if(intent.state==='reload'&&e.previousSoundState!=='reload')this.effects.soundEngine?.emitNoise('reload',e.pose.point(e.actor,'chest'),{sourceId:e.actor.id,team:'enemy',aiOnly:true});e.previousSoundState=intent.state;
  if(intent.reloaded){const loaded=this.onEnemyReloaded?this.onEnemyReloaded(e):(e.rounds=30,true);if(loaded!==false){e.magazinesLoaded++;this.events.push({type:'reload-complete',id:e.actor.id,time});}else{e.noAmmo=true;this.events.push({type:'ammo-empty',id:e.actor.id,time});}}
  if(intent.move){if(this.sector==='05'){
    const goal=KH_PATROLS[e.patrolIndex%KH_PATROLS.length],move=time<(e.patrolUntil||0)?{velocity:new Vector3()}:this.navigation.move(e,goal,dt,AI1.walkSpeedMps*condition.moveRate);e.velocity.copy(move.velocity);if(move.arrived){e.patrolIndex++;e.patrolUntil=time+AI1.patrolPauseS;}e.walkSeconds+=dt;
   }else{const move=moveCombatActor(e.actor,e.routeIndex,dt,condition.moveRate);e.routeIndex=move.index;e.velocity.copy(move.velocity);e.walkSeconds+=dt;}}else e.velocity.set(0,0,0);
  // No hidden chest/position fallback. Uninformed actors keep their authored
  // guard/route direction; remembered/heard evidence can rotate the body only.
  const target=intent.target?.point||null;if(target){const toward=target.clone().sub(new Vector3(...e.actor.at)),yaw=Math.atan2(toward.x,toward.z);e.actor.yaw+=wrap(yaw-e.actor.yaw)*(1-Math.exp(-dt*6));}
  const animated=e.targetPose;
  if(animated.updateFrame)animated.updateFrame({dt,time,actor:e.actor,velocity:e.velocity,intent,walkSeconds:e.walkSeconds,rounds:e.rounds,reloadDurationS:COMBAT_RELOAD_S/Math.max(.1,condition.reloadRate),gaitImpairment:condition.limp,reloadUntil:e.decision.reloadUntil,crouched:!!e.crouched});
  else animated.sample(intent.move?'walk':intent.aim?'aim':'standing',e.walkSeconds);
  const delta=target?target.clone().sub(animated.eye(e.actor)):new Vector3(Math.sin(e.actor.yaw),0,Math.cos(e.actor.yaw)),targetYaw=Math.atan2(delta.x,delta.z),yaw=Math.atan2(Math.sin(targetYaw-e.actor.yaw),Math.cos(targetYaw-e.actor.yaw)),pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));animated.distributeAim(intent.aim?yaw:0,intent.aim?pitch:0);
  // v33 short procedural hit response; standing bodies remain kinematic.
  if(e.hitImpulse){const hit=e.hitImpulse,elapsed=time-hit.time;if(elapsed>.25)e.hitImpulse=null;else{const bone=hit.bone.endsWith('UpperArm')?hit.bone.replace('UpperArm','Clavicle'):hit.bone;animated.rig.byName.get(bone)?.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),hit.amount*Math.exp(-elapsed*18)));}}
  e.leanApplied=applyAILean(animated,e.lean,{actor:e.actor,physics:this.physics});const gunRotation=e.aimController.step(dt,{time,eye:animated.eye(e.actor),muzzle:e.shotPose?.origin.distanceTo(new Vector3(...e.actor.at))<2?e.shotPose.origin:null,observation:intent.target,style:e.decision.style,aiming:intent.aim,actorYaw:e.actor.yaw,speed:e.velocity.length(),crouched:e.crouched,supported:!!e.supported,medicalFeedback:condition,ballistics:shotBallistics('545_ps_gs','ak74m')});
  e.shotPose=mountAI1AK(e.actor,animated,this.ak,e.gun,{rotation:gunRotation,style:e.decision.style,lowered:!intent.aim||intent.state==='reload',lean:e.leanApplied.value,shotAge:e.lastShot?time-e.lastShot.time:100});animated.remember(e.actor,time);
  this.profile.measure('skinning',()=>{e.syncMuscles();e.pose.remember(e.actor,time);});this.effects.soundEngine?.enemyStep(e,dt);e.errorDeg=e.aimController.errors.motorErrorDeg;
  if(intent.fire&&!this.playerDown&&!e.droppedBody&&!strength.collapse){const event=this.profile.measure('traceShot',()=>fireAI1({physics:this.physics,actor:e.actor,pose:e.shotPose,shotId:0x40000000+this.shots+1,time,velocity:e.velocity}));
   if(event){animated.notifyFire?.(time);e.aimController.onShot(event.ballistics,event.shotId,{crouched:e.crouched,speed:e.velocity.length(),fireMode:'full'});if(this.onEnemyFired)this.onEnemyFired(e);else e.rounds--;e.totalFired++;this.shots++;e.lastShot=serialShot(event);this.record(event);this.profile.measure('effectsSound',()=>this.effects.shot({...event,weaponId:'ak74m',shooterId:e.actor.id,team:'enemy'}));this.events.push({type:'enemy-shot',id:e.actor.id,time,shotId:event.shotId,rounds:e.rounds,style:e.decision.style,observedAt:intent.target?.time,actualMuzzleDirection:event.direction.toArray()});}
  }
  if(this.events.length>100)this.events.splice(0,this.events.length-100);
 }
 record(event){if(!this.active)return;event={...event,time:this.clock};
  for(const body of [this.player,...this.listEnemies()].filter(Boolean)){
   const records=this.profile.measure('medical',()=>body.record(event));if(!records.length)continue;
   if(body===this.player){this.hitLife=.35;const source=event.origin.clone().sub(this.player.pose.eye(this.player.actor));this.hitAngle=Math.atan2(source.x,-source.z);this.events.push({type:'player-hit',time:event.time,shotId:event.shotId,records:records.map(r=>({skinContact:r.skinContact,part:r.partKey,label:r.label}))});}
   {const contact=event.trace.bodyHits.find(b=>b.targetId===body.actor.id),armorContact=event.trace.armorResults.find(a=>a.targetId===body.actor.id),part=contact?.parts[0];const bone=this.physics.humanSensors.find(s=>s.actor.id===body.actor.id&&s.shape.id===part?.address?.shapeId)?.shape.bone||({head:'head',neck:'neck',chest:'chest',abdomen:'spine',leftArm:'leftUpperArm',rightArm:'rightUpperArm',leftLeg:'leftUpperLeg',rightLeg:'rightUpperLeg'}[part?.bodyPart]||(armorContact?.kind==='helmet'?'head':armorContact?.slot==='groin'?'pelvis':'chest'));if(body!==this.player)body.hitImpulse={bone,time:event.time,amount:.035};
    const velocity=part?.velocityInMps??armorContact?.before?.velocityMps??event.ballistics.muzzleVelocityMps,incoming=contact?.incomingDirection?new Vector3(...contact.incomingDirection):event.direction.clone(),point=contact?.point||armorContact?.point;const impact={bone,time:event.time,impulse:incoming.multiplyScalar(event.ballistics.projectileMassKg*velocity),point:point?new Vector3(...point):body.pose.point(body.actor,bone)};body.lastImpact={bone,velocityMps:velocity,momentumNs:event.ballistics.projectileMassKg*velocity,point:impact.point.toArray(),source:'completed trace impact, not launch velocity'};if(body.prepareRagdoll().active)body.prepareRagdoll().impulse(bone,impact.impulse,impact.point);else body.pendingImpact=impact;
   }
  }
 }
 prepareWeaponDrop(e){
  const bounds=this.ak.bounds,size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()),q=e.gun.quaternion,p=e.gun.position;
  const body=this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...p.toArray()).setRotation(q).setLinearDamping(.25).setAngularDamping(.6).setCcdEnabled(true));
  const collider=this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setTranslation(...center.toArray()).setCollisionGroups(0).setSensor(true).setMass(AK74M.physical.weightKg).setFriction(.8).setRestitution(.08),body);this.physics.surface.set(collider.handle,{id:e.actor.id+':dropped-AK',kind:'human-movement'});body.recomputeMassPropertiesFromColliders();
  e.preparedDropBody=body;
 }
 dropWeapon(e){
  if(e.droppedBody)return;const body=e.preparedDropBody;body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);body.setTranslation(e.gun.position,true);body.setRotation(e.gun.quaternion,true);body.collider(0).setSensor(false);body.collider(0).setCollisionGroups(0xffffffff);
  const motion=e.pose.velocities().get('rightHand')||{linear:e.velocity.clone(),angular:new Vector3()},hand=e.pose.point(e.actor,'rightHand'),com=V(body.worldCom());body.setLinvel(motion.linear.clone().add(motion.angular.clone().cross(com.sub(hand))),true);body.setAngvel(motion.angular,true);e.droppedBody=body;this.onEnemyDropped?.(e);
 }
 syncDroppedWeapon(e){if(!e.droppedBody||e.droppedBody.isSleeping())return;e.gun.position.copy(V(e.droppedBody.translation()));e.gun.quaternion.copy(Q(e.droppedBody.rotation()));e.gun.updateMatrixWorld(true);}
 debug(){this.player?.debug(this.settings);for(const e of this.listEnemies())e.debug(this.settings);}
 bridge(id){return id==='P01'?this.player?.medical:this.listEnemies().find(e=>e.actor.id===id)?.medical||null;}
 shake(){return this.hitLife>0?Math.sin((.35-this.hitLife)*105)*.022*(this.hitLife/.35):0;}
 enemySnapshot(e){return{...e.snapshot(),skill:e.skill?.id,decision:e.decision.snapshot(),senses:e.senses?.snapshot(this.clock),aim:e.aimController?.snapshot(),rounds:e.rounds,totalFired:e.totalFired,magazinesLoaded:e.magazinesLoaded,lastShot:e.lastShot,posture:{crouched:e.crouched,lean:e.lean,applied:e.leanApplied??null},navigation:e.navigation?{rooms:e.navigation.rooms,index:e.navigation.index,points:e.navigation.points}:null,weapon:{position:e.gun.position.toArray(),rotation:e.gun.quaternion.toArray(),metrics:e.targetPose.weaponMetrics,dropped:!!e.droppedBody}};}
 snapshot(){return{profile:this.profile.summary(),ready:!!this.readyEnemy,frameCost:this.frameCost??null,active:this.active,sector:this.active?this.sector:null,spawning:this.spawning,maximumEnemies:this.config.maximumEnemies,enemyCount:this.listEnemies().length,deployment:{...this.deployment},navigation:this.sector==='05'?this.navigation?.snapshot():null,enemies:this.listEnemies().map(e=>this.enemySnapshot(e)),ai1:{sensingHz:10,maxRaysPerSample:9,playerAimModelShared:true,separateAIDispersion:false},playerDown:this.playerDown,playerFall:this.playerFall?.snapshot()||null,playerDroppedWeapon:this.playerDrop?.snapshot()||null,playerHeadMask:this.player?.headMask||null,hitLife:this.hitLife,hitAngle:this.hitAngle,clock:this.clock,shots:this.shots,events:structuredClone(this.events),
  player:this.player?.snapshot()||null,enemy:this.enemy?{...this.enemy.snapshot(),decision:this.enemy.decision.snapshot(),lastHeardNoise:this.enemy.lastHeardNoise,threatDirection:this.enemy.threatDirection,routeIndex:this.enemy.routeIndex,rounds:this.enemy.rounds,totalFired:this.enemy.totalFired,magazinesLoaded:this.enemy.magazinesLoaded,lastImpact:this.enemy.lastImpact||null,errorDeg:this.enemy.errorDeg,senses:this.enemy.lastSenses?{visible:this.enemy.lastSenses.visible,rays:this.enemy.lastSenses.rays}:null,lastShot:this.enemy.lastShot,
   weapon:{sourceMesh:this.ak.sourceMesh,armsExcluded:true,dropped:!!this.enemy.droppedBody,position:this.enemy.gun.position.toArray(),rotation:this.enemy.gun.quaternion.toArray(),massKg:AK74M.physical.weightKg}}:null};}
}
function serialShot(e){return{shotId:e.shotId,time:e.time,origin:e.origin.toArray(),direction:e.direction.toArray(),ammoId:e.ammoId,ballistics:e.ballistics,
 trace:{...e.trace,hit:e.trace.hit?{...e.trace.hit,point:e.trace.hit.point.toArray(),normal:e.trace.hit.normal.toArray()}:null}};}
