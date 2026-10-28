import{Vector3}from'three';import{advanceFlight,flightProfile}from'../apps/training/src/flight.js';import{CATALOG}from'../apps/training/src/catalog.js';
// QA-only selection of real rays. No anatomy, channel, damage or health rewrite.
export function configuredFire(c,{target,direction=new Vector3(0,0,-1),distance=5,ammoId='545_ps_gs',weaponId=ammoId==='545_ps_gs'?'ak74m':ammoId==='762_m80'?'scar_h':'m4a1',shotId=1001}={}){
 const ballistics=c.shotBallistics(ammoId,weaponId),origin=target.clone().addScaledVector(direction,-distance),aim=direction.clone();let pos=new Vector3(),v=aim.clone().multiplyScalar(ballistics.muzzleVelocityMps),along=0;const profile=flightProfile(CATALOG.AMMO_PRESETS[ammoId]);
 while(along<distance-1e-8){const dt=Math.min(1/120,(distance-along)/Math.max(1,v.dot(aim))),next=advanceFlight(pos,v,dt,profile);pos=next.position;v=next.velocity;along=pos.dot(aim);}origin.y=target.y-pos.y;
 const query=Object.create(c.physics),fixed=new Set([...c.physics.surface].filter(([,s])=>!['human','armor-sensor'].includes(s.kind)).map(([h])=>h));query.contact=(o,d,n,excluded=new Set(),options)=>c.physics.contact(o,d,n,new Set([...excluded,...fixed]),options);
 const trace=c.traceShot(query,origin,aim,ballistics,{shotId,random:()=>.001,simulateFlight:true,maxDistance:distance+3}),event={shotId,time:c.enemy.medical.time,origin,direction:aim,ballistics,ammoId,trace};c.enemy.record(event);return event;
}
export const rawLungs=m=>m.wounds.flatMap(w=>w.s1OrganDamage||[]).filter(o=>o.organ==='lung');
