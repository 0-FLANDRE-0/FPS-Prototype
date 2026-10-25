import * as T from 'three';
export class SoundDebug{
 constructor(scene,engine,element){this.scene=scene;this.engine=engine;this.element=element;this.enabled=false;this.group=null;this.stamp=-Infinity;}
 setEnabled(value){this.enabled=value;this.element.hidden=!value;if(this.group)this.group.visible=value;}
 prepare(){if(this.group)return;this.group=new T.Group();this.group.name='SoundPaths';this.group.renderOrder=10;this.scene.add(this.group);
  for(const room of this.engine.rooms.filter(r=>!r.outdoor))for(const b of room.boxes){const size=b.max.map((v,i)=>v-b.min[i]),center=b.max.map((v,i)=>(v+b.min[i])/2),wire=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(...size)),new T.LineBasicMaterial({color:'#75b0ff',transparent:true,opacity:.5,depthTest:false}));wire.position.fromArray(center);this.group.add(wire);}
  for(const p of this.engine.portals){const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(-p.width/2,-p.height/2,0),new T.Vector3(p.width/2,-p.height/2,0),new T.Vector3(p.width/2,p.height/2,0),new T.Vector3(-p.width/2,p.height/2,0),new T.Vector3(-p.width/2,-p.height/2,0)]),line=new T.Line(geo,new T.LineBasicMaterial({color:p.openness>.5?'#71ff9b':'#ff8d65',depthTest:false}));if(Math.abs(p.normal[0])>.5)line.rotation.y=Math.PI/2;line.position.fromArray(p.center);line.userData.portal=p;this.group.add(line);}
  this.paths=new T.Group();this.group.add(this.paths);
 }
 update(){if(!this.enabled)return;this.prepare();if(this.engine.time>=this.stamp&&this.engine.time-this.stamp<.2)return;this.stamp=this.engine.time;for(const n of this.group.children)if(n.userData.portal)n.material.color.set(n.userData.portal.openness>.5?'#71ff9b':'#ff8d65');for(const mesh of [...this.paths.children]){mesh.geometry.dispose();mesh.material.dispose();this.paths.remove(mesh);}
  const rows=this.engine.recent.slice(-8),texts=['SND1 · 물리 레벨 / 경로'];for(const row of rows){for(const c of row.components){for(const hit of c.wallHits){const w=this.engine.walls.find(w=>w.id===hit.id);if(w){const wire=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(...w.size)),new T.LineBasicMaterial({color:'#ffaa55',depthTest:false,transparent:true,opacity:.45}));wire.position.fromArray(w.at);this.paths.add(wire);}}const line=new T.Line(new T.BufferGeometry().setFromPoints(c.points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color:c.kind==='portal'?'#69efff':'#ffad69',depthTest:false,transparent:true,opacity:c.playable?.9:.35}));this.paths.add(line);}
   texts.push(`${row.listenerId} ${row.type} ${row.levelDb.toFixed(1)} dB · ${Math.round(row.delayS*1000)} ms ${row.playback?'재생':'음소거/AI'}`);for(const c of row.components)texts.push(` ${c.kind} ${c.lengthM.toFixed(1)} m / ${c.levelDb.toFixed(1)} dB ${c.playbackStatus||(c.playable?'사용':'−10 dB 제외')} ${c.wallHits.map(w=>w.id).join(',')}`);
   if(row.hearing)texts.push(` AI ${row.hearing.heard?'들음':'못 들음'} p=${row.hearing.probability.toFixed(3)} 추정=${row.hearing.estimatedPosition?.map(v=>v.toFixed(2)).join(',')||'—'}`);
  }
  const h=this.engine.hearing.get('P01');texts.push(`청력 저하 ${((h?.loss||0)*100).toFixed(1)}% · dose ${(h?.dose||0).toFixed(3)}`);this.element.textContent=texts.join('\n');
 }
}
