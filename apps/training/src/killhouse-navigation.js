import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {KH_ROOMS,KH_PORTALS,KH_BOXES} from './killhouse-config.js';
// SND1 portal graph selects rooms; a clearance grid inside those rooms routes
// around actual cover/walls. Floor existence is checked against real colliders.
export class KillhouseNavigation{
 constructor(physics){this.physics=physics;this.cell=.15;this.radius=.23;this.nodes=new Map();this.build();}
 roomAt(p){return KH_ROOMS.find(r=>r.boxes.some(b=>p[0]>=b.min[0]&&p[0]<=b.max[0]&&p[2]>=b.min[2]&&p[2]<=b.max[2]))?.id||'outdoor';}
 roomRoute(a,b){const open=[[a]],seen=new Set([a]);while(open.length){const path=open.shift(),id=path.at(-1);if(id===b)return path;for(const p of KH_PORTALS.filter(p=>p.kind==='opening'&&(p.roomA===id||p.roomB===id))){const next=p.roomA===id?p.roomB:p.roomA;if(!seen.has(next)){seen.add(next);open.push([...path,next]);}}}return[];}
 build(){const p=this.physics;for(let ix=0;ix<=86;ix++)for(let iz=0;iz<=55;iz++){const x=130+ix*this.cell,z=30+iz*this.cell;if(KH_BOXES.some(b=>b.kind!=='floor'&&b.at[1]-b.size[1]/2<1.65&&b.at[1]+b.size[1]/2>.18&&Math.abs(x-b.at[0])<b.size[0]/2+this.radius&&Math.abs(z-b.at[2])<b.size[2]/2+this.radius))continue;const hit=p.world.castRay(new RAPIER.Ray({x,y:.2,z},{x:0,y:-1,z:0}),.3,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body,c=>p.surface.get(c.handle)?.kind==='floor');if(hit)this.nodes.set(ix+','+iz,{ix,iz,p:[x,0,z],room:this.roomAt([x,0,z])});}}
 nearest(p,allowed=null){let best=null,d=Infinity;for(const n of this.nodes.values()){if(allowed&&!allowed.has(n.room))continue;const ds=(p[0]-n.p[0])**2+(p[2]-n.p[2])**2;if(ds<d){d=ds;best=n;}}return best;}
 route(from,to){const rooms=this.roomRoute(this.roomAt(from),this.roomAt(to));if(!rooms.length)return{points:[],rooms};const allowed=new Set(rooms),a=this.nearest(from,allowed),b=this.nearest(to,allowed),bb=b;if(!a||!b)return{points:[],rooms};const key=n=>n.ix+','+n.iz,start=key(a),end=key(b),open=[a],cost=new Map([[start,0]]),prior=new Map(),closed=new Set();
 while(open.length){open.sort((a,b)=>cost.get(key(a))+Math.hypot(a.ix-bb.ix,a.iz-bb.iz)-cost.get(key(b))-Math.hypot(b.ix-bb.ix,b.iz-bb.iz));const n=open.shift(),k=key(n);if(k===end){const points=[];let cur=k;while(cur){points.unshift(this.nodes.get(cur).p);cur=prior.get(cur);}return{points,rooms};}if(closed.has(k))continue;closed.add(k);
  for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const next=this.nodes.get((n.ix+dx)+','+(n.iz+dz));if(!next||!allowed.has(next.room)||dx&&dz&&(!this.nodes.has((n.ix+dx)+','+n.iz)||!this.nodes.has(n.ix+','+(n.iz+dz))))continue;const nk=key(next),c=cost.get(k)+Math.hypot(dx,dz);if(c<(cost.get(nk)??Infinity)){cost.set(nk,c);prior.set(nk,k);open.push(next);}}
 }
 return{points:[],rooms};
 }
 move(enemy,goal,dt,speed){if(!enemy.navigation||enemy.navigation.goal!==goal){enemy.navigation={...this.route(enemy.actor.at,goal),goal,index:0};}const nav=enemy.navigation;while(nav.index<nav.points.length&&new Vector3(...nav.points[nav.index]).distanceTo(new Vector3(...enemy.actor.at))<.045)nav.index++;const point=nav.points[nav.index];if(!point)return{arrived:true,velocity:new Vector3()};const delta=new Vector3(...point).sub(new Vector3(...enemy.actor.at)),distance=Math.min(delta.length(),speed*dt),dir=delta.normalize(),origin=new Vector3(...enemy.actor.at).add(new Vector3(0,.85,0));
 const p=this.physics,hit=p.world.castShape(origin,new Quaternion(),dir,new RAPIER.Capsule(.6,this.radius),0,distance+.01,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body,c=>{const s=p.surface.get(c.handle);return s?.kind!=='floor'&&s?.id!==enemy.actor.id;});const travel=hit?Math.max(0,Math.min(distance,hit.time_of_impact-.01)):distance;
 enemy.actor.at=new Vector3(...enemy.actor.at).addScaledVector(dir,travel).toArray();if(travel)enemy.actor.yaw=Math.atan2(dir.x,dir.z);return{arrived:false,velocity:dir.multiplyScalar(travel/dt),blocked:!!hit};}
 snapshot(){return{cellM:this.cell,clearanceM:this.radius,nodes:this.nodes.size,rooms:KH_ROOMS.map(r=>r.id),portals:KH_PORTALS.map(p=>({id:p.id,kind:p.kind,roomA:p.roomA,roomB:p.roomB}))};}
}
