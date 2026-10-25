import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,CanvasTexture,SRGBColorSpace} from 'three';
import {COMBAT,COMBAT_BOXES} from './combat-config.js';
export function createCombatZone(scene,physics){
 const group=new Group();group.name='Sector04';group.visible=false;scene.add(group);const geometry=new BoxGeometry(1,1,1),materials={};
 for(const[id,color]of Object.entries({concrete:'#7b837c',drywall:'#c4c0b3',wood:'#8a694a',floor:'#918e7b',panel:'#284b42'}))materials[id]=new MeshStandardMaterial({color,roughness:.92});
 for(const b of COMBAT_BOXES){const mesh=new Mesh(geometry,materials[b.kind==='floor'?'floor':b.material]);mesh.name=b.id;mesh.position.fromArray(b.at);mesh.scale.fromArray(b.size);group.add(mesh);
  const collider=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...b.size.map(v=>v/2)).setTranslation(...b.at).setFriction(1.1).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max));physics.surface.set(collider.handle,{id:b.id,kind:b.kind,material:b.material,definition:b});}
 const panel=new Mesh(geometry,materials.panel);panel.name=COMBAT.panel.id;panel.position.fromArray(COMBAT.panel.at);panel.scale.fromArray(COMBAT.panel.size);group.add(panel);
 const definition={...COMBAT.panel,kind:'wall',material:'concrete',penetrable:false};const collider=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...COMBAT.panel.size.map(v=>v/2)).setTranslation(...COMBAT.panel.at));physics.surface.set(collider.handle,{id:COMBAT.panel.id,kind:'wall',material:'concrete',definition});
 // The doorway is an actual opening. This sensor limits only player movement;
 // AI route movement and projectiles pass through it.
 const boundary=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(.08,1.6,.80).setTranslation(77.02,1.6,-4.2).setSensor(true));physics.surface.set(boundary.handle,{id:'combat-player-boundary',kind:'player-boundary'});
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#20362e';c.fillRect(0,0,512,256);c.fillStyle='#e2debc';c.font='bold 50px sans-serif';c.textAlign='center';c.fillText('SECTOR 04',256,90);c.font='32px sans-serif';c.fillText('적 1명 투입 / 정리',256,158);c.fillText('가까이서 F',256,209);const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const sign=new Mesh(new BoxGeometry(.01,.8,1.6),new MeshStandardMaterial({map:texture,roughness:.85}));sign.position.set(71.74,2.15,4);group.add(sign);
 return{group,playerCollisionFilter:c=>{const s=physics.surface.get(c.handle);return s?.id!=='P01'&&!['human','armor-sensor'].includes(s?.kind);},show:v=>group.visible=v};
}
