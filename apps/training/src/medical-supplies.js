import{MO2,productRule}from'./medical-mo2-policy.js';
// Existing product package dimensions/mass retain their sources; generic injector and grid footprints are tuning.
const oz=28.349523125,freeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return Object.freeze(o);};
export const MEDICAL_ITEMS=freeze({ruleId:'medical-items-m3-v59',cellMm:90,doubleTapMs:350,dragThresholdPx:7,ifakGrid:{cols:3,rows:3},requestedGrid:{cols:3,rows:3},ifakSize:{w:2,h:2},classification:'사용자 구성/외부2x2; 제품 치수/무게 출처; 내부 격자는 정리 공간의 추상화, 실제 크기 비례 아님(게임 허용)'});
const supply=(id,name,shortName,description,target,packageMm,massOz,size,source,units=1)=>({id,name,shortName,description,target,packageMm,weightKg:massOz*oz/1000,size,source,units,kind:'medicalSupply'});
export const MEDICAL_SUPPLIES=freeze({
 cat:supply('cat','CAT Gen7 지혈대','CAT','팔다리 출혈용 지혈대.','팔다리 영역',[165.1,60.96,38.1],2.7,{w:1,h:1},'https://www.narescue.com/all-products/massive-hemorrhage/combat-application-tourniquet-c-a-t.html'),
 gauze:supply('gauze','QuikClot Combat Gauze','거즈','카올린 함유 지혈거즈.','상처',[139.7,127,15.875],.8,{w:1,h:2},'https://www.narescue.com/outdoor-adventure-products/combat-gauze.html'),
 injector:supply('injector','지혈 주입기','주입기','범용 스펀지형 지혈 주입기 · 가상 제품','상처',[150,35,35],60/oz,{w:1,h:1},'튜닝: XSTAT 계열 참고, 해당 제품 치수·무게 원문 미확인'),
 bandage:supply('bandage','NAR ETD 4인치 압박붕대','압박붕대','흡수 패드가 있는 탄력 압박붕대.','상처',[114.3,63.5,44.45],2.6,{w:1,h:1},'https://www.narescue.com/all-products/4-emergency-trauma-dressing-etd.html'),
 seal:supply('seal','HyFin Vent Compact 흉부 씰','흉부 씰','통기형 흉부 씰 2개 세트.','가슴 상태',[167.64,98.425,3.302],1.55,{w:1,h:2},'https://www.narescue.com/hyfin-vent-compact-chest-seal-twin-pack.html',2),
 needle:supply('needle','NAR ARS 14G 감압 키트','감압 키트','보호 튜브에 든 14G 감압 키트.','가슴 상태',[144.78,20.32,17.78],.6,{w:1,h:1},'https://www.narescue.com/military-products/respirations/ars-for-needle-decompression-3-26.html'),
 txa:supply('txa','TXA 투여 세트','TXA','전신 항섬유소용해 처치 · 현장 투여 단순화.','전체',[100,30,20],2.47,{w:1,h:2},'M4 prototype envelope/mass tuning'),
 foam:supply('foam','범용 지혈 폼','지혈 폼','겉·사지 내부·체강 지혈 · 게임 허용','상처',[160,60,40],10.58,{w:1,h:2},'M4 experimental delivery envelope/mass tuning'),
 pill:supply('pill','전투 상처 약 팩','약 팩','아세트아미노펜650mg×2·멜록시캄15mg · 시작 시간 압축','전체',[55,45,8],.35,{w:1,h:1},'M4b package/mass tuning:10g'),
 otfc:supply('otfc','OTFC 800µg','OTFC','부분 사용 가능 · 의식 저하 시 자동 중단','전체',[100,25,15],.35,{w:1,h:1},'M4b sealed unit envelope/mass tuning:10g'),
 ketamine:supply('ketamine','케타민 IM 50mg','케타민','미리 채운 주사기 · 게임 허용','전체',[120,25,20],.53,{w:1,h:1},'M4b prefilled syringe envelope/mass tuning:15g'),
 blood:supply('blood','전혈500mL·수액 세트','전혈500','양손 연결 후 이동·조준·다른 처치 가능','전체',[180,120,45],21.16,{w:1,h:2},'M4b 500mL blood≈530g + bag/tubing70g;600g tuning'),
 npa:supply('npa','NAR NPA 28F·윤활제','NPA','윤활제가 동봉된 비인두 기도기.','기도',[152.4,40.64,12.7],.5,{w:1,h:1},'https://www.narescue.com/all-products/naso-with-lubricant-packet.html'),
});
export const IFAK=freeze({id:'ifak',name:'IFAK',shortName:'IFAK',description:'개인 의료 파우치 · 의료 물품 전용',kind:'medicalContainer',size:MEDICAL_ITEMS.ifakSize,grid:MEDICAL_ITEMS.ifakGrid,weightKg:.159,packageMm:[190,130,64],source:'https://tasmaniantigerusa.com/medic-equipment/ifak-pouches/tt-tac-ifak-pouch-m',modelReference:'TT TAC IFAK POUCH M; 사용자 지정 구성, 미군 IFAK II 전체 재현 아님'});
export const MEDIC_POUCH=freeze({id:'medic-pouch',name:'복부 키트',shortName:'복부 키트',description:'TXA·범용 지혈 폼 · 의료 물품 전용',kind:'medicalContainer',size:{w:1,h:2},grid:{cols:2,rows:2},weightKg:.120,packageMm:[180,90,80],source:'M4 prototype pouch tuning; depth-stacked envelopes, not a marketed kit'});
export const MEDIC_SUPPORT=freeze({id:'medic-support',name:'위생병 파우치',shortName:'위생병',description:'진통제·전혈 · 의료 물품 전용',kind:'medicalContainer',size:{w:2,h:1},grid:{cols:3,rows:3},weightKg:.18,packageMm:[200,160,100],source:'M4b prototype envelope/mass tuning; inventory footprint is an abstraction'});
export const INITIAL_MEDIC_SUPPORT=freeze([['pill',0,0],['otfc',1,0],['otfc',2,0],['ketamine',0,1],['ketamine',1,1],['blood',2,1]]);
export const medicalDefinition=item=>item?.kind==='medicalContainer'?(item.definitionId===MEDIC_POUCH.id?MEDIC_POUCH:item.definitionId===MEDIC_SUPPORT.id?MEDIC_SUPPORT:IFAK):item?.kind==='medicalSupply'?MEDICAL_SUPPLIES[item.definitionId]:null;
export const isMedicalItem=item=>item?.kind==='medicalSupply'||item?.kind==='medicalContainer';
export const INITIAL_IFAK_CONTENTS=freeze([['gauze',0,0],['seal',1,0],['cat',2,0],['cat',2,1],['bandage',0,2],['needle',1,2],['npa',2,2]]);

// The sole creation boundary for owned medical consumables. Transfers retain identity and resource.
export function createMedicalSupply(instanceId,definitionId,owner,cell,restored={}){
 if(!MEDICAL_SUPPLIES[definitionId])throw Error('Unknown medical product: '+definitionId);
 const p=productRule(definitionId),remaining=restored.remaining??p.maximum;
 if(!Number.isFinite(remaining)||remaining<0||remaining>p.maximum)throw Error('Invalid medical resource');
 return{...restored,instanceId,kind:'medicalSupply',definitionId,owner,...(cell?{cell:{...cell}}:{}),remaining,maximumUses:p.maximum,resourceRuleId:MO2.ruleId,resourceKind:p.resource};
}
