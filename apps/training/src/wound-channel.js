import {CATALOG} from './catalog.js';
import {terminalSettingS3} from './wound-s3-types.js';
import PROFILE_MAP from './generated/wound-profile-map.json' with {type:'json'};
// Independent3D wound approximation. These coefficients are game calibration,
// not a tissue constitutive law. S2 uses this state authoritatively only inside tissue.
export const WOUND_S1_VALUES=Object.freeze({stepM:.005,densityKgM3:1050,gelDensityKgM3:1000,stopVelocityMps:20,maxRadiusM:.15,maxSteps:512,organSeverityGain:1,muscleCoefficient:.4,fragmentFillFraction:.025,fragmentYawRad:Math.PI/18,
 referenceVolumesM3:{head:.00045,neck:.00025,chest:.001,abdomen:.001,leftArm:.00045,rightArm:.00045,leftLeg:.0008,rightLeg:.0008},
 tissueCoefficients:{lung:.15,muscle:.4,skin:.4,fat:.4,bowel:.4,stomach:.4,bladder:.4,vessel:.12,liver:.9,spleen:.9,kidney:.9,brain:1,brainstem:1,spinal_cord:.4,airway:.4,esophagus:.4,heart_hook_only:.4,heart:.4}});
// S2 densities are reference material densities; all extra bone-response numbers
// and the zero outside-enclosure transmission are explicitly game tuning.
export const WOUND_S2_VALUES=Object.freeze({ruleId:'wound-channel-s2',softDensityKgM3:1050,lungDensityKgM3:340,corticalBoneDensityKgM3:1920,trabecularBoneDensityKgM3:1170,airDensityKgM3:1.20479,
 boneYawAdvanceMPerM:1.2,boneDeformationAreaPerM:4,maxDeformationAreaScale:1.8,boneSecondaryFragmentRadiusM:.025,boneSecondaryDamageEnergyDensityJPerM3:2e7,outsideEnclosureTemporaryCavityFactor:0,outsideEnclosureFragmentFactor:0,concussionRiskVolumeGain:.25,
 densityReference:'muscle1050/cortical1920 Geant4 G4NistMaterialBuilder ICRP; aeratedlung340 Hopkins2007 meanFRC; trabecular1170 explicittuning (absent fromsameGeant4table); air1.20479 reference; density-to-drag is game approximation',classification:'reference densities plus explicit S2 game tunings'});
const S2=WOUND_S2_VALUES;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),K=WOUND_S1_VALUES,pi=Math.PI;
// Sources/figure readout error and all borrowed structures are recorded in the
// S1 ledger. Cd and k are fitted, not measured aerodynamic drag coefficients.
const seeds={
 ak74:{diameterM:.0056,lengthM:.0255,massKg:.0034,velocity:935,penetrationM:.52,peakM:.10,diameterTCM:.145,yaw:[[0,0],[.06,0],[.125,pi/2],[.19,pi],[.29,pi],[.39,1.5*pi],[.47,2*pi]],fragmentVelocityMps:Infinity,fragmentFraction:0,fragmentRangeM:0},
 m193:{diameterM:.00569,lengthM:.019,massKg:.0036,velocity:943,penetrationM:.36,peakM:.185,diameterTCM:.14,yaw:[[0,0],[.12,0],[.24,pi/2],[.32,pi]],fragmentVelocityMps:780,fragmentFraction:.36,fragmentRangeM:.13},
 ak47:{diameterM:.00792,lengthM:.026,massKg:.00789,velocity:713,penetrationM:.74,peakM:.41,diameterTCM:.14,yaw:[[0,0],[.25,0],[.45,pi/2],[.55,pi]],fragmentVelocityMps:Infinity,fragmentFraction:0,fragmentRangeM:0},
 m80:{diameterM:.00782,lengthM:.028,massKg:.0097,velocity:862,penetrationM:.64,peakM:.28,diameterTCM:.185,yaw:[[0,0],[.16,0],[.34,pi/2],[.43,pi]],fragmentVelocityMps:Infinity,fragmentFraction:0,fragmentRangeM:0},
 pistol:{diameterM:.009,lengthM:.015,massKg:.0075,velocity:342,penetrationM:.6,peakM:0,diameterTCM:.04,yaw:[[0,0],[2,0]],fragmentVelocityMps:Infinity,fragmentFraction:0,fragmentRangeM:0}
};
function yawAt(p,depth){const knots=p.yaw;for(let i=1;i<knots.length;i++)if(depth<=knots[i][0]){const [a,y]=knots[i-1],[b,z]=knots[i];return y+(z-y)*clamp((depth-a)/(b-a));}return knots.at(-1)[1];}
function cell(p,v,mass,depth,dx,fragmented){const yaw=yawAt(p,depth+dx/2),side=Math.abs(Math.sin(yaw)),plainArea=pi*(p.diameterM/2)**2*Math.abs(Math.cos(yaw))+p.diameterM*p.lengthM*side,area=p.expansionAreaScale?plainArea*p.expansionAreaScale:plainArea,cd=p.cd*(1+1.5*side*side);return {yaw,area,cd};}
function integrate(p,{velocity=p.velocity,length=p.penetrationM,offset=0,mass=p.massKg,fragmented=false,fragmentDepthM=null,fragmentEnergyJ=0,initialMass=mass,density=K.gelDensityKgM3,full=false}={}){
 let v=velocity,d=0,fragmentEnergy=fragmentEnergyJ,fragmentStart=fragmentDepthM,fragmentMass=fragmented?initialMass*p.fragmentFraction:0,energyLost=0,peak=0,peakDepth=0,stop=null;const steps=[];
 for(let n=0;n<K.maxSteps&&d<length-1e-10;n++){
  const dx=Math.min(K.stepM,length-d),absolute=offset+d,yaw=yawAt(p,absolute+dx/2);let fragmentLoss=0;
  if(!fragmented&&p.fragmentFraction>0&&velocity>=p.fragmentVelocityMps&&Math.abs(Math.sin(yaw))>=Math.sin(K.fragmentYawRad)){
   fragmented=true;fragmentStart=absolute;fragmentMass=mass*p.fragmentFraction;mass-=fragmentMass;fragmentEnergy=.5*fragmentMass*v*v;
  }
  const c=cell(p,v,mass,absolute,dx,fragmented),next=v*Math.exp(-density*c.cd*c.area*dx/(2*mass)),mainLoss=.5*mass*(v*v-next*next);
  // A single lumped fragment cloud conserves its kinetic energy. Its sparse
  // permanent track volume is distinct from its outer spatial reach.
  if(fragmentEnergy>0){const cdf=u=>(1-Math.cos(pi*clamp(u)))/2,a=(absolute-fragmentStart)/Math.max(.005,p.fragmentRangeM),b=a+dx/Math.max(.005,p.fragmentRangeM);fragmentLoss=fragmentEnergy*clamp((cdf(b)-cdf(a))/Math.max(1e-12,1-cdf(a)));fragmentEnergy-=fragmentLoss;}
  const loss=mainLoss+fragmentLoss,dEdx=loss/dx,r=Math.min(K.maxRadiusM,(p.k||1)*Math.sqrt(Math.max(0,dEdx))),fragmentProgress=fragmentStart===null?1:(absolute-fragmentStart)/Math.max(.001,p.fragmentRangeM),rf=fragmented&&fragmentProgress>=0&&fragmentProgress<=1?p.fragmentRadiusM*Math.sin(pi*clamp(fragmentProgress)):0;
  energyLost+=loss;if(dEdx>peak){peak=dEdx;peakDepth=d+dx/2;}
  if(full)steps.push({depthM:d,dxM:dx,velocityInMps:v,velocityOutMps:next,massKg:mass,fragmentMassKg:fragmentMass,yawRad:yaw,dEdxJPerM:dEdx,energyLossJ:loss,permanentRadiusM:Math.sqrt(c.area/pi),temporaryRadiusM:r,fragmentRadiusM:rf,fragmented});
  d+=dx;v=next;if(v<=K.stopVelocityMps){stop=d;break;}
 }
 return {steps,velocityOutMps:v,massKg:mass,fragmentMassKg:fragmentMass,fragmented,fragmentDepthM:fragmentStart,fragmentEnergyJ:fragmentEnergy,energyLostJ:energyLost,peakDEdx:peak,peakDepthM:peakDepth,stopDepthM:stop,occupiedDepthM:offset+d};
}
function fit(seed,id){
 let best=null;const onset=seed.yaw[1][0],scales=id==='pistol'||id==='ak74'?[1]:Array.from({length:36},(_,i)=>.5+i*.1);
 for(const yawScale of scales){const p={...seed,id,cd:.1,k:1,fragmentRadiusM:.035,yawScale,yaw:seed.yaw.map(([depth,angle],i)=>[i<2?depth:onset+(depth-onset)*yawScale,angle])};
 // Solve Cd against the operational20m/s stopping depth at the source impact
 // speed, then fit k to the readout maximum TC diameter at that same condition.
 let lo=.0001,hi=8;for(let i=0;i<38;i++){p.cd=(lo+hi)/2;const r=integrate(p);if(r.velocityOutMps>K.stopVelocityMps)lo=p.cd;else hi=p.cd;}p.cd=(lo+hi)/2;
 const r=integrate(p),error=Math.abs(r.peakDepthM-seed.peakM);if(!best||error<best.error)best={p,r,error};}
 const {p,r}=best;p.k=(p.diameterTCM/2)/Math.sqrt(Math.max(1e-12,r.peakDEdx));p.classification=id==='pistol'?'estimate: no verified stop depth/TC diameter':'tuning fit to source figure; borrowed cartridge structures remain estimates';return Object.freeze(p);
}
export const WOUND_PROFILES=Object.freeze(Object.fromEntries(Object.entries(seeds).map(([id,p])=>[id,fit(p,id)])));
function makeWoundProfile(ammoId){const ammo=CATALOG.AMMO_PRESETS[ammoId],mapping=PROFILE_MAP[ammoId];if(!ammo||!mapping)throw Error('Unregistered S1 cartridge: '+ammoId);const base=WOUND_PROFILES[mapping.profileId],m855=ammoId==='556_m855',diameterM=mapping.diameterM;return {...base,profileId:mapping.profileId,ammoId,diameterM,lengthM:base.lengthM*diameterM/base.diameterM,fragmentFraction:mapping.fragmentAllowed?base.fragmentFraction:0,fragmentVelocityMps:m855?760:base.fragmentVelocityMps,borrowed:!(ammoId==='545_ps_gs'||ammoId==='556_m193'||ammoId==='762x39_ps'||ammoId==='762_m80'),mappingClassification:mapping.classification,mappingNote:(m855?'M193 figure proxy; M855 steel/lead construction differs;760m/s legacy yaw threshold reused as unverified fragmentation tuning. ':'')+mapping.mappingNote};}
// Explicit eager tables: every registered cartridge is built during module load,
// before any shot. The speed bins are the fragmentation gate's below/at-or-above
// classes; quadratic drag permits unit-entry-speed curves to scale analytically.
const legacyProfiles=Object.freeze(Object.fromEntries(Object.keys(PROFILE_MAP).map(id=>[id,Object.freeze(makeWoundProfile(id))])));
function typedWoundProfile(ammoId,active){
 const setting=terminalSettingS3(ammoId),old=legacyProfiles[ammoId],defaults=setting.typeDefaults,donor=WOUND_PROFILES[setting.donorProfileId],originalYaw=WOUND_PROFILES[CATALOG.AMMO_PRESETS[ammoId].caliber==='5.45x39mm'?'ak74':CATALOG.AMMO_PRESETS[ammoId].caliber==='7.62x51mm'?'m80':'m193'].yaw;
 const thresholdShape=setting.type==='expand'||setting.type==='frangible',yaw=defaults.yawKnotsM&&(!thresholdShape||active)?defaults.yawKnotsM:thresholdShape?originalYaw:donor.yaw;
 return Object.freeze({...old,...donor,profileId:setting.donorProfileId,ammoId,diameterM:defaults.diameterOverrideM||old.diameterM,lengthM:(defaults.diameterOverrideM||old.diameterM)*setting.lengthRatio,...(defaults.coreMassOverrideKg?{coreMassOverrideKg:defaults.coreMassOverrideKg}:{}),cd:donor.cd*defaults.dragScale,k:donor.k*defaults.cavityScale,yaw,
  fragmentFraction:active?defaults.fragmentFraction:0,fragmentVelocityMps:setting.thresholdVelocity,fragmentRangeM:defaults.fragmentRangeM||0,fragmentYawSin:Math.sin(defaults.fragmentYawRad??K.fragmentYawRad),fragmentOnsetDepthM:defaults.fragmentOnsetDepthM??null,expansionAreaScale:setting.type==='expand'&&active?defaults.expansionAreaScale:1,
  yawOnsetDepthM:yaw.length>1?yaw[1][0]:0,lutKey:ammoId+(active?':s3-high':':s3-low'),s3Terminal:setting,s3TerminalEffectActive:active,
  borrowed:setting.grade!=='plate',mappingClassification:setting.grade,mappingNote:'S3 original '+setting.type+'/'+setting.thresholdVelocity+' m/s; '+setting.grade+'; donor '+setting.donorProfileId+'; shared type defaults, no individual cartridge fit.'});
}
const typedProfiles=Object.freeze(Object.fromEntries(Object.keys(PROFILE_MAP).filter(id=>terminalSettingS3(id)).map(id=>[id,Object.freeze({low:typedWoundProfile(id,false),high:typedWoundProfile(id,true)})])));
const profiles=Object.freeze(Object.fromEntries(Object.entries(legacyProfiles).map(([id,p])=>[id,typedProfiles[id]?.high||p])));
function tissueProfile(ammoId,velocity,state){const variants=typedProfiles[ammoId];return variants?variants[(state.s3TerminalEffectActive??velocity>=variants.high.s3Terminal.thresholdVelocity)?'high':'low']:woundProfile(ammoId);}
function fragmentGate(p,depth,yawSin){return p.fragmentOnsetDepthM!==undefined&&p.fragmentOnsetDepthM!==null?depth>=p.fragmentOnsetDepthM:yawSin>=(p.fragmentYawSin??fragmentYawSin);}
export function woundProfile(ammoId){const p=profiles[ammoId];if(!p)throw Error('Unregistered S1 cartridge: '+ammoId);return p;}
const LUT_N=K.maxSteps,LUT_DX=K.stepM,fragmentYawSin=Math.sin(K.fragmentYawRad),lutStarted=performance.now();
function buildLUT(p){
 const initialMass=p.coreMassOverrideKg||CATALOG.AMMO_PRESETS[p.ammoId].projectileMassG/1000||p.massKg,massAfter=initialMass*(1-p.fragmentFraction),size=LUT_N+1;
 const yaw=new Float64Array(size),area=new Float64Array(size),decayFull=new Float64Array(size),decayFragment=new Float64Array(size),dragExponentFull=new Float64Array(size),dragExponentFragment=new Float64Array(size),cloudCDF=new Float64Array(size),cloudRadius=new Float64Array(size),unitLowVelocity=new Float64Array(size),unitHighVelocity=new Float64Array(size),unitLowTemporaryRadius=new Float64Array(size),unitHighTemporaryRadius=new Float64Array(size);
 let low=1,high=1,highMass=initialMass,fragmentEnergy=0,fragmentStart=null;
 for(let i=0;i<size;i++){
  const d=i*LUT_DX,c=cell(p,1,initialMass,d,LUT_DX,false),u=clamp(d/Math.max(.005,p.fragmentRangeM));
  yaw[i]=c.yaw;area[i]=c.area;decayFull[i]=Math.exp(-K.densityKgM3*c.cd*c.area*LUT_DX/(2*initialMass));decayFragment[i]=Math.exp(-K.densityKgM3*c.cd*c.area*LUT_DX/(2*massAfter));
  dragExponentFull[i]=K.densityKgM3*c.cd*c.area*LUT_DX/(2*initialMass);dragExponentFragment[i]=K.densityKgM3*c.cd*c.area*LUT_DX/(2*massAfter);
  cloudCDF[i]=(1-Math.cos(pi*u))/2;cloudRadius[i]=d<=p.fragmentRangeM?p.fragmentRadiusM*Math.sin(pi*u):0;
  // Store the two actual unit-speed cavity curves as well as the per-depth
  // attenuation coefficients needed by S2 equivalent-depth tissue attenuation.
  unitLowVelocity[i]=low;const lowNext=low*decayFull[i];unitLowTemporaryRadius[i]=p.k*Math.sqrt(Math.max(0,.5*initialMass*(low*low-lowNext*lowNext)/LUT_DX));low=lowNext;
  if(fragmentStart===null&&p.fragmentFraction>0&&fragmentGate(p,d,Math.abs(Math.sin(c.yaw)))){fragmentStart=d;fragmentEnergy=.5*initialMass*p.fragmentFraction*high*high;highMass=massAfter;}
  unitHighVelocity[i]=high;const highNext=high*(fragmentStart===null?decayFull[i]:decayFragment[i]);let fragLoss=0;
  if(fragmentEnergy>0){const a=clamp((d-fragmentStart)/Math.max(.005,p.fragmentRangeM)),b=clamp((d+LUT_DX-fragmentStart)/Math.max(.005,p.fragmentRangeM)),fa=(1-Math.cos(pi*a))/2,fb=(1-Math.cos(pi*b))/2;fragLoss=fragmentEnergy*clamp((fb-fa)/Math.max(1e-12,1-fa));fragmentEnergy-=fragLoss;}
  unitHighTemporaryRadius[i]=p.k*Math.sqrt(Math.max(0,(.5*highMass*(high*high-highNext*highNext)+fragLoss)/LUT_DX));high=highNext;
 }
 return {p,initialMass,massAfter,yaw,area,decayFull,decayFragment,dragExponentFull,dragExponentFragment,cloudCDF,cloudRadius,unitLowVelocity,unitHighVelocity,unitLowTemporaryRadius,unitHighTemporaryRadius};
}
const tableProfiles=[...Object.entries(legacyProfiles).filter(([id])=>!typedProfiles[id]),...Object.values(typedProfiles).flatMap(v=>[[v.low.lutKey,v.low],[v.high.lutKey,v.high]])];
const tables=Object.freeze(Object.fromEntries(tableProfiles.map(([id,p])=>[id,buildLUT(p)])));
export const WOUND_LUT_INFO=Object.freeze({mode:'eager cartridge × fragmentation-speed-class curves; S2 tissue-density equivalent depth and analytic v² scaling',cartridges:Object.keys(profiles).length,profileVariants:Object.keys(tables).length,s3TypeVariants:Object.keys(typedProfiles).length*2,speedClasses:2,depthStepM:LUT_DX,depthSamples:LUT_N+1,maximumDepthM:LUT_N*LUT_DX,loadTimeMs:performance.now()-lutStarted,
 scalarBytes:Object.values(tables).reduce((sum,t)=>sum+Object.values(t).reduce((n,v)=>n+(v instanceof Float64Array?v.byteLength:0),0),0),interpolation:'linear at 5 mm equivalent depth; cached tissue-boundary subdivision; exact per-cell energy accounting; custom mass/deformation use attenuation exponent rescaling',directFallback:'explicit computeWoundChannelDirect export for QA; registered live cartridges use eager tables'});
function lookup(array,index){if(index<=0)return array[0];if(index>=LUT_N)return array[LUT_N];const i=Math.floor(index),f=index-i;return array[i]+(array[i+1]-array[i])*f;}
function integrateLUT(p,{velocity=p.velocity,length=p.penetrationM,offset=0,mass=p.massKg,fragmented=false,fragmentDepthM=null,fragmentEnergyJ=0,initialMass=mass,full=false}={}){
 const table=tables[p.lutKey||p.ammoId];if(!table)return integrate(p,{velocity,length,offset,mass,fragmented,fragmentDepthM,fragmentEnergyJ,initialMass,density:K.densityKgM3,full});
 let v=velocity,d=0,fragmentEnergy=fragmentEnergyJ,fragmentStart=fragmentDepthM,fragmentMass=fragmented?initialMass*p.fragmentFraction:0,energyLost=0,peak=0,peakDepth=0,stop=null;const steps=[];
 for(let n=0;n<K.maxSteps&&d<length-1e-10;n++){
  const dx=Math.min(LUT_DX,length-d),absolute=offset+d,index=(absolute+dx/2)/LUT_DX-.5,yaw=lookup(table.yaw,index),area=lookup(table.area,index);let fragmentLoss=0;
  if(!fragmented&&p.fragmentFraction>0&&velocity>=p.fragmentVelocityMps&&Math.abs(Math.sin(yaw))>=fragmentYawSin){fragmented=true;fragmentStart=absolute;fragmentMass=mass*p.fragmentFraction;mass-=fragmentMass;fragmentEnergy=.5*fragmentMass*v*v;}
  const standardMass=fragmented?table.massAfter:table.initialMass,baseDecay=lookup(fragmented?table.decayFragment:table.decayFull,index),decay=dx===LUT_DX&&Math.abs(mass-standardMass)<1e-12?baseDecay:Math.pow(baseDecay,dx/LUT_DX*standardMass/mass),next=v*decay,mainLoss=.5*mass*(v*v-next*next);
  if(fragmentEnergy>0){const cloudIndex=(absolute-fragmentStart)/LUT_DX,a=lookup(table.cloudCDF,cloudIndex),b=lookup(table.cloudCDF,cloudIndex+dx/LUT_DX);fragmentLoss=fragmentEnergy*clamp((b-a)/Math.max(1e-12,1-a));fragmentEnergy-=fragmentLoss;}
  const loss=mainLoss+fragmentLoss,dEdx=loss/dx,r=Math.min(K.maxRadiusM,p.k*Math.sqrt(Math.max(0,dEdx))),progress=fragmentStart===null?-1:absolute-fragmentStart,rf=fragmented&&progress>=0&&progress<=p.fragmentRangeM?lookup(table.cloudRadius,progress/LUT_DX):0;
  energyLost+=loss;if(dEdx>peak){peak=dEdx;peakDepth=d+dx/2;}
  if(full)steps.push({depthM:d,dxM:dx,velocityInMps:v,velocityOutMps:next,massKg:mass,fragmentMassKg:fragmentMass,yawRad:yaw,dEdxJPerM:dEdx,energyLossJ:loss,permanentRadiusM:Math.sqrt(area/pi),temporaryRadiusM:r,fragmentRadiusM:rf,fragmented});
  d+=dx;v=next;if(v<=K.stopVelocityMps){stop=d;break;}
 }
 return {steps,velocityOutMps:v,massKg:mass,fragmentMassKg:fragmentMass,fragmented,fragmentDepthM:fragmentStart,fragmentEnergyJ:fragmentEnergy,energyLostJ:energyLost,peakDEdx:peak,peakDepthM:peakDepth,stopDepthM:stop,occupiedDepthM:offset+d};
}
// Cache-only tissue resolver. Geometry is supplied once by the existing body
// intersection pass; no cell asks the 3D world a new question.
function tissueCache(input,startDepthM=0,lengthM=Infinity){
 const records=input.tissueIntervals||input.internalHits||[],out=[];
 for(const h of records){const kind=h.kind==='bone'?'bone':h.kind==='air'||h.organ==='air'?'air':h.kind==='lung'||h.organ==='lung'?'lung':null;if(!kind)continue;
  const intervals=h.intervals||(Number.isFinite(h.entryDepthM)&&Number.isFinite(h.exitDepthM)?[[h.entryDepthM,h.exitDepthM]]:EMPTY);
  const density=kind==='bone'?(h.boneType==='trabecular'?S2.trabecularBoneDensityKgM3:S2.corticalBoneDensityKgM3):kind==='lung'?S2.lungDensityKgM3:S2.airDensityKgM3;
  for(const [a,b]of intervals)if(b>a&&b>startDepthM&&a<startDepthM+lengthM)out.push({start:Math.max(a,startDepthM),end:Math.min(b,startDepthM+lengthM),kind,density,priority:kind==='bone'?3:kind==='lung'?2:1,id:h.id,identifier:h.identifier||h.id,boneType:h.boneType||'cortical'});
 }
 return out.sort((a,b)=>a.start-b.start||b.priority-a.priority);
}
function fragmentCloudCDF(u){return (1-Math.cos(pi*clamp(u)))/2;}
function integrateTissue(p,{velocity,length,offset=0,mass,initialMass=mass,fragmentMassKg=0,fragmented=false,fragmentDepthM=null,fragmentEnergyJ=0,equivalentDepthM=offset,yawDepthAdvanceM=0,yawOffsetRad=0,deformationAreaScale=1,fragmentationEligible=velocity>=p.fragmentVelocityMps,tissues=[],startDepthM=0,direct=false}={}){
 const table=tables[p.lutKey||p.ammoId];let v=Math.max(0,velocity),d=0,eq=equivalentDepthM,advance=yawDepthAdvanceM,areaScale=deformationAreaScale,fragmentEnergy=fragmentEnergyJ,fragmentStart=fragmentDepthM,fragmentMass=fragmentMassKg,energyLost=0,boneEnergy=0,stopped=v===0;const steps=[],boneMap=new Map();
 for(let n=0;n<K.maxSteps&&d<length-1e-10&&!stopped;n++){
  const absolute=startDepthM+d,epsilon=1e-10;let t=null,boundary=length-d;
  for(let ti=0;ti<tissues.length;ti++){const candidate=tissues[ti];if(candidate.start>absolute+epsilon){boundary=Math.min(boundary,candidate.start-absolute);continue;}if(candidate.end<=absolute+epsilon)continue;boundary=Math.min(boundary,candidate.end-absolute);if(!t||candidate.priority>t.priority)t=candidate;}
  let dx=Math.min(K.stepM,length-d,boundary),ratio=(t?.density??S2.softDensityKgM3)/S2.softDensityKgM3;if(!(dx>1e-9)){d+=Math.min(1e-9,length-d);continue;}
  const bone=t?.kind==='bone',eqDx=dx*ratio,boneAdvance=bone?S2.boneYawAdvanceMPerM*dx:0,lookupDepth=eq+advance+(eqDx+boneAdvance)/2,index=lookupDepth/LUT_DX-.5;
  let yaw=direct?yawAt(p,lookupDepth):lookup(table.yaw,index);yaw+=yawOffsetRad;
  const geometricArea=direct||!!yawOffsetRad,side=geometricArea||(!fragmented&&p.fragmentFraction>0&&fragmentationEligible)?Math.abs(Math.sin(yaw)):0,plainArea=geometricArea?(pi*(p.diameterM/2)**2*Math.abs(Math.cos(yaw))+p.diameterM*p.lengthM*side)*(p.expansionAreaScale||1):lookup(table.area,index),cellAreaScale=Math.min(S2.maxDeformationAreaScale,areaScale+(bone?S2.boneDeformationAreaPerM*dx/2:0)),area=plainArea*cellAreaScale;
  if(!fragmented&&p.fragmentFraction>0&&fragmentationEligible&&fragmentGate(p,offset+d,side)){fragmented=true;fragmentStart=offset+d;const added=mass*p.fragmentFraction;fragmentMass+=added;mass-=added;fragmentEnergy+=.5*added*v*v;}
  let exponent;
  if(direct||yawOffsetRad){const cd=p.cd*(1+1.5*side*side);exponent=S2.softDensityKgM3*cd*area*dx*ratio/(2*mass);}
  else{const standardMass=fragmented?table.massAfter:table.initialMass,baseExponent=lookup(fragmented?table.dragExponentFragment:table.dragExponentFull,index);exponent=baseExponent*dx/LUT_DX*ratio*standardMass/mass*cellAreaScale;}
  let next=v*Math.exp(-exponent);if(next<=K.stopVelocityMps){if(v>K.stopVelocityMps){const fraction=clamp(Math.log(v/K.stopVelocityMps)/Math.max(1e-12,exponent));dx*=fraction;}stopped=true;next=0;}
  let fragmentLoss=0;const actualEqDx=dx*ratio,actualAdvance=bone?S2.boneYawAdvanceMPerM*dx:0;
  if(fragmentEnergy>0){let fa,fb;if(direct){const a=(offset+d-fragmentStart)/Math.max(.005,p.fragmentRangeM),b=a+dx/Math.max(.005,p.fragmentRangeM);fa=fragmentCloudCDF(a);fb=fragmentCloudCDF(b);}else{fa=lookup(table.cloudCDF,(offset+d-fragmentStart)/LUT_DX);fb=lookup(table.cloudCDF,(offset+d+dx-fragmentStart)/LUT_DX);}fragmentLoss=fragmentEnergy*clamp((fb-fa)/Math.max(1e-12,1-fa));if(stopped)fragmentLoss=fragmentEnergy;fragmentEnergy-=fragmentLoss;}
  const mainLoss=.5*mass*(v*v-next*next),loss=mainLoss+fragmentLoss,dEdx=loss/Math.max(1e-12,dx),r=Math.min(K.maxRadiusM,p.k*Math.sqrt(Math.max(0,dEdx))),progress=fragmentStart===null?-1:offset+d-fragmentStart,rf=fragmented&&progress>=0&&progress<=p.fragmentRangeM?(direct?p.fragmentRadiusM*Math.sin(pi*clamp(progress/Math.max(.005,p.fragmentRangeM))):lookup(table.cloudRadius,progress/LUT_DX)):0,secondary=bone?loss/S2.boneSecondaryDamageEnergyDensityJPerM3:0;
  steps.push({depthM:d,dxM:dx,velocityInMps:v,velocityOutMps:next,massKg:mass,fragmentMassKg:fragmentMass,yawRad:yaw,dEdxJPerM:dEdx,energyLossJ:loss,permanentRadiusM:Math.sqrt(area/pi),temporaryRadiusM:r,fragmentRadiusM:rf,fragmented,tissue:t?.kind||'soft',densityKgM3:t?.density??S2.softDensityKgM3,equivalentDepthM:eq,equivalentDxM:actualEqDx,boneId:bone?t.id:null,boneEnergyLossJ:bone?loss:0,boneSecondaryFragmentVolumeM3:secondary,boneSecondaryFragmentRadiusM:bone?Math.min(S2.boneSecondaryFragmentRadiusM,r):0,deformationAreaScale:p.expansionAreaScale?cellAreaScale*p.expansionAreaScale:cellAreaScale});
  if(bone){boneEnergy+=loss;let record=boneMap.get(t.id);if(!record){record={id:t.id,identifier:t.identifier,energyLostJ:0,traversedLengthM:0,boneType:t.boneType};boneMap.set(t.id,record);}record.energyLostJ+=loss;record.traversedLengthM+=dx;}
  energyLost+=loss;d+=dx;eq+=actualEqDx;advance+=actualAdvance;areaScale=Math.min(S2.maxDeformationAreaScale,areaScale+(bone?S2.boneDeformationAreaPerM*dx:0));v=next;
 }
 // Operational stop deposits remaining kinetic energy in the final cell. A
 // projectile that reached the end still exits even if its speed is small.
 return {steps,velocityOutMps:v,massKg:mass,fragmentMassKg:fragmentMass,fragmented,fragmentDepthM:fragmentStart,fragmentEnergyJ:fragmentEnergy,energyLostJ:energyLost,boneEnergyLostJ:boneEnergy,boneHits:[...boneMap.values()],stopDepthM:stopped?d:null,stopped,traversedLengthM:d,occupiedDepthM:offset+d,equivalentDepthM:eq,yawDepthAdvanceM:advance,deformationAreaScale:areaScale,yawRad:yawAt(p,eq+advance)+yawOffsetRad,fragmentationEligible};
}
const EMPTY=Object.freeze([]);
function intervalOverlap(intervals,a,b){if(!intervals.length)return 0;if(intervals.length===1)return Math.min(b-a,Math.max(0,Math.min(b,intervals[0][1])-Math.max(a,intervals[0][0])));let sum=0;for(let i=0;i<intervals.length;i++){const interval=intervals[i];sum+=Math.max(0,Math.min(b,interval[1])-Math.max(a,interval[0]));}return Math.min(b-a,sum);}
// Separate sites keep the source metadata's organ/vessel shapes monomorphic.
function materializeOrgan(h,k,effectiveVolumeM3){return ({...h,direct:k.direct,enclosurePenetrated:k.enclosurePenetrated,temporaryCavityAttenuation:k.temporaryCavityAttenuation,concussionRisk:k.concussionRisk,volumeM3:k.volumeM3,coefficient:k.coefficient,permanentVolumeM3:k.permanentVolumeM3,temporaryVolumeM3:k.temporaryVolumeM3,fragmentVolumeM3:k.fragmentVolumeM3,boneSecondaryFragmentVolumeM3:k.boneSecondaryFragmentVolumeM3,effectiveVolumeM3,severity:clamp(effectiveVolumeM3/k.volumeM3*K.organSeverityGain)});}
function materializeVessel(h,k,effectiveVolumeM3){return ({...h,direct:k.direct,enclosurePenetrated:k.enclosurePenetrated,temporaryCavityAttenuation:k.temporaryCavityAttenuation,concussionRisk:k.concussionRisk,volumeM3:k.volumeM3,coefficient:k.coefficient,permanentVolumeM3:k.permanentVolumeM3,temporaryVolumeM3:k.temporaryVolumeM3,fragmentVolumeM3:k.fragmentVolumeM3,boneSecondaryFragmentVolumeM3:k.boneSecondaryFragmentVolumeM3,effectiveVolumeM3,severity:clamp(effectiveVolumeM3/k.volumeM3*K.organSeverityGain)});}
function computeChannel({ammoId,entryVelocityMps,massKg,lengthM,bodyPart,startDepthM=0,internalHits=[],cavityCandidates=[],tissueIntervals=null,enclosureHits=null,origin=[0,0,0],direction=[0,0,1],actualExitVelocityMps=null,stateIn=null}={},direct=false){
 const state=stateIn||{},p=tissueProfile(ammoId,entryVelocityMps,state),initialMass=state.initialMassKg||p.coreMassOverrideKg||massKg||CATALOG.AMMO_PRESETS[ammoId].projectileMassG/1000||p.massKg,offset=state.occupiedDepthM||0,equivalentDepthM=state.equivalentDepthM??offset,yawDepthAdvanceM=state.yawDepthAdvanceM||0,yawOffsetRad=state.yawRad===undefined?0:state.yawRad-yawAt(p,equivalentDepthM+yawDepthAdvanceM),tissues=tissueCache({tissueIntervals,internalHits},startDepthM,Math.max(0,lengthM));
 const curve=integrateTissue(p,{velocity:entryVelocityMps,length:Math.max(0,lengthM),offset,mass:state.massKg||initialMass,initialMass,fragmentMassKg:state.fragmentMassKg||0,fragmented:state.fragmented||false,fragmentDepthM:state.fragmentDepthM??null,fragmentEnergyJ:state.fragmentEnergyJ||0,equivalentDepthM,yawDepthAdvanceM,yawOffsetRad,deformationAreaScale:state.deformationAreaScale||1,fragmentationEligible:state.fragmentationEligible??(entryVelocityMps>=p.fragmentVelocityMps),tissues,startDepthM,direct});
 const penetratedBoneIds=new Set(state.penetratedBoneIds||[]);for(const h of(enclosureHits||internalHits))if(h.kind==='bone'&&(h.intervals||[]).some(([a,b])=>b>startDepthM&&a<startDepthM+curve.traversedLengthM))penetratedBoneIds.add(h.id);
 const hitMap=new Map();for(let i=0;i<internalHits.length;i++)hitMap.set(internalHits[i].id,internalHits[i]);
 const organs=[],kernels=[],partEnd=startDepthM+curve.traversedLengthM;let maximumRadius2=0;for(let i=0;i<curve.steps.length;i++){const c=curve.steps[i],r=Math.max(c.temporaryRadiusM,c.fragmentRadiusM,c.boneSecondaryFragmentRadiusM||0);maximumRadius2=Math.max(maximumRadius2,r*r);}
 for(let i=0;i<cavityCandidates.length;i++){
  const h=cavityCandidates[i];if(h.kind==='bone')continue;const hit=hitMap.get(h.id),direct=!!hit&&intervalOverlap(hit.intervals||EMPTY,startDepthM,partEnd)>1e-10,radialGap2=direct?0:h.surfaceDistanceM*h.surfaceDistanceM;if(!direct&&radialGap2>=maximumRadius2)continue;const candidateIntervals=h.cavityIntervals||[[h.closestDepthM,h.closestDepthM]];
  if(!intervalOverlap(candidateIntervals,startDepthM,partEnd)&&!intervalOverlap(hit?.intervals||EMPTY,startDepthM,partEnd))continue;
  let coreIntervals=hit?.intervals;if(!coreIntervals?.length){const margin=Math.sqrt(Math.max(0,K.maxRadiusM**2-h.surfaceDistanceM**2));coreIntervals=[];for(let j=0;j<candidateIntervals.length;j++){const [a,b]=candidateIntervals[j];coreIntervals.push(a+margin<b-margin?[a+margin,b-margin]:[h.closestDepthM,h.closestDepthM]);}}
  const volume=Math.max(1e-12,h.volumeM3||1e-5);let span=0;for(let j=0;j<coreIntervals.length;j++)span+=coreIntervals[j][1]-coreIntervals[j][0];
  const protectedNeural=['brain','brainstem','spinal_cord'].includes(h.organ),enclosureIds=h.enclosureBoneIds||[],priorPenetrated=direct||!protectedNeural||enclosureIds.some(id=>(state.penetratedBoneIds||EMPTY).includes(id));let enclosureEntryDepthM=priorPenetrated?-Infinity:Infinity;
  if(!priorPenetrated)for(const bone of(enclosureHits||internalHits))if(bone.kind==='bone'&&enclosureIds.includes(bone.id))for(const [a,b]of bone.intervals||EMPTY)if(b>startDepthM&&a<partEnd)enclosureEntryDepthM=Math.min(enclosureEntryDepthM,Math.max(startDepthM,a));
  const enclosurePenetrated=Number.isFinite(enclosureEntryDepthM)||enclosureEntryDepthM===-Infinity;
  organs.push(h);
  kernels.push({enclosureEntryDepthM,hitIntervals:hit?.intervals||EMPTY,candidateIntervals,coreIntervals,radialGap2,crossArea:volume/Math.max(span,Math.cbrt(volume)*.5),direct,volumeM3:volume,coefficient:K.tissueCoefficients[h.kind==='vessel'?'vessel':h.organ]??K.muscleCoefficient,enclosurePenetrated,temporaryCavityAttenuation:enclosurePenetrated?1:S2.outsideEnclosureTemporaryCavityFactor,concussionRisk:0,permanentVolumeM3:0,temporaryVolumeM3:0,fragmentVolumeM3:0,boneSecondaryFragmentVolumeM3:0});
 }
 const volumes={permanentM3:0,temporaryM3:0,fragmentM3:0,boneSecondaryFragmentM3:0,effectiveM3:0};let concussionRisk=0;
 for(let si=0;si<curve.steps.length;si++){
  const s=curve.steps[si],a=s.depthM+startDepthM,b=a+s.dxM,permanentArea=pi*s.permanentRadiusM**2,tempR2=s.temporaryRadiusM**2,fragR2=s.fragmentRadiusM**2,perm=permanentArea*s.dxM,temp=pi*tempR2*s.dxM,frag=pi*fragR2*s.dxM*K.fragmentFillFraction,secondaryRadius2=(s.boneSecondaryFragmentRadiusM||0)**2,secondaryVolume=s.boneSecondaryFragmentVolumeM3||0;let coverage=0,weighted=0;
  for(let oi=0;oi<organs.length;oi++){
   const kernel=kernels[oi],h=kernel;if(!h.direct&&kernel.radialGap2>=tempR2&&kernel.radialGap2>=fragR2&&kernel.radialGap2>=secondaryRadius2)continue;
   const directLength=intervalOverlap(kernel.hitIntervals,a,b),candidateLength=intervalOverlap(kernel.candidateIntervals,a,b);if(!directLength&&!candidateLength)continue;
   const mid=(a+b)/2;let axialGap;if(kernel.coreIntervals.length===1){const interval=kernel.coreIntervals[0];axialGap=Math.max(interval[0]-mid,mid-interval[1],0);}else{axialGap=Infinity;for(let j=0;j<kernel.coreIntervals.length;j++){const interval=kernel.coreIntervals[j],gap=Math.max(interval[0]-mid,mid-interval[1],0);if(gap<axialGap)axialGap=gap;}}
   const gap2=kernel.radialGap2+axialGap*axialGap;if(!directLength&&gap2>=tempR2&&gap2>=fragR2&&gap2>=secondaryRadius2)continue;const pc=directLength>0?Math.min(h.volumeM3-h.permanentVolumeM3,permanentArea*directLength):0,tc=Math.min(h.volumeM3-h.temporaryVolumeM3,Math.min(kernel.crossArea,pi*Math.max(0,tempR2-gap2))*candidateLength),fc=fragR2>0?Math.min(h.volumeM3-h.fragmentVolumeM3,Math.min(kernel.crossArea,pi*Math.max(0,fragR2-gap2))*candidateLength*K.fragmentFillFraction):0;
   let attenuation=1;if(kernel.enclosureEntryDepthM!==-Infinity){attenuation=b>=kernel.enclosureEntryDepthM?h.temporaryCavityAttenuation:S2.outsideEnclosureTemporaryCavityFactor;const blockedTC=tc*(1-attenuation);if(blockedTC>0){h.concussionRisk=clamp(h.concussionRisk+blockedTC/h.volumeM3*S2.concussionRiskVolumeGain);concussionRisk=Math.max(concussionRisk,h.concussionRisk);}}
   const acceptedTC=attenuation===1?tc:tc*attenuation,acceptedFC=kernel.enclosureEntryDepthM===-Infinity||b>=kernel.enclosureEntryDepthM?fc:fc*S2.outsideEnclosureFragmentFactor;let secondary=0;if(secondaryVolume>0){const secondaryFraction=secondaryRadius2>0?Math.max(0,1-gap2/secondaryRadius2):0;secondary=Math.min(h.volumeM3-h.boneSecondaryFragmentVolumeM3,secondaryVolume*secondaryFraction*candidateLength/Math.max(1e-12,s.dxM));}
   if(pc>0)h.permanentVolumeM3+=pc;if(acceptedTC>0)h.temporaryVolumeM3+=acceptedTC;if(acceptedFC>0)h.fragmentVolumeM3+=acceptedFC;if(h.enclosurePenetrated&&secondary>0)h.boneSecondaryFragmentVolumeM3+=secondary;if(acceptedTC!==0){const share=temp>0?acceptedTC/temp:0;coverage+=share;weighted+=share*h.coefficient;}
  }
  const coef=coverage>1?weighted/coverage:K.muscleCoefficient*(1-coverage)+weighted;
  const secondary=s.boneSecondaryFragmentVolumeM3||0;volumes.permanentM3+=perm;volumes.temporaryM3+=temp;volumes.fragmentM3+=frag;volumes.boneSecondaryFragmentM3+=secondary;volumes.effectiveM3+=perm+frag+secondary+clamp(coef,.1,1)*temp;
 }
 const damagedOrgans=[];for(let i=0;i<organs.length;i++){const h=organs[i],k=kernels[i],effectiveVolumeM3=k.permanentVolumeM3+k.fragmentVolumeM3+k.boneSecondaryFragmentVolumeM3+k.coefficient*k.temporaryVolumeM3;if(effectiveVolumeM3>0||k.concussionRisk>0)damagedOrgans.push(h.kind==='vessel'?materializeVessel(h,k,effectiveVolumeM3):materializeOrgan(h,k,effectiveVolumeM3));}
 const referenceVolumeM3=K.referenceVolumesM3[bodyPart]||.001;
 const result={ruleId:'wound-channel-s2',calculationMode:direct?'direct':'equivalent-depth-lut',ammoId,bodyPart,profileId:p.profileId,profileMapping:p.mappingNote,entryVelocityMps,lengthM,startDepthM,traversedLengthM:curve.traversedLengthM,stopped:curve.stopped,stopDepthM:curve.stopDepthM,exitVelocityMps:curve.stopped?0:curve.velocityOutMps,terminalVelocityMps:curve.velocityOutMps,initialYawRad:yawAt(p,equivalentDepthM+yawDepthAdvanceM)+yawOffsetRad,initialArmorYawRad:0,armorDeformationApplied:false,armorYawApplied:false,origin:[...origin],direction:[...direction],volumes,referenceVolumeM3,damageMultiplier:clamp(volumes.effectiveM3/referenceVolumeM3,.1,1),predictedExitVelocityMps:curve.velocityOutMps,actualExitVelocityMps:curve.stopped?0:curve.velocityOutMps,previousActualExitVelocityMps:actualExitVelocityMps,fragmentationThresholdMps:Number.isFinite(p.fragmentVelocityMps)?p.fragmentVelocityMps:null,fragmentation:curve.fragmented,steps:curve.steps,organs:damagedOrgans,stateOut:{initialMassKg:initialMass,velocityMps:curve.velocityOutMps,massKg:curve.massKg,fragmentMassKg:curve.fragmentMassKg,fragmented:curve.fragmented,fragmentDepthM:curve.fragmentDepthM,occupiedDepthM:curve.occupiedDepthM,equivalentDepthM:curve.equivalentDepthM,yawDepthAdvanceM:curve.yawDepthAdvanceM,yawRad:curve.yawRad,deformationAreaScale:curve.deformationAreaScale,fragmentEnergyJ:curve.fragmentEnergyJ,fragmentationEligible:curve.fragmentationEligible,penetratedBoneIds:[...penetratedBoneIds]},energyLostJ:curve.energyLostJ,boneEnergyLostJ:curve.boneEnergyLostJ,boneHits:curve.boneHits,concussionRisk,geometryQueriesPerStep:0};
 if(p.s3Terminal){result.s3Terminal={ruleId:'terminal-types-s3',type:p.s3Terminal.type,thresholdVelocity:p.s3Terminal.thresholdVelocity,grade:p.s3Terminal.grade,donorProfileId:p.s3Terminal.donorProfileId,yawOnsetDepthM:p.yawOnsetDepthM,terminalEffectActive:p.s3TerminalEffectActive,expanded:p.expansionAreaScale>1,expansionAreaScale:p.expansionAreaScale,lengthRatio:p.s3Terminal.lengthRatio};result.stateOut.s3TerminalEffectActive=p.s3TerminalEffectActive;}
 return result;
}
export function computeWoundChannel(input){return computeChannel(input,false);}
export function computeWoundChannelDirect(input){return computeChannel(input,true);}
export function gelatinProfile(profileId){const p=WOUND_PROFILES[profileId];if(!p)throw Error('Unknown wound profile');const c=integrate(p,{length:Math.min(2,p.penetrationM+.2),full:true});return {profileId,sourceImpactVelocityMps:p.velocity,calibratedCd:p.cd,k:p.k,stopVelocityThresholdMps:K.stopVelocityMps,predictedPenetrationM:c.stopDepthM,maximumTemporaryDepthM:c.peakDepthM,maximumTemporaryDiameterM:Math.max(...c.steps.map(s=>2*s.temporaryRadiusM)),fragmentDepthM:c.fragmentDepthM,steps:c.steps,sourceReadout:profileId==='pistol'?null:{penetrationM:p.penetrationM,yawOnsetDepthM:p.yaw[1][0],maximumTemporaryDepthM:p.peakM,maximumTemporaryDiameterM:p.diameterTCM},tuningReference:profileId==='pistol'?{penetrationM:p.penetrationM,maximumTemporaryDiameterM:p.diameterTCM,classification:'estimate; no verified complete pistol figure'}:null,yawOnsetDepthM:p.yaw[1][0],fragmentEndDepthM:c.fragmentDepthM===null?null:c.fragmentDepthM+p.fragmentRangeM};}
