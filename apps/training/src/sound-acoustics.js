// SND1: physical propagation shared by playback and hearing. No ballistic mutation.
// Source equations and every approximation are classified in sound-snd1-ledger.json.
import {FOOTSTEP_AUDIO} from './sound-tuning.js';
export const SOUND = Object.freeze({ruleId:'sound-snd1',speedMps:343,bandsHz:[500,2000,4000],temperatureK:293.15,humidityPercent:50,pressureKPa:101.325,maxVoices:24,maxConvolvers:3,componentCullDb:10,maxRecent:24,maxEvents:256,backgroundDb:30,hearingMarginDb:8,levelMarginRangeDb:35,microphoneDefaultPercent:70,virtualCeilingM:3.2,referenceCOUnused:true});
export const MATERIAL_SOUND = Object.freeze({
 concrete:{densityKgM3:2300,absorption:[.01,.02,.02]},drywall:{densityKgM3:800,absorption:[.05,.07,.09]},wood:{densityKgM3:650,absorption:[.05,.05,.05]},thin_metal:{densityKgM3:7850,absorption:[.01,.02,.02]},steel:{densityKgM3:7850,absorption:[.01,.02,.02]},glass:{densityKgM3:2500,absorption:[.04,.02,.02]},
});
export const NOISE_TYPE_PROFILE = Object.freeze({
 gunshot:{loudness:1,decay:4,conf:.85,sourceDb:160,spectrum:[.35,.45,.20]},
 footstep_walk:{loudness:.18,decay:1,conf:.30,sourceDb:58,spectrum:[.60,.30,.10]},
 footstep_run:{loudness:.45,decay:1.8,conf:.45,sourceDb:67,spectrum:[.60,.30,.10]},
 footstep_crawl:{loudness:.08,decay:.8,conf:.22,sourceDb:47,spectrum:[.60,.30,.10]},
 reload:{loudness:.20,decay:1.5,conf:.40,sourceDb:53,spectrum:[.35,.45,.20],aiOnly:true},
 impact:{loudness:.50,decay:2,conf:.55,sourceDb:75,spectrum:[.35,.45,.20],aiOnly:true},
 crack:{loudness:1,decay:2,conf:.75,sourceDb:140,spectrum:[.10,.40,.50]},
 gear:{loudness:.12,decay:1,conf:.25,sourceDb:51,spectrum:[.30,.40,.30]},
});
export const LOAD_NOISE_MUL = Object.freeze({light:.85,standard:1,heavy:1.15,overloaded:1.30});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a),distance=(a,b)=>length(sub(a,b));
export const energyDb=levels=>{const valid=levels.filter(Number.isFinite);if(!valid.length)return -Infinity;const m=Math.max(...valid);return m+10*Math.log10(valid.reduce((s,l)=>s+10**((l-m)/10),0));};
export function airAbsorptionDbM(f,{temperatureK:T=SOUND.temperatureK,humidityPercent:rh=SOUND.humidityPercent,pressureKPa:p=SOUND.pressureKPa}={}){
 // ISO 9613-1:1993, 1 atm, humidity concentration in percent, not fractional RH.
 const tr=T/293.15,pr=p/101.325,ps=10**(-6.8346*(273.16/T)**1.261+4.6151),h=rh*ps/pr;
 const o=pr*(24+4.04e4*h*(.02+h)/(.391+h)),n=pr*tr**(-.5)*(9+280*h*Math.exp(-4.17*(tr**(-1/3)-1)));
 return 8.686*f*f*(1.84e-11/pr*Math.sqrt(tr)+tr**(-2.5)*(.01275*Math.exp(-2239.1/T)/(o+f*f/o)+.1068*Math.exp(-3352/T)/(n+f*f/n)));
}
export function massLawLossDb(material,thicknessM,f){const density=MATERIAL_SOUND[material]?.densityKgM3??MATERIAL_SOUND.concrete.densityKgM3;return Math.max(0,20*Math.log10(Math.max(1e-5,density*thicknessM)*f)-47);}
export function segmentBox(from,to,box){
 const a=box.at.map((v,i)=>v-box.size[i]/2),b=box.at.map((v,i)=>v+box.size[i]/2),d=sub(to,from);let entry=0,exit=1;
 for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-12){if(from[i]<a[i]||from[i]>b[i])return null;continue;}let lo=(a[i]-from[i])/d[i],hi=(b[i]-from[i])/d[i];if(lo>hi)[lo,hi]=[hi,lo];entry=Math.max(entry,lo);exit=Math.min(exit,hi);if(entry>=exit)return null;}
 return{entry,exit,lengthM:(exit-entry)*length(d)};
}
export function roomAt(point,rooms){return rooms.find(r=>!r.outdoor&&r.boxes.some(b=>point.every((v,i)=>v>=b.min[i]&&v<=b.max[i])))||rooms.find(r=>r.outdoor);}
export function roomAcoustics(room,portals=[]){
 if(!room||room.outdoor)return{volumeM3:0,areaM2:0,rt60S:[0,0,0],reverbEnergyGain:0};
 let volumeM3=0,areaM2=0;for(const b of room.boxes){const[x,y,z]=sub(b.max,b.min);volumeM3+=x*y*z;areaM2+=2*(x*y+x*z+y*z);}
 const surfaces=[...(room.surfaceAreas||[{material:'concrete',areaM2}]),...portals.filter(p=>p.roomA===room.id||p.roomB===room.id).map(p=>({material:p.closedMaterial||'concrete',areaM2:p.width*p.height,openness:p.openness}))];areaM2=surfaces.reduce((s,a)=>s+a.areaM2,0);const absorption=SOUND.bandsHz.map((_,i)=>surfaces.reduce((s,a)=>s+a.areaM2*((a.openness??0)+(1-(a.openness??0))*(MATERIAL_SOUND[a.material]?.absorption[i]??.02)),0)/areaM2);const uncappedRT60S=absorption.map(a=>.161*volumeM3/Math.max(.01,areaM2*a)),rt60S=uncappedRT60S.map(t=>clamp(t,.08,2.5));
 return{volumeM3,areaM2,absorption,uncappedRT60S,rt60S,reverbEnergyGain:clamp(rt60S[1]*.20,0,.6)}; // Sabine; wet energy scaling/RT cap are game tuning.
}
// Only low free-standing screens can be routed over. Full-height walls still
// require an existing opening; no through-concrete "audibility floor" is added.
function acousticSegment(from,to,walls,allowScreens){
 const points=[from,to],screenIds=new Set();
 for(let pass=0;pass<5;pass++){
  let obstructed=false;
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],hits=walls.map(w=>({w,h:segmentBox(a,b,w)})).filter(({h})=>h&&h.lengthM>1e-4&&h.entry>1e-6&&h.exit<.999999).sort((a,b)=>a.h.entry-b.h.entry);
   if(!hits.length)continue;
   const {w,h}=hits[0],top=w.at[1]+w.size[1]/2,bottom=w.at[1]-w.size[1]/2;
   if(!allowScreens||top>FOOTSTEP_AUDIO.maxScreenHeightM||bottom>.15)return null;
   const delta=sub(b,a),margin=FOOTSTEP_AUDIO.screenClearanceM/Math.max(.1,Math.hypot(delta[0],delta[2])),before=add(a,mul(delta,Math.max(0,h.entry-margin))),after=add(a,mul(delta,Math.min(1,h.exit+margin)));
   before[1]=after[1]=top+FOOTSTEP_AUDIO.screenClearanceM;points.splice(i+1,0,before,after);screenIds.add(w.id);obstructed=true;break;
  }
  if(!obstructed){const lengthM=points.slice(1).reduce((s,p,i)=>s+distance(points[i],p),0);return{points,lengthM,screenIds:[...screenIds],excessM:Math.max(0,lengthM-distance(from,to))};}
 }
 return null;
}
const screenLoss=detours=>SOUND.bandsHz.map(f=>detours.reduce((s,p)=>s+FOOTSTEP_AUDIO.screenLossScale*10*Math.log10(1+40*p.excessM*f/SOUND.speedMps),0));
export function shortestPortalPath(from,to,sourceRoom,listenerRoom,portals,walls=[],allowScreens=false){
 if(sourceRoom.id===listenerRoom.id)return null;
 const queue=[{room:sourceRoom.id,point:from,cost:0,portals:[],points:[from],screenDetours:[],visited:new Set([sourceRoom.id])}];let best=null;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const n=queue.shift();if(best&&n.cost>=best.lengthM)continue;
  if(n.room===listenerRoom.id){const leg=acousticSegment(n.point,to,walls,allowScreens);if(!leg)continue;const total=n.cost+leg.lengthM;if(!best||total<best.lengthM)best={portals:n.portals,lengthM:total,points:[...n.points,...leg.points.slice(1)],portalPoints:[from,...n.portals.map(p=>p.center),to],screenDetours:[...n.screenDetours,...(leg.screenIds.length?[leg]:[])]};continue;}
  if(n.portals.length>=8)continue;
  for(const p of portals){const other=p.roomA===n.room?p.roomB:p.roomB===n.room?p.roomA:null;if(!other||n.visited.has(other)||p.openness<=0)continue;
   const leg=acousticSegment(n.point,p.center,walls,allowScreens);if(!leg)continue;
   queue.push({room:other,point:p.center,cost:n.cost+leg.lengthM,portals:[...n.portals,p],points:[...n.points,...leg.points.slice(1)],screenDetours:[...n.screenDetours,...(leg.screenIds.length?[leg]:[])],visited:new Set([...n.visited,other])});
  }
 }
 return best;
}
function portalIntersection(from,to,p){const d=sub(to,from),den=dot(d,p.normal);if(Math.abs(den)<1e-10)return null;const t=dot(sub(p.center,from),p.normal)/den;if(t<=1e-6||t>=1-1e-6)return null;const point=add(from,mul(d,t)),horizontal=Math.abs(p.normal[0])>.5?2:0;if(Math.abs(point[horizontal]-p.center[horizontal])>p.width/2||Math.abs(point[1]-p.center[1])>p.height/2)return null;return{point,t};}
function lossByBand(pathLength,losses,event){return SOUND.bandsHz.map((f,i)=>event.sourceDb+10*Math.log10((event.spectrum||NOISE_TYPE_PROFILE[event.type].spectrum)[i])-20*Math.log10(Math.max(1,pathLength))-airAbsorptionDbM(f)*pathLength-losses[i]);}
export function propagateSound(event,listener,{rooms,portals,walls=[]}){
 const from=event.position,to=listener,sourceRoom=roomAt(from,rooms),listenerRoom=roomAt(to,rooms),d=distance(from,to),wallHits=[];let losses=[0,0,0],blocked=false;
 for(const w of walls){const hit=segmentBox(from,to,w);if(!hit||hit.lengthM<1e-6)continue;blocked=true;const thickness=w.nominalThicknessM??Math.min(...w.size),tl=SOUND.bandsHz.map(f=>massLawLossDb(w.material||'concrete',thickness,f));losses=losses.map((v,i)=>v+tl[i]);wallHits.push({id:w.id,material:w.material||'concrete',thicknessM:thickness,pathInWallM:hit.lengthM,lossDb:tl});}
 // A door/window lives only in acoustic data; never create/change ballistic colliders.
 for(const p of portals){if(p.kind==='opening'||!portalIntersection(from,to,p))continue;const closed=1-clamp(p.openness,0,1);blocked=true;const tl=SOUND.bandsHz.map(f=>massLawLossDb(p.closedMaterial||'wood',p.thicknessM??(p.kind==='window'?.006:.04),f));losses=losses.map((v,i)=>closed<=0?Infinity:v+tl[i]-10*Math.log10(closed));wallHits.push({id:p.id,material:p.closedMaterial,closedFraction:closed,lossDb:tl});}
 const directBands=lossByBand(d,losses,event),direct={kind:'wall',points:[from,to],lengthM:d,delayS:d/SOUND.speedMps,lossDb:losses,wallHits,bandDb:directBands,levelDb:energyDb(directBands),apparentPosition:from};
 const allowScreens=event.type.startsWith('footstep'),route=sourceRoom&&listenerRoom?shortestPortalPath(from,to,sourceRoom,listenerRoom,portals,walls,allowScreens):null;let portal=null;
 if(route){const pathLoss=screenLoss(route.screenDetours),details=[];for(let i=0;i<route.portals.length;i++){const p=route.portals[i],before=route.portalPoints[i],after=route.portalPoints[i+2],a=sub(p.center,before),b=sub(after,p.center),cos=clamp(dot(a,b)/Math.max(1e-8,length(a)*length(b)),-1,1),angle=Math.acos(cos),opennessLoss=-10*Math.log10(Math.max(1e-9,p.openness)),detour=Math.max(0,distance(before,p.center)+distance(p.center,after)-distance(before,after));
    // Maekawa-inspired Fresnel detour; angle weighting/aperture center path are tuning.
    const diffraction=SOUND.bandsHz.map(f=>angle<1e-4?0:10*Math.log10(1+20*(2*detour*f/SOUND.speedMps))*Math.sin(angle/2));for(let k=0;k<3;k++)pathLoss[k]+=opennessLoss+diffraction[k];details.push({id:p.id,openness:p.openness,opennessLossDb:opennessLoss,turnDeg:angle*180/Math.PI,diffractionLossDb:diffraction});}
  const bandDb=lossByBand(route.lengthM,pathLoss,event);portal={kind:'portal',...route,portals:details,lossDb:pathLoss,bandDb,levelDb:energyDb(bandDb),delayS:route.lengthM/SOUND.speedMps,wallHits:[],apparentPosition:route.portals.at(-1).center};
 }
 // Same-region direct rays and unblocked open-air rays have only one component.
 let around=portal;
 if(allowScreens&&blocked){const path=acousticSegment(from,to,walls,true);if(path?.screenIds.length){const lossDb=screenLoss([path]),bandDb=lossByBand(path.lengthM,lossDb,event),screen={kind:'diffraction',...path,lossDb,bandDb,levelDb:energyDb(bandDb),delayS:path.lengthM/SOUND.speedMps,wallHits:[],apparentPosition:path.points.at(-2)};if(!around||screen.levelDb>around.levelDb)around=screen;}}
 const components=around&&blocked?[around,direct]:around?[around]:[direct];
 const combinedBands=SOUND.bandsHz.map((_,i)=>energyDb(components.map(c=>c.bandDb[i]))),levelDb=energyDb(combinedBands),loudest=Math.max(...components.map(c=>c.levelDb)),dominant=components.reduce((a,b)=>a.levelDb>=b.levelDb?a:b);
 for(const c of components)c.playable=Number.isFinite(c.levelDb)&&c.levelDb>=loudest-SOUND.componentCullDb;
 const srcReverb=roomAcoustics(sourceRoom,portals),dstReverb=roomAcoustics(listenerRoom,portals),wetGain=srcReverb.reverbEnergyGain+(sourceRoom?.id===listenerRoom?.id?0:dstReverb.reverbEnergyGain);
 return{sourceRoom:sourceRoom?.id,listenerRoom:listenerRoom?.id,sourcePosition:from,listenerPosition:to,components,bandDb:combinedBands,levelDb,exposureDb:levelDb+10*Math.log10(1+wetGain),reverbEnergyGain:wetGain,dominant:dominant.kind,apparentPosition:dominant.apparentPosition,delayS:dominant.delayS,sourceReverb:srcReverb,listenerReverb:dstReverb};
}
export function playbackGain(levelDb,event=null){const footstep=event?.type?.startsWith('footstep'),floor=footstep?FOOTSTEP_AUDIO.playbackFloorDb:20;if(!Number.isFinite(levelDb)||levelDb<floor)return 0;const outputDb=clamp(-42+.32*(levelDb-40),-48,-2);if(!footstep)return 10**(outputDb/20);const fade=clamp((levelDb-floor)/FOOTSTEP_AUDIO.playbackFadeDb,0,1),boost=event.sourceId==='P01'?FOOTSTEP_AUDIO.ownPlaybackBoostDb:FOOTSTEP_AUDIO.playbackBoostDb;return 10**((outputDb+boost)/20)*fade*fade*(3-2*fade);} // Explicit mobile dynamic-range compression tuning.
export function machCrack(segments,listener,{maxMissM=12}={}){
 let best=null;for(const s of segments||[]){if(s.medium!=='air'||!s.from||!s.to)continue;const startSpeed=s.velocityFromMps??s.velocityMps??0,endSpeed=s.velocityMps??startSpeed,delta=sub(s.to,s.from),len=length(delta);if(startSpeed<=SOUND.speedMps||len<1e-7)continue;const u=mul(delta,1/len),r=sub(listener,s.from),x=dot(r,u),b=length(sub(r,mul(u,x)));if(b>maxMissM||b<.05)continue;
  let localSpeed=startSpeed,emissionDistance;for(let j=0;j<6;j++){if(localSpeed<=SOUND.speedMps)break;emissionDistance=x-b/Math.sqrt((localSpeed/SOUND.speedMps)**2-1);localSpeed=startSpeed+(endSpeed-startSpeed)*clamp(emissionDistance/len,0,1);}
  if(localSpeed<=SOUND.speedMps||emissionDistance<0||emissionDistance>len)continue;
  const position=add(s.from,mul(u,emissionDistance)),emissionTimeS=(s.timeStartS??0)+(s.timeEndS!=null?(s.timeEndS-(s.timeStartS??0))*emissionDistance/len:emissionDistance/localSpeed),arrivalTimeS=emissionTimeS+distance(position,listener)/SOUND.speedMps;
  if(!best||arrivalTimeS<best.arrivalTimeS)best={position,emissionTimeS,arrivalTimeS,missDistanceM:b,localSpeedMps:localSpeed,machAngleDeg:Math.asin(SOUND.speedMps/localSpeed)*180/Math.PI,direction:mul(sub(position,listener),1/Math.max(1e-9,distance(position,listener))),sourceDb:140-15*Math.log10(Math.max(.25,b)),durationS:clamp(.0006+b*.00002,.0006,.0012)};
 }return best;
}
