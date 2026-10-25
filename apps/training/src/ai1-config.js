import {CATALOG} from './catalog.js';
import {AK74M} from './weapon-data.js';
// AI1 coefficients are game tuning. Original 2D profiles are read, never edited.
export const AI1=Object.freeze({sensePeriodS:.1,maxRays:9,fovDeg:120,detectionRate:5,memoryDecayPerS:.08,walkSpeedMps:1.4,nearAutoM:3,autoIntervalS:60/AK74M.action.rateOfFire,pairIntervalS:.25,patrolPauseS:1.5});
export const AI_SKILLS=Object.freeze(['recruit','regular','elite']);
export function aiSkill(id='regular'){
 const key=AI_SKILLS.includes(id)?id:'regular',original=CATALOG.COMPOSURE_PROFILES[key],c=original.composure;
 return Object.freeze({id:key,original,reaction:1.35-.65*c,turn: .7+.7*c,overshoot:.9-.6*c,lead:.25+.6*c,perceptionM:.21-.15*c,recovery:2+7*c,suppressionResistance:original.startleResistance,hipM:5+3*c,quickM:12+6*c});
}
export function fireStyle(distance,skill,urgent=false){return distance<=skill.hipM||urgent&&distance<9?'hip':distance<=skill.quickM?'quick':'ads';}
export const FIRE_STYLES=Object.freeze({hip:{readyS:.13,uncertainty:2.8,ads:false},quick:{readyS:.28,uncertainty:1.6,ads:false},ads:{readyS:.5,uncertainty:1,ads:true}});
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
