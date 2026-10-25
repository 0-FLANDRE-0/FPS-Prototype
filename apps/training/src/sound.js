import{SCAR_DATA}from'./scar-data.js';
import{loadNoiseAtMass}from'./equipment-data.js';
import {FootContactTracker} from './foot-contact.js';
import {combatMassLedger} from './combat-mass.js';
import {SOUND,NOISE_TYPE_PROFILE,LOAD_NOISE_MUL,propagateSound,playbackGain,machCrack,roomAcoustics,airAbsorptionDbM} from './sound-acoustics.js';
import {SOUND_ROOMS,SOUND_PORTALS,SOUND_WALLS,footstepSurfaceAt} from './sound-world.js';
import {newHearing,tickHearing,exposeHearing,hearNoise,combinedHearingPresentation} from './sound-hearing.js';
import {AUDIO_TUNING,FOOTSTEP_AUDIO} from './sound-tuning.js';
import asset from '../assets/sounds/prepared/sprite-index.json';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const array=p=>Array.isArray(p)?[...p]:p.toArray();
// Same LCG as combat.js, with an isolated seed so audio variation never consumes
// aim / recoil / ballistic random draws. Hearing uses the actor's existing RNG.
export function soundRandom(seed=0x534e4431){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export class TrainingSound{
 constructor({physics,enabled=true,microphone=70}={}){
  this.loadMassKg=combatMassLedger().equipmentMassKg+combatMassLedger().weaponMassKg;this.loadClass=this.loadMassKg<8?'light':this.loadMassKg<13?'standard':this.loadMassKg<18?'heavy':'overloaded';this.physics=physics;this.enabled=enabled;this.microphone=microphone;this.context=null;this.contextsCreated=0;this.buffersReady=false;this.time=0;this.sequence=0;this.rooms=SOUND_ROOMS;this.portals=SOUND_PORTALS.map(p=>({...p}));this.walls=SOUND_WALLS;this.listeners=new Map();this.hearing=new Map();this.pending=[];this.recent=[];this.footsteps=[];this.footState=new Map();this.lastSample={};this.voices=[];this.reverbs=new Map();this.random=soundRandom();this.playRandom=soundRandom(0x534e4432);this.hearRandom=soundRandom(0x534e4433);this.stats={emitted:0,played:0,dropped:0,voiceSteals:0,decodeMisses:0,maxVoices:0,maxConvolvers:0,decodeErrors:0,lateArrivals:0};this.paused=false;
 }
 setEnabled(enabled){this.enabled=enabled;if(this.mute)this.mute.gain.setTargetAtTime(enabled?1:0,this.context.currentTime,.005);if(!enabled){this.stopVoices();if(this.toneGain)this.toneGain.gain.value=0;}else this.unlock();}
 setMicrophone(value){this.microphone=clamp(value,0,100);if(this.dry){const t=this.context.currentTime;this.dry.gain.setTargetAtTime(1-this.microphone/100,t,.01);this.micWet.gain.setTargetAtTime(this.microphone/100,t,.01);}}
 unlock(){
  if(!this.enabled)return null;
  try{if(!this.context){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;this.context=new Context({sampleRate:48000});this.contextsCreated++;this.prepareGraph();this.decodePromise=this.decode();}
   if(!this.paused&&this.context.state==='suspended')this.context.resume().catch(()=>{});return this.decodePromise;
  }catch{this.stats.decodeErrors++;return null;}
 }
 async decode(){try{const raw=document.getElementById('sound-sprite')?.textContent.trim();if(!raw)throw Error('Missing embedded sound sprite');const data=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));this.sprite=await this.context.decodeAudioData(data.buffer);this.buffersReady=true;}catch{this.stats.decodeErrors++;}}
 prepareGraph(){
  const c=this.context;this.mix=c.createGain();this.hearingFilter=c.createBiquadFilter();this.hearingFilter.type='lowpass';this.hearingFilter.frequency.value=20000;this.hearingGain=c.createGain();this.mix.connect(this.hearingFilter).connect(this.hearingGain);
  this.dry=c.createGain();this.micWet=c.createGain();this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-3;this.limiter.knee.value=2;this.limiter.ratio.value=20;this.limiter.attack.value=.001;this.limiter.release.value=.06;this.mute=c.createGain();this.mute.gain.value=this.enabled?1:0;this.limiter.connect(this.mute).connect(c.destination);
  this.hearingGain.connect(this.dry).connect(this.limiter);const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=140;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=6500;const compressor=c.createDynamicsCompressor();compressor.threshold.value=-22;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.12;const saturation=c.createWaveShaper();saturation.curve=Float32Array.from({length:2048},(_,i)=>clamp((i/2047*2-1)*2.8,-1,1)*.8);saturation.oversample='2x';this.hearingGain.connect(hp).connect(lp).connect(compressor).connect(saturation).connect(this.micWet).connect(this.limiter);this.setMicrophone(this.microphone);
  this.tone=c.createOscillator();this.tone.frequency.value=5100;this.toneGain=c.createGain();this.toneGain.gain.value=0;this.tone.connect(this.toneGain).connect(this.limiter);this.tone.start();
  // Warm the bounded reverb pool on the first user gesture, before combat shots.
  for(const room of this.rooms.filter(r=>!r.outdoor).slice(0,SOUND.maxConvolvers))this.reverb(room.id);
 }
 reverb(roomId){
  const room=this.rooms.find(r=>r.id===roomId);if(!room||room.outdoor||!this.context)return null;
  if(this.reverbs.has(roomId)){const r=this.reverbs.get(roomId);r.used=this.time;return r;}
  if(this.reverbs.size>=SOUND.maxConvolvers){const oldest=[...this.reverbs.values()].sort((a,b)=>a.used-b.used)[0];oldest.output.gain.setTargetAtTime(0,this.context.currentTime,.01);oldest.node.disconnect();oldest.output.disconnect();this.reverbs.delete(oldest.id);}
  const rt=roomAcoustics(room,this.portals).rt60S[1],c=this.context,length=Math.floor(Math.min(1.2,rt)*c.sampleRate),ir=c.createBuffer(2,length,c.sampleRate),rng=soundRandom(0x49520000+this.rooms.indexOf(room));for(let channel=0;channel<2;channel++){const data=ir.getChannelData(channel);for(let i=0;i<length;i++)data[i]=(rng()*2-1)*Math.exp(-6.9078*(i/c.sampleRate)/rt)*Math.min(1,i/(.008*c.sampleRate))*Math.min(1,(length-i)/(.02*c.sampleRate));}
  const node=c.createConvolver();node.buffer=ir;const output=c.createGain();output.gain.value=1;node.connect(output).connect(this.mix);const bus={id:roomId,node,output,used:this.time,rt60S:rt,irDurationS:length/c.sampleRate};this.reverbs.set(roomId,bus);this.stats.maxConvolvers=Math.max(this.stats.maxConvolvers,this.reverbs.size);return bus;
 }
 setPaused(paused){if(this.paused===paused)return;this.paused=paused;if(!this.context)return;if(paused)this.context.suspend().catch(()=>{});else if(this.enabled)this.context.resume().catch(()=>{});}
 setListener(id,position,{player=false,medical={},feedback=null,random=null,onHeard=null,team=player?'player':'enemy'}={}){this.listeners.set(id,{id,position:array(position),player,medical,feedback,random,onHeard,team});if(!this.hearing.has(id))this.hearing.set(id,newHearing());}
 removeListener(id){this.listeners.delete(id);this.hearing.delete(id);this.pending=this.pending.filter(p=>p.listenerId!==id);this.footState.delete(id);}
 updateListenerCamera(camera){if(!this.context)return;const c=this.context,listener=c.listener,p=camera.position,f={x:0,y:0,z:-1},up={x:0,y:1,z:0};const e=camera.matrixWorld.elements;f.x=-e[8];f.y=-e[9];f.z=-e[10];up.x=e[4];up.y=e[5];up.z=e[6];if(listener.positionX){for(const[k,v]of Object.entries({positionX:p.x,positionY:p.y,positionZ:p.z,forwardX:f.x,forwardY:f.y,forwardZ:f.z,upX:up.x,upY:up.y,upZ:up.z}))listener[k].setValueAtTime(v,c.currentTime);}else{listener.setPosition(p.x,p.y,p.z);listener.setOrientation(f.x,f.y,f.z,up.x,up.y,up.z);}}
 emitNoise(type,position,opts={}){
  const profile=NOISE_TYPE_PROFILE[type];if(!profile)return null;const event={id:++this.sequence,type,position:array(position),time:this.time,...profile,...opts};this.stats.emitted++;
  for(const listener of this.listeners.values()){
   if(opts.onlyListener&&opts.onlyListener!==listener.id)continue;
   const physical=propagateSound(event,listener.position,this),arrival=event.time+physical.delayS,components=physical.components.map(c=>({...c,arrival:event.time+c.delayS,delivered:false,playbackStatus:'pending'}));physical.components=components;
   this.pending.push({event,listenerId:listener.id,physical,arrival,components,heard:false});
  }
  if(this.pending.length>SOUND.maxEvents){this.stats.dropped+=this.pending.length-SOUND.maxEvents;this.pending.splice(0,this.pending.length-SOUND.maxEvents);}
  return event;
 }
 shot(event){
  const shooterId=event.shooterId||((event.shotId??0)>=0x40000000?'enemy':'P01'),team=event.team||(shooterId==='P01'?'player':'enemy'),weaponId=event.weaponId||(team==='enemy'?'ak74m':'m4a1');
  this.emitNoise('gunshot',event.origin,{sourceId:shooterId,team,weaponId,shotId:event.shotId,sampleGroup:'m4',...(weaponId==='scar_h'?{sourceDb:NOISE_TYPE_PROFILE.gunshot.sourceDb+SCAR_DATA.audio.levelDeltaDb}:{})});
  for(const listener of this.listeners.values()){if(listener.id===shooterId)continue;const crack=machCrack(event.trace?.segments,listener.position);if(crack)this.emitNoise('crack',crack.position,{...crack,time:this.time+crack.emissionTimeS,sourceId:shooterId,team,shotId:event.shotId,onlyListener:listener.id,crack});}
  for(const hit of (event.trace?.events||[]).slice(0,12))if(hit.point)this.emitNoise('impact',hit.point,{sourceId:shooterId,team,aiOnly:true,time:this.time+this.impactTime(event.trace?.segments,hit.point)});
 }
 impactTime(segments,point){let nearest=null;for(const s of segments||[]){const d=s.to.reduce((sum,v,i)=>sum+(v-point[i])**2,0);if(!nearest||d<nearest.d)nearest={d,time:s.timeEndS??0};}return nearest?.time??0;}
 footstep(id,position,gait='walk',{loadClass=this.loadClass,equipmentMassKg=id==='P01'?this.playerEquipmentMassKg:null,bone=null,boneHeightM=null,timing='explicit contact',contactTime=null,clearanceM=null,soleHeightM=null}={}){
  const groundPosition=array(position),point=groundPosition.map((v,i)=>v+(i===1?FOOTSTEP_AUDIO.sourceHeightM:0)),surface=footstepSurfaceAt(this.physics,groundPosition),type=gait==='run'?'footstep_run':gait==='crouch'?'footstep_crawl':'footstep_walk',offset={concrete:0,wood:3,thin_metal:7,tile:2}[surface.surface]??0,load=equipmentMassKg!=null?loadNoiseAtMass(equipmentMassKg):(LOAD_NOISE_MUL[loadClass]??1);
  const sampleGroup=surface.surface==='concrete'?(gait==='run'?'concrete_run':'concrete_walk'):(surface.surface==='thin_metal'?'metal':surface.surface)+'_walk';
  const event=this.emitNoise(type,point,{sourceId:id,team:id==='P01'?'player':'enemy',sourceDb:NOISE_TYPE_PROFILE[type].sourceDb+FOOTSTEP_AUDIO.sourceBoostDb+offset+20*Math.log10(load),gait,sampleGroup,time:this.time+(contactTime==null?0:this.physics.world.timestep),pitchBase:gait==='run'&&surface.surface!=='concrete'?1.08:gait==='crouch'?.95:1});
  this.footsteps.push({loadMultiplier:load,equipmentMassKg:equipmentMassKg??null,eventId:event.id,time:event.time,id,gait,...surface,position:point,groundPosition,bone,boneHeightM,timing,contactTime,clearanceM,soleHeightM});if(this.footsteps.length>160)this.footsteps.shift();
  const chance=gait==='run'?.85:gait==='crouch'?.18:.45;if(this.random()<chance)this.emitNoise('gear',point,{sourceId:id,team:id==='P01'?'player':'enemy',time:event.time,sourceDb:51+(gait==='run'?8:gait==='crouch'?-8:0)+20*Math.log10(load),sampleGroup:'gear'});
 }
 playerStep({feet,contacts=[],speed,grounded,crouched,sprinting}){
  for(const contact of contacts)this.footstep('P01',contact.position,crouched?'crouch':sprinting?'run':'walk',{bone:contact.bone,boneHeightM:contact.anklePosition[1]-array(feet)[1],soleHeightM:contact.solePosition[1]-array(feet)[1],timing:'animated sole ground contact',contactTime:contact.time,clearanceM:contact.clearanceM});
  const previous=this.footState.get('P01')||{},p=array(feet);if(previous.grounded===false&&grounded&&previous.fallSpeed<-.9)this.emitNoise('gear',p,{sourceId:'P01',team:'player',sourceDb:63,sampleGroup:'gear',landing:true});this.footState.set('P01',{grounded,fallSpeed:this.physics?.movementVelocity?.y??0});
 }
 enemyStep(enemy,dt=1/60){
  const id=enemy.actor.id;if(enemy.collapsed)return;let tracker=this.footState.get(id);if(!tracker){tracker=new FootContactTracker();this.footState.set(id,tracker);}
  const contacts=tracker.sample({rig:enemy.pose.rig,actor:enemy.actor,physics:this.physics,time:this.time+dt,moving:enemy.velocity.length()>.08,velocity:enemy.velocity});
  for(const contact of contacts)this.footstep(id,contact.position,enemy.crouched?'crouch':enemy.velocity.length()>2.3?'run':'walk',{loadClass:enemy.actor.loadClass||this.loadClass,equipmentMassKg:enemy.actor.loadWeightKg??this.loadMassKg,bone:contact.bone,boneHeightM:contact.anklePosition[1]-enemy.actor.at[1],soleHeightM:contact.solePosition[1]-enemy.actor.at[1],timing:'animated sole ground contact',contactTime:contact.time,clearanceM:contact.clearanceM});
 }
 tick(dt){
  if(dt<=0)return;this.time+=dt;for(const h of this.hearing.values())tickHearing(h,dt);
  for(const p of this.pending){const listener=this.listeners.get(p.listenerId);if(!listener){p.done=true;continue;}const h=this.hearing.get(p.listenerId);
   if(!p.heard&&this.time>=p.arrival){p.heard=true;let hearingResult=null;if(!listener.player&&p.event.team!==listener.team&&p.event.sourceId!==listener.id&&!listener.medical.isDead&&!listener.medical.isUnconscious){hearingResult=hearNoise(p.event,p.physical,h,listener.medical,listener.random||this.hearRandom,listener.feedback);if(hearingResult.heard)listener.onHeard?.({...hearingResult,eventId:p.event.id,type:p.event.type,time:this.time,sourceTeam:p.event.team});}
    exposeHearing(h,p.event,p.physical);this.recent.push({eventId:p.event.id,type:p.event.type,sourceId:p.event.sourceId,time:this.time,emissionTime:p.event.time,listenerId:p.listenerId,...p.physical,hearing:hearingResult,crack:p.event.crack||null,playback:listener.player&&!p.event.aiOnly&&this.enabled});if(this.recent.length>SOUND.maxRecent)this.recent.shift();
   }
   for(const c of p.components)if(!c.delivered&&this.time+.05>=c.arrival){c.delivered=true;c.playbackStatus=listener.player&&!p.event.aiOnly&&c.playable?this.play(p.event,c,p.physical):p.event.aiOnly?'AI-only':!c.playable?'component-cull':'AI-listener';}
   p.done=p.heard&&p.components.every(c=>c.delivered);
  }
  this.pending=this.pending.filter(p=>!p.done);const h=this.hearing.get('P01');if(h&&this.context){const t=this.context.currentTime,p=combinedHearingPresentation(h,this.listeners.get('P01')?.feedback);
   this.hearingFilter.frequency.setTargetAtTime(p.lowpassHz,t,AUDIO_TUNING.hearingAttackS);this.hearingGain.gain.setTargetAtTime(p.gain,t,AUDIO_TUNING.hearingAttackS);this.toneGain.gain.setTargetAtTime(this.enabled?p.tinnitusGain:0,t,AUDIO_TUNING.tinnitusAttackS);}
 }
 choose(group){let choices=Object.entries(asset.clips).filter(([,s])=>s.group===group);if(group==='concrete_walk')choices=choices.concat(Object.entries(asset.clips).filter(([,s])=>s.group==='concrete_aux'));if(choices.length>1)choices=choices.filter(([id])=>id!==this.lastSample[group]);if(!choices.length)return null;const selected=choices[Math.floor(this.playRandom()*choices.length)];this.lastSample[group]=selected[0];return{id:selected[0],...selected[1]};}
 play(event,component,physical){
  if(!this.enabled)return'muted';if(playbackGain(component.levelDb,event)<=0)return'below-playback-floor';if(!this.context||this.context.state!=='running')return'context-unavailable';if(!this.buffersReady){this.stats.decodeMisses++;return'not-decoded';}
  const c=this.context,now=c.currentTime;let when=now+Math.max(0,component.arrival-this.time);this.voices=this.voices.filter(v=>!v.ended);if(this.voices.length>=SOUND.maxVoices){const quiet=this.voices.reduce((a,b)=>a.levelDb<b.levelDb?a:b);if(quiet.levelDb>=component.levelDb){this.stats.dropped++;return'voice-cull';}quiet.gain.gain.setTargetAtTime(0,now,.001);quiet.source.stop(now+.004);when=Math.max(when,now+.004);quiet.ended=true;this.voices=this.voices.filter(v=>!v.ended);this.stats.voiceSteals++;}
  const crack=event.type==='crack',sample=crack?null:this.choose(event.sampleGroup||'m4');if(!crack&&!sample)return'no-sample';const source=c.createBufferSource();let duration;
  if(crack){duration=event.durationS??.0008;const b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++){const t=i/(data.length-1);data[i]=(1-2*t)*Math.min(1,t*15)*Math.min(1,(1-t)*15)*.8;}source.buffer=b;}else{source.buffer=this.sprite;duration=sample.durationS;}
  const scar=event.type==='gunshot'&&event.weaponId==='scar_h',ak=event.type==='gunshot'&&event.weaponId!=='m4a1',rate=(event.pitchBase??1)*(scar?SCAR_DATA.audio.rate:ak?.94:1)*(1+(this.playRandom()-.5)*.06);const drugRate=this.listeners.get('P01')?.feedback?.vision?.drugAudioRate??1,drugStrength=(this.medicalEffects??100)/100;source.playbackRate.value=rate*(1+(drugRate-1)*drugStrength);
  const lo=c.createBiquadFilter();lo.type='lowshelf';lo.frequency.value=700;lo.gain.value=clamp((component.lossDb[1]-component.lossDb[0])+(airAbsorptionDbM(2000)-airAbsorptionDbM(500))*component.lengthM+(scar?SCAR_DATA.audio.lowShelfDb:ak?3:0),-20,12);const hi=c.createBiquadFilter();hi.type='highshelf';hi.frequency.value=2800;hi.gain.value=clamp(component.bandDb[2]-component.bandDb[1]-10*Math.log10((event.spectrum[2]||.2)/(event.spectrum[1]||.45))+(scar?SCAR_DATA.audio.highShelfDb:0),-45,3);const gain=c.createGain();gain.gain.setValueAtTime(playbackGain(physical.levelDb,event)*10**(((event.type==='gunshot'?AUDIO_TUNING.gunshotBoostDb:0)+component.levelDb-physical.levelDb)/20)*(1+(this.playRandom()-.5)*.12),now);const panner=c.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.rolloffFactor=0;panner.refDistance=1;panner.maxDistance=100000;const pos=component.apparentPosition;panner.positionX.value=pos[0];panner.positionY.value=pos[1];panner.positionZ.value=pos[2];source.connect(lo).connect(hi).connect(gain).connect(panner).connect(this.mix);
  const wet=[];for(const roomId of new Set([physical.sourceRoom,physical.listenerRoom])){const bus=this.reverb(roomId);if(!bus)continue;const send=c.createGain();send.gain.value=Math.sqrt(roomAcoustics(this.rooms.find(r=>r.id===roomId),this.portals).reverbEnergyGain);panner.connect(send).connect(bus.node);wet.push(send);}
  const voice={source,gain,levelDb:component.levelDb,ended:false,eventId:event.id,sampleId:sample?.id||'procedural-N-wave',startedAt:when,rate};this.voices.push(voice);this.stats.played++;this.stats.maxVoices=Math.max(this.stats.maxVoices,this.voices.length);source.onended=()=>{voice.ended=true;component.playbackStatus='complete';for(const n of[source,lo,hi,gain,panner,...wet])n.disconnect();};source.start(when,crack?0:sample.offsetS,duration);component.audioStartS=when;this.lastVoice={eventId:voice.eventId,sampleId:voice.sampleId,startedAt:when,rate,levelDb:voice.levelDb,playbackGain:gain.gain.value};return'scheduled';
 }
 stopVoices(){for(const v of this.voices){try{v.source.stop();}catch{}v.ended=true;}this.voices=[];}
 reset(){this.stopVoices();this.sequence=0;this.playerReloadAction=null;this.random=soundRandom();this.playRandom=soundRandom(0x534e4432);this.hearRandom=soundRandom(0x534e4433);this.lastSample={};this.pending=[];this.recent=[];this.footsteps=[];this.footState.clear();for(const id of this.hearing.keys())this.hearing.set(id,newHearing());this.time=0;}
 snapshot(){return{playerEquipmentMassKg:this.playerEquipmentMassKg??null,playerLoadMultiplier:this.playerEquipmentMassKg==null?null:loadNoiseAtMass(this.playerEquipmentMassKg),legacyNPCLoadMassKg:this.loadMassKg,loadClass:this.loadClass,modeledEquipmentKg:this.loadMassKg,ruleId:SOUND.ruleId,time:this.time,enabled:this.enabled,contextsCreated:this.contextsCreated,contextState:this.context?.state||null,decoded:this.buffersReady,sampleRate:this.context?.sampleRate||null,spriteBytes:asset.bytes,clipCount:Object.keys(asset.clips).length,microphonePercent:this.microphone,voices:this.voices.filter(v=>!v.ended).length,convolvers:this.reverbs.size,stats:{...this.stats},hearing:Object.fromEntries([...this.hearing].map(([id,h])=>[id,{...h}])),pending:this.pending.length,footsteps:structuredClone(this.footsteps),recent:structuredClone(this.recent),lastVoice:this.lastVoice||null};}
}
