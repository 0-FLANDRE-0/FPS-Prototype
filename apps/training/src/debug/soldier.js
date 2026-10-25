// Imported by external QA only; no entry from the released main.js.
export async function withDebugSoldier(physics,humans,armor,work){
  const sync=()=>{physics.syncHumanTransforms();humans?.syncPose();armor?.syncPose();};
  try{return await work({rig:physics.humanRigs.get('H01'),sync});}
  finally{for(const rig of physics.humanRigs.values()){rig.setPose('standing',0);rig.setPose('rest',0);}sync();}
}
