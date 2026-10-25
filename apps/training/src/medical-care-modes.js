import{initBandageResource,BANDAGE}from'./medical-bandage.js';
import{M4C}from'./medical-care-m4c-policy.js';
import{m4bDuration}from'./medical-care-m4b-policy.js';
// 3D M4c timing policy. M3 reality coefficients and M4b drug/infusion times remain the baseline.
export const TREATMENT_MODES=['game','realistic','reality'];
export const MODE_LABELS={game:'게임',realistic:'리얼리스틱',reality:'현실'};
export const M4_VALUES={ruleId:'self-care-m4-v60',defaultMode:'realistic',sealSeconds:25,needleSeconds:12,txaSeconds:20,foamSeconds:30,backSealMultiplier:1.8,needleRadius:.065,needleDrainPerS:.35,ventDrainPerS:.015,needleRecurrenceChance:.35,needleRecurrenceMinS:90,needleRecurrenceMaxS:300,needleReachFailure:{anterior:.08,lateral:.02},iatrogenicPneumo:.12,foamPain:40,txaWindowS:10800,classification:'사용자 모드 설계; 시간·확률·허용 반경·출혈 계수 튜닝; 임상 치료 지침 아님'};
const limits={game:{bandage:3,gauze:3,needle:3,seal:4},realistic:{bandage:2,gauze:2,needle:2,seal:2},reality:{bandage:1,gauze:1,needle:1,seal:2}};
export const validCareMode=m=>TREATMENT_MODES.includes(m)?m:'realistic';
export const useLimit=(id,mode)=>limits[validCareMode(mode)][id]??1;
export function careProfile(mode,original){
 mode=validCareMode(mode);if(mode==='reality')return original;
 return{...original,...M4C.profiles[mode],catResidual:mode==='game'?0:.00005,looseArteryGain:mode==='game'?0:original.looseArteryGain,looseVeinFactor:mode==='game'?1:original.looseVeinFactor,bandage:mode==='game'?{artery:.3,vein:0,capillary:0}:{artery:.5,vein:.02,capillary:.01},gauze:mode==='game'?{artery:0,vein:0,capillary:0}:{artery:.00005,vein:.00005,capillary:.00005}};
}
export const durationScale=mode=>mode==='game'?1/6:mode==='realistic'?.4:1;
export const extraDuration=(kind,mode)=>m4bDuration(kind,mode)??M4C.profiles[mode]?.[kind+'Seconds']??({seal:M4_VALUES.sealSeconds,needle:M4_VALUES.needleSeconds,txa:M4_VALUES.txaSeconds,foam:M4_VALUES.foamSeconds}[kind]??0)*durationScale(mode);
export function careDuration(kind,partKey,p,mode){return kind==='cat'?p.catSeconds[partKey?.endsWith('Arm')?'arm':'leg']:kind==='bandage'?p.bandageSeconds:kind==='gauze'?p.gauzePackingSeconds+p.gauzePressureSeconds:extraDuration(kind,mode);}
// One pack may represent several units, with the same mass/footprint (game allowance).
// Depleted packs retain a non-spatial stock ledger so changing mode cannot refill uses.
export function syncMedicalUses(inv,mode){
 mode=validCareMode(mode);inv.treatmentMode=mode;inv.medicalStock??=new Map();
 for(const item of inv.items.values())if(item.kind==='medicalSupply'&&item.definitionId!=='cat'&&!inv.medicalStock.has(item.instanceId))inv.medicalStock.set(item.instanceId,{template:structuredClone(item),used:0});
 for(const[id,stock]of inv.medicalStock){if(stock.template.definitionId==='bandage'){const item=inv.items.get(id);if(item)initBandageResource(item);stock.resourceRuleId=BANDAGE.ruleId;continue;}const max=useLimit(stock.template.definitionId,mode),remaining=Math.max(0,max-stock.used),item=inv.items.get(id);stock.maximum=max;if(item&&!item.owner.startsWith('treatment:')){stock.template=structuredClone(item);item.remaining=remaining;item.maximumUses=max;item.used=stock.used;if(!remaining)inv.items.delete(id);}else if(!item&&remaining){const restored={...structuredClone(stock.template),remaining,maximumUses:max,used:stock.used};let cell=inv.findCell(restored.owner,restored);if(!cell){restored.owner='bag';cell=inv.findCell('bag',restored);}if(cell){restored.cell=cell;inv.items.set(id,restored);}}}
 inv.changed();
}
export function consumeMedicalUse(inv,item){const stock=inv.medicalStock?.get(item.instanceId);if(stock){stock.template=structuredClone(item);stock.used++;item.used=stock.used;}item.remaining=Math.max(0,item.remaining-1);if(!item.remaining)inv.items.delete(item.instanceId);}
