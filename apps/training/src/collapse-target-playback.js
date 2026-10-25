// Animation-only adapter. The stream owns the captured clip blend, source
// phases and playback rates; this module never touches a Rapier body or motor.
export function createCollapseAnimationTarget(rig,stream){
 if(!stream)return null;
 if(typeof stream.advance!=='function')throw new TypeError('Collapse animation stream requires advance(dt)');
 const initial=rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),moving=!!stream.moving,clipName=stream.clipName??null;
 let elapsedS=0;
 function write(goalRig,dt=0){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Collapse animation dt must be finite and nonnegative');
  let rows=initial;
  if(moving&&dt>0){elapsedS+=dt;rows=stream.advance(dt);}
  else if(moving&&elapsedS>0)rows=stream.advance(0);
  if(!rows||rows.length<24)throw new Error('Collapse animation stream must provide the existing 24 body bones');
  for(let i=0;i<goalRig.bones.length;i++){const row=rows[i]||initial[i],b=goalRig.bones[i];b.position.copy(row.p);b.quaternion.copy(row.q);}
  goalRig.root.updateMatrixWorld(true);
  return goalRig;
 }
 return{moving,clipName,write,snapshot:()=>({moving,clipName,elapsedS,bones:initial.length})};
}
