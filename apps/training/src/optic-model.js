import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VUDU,ACOG,OPTICS,opticForWeapon} from './optic-data.js';
import {createOpticImage} from './optic-render.js';
import {createHolographicSight} from './optic-holo.js';
import {VUDU_RENDER_PROFILE,ACOG_RENDER_PROFILE} from './optic-specs.js';
export async function loadVudu(original,m4RootRest){
 const rear=original.getObjectByName('rear_sight001'),entries=[];
 for(const definition of Object.values(OPTICS)){
  const encoded=document.getElementById(definition.blob).textContent.trim(),binary=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),gltf=await new GLTFLoader().parseAsync(binary.buffer,''),mount=new T.Group();
  mount.name=definition===VUDU?'M4OpticMount':'M4OpticMount_'+definition.prefix;mount.matrixAutoUpdate=false;mount.matrix.copy(m4RootRest.clone().invert().multiply(new T.Matrix4().makeTranslation(...definition.mountPosition)));mount.add(gltf.scene);original.add(mount);mount.visible=false;
  gltf.scene.traverse(n=>{if(n.isMesh){n.frustumCulled=false;if(n.material.transparent)n.material.depthWrite=false;}});
  const keys=definition.sight==='holo'?['window','windowFront','mountBottom']:['ocular','objective','mountBottom'],markers=Object.fromEntries(keys.map(key=>[key,gltf.scene.getObjectByName(definition.prefix+'_'+key)]));
  if(Object.values(markers).some(v=>!v))throw new Error('Missing optic markers: '+definition.id);
  const optics=definition.sight==='holo'?createHolographicSight({mount,markers,pack:gltf.scene,definition}):createOpticImage({mount,markers,pack:gltf.scene,profile:definition===ACOG?ACOG_RENDER_PROFILE:VUDU_RENDER_PROFILE});entries.push({definition,mount,pack:gltf.scene,markers,optics});
 }
 let current=entries[0];const mounted=inventory=>['m4a1','scar_h'].includes(inventory.weapon?.definitionId)&&entries.find(e=>e.definition.id===inventory.optic?.definitionId)||null;
 function sync(inventory,scar){const entry=mounted(inventory);for(const e of entries){const isScar=inventory.weapon?.definitionId==="scar_h"&&scar,parent=isScar?scar.opticAnchor:original,def=opticForWeapon(e.definition,inventory.weapon?.definitionId);if(e.mount.parent!==parent)parent.add(e.mount);e.mount.matrix.copy(isScar?new T.Matrix4().makeTranslation(...def.mountPosition):m4RootRest.clone().invert().multiply(new T.Matrix4().makeTranslation(...def.mountPosition)));}for(const e of entries)e.mount.visible=e===entry;if(rear)rear.visible=!entry;if(entry)current=entry;}
 const optics={update(options){const entry=mounted(options.inventory);if(entry)current=entry;for(const e of entries)e.optics.update(e===entry?options:{...options,ads:0});},render(...args){for(const e of entries)e.optics.render(...args);},dispose(){for(const e of entries)e.optics.dispose();},projectWorldPoint:point=>current.optics.projectWorldPoint(point),snapshot:()=>current.optics.snapshot(),get camera(){return current.optics.camera;},get surface(){return current.optics.surface;}};
 return {get mount(){return current.mount;},get pack(){return current.pack;},sync,optics,snapshot:()=>{current.mount.updateWorldMatrix(true,true);return {id:current.definition.id,visible:current.mount.visible,rearIronVisible:rear?.visible,markers:Object.fromEntries(Object.entries(current.markers).map(([key,n])=>[key,n.getWorldPosition(new T.Vector3()).toArray()])),opticalAxis:new T.Vector3(0,0,-1).applyQuaternion(current.mount.getWorldQuaternion(new T.Quaternion())).toArray(),pip:current.optics.snapshot().pip,zeroing:false,optics:current.optics.snapshot()};}};
}
