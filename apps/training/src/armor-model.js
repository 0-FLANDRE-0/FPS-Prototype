import * as T from 'three';
import {HUMAN_TARGETS}from'./human-targets.js';
import {ARMOR_PROFILE,ARMOR_COLORS,armorVertices,armorIndices,armorPose}from'./armor-targets.js';
import{CATALOG}from'./catalog.js';import{plateColor}from'./plate-shapes.js';
export function createArmorRegions(scene,{rigs=null,targets=HUMAN_TARGETS}={}){
 const groups={soft:new T.Group(),plate:new T.Group(),helmet:new T.Group()},profiles=new Map(targets.map(a=>[a.id,ARMOR_PROFILE.shapes])),rows=new Map();
 for(const[k,g]of Object.entries(groups)){g.name=k+'ArmorRegions';g.visible=false;scene.add(g);}
 function remove(id){const row=rows.get(id);if(!row)return;for(const a of row.attachments)a.object.removeFromParent();for(const r of row.resources)r.dispose();rows.delete(id);}
 function build(actor,shapes){remove(actor.id);const row={attachments:[],resources:[]};rows.set(actor.id,row);
  for(const shape of shapes){const kind=shape.kind,color=kind==='plate'?plateColor(shape.itemId):ARMOR_COLORS[kind],fill=new T.MeshBasicMaterial({color,transparent:true,opacity:.12,depthTest:false,depthWrite:false,side:T.DoubleSide}),edge=new T.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false,depthWrite:false}),geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(armorVertices(shape),3)).setIndex(new T.BufferAttribute(armorIndices(shape),1)),edges=new T.EdgesGeometry(geometry);row.resources.push(fill,edge,geometry,edges);
   for(const object of[new T.Mesh(geometry,fill),new T.LineSegments(edges,edge)]){object.name=actor.id+':'+shape.id;object.renderOrder=kind==='plate'?13:12;row.attachments.push({object,actor,shape});groups[kind].add(object);}
   if(kind==='plate'&&typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(10,18,24,.85)';ctx.fillRect(0,0,512,64);ctx.fillStyle=color;ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText(CATALOG.PLATE_REGISTRY[shape.itemId].display.shortName,256,44);const texture=new T.CanvasTexture(canvas),material=new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}),object=new T.Sprite(material);object.scale.set(.23,.029,1);object.name=actor.id+':'+shape.id+':label';object.renderOrder=14;row.attachments.push({object,actor,shape,label:true});groups.plate.add(object);row.resources.push(texture,material);}
  }
 }
 for(const actor of targets)build(actor,profiles.get(actor.id));
 function syncPose(){for(const row of rows.values())for(const{object,actor,shape,label}of row.attachments){const pose=armorPose(actor,shape,rigs?.get(actor.id));object.position.copy(pose.position);object.quaternion.copy(pose.rotation);if(label)object.position.add(new T.Vector3(0,shape.height/2+.025,0).applyQuaternion(pose.rotation));}}
 syncPose();return{syncPose,setShapes(id,shapes){const actor=targets.find(a=>a.id===id);if(!actor)return;profiles.set(id,shapes);build(actor,shapes);syncPose();},setVisible:(soft,plate,helmet=false)=>{groups.soft.visible=soft;groups.plate.visible=plate;groups.helmet.visible=helmet;},
  snapshot:()=>({profile:structuredClone(ARMOR_PROFILE),colors:{...ARMOR_COLORS},softVisible:groups.soft.visible,platesVisible:groups.plate.visible,helmetVisible:groups.helmet.visible,diagnosticShapes:[...profiles.values()].reduce((n,s)=>n+s.length,0),targets:targets.map(actor=>({targetId:actor.id,shapes:profiles.get(actor.id).map(shape=>{const pose=armorPose(actor,shape,rigs?.get(actor.id));return{id:shape.id,itemId:shape.itemId,position:pose.position.toArray(),rotation:pose.rotation.toArray()};})}))}),
  dispose:()=>{for(const id of[...rows.keys()])remove(id);for(const group of Object.values(groups))scene.remove(group);}};
}
