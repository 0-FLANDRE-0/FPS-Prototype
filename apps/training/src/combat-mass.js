import {CATALOG} from './catalog.js';
import {AK74M} from './weapon-data.js';
import {ARMOR_PROFILE} from './armor-targets.js';
// Original game registry values, not new manufacturer measurements. The vest
// preset exposes separate plate/accessory slots and the original load resolver
// adds those items. Each equipped item is counted once, not once per mesh.
export function combatMassLedger(bodyMassKg=80){
 const shapes=ARMOR_PROFILE.shapes,vest=shapes.find(s=>s.itemId.startsWith('armor_')),helmet=shapes.find(s=>s.kind==='helmet'),entries=[];
 const add=(id,slot,kg,source,bones)=>entries.push({itemId:id,slot,weightKg:kg,classification:'원본 게임 레지스트리',source,bones});
 add(vest.itemId,'vest',CATALOG.BODY_ARMOR_PRESETS[vest.itemId].weightKg,'src/data/body-armor.js',[{bone:'chest',share:1}]);
 for(const p of shapes.filter(s=>s.kind==='plate'))add(p.itemId,p.slot,CATALOG.PLATE_REGISTRY[p.itemId].physical.weightKg,'src/data/plates.js',[{bone:'chest',share:1}]);
 add(helmet.itemId,'helmet',CATALOG.HELMET_REGISTRY[helmet.itemId].physical.weightKg,'src/data/helmets.js',[{bone:'head',share:1}]);
 for(const id of [...new Set(shapes.map(s=>s.itemId).filter(id=>CATALOG.PROTECTION_ACCESSORY_PRESETS[id]))]){
  const a=CATALOG.PROTECTION_ACCESSORY_PRESETS[id],bones=a.accessoryType==='shoulder'?[{bone:'leftUpperArm',share:.5},{bone:'rightUpperArm',share:.5}]:[{bone:a.accessoryType==='groin'?'pelvis':'chest',share:1}];
  add(id,a.accessoryType,a.weightKg,'src/data/body-armor.js',bones);
 }
 const equipmentByBone={};for(const e of entries)for(const b of e.bones)equipmentByBone[b.bone]=(equipmentByBone[b.bone]||0)+e.weightKg*b.share;
 const equipmentMassKg=entries.reduce((s,e)=>s+e.weightKg,0);
 return{bodyMassKg,bodyMassClassification:'튜닝 — 사용자 선택 80kg 기본 체중',entries,equipmentByBone,equipmentMassKg,totalRagdollMassKg:bodyMassKg+equipmentMassKg,
  weaponMassKg:AK74M.physical.weightKg,weaponClassification:'원본 AK-74M physical.weightKg; 별도 낙하 강체',totalWithHeldWeaponKg:bodyMassKg+equipmentMassKg+AK74M.physical.weightKg,
  mappingClassification:'기존 방호 메시 부착 뼈에 배분; 양쪽 어깨 보호구는 원본 쌍 장비 .85kg을 절반씩; 분절 배분은 공간 어댑터',
  deduplication:'Four vest soft meshes count as one vest; front/back neck meshes count as one collar; two shoulder meshes count as one pair; two distinct plates each count once',
  omitted:'Decorative pouches/knee covers have no equipped registry item in H01; no invented item mass. Ammo/inventory load beyond the specified armor kit is deferred'};
}
