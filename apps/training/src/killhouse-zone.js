import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,CanvasTexture,SRGBColorSpace,PointLight} from 'three';
import {KILLHOUSE,KH_BOXES} from './killhouse-config.js';
export function createKillhouseZone(scene,physics){
 const group=new Group();group.name='Sector05';group.visible=false;scene.add(group);const geometry=new BoxGeometry(1,1,1),materials=Object.fromEntries(Object.entries({concrete:'#999d95',drywall:'#d1cdbb',wood:'#987c56',floor:'#9f9c87',panel:'#245c4b'}).map(([id,color])=>[id,new MeshStandardMaterial({color,roughness:.92})]));
 for(const b of [...KH_BOXES,{...KILLHOUSE.panel,material:'concrete',kind:'wall',penetrable:false}]){const mesh=new Mesh(geometry,materials[b.id===KILLHOUSE.panel.id?'panel':b.kind==='floor'?'floor':b.material]);mesh.name=b.id;mesh.position.fromArray(b.at);mesh.scale.fromArray(b.size);group.add(mesh);const c=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...b.size.map(n=>n/2)).setTranslation(...b.at).setFriction(1.1));physics.surface.set(c.handle,{id:b.id,kind:b.kind,material:b.material,definition:b,footstepSurface:'concrete'});}
 // Uniform test lighting; no illumination-dependent sensing in AI1.
 for(const [x,z]of[[132,32],[135.5,32],[134.3,36.7],[131.4,36.7],[139,32],[141,36],[134,34.6]]){const light=new PointLight('#fff5de',7,8,1);light.position.set(x,2.5,z);group.add(light);}
 const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#213d32';ctx.fillRect(0,0,512,256);ctx.fillStyle='#eee4c5';ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.fillText('SECTOR 05',256,88);ctx.font='30px sans-serif';ctx.fillText('KILLHOUSE / AI1',256,145);ctx.fillText('F · 투입 설정',256,205);const texture=new CanvasTexture(c);texture.colorSpace=SRGBColorSpace;const sign=new Mesh(new BoxGeometry(.02,.7,1.4),new MeshStandardMaterial({map:texture}));sign.position.set(130.13,2.1,37.1);group.add(sign);
 return{group,show:v=>group.visible=v,playerCollisionFilter:c=>{const s=physics.surface.get(c.handle);return s?.id!=='P01'&&!['human','armor-sensor'].includes(s?.kind);}};
}
