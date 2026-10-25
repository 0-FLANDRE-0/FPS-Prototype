import{SCAR_CONTACTS}from'./scar-data.js';
// Z attachment stage: manufacturer dimensions; storage/time/placement are tuning.
export const VUDU = Object.freeze({
 id:'vudu_1_6x24',name:'EOTECH Vudu 1–6×24',shortName:'Vudu 1–6×',
 kind:'optic',size:Object.freeze({w:1,h:2}),weaponIds:Object.freeze(['m4a1','scar_h']),
 weightKg:.570,lengthM:.270,tubeDiameterM:.030,objectiveDiameterM:.024,
 eyeReliefM:Object.freeze([.083,.100]),
 manufacturer:'https://www.eotechinc.com/products/eotech-vudu-1-6x24-ffp',
 installSeconds:1.0,removeSeconds:.8,
 // Measured receiver rail top minus the mount's 5.422 mm inner seating plane;
 // the clamp skirts extend below the rail. Fore/aft placement is authored.
 // Fore/aft placement remains the uploaded reference's authored tuning.
 mountPosition:Object.freeze([0,.08968237042427067-.005421621642754492,.145]),
 blob:"optic-data",prefix:"Vudu",sight:"pip",variableZoom:true,adsEyeReliefM:.09,axisHeightM:.04033210855889871,axisLengthM:.24894691887253503,
});
export const XPS3 = Object.freeze({
 id:'eotech_xps3_0',name:'EOTECH XPS3-0 HWS',shortName:'XPS3',kind:'optic',
 size:Object.freeze({w:1,h:1}),weaponIds:Object.freeze(['m4a1','scar_h']),weightKg:.227,lengthM:.09525,
 windowM:Object.freeze([.03,.023]),reticleMOA:Object.freeze({ring:68,dot:1}),
 manufacturer:'EOTECH XPS3/XPS2 operator manual (8.0 oz, 3.75 in, window 30x23 mm); 68 MOA ring per EOTECH EXPS3 manual',
 // Install/removal times, rail placement and 173mm eye position are game tuning.
 installSeconds:.8,removeSeconds:.6,mountPosition:Object.freeze([0,.08426074878151618,.057]),
 blob:'optic-xps3-data',prefix:'XPS3',sight:'holo',variableZoom:false,fixedMag:1,adsEyeReliefM:.173,
 axisHeightM:.04226,axisLengthM:.01438,
});
export const ACOG = Object.freeze({
 id:'trijicon_ta31',name:'Trijicon ACOG TA31 4×32',shortName:'ACOG 4×',kind:'optic',
 size:Object.freeze({w:1,h:2}),weaponIds:Object.freeze(['m4a1','scar_h']),weightKg:.42241,lengthM:.15189,
 manufacturer:'https://www.trijicon.com/products/details/ta31-d-100309',
 // Times/placement are game tuning. 1.5-inch eye relief is manufacturer data.
 installSeconds:1,removeSeconds:.8,mountPosition:Object.freeze([0,.08426074878151618,.192]),
 blob:'optic-acog-data',prefix:'ACOG',sight:'pip',variableZoom:false,fixedMag:4,adsEyeReliefM:.0381,
 axisHeightM:.0396,axisLengthM:.12552,
});
export const OPTICS = Object.freeze({[VUDU.id]:VUDU,[XPS3.id]:XPS3,[ACOG.id]:ACOG});
export const opticDefinition = item => OPTICS[item?.definitionId] || null;

const scarOptics=new Map();
export function opticForWeapon(def,weaponId){if(!def||weaponId!=="scar_h")return def;if(!scarOptics.has(def.id))scarOptics.set(def.id,Object.freeze({...def,mountPosition:Object.freeze([def.mountPosition[0],SCAR_CONTACTS.railY-.005421621642754492,def.mountPosition[2]])}));return scarOptics.get(def.id);}
