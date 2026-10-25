// Winter 2009, Table4.1 (p86), Dempster-derived segment weight fractions.
// Head+neck is one source segment. Its two rig bodies share that exact mass by
// capsule volume; that subdivision is geometric tuning, not another source row.
export const SEGMENT_MASS_FRACTIONS=Object.freeze({pelvis:.142,spine:.139,chest:.216,head_neck:.081,
 upperArm:.028,forearm:.016,hand:.006,thigh:.100,shank:.0465,foot:.0145});
// Public AAOS/Norkin & White reference chart, goniometer.io/rom-chart.pdf.
// Anatomical neutral degrees; physical frames convert from the current pose.
export const JOINT_ROM_DEG=Object.freeze({
 torso:{flexion:90,extension:25,lateral:25,rotation:0},
 shoulder:{flexion:180,extension:60,abduction:180,adduction:40,internalRotation:70,externalRotation:90},
 elbow:{flexion:150,extension:0},hip:{flexion:120,extension:30,abduction:45,adduction:30,internalRotation:45,externalRotation:45},
 knee:{flexion:135,extension:0},neck:{flexion:45,extension:45,lateral:45,rotation:60},
 wrist:{flexion:80,extension:70,radial:20,ulnar:30},ankle:{dorsiflexion:20,plantarflexion:50,inversion:35,eversion:15}});
export const RAGDOLL_TUNING=Object.freeze({bodyMassKg:80,strength:0,friction:1.1,restitution:0,linearDamping:2,angularDamping:4,
 contactSkinM:.003,additionalSolverIterations:8,passiveTorsoSplit:true});
export const RAGDOLL_SEGMENTS=Object.freeze([
 {bone:'pelvis',end:'spine',massKey:'pelvis',radius:.105},
 {bone:'spine',end:'chest',massKey:'spine',radius:.10},
 {bone:'chest',end:'neck',massKey:'chest',radius:.13},
 {bone:'neck',end:'head',massKey:'head_neck',radius:.045},
 {bone:'head',offset:[0,.12,0],massKey:'head_neck',radius:.085},
 ...['left','right'].flatMap(side=>[
  {bone:side+'UpperArm',end:side+'Forearm',massKey:'upperArm',radius:.055},
  {bone:side+'Forearm',end:side+'Hand',massKey:'forearm',radius:.045},
  {bone:side+'Hand',offset:[0,-.09,.03],massKey:'hand',radius:.035},
  {bone:side+'UpperLeg',end:side+'LowerLeg',massKey:'thigh',radius:.075},
  {bone:side+'LowerLeg',end:side+'Foot',massKey:'shank',radius:.055},
  {bone:side+'Foot',end:side+'Toes',massKey:'foot',radius:.055},
 ])]);
