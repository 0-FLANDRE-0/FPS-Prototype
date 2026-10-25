import{Vector3}from'three';
import{groundAt}from'./foot-contact.js';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {BOXES} from './config.js';
import {COMBAT_BOXES} from './combat-config.js';
import {KH_ROOMS,KH_PORTALS,KH_BOXES} from './killhouse-config.js';
const box=(min,max)=>({min,max});
export const SOUND_ROOMS=Object.freeze([
 {id:'combat',boxes:[box([71,0,-7],[77,3.2,1.03])],outdoor:false,surfaceAreas:[{material:'concrete',areaM2:161.832},{material:'drywall',areaM2:6.72},{material:'wood',areaM2:6.72}]},
 {id:'hall',boxes:[box([71.73,0,1.03],[76.27,3.2,8.7])],outdoor:false,surfaceAreas:[{material:'concrete',areaM2:133.25},{material:'drywall',areaM2:4.384},{material:'wood',areaM2:4.384}]},
 {id:'spawn',boxes:[box([77.3,0,-9],[80.5,3.2,-5.85])],outdoor:false,surfaceAreas:[{material:'concrete',areaM2:53.12}]},
 {id:'spawn-lobby',boxes:[box([79.7,0,-5.85],[80.5,3.2,-3]),box([77.3,0,-5.55],[79.7,3.2,-3])],outdoor:false,surfaceAreas:[{material:'concrete',areaM2:60.8}]},
 ...KH_ROOMS,
 {id:'outdoor',boxes:[box([-100,-20,-1000],[200,100,200])],outdoor:true},
]);
// Author only existing geometric openings. No visual ceiling / door / window added.
export const SOUND_PORTALS=Object.freeze([
 {id:'combat-hall-opening',roomA:'combat',roomB:'hall',center:[74.075,1.6,1.05],width:1.9,height:3.2,normal:[0,0,1],kind:'opening',openness:1},
 {id:'enemy-doorway',roomA:'combat',roomB:'spawn-lobby',center:[77.15,1.6,-4.2],width:1.6,height:3.2,normal:[1,0,0],kind:'opening',openness:1},
 {id:'spawn-baffle-opening',roomA:'spawn-lobby',roomB:'spawn',center:[80.1,1.6,-5.7],width:.8,height:3.2,normal:[0,0,1],kind:'opening',openness:1},
 {id:'spawn-outdoor-opening',roomA:'spawn',roomB:'outdoor',center:[77.15,1.6,-8.2],width:1.6,height:3.2,normal:[1,0,0],kind:'opening',openness:1},
 ...KH_PORTALS,
]);
export const SOUND_WALLS=Object.freeze([...BOXES,...COMBAT_BOXES,...KH_BOXES].filter(b=>b.kind!=='floor').map(b=>({...b,material:b.material||'concrete'})));
export const FOOTSTEP_STRIPS=Object.freeze(['concrete','wood','thin_metal','tile'].map((surface,i)=>({id:'footstep-strip-'+surface,surface,min:[10+i*2.5,-.05,.5],max:[12+i*2.5,.1,6.5]})));
export function installFootstepStrips(scene,physics){
 for(const surface of physics.surface.values())if(surface.kind==='floor'){surface.footstepSurface='concrete';surface.footstepSurfaceZones=FOOTSTEP_STRIPS;}
 const group=new T.Group();group.name='FootstepSurfaceTest';scene.add(group);
 const colors={concrete:'#959c93',wood:'#a77b44',thin_metal:'#6c8495',tile:'#b4beb5'};
 for(const s of FOOTSTEP_STRIPS){const plane=new T.Mesh(new T.PlaneGeometry(2,6),new T.MeshStandardMaterial({color:colors[s.surface],roughness:.85,transparent:true,opacity:.8}));plane.rotation.x=-Math.PI/2;plane.position.set((s.min[0]+s.max[0])/2,.003,3.5);group.add(plane);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#e7e8d9';ctx.fillRect(0,0,256,64);ctx.fillStyle='#20362d';ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillText({concrete:'CONCRETE',wood:'WOOD',thin_metal:'METAL',tile:'TILE'}[s.surface],128,42);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const label=new T.Mesh(new T.PlaneGeometry(1.8,.45),new T.MeshBasicMaterial({map:texture}));label.rotation.x=-Math.PI/2;label.position.set(plane.position.x,.006,6.1);group.add(label);
 }
 return group;
}
export function footstepSurfaceAt(physics,point){
 const contact=groundAt(physics,new Vector3(...point)),floor=contact?.surface;if(!floor)return{surface:'concrete',colliderId:null};
 const zone=floor.footstepSurfaceZones?.find(z=>point[0]>=z.min[0]&&point[0]<=z.max[0]&&point[2]>=z.min[2]&&point[2]<=z.max[2]);return{surface:zone?.surface||floor.footstepSurface||({wood:'wood',steel:'thin_metal',thin_metal:'thin_metal'}[floor.material])||'concrete',colliderId:floor.id,zoneId:zone?.id||null};
}
