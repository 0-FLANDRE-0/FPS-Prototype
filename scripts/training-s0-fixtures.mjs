import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Scene,Vector3} from 'three';
import {rigOnly} from './training-fps-model.mjs';
export const S0_BASELINE='3c1e39af2480a5efe4ff95c15f85d2832eec49c0';
export async function s0Context(root=process.cwd()){
 const load=name=>import(pathToFileURL(resolve(root,'apps/training/src/'+name+'.js')));
 const [{createPhysics},{createCombatActor},{traceShot},{shotBallistics},{internalWorldShapes},{medicalMuscleStrength},{medicalObservation}]=await Promise.all(['physics','combat-actor','ballistics','catalog','internal-anatomy','muscle-data','medical'].map(load));
 const {flightProfile,advanceFlight}=await load('flight'),{CATALOG}=await load('catalog');
 const physics=await createPhysics({humanTargets:[]}),source=await rigOnly(await readFile(resolve(root,'dist/soldier-fingers.glb'))),scene=new Scene();
 const enemy=await createCombatActor({scene,physics,source,id:'S01',at:[100,0,0]});
 return {root,physics,source,scene,enemy,traceShot,shotBallistics,internalWorldShapes,medicalMuscleStrength,medicalObservation,
  reset({pose='standing',armor=false}={}){enemy.medical.reset();physics.armorCondition.reset();enemy.pose.sample(pose,0);enemy.targetPose.sample(pose,0);enemy.sync();physics.armorSensors=armor?[...enemy.registered.armor]:[];},
  world(){return internalWorldShapes(physics.internalAnatomies.get('S01'),enemy.actor);},
  center(id){const s=this.world().find(s=>s.id===id);if(!s)return null;return new Vector3(...(s.center||s.segments[Math.floor(s.segments.length/2)].a));},
  fire({target,direction=new Vector3(0,0,-1),distance=5,ammoId='545_ps_gs',shotId=100,random=()=>.001,isolateAnatomy=false}={}){const ballistics=shotBallistics(ammoId,ammoId==='545_ps_gs'?'ak74m':'m4a1'),origin=target.clone().addScaledVector(direction,-distance),aim=direction.clone();origin.y+=9.81*.5*(distance/ballistics.muzzleVelocityMps)**2;
   {let pos=new Vector3(),v=aim.clone().multiplyScalar(ballistics.muzzleVelocityMps),along=0;const profile=flightProfile(CATALOG.AMMO_PRESETS[ammoId]);while(along<distance-1e-8){const dt=Math.min(1/120,(distance-along)/Math.max(1,v.dot(aim))),next=advanceFlight(pos,v,dt,profile);pos=next.position;v=next.velocity;along=pos.dot(aim);}origin.y=target.y-pos.y;}
   const query=Object.create(physics);if(isolateAnatomy){const fixed=new Set([...physics.surface].filter(([,s])=>!['human','armor-sensor'].includes(s.kind)).map(([handle])=>handle));query.contact=(o,d,n,excluded=new Set(),options)=>physics.contact(o,d,n,new Set([...excluded,...fixed]),options);}
   const trace=traceShot(query,origin,aim,ballistics,{shotId,random,simulateFlight:true,maxDistance:distance+3});
   const event={shotId,time:0,origin,direction:aim,ballistics,ammoId,trace};enemy.record(event);return event;},
  row(time){const m=enemy.medical.actor.medical;return {...medicalObservation(enemy.medical.actor,time),transientNeurologicDisruption:m.transientNeurologicDisruption,bodyTraumaHP:Object.fromEntries(Object.entries(m.bodyParts).map(([k,p])=>[k,p.hp])),collapse:medicalMuscleStrength(enemy.medical.actor)};},
  dispose(){enemy.dispose();physics.dispose();}}
}
