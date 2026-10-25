import {SCAR_HANDLING} from './scar-data.js';
// Display/action timing measured on the supplied clips; original registry stays intact.
export const FPS_HANDLING = Object.freeze({
 scar_h:SCAR_HANDLING,
 m4a1: {draw:{clip:'Take',duration:.625},hide:{clip:'Hide',duration:.625},
  reload:{clip:'Reload',duration:2.0833332538604736,removeAt:10/24,insertAt:29/24,feedAt:38/24,insertStart:15/24}},
 ak74m: {draw:{clip:'Draw',duration:.6483333706855774},hide:{clip:'Draw',duration:.6483333706855774,reverse:true},
  reload:{clip:'Reload',duration:2.6483333110809326,removeAt:1.15,insertAt:1.9,insertStart:1.15},
  emptyReload:{clip:'Reload_full',duration:3.49833345413208,removeAt:1.15,insertAt:1.9,feedAt:2.7,insertStart:1.15}}
});
export function reloadAnimation(id,{empty=false,insertOnly=false,removeOnly=false}={}){
 const profile=FPS_HANDLING[id];if(!profile)return null;
 const clip=empty&&profile.emptyReload?profile.emptyReload:profile.reload,sourceStart=insertOnly?clip.insertStart:0;
 return {clip:clip.clip,sourceStart,duration:removeOnly?clip.removeAt+.2:clip.duration-sourceStart,removeAt:insertOnly?0:clip.removeAt,insertAt:removeOnly?null:clip.insertAt-sourceStart,feedAt:empty&&!removeOnly?clip.feedAt-sourceStart:null};
}
