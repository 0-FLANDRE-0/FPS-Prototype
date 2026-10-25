// =============================================================
// 2A-6.1: HELMET REGISTRY (헬멧 본체 source of truth)
//   build는 helmetSlot/helmetSlotHighCut/MidCut/FullCut/locSlot를 재호출해 기존 형태 재구성.
//   새 헬멧 추가 시 이 registry 한 곳만 작성. cutType: normal/high_cut/mid_cut/full_cut/bump
// =============================================================
const HELMET_REGISTRY_GROUPS = {
  'Ballistic': { label:'방탄헬멧', tableOrder: 10 },
  'Bump':      { label:'범프헬멧', tableOrder: 20 },
};
const HELMET_REGISTRY = {
  'mich_test': {
    id:'mich_test',
    display:{ name:'MICH 헬멧', shortName:'MICH', desc:'shell 24 / liner 8 (aramid) — 권총·파편 차단, 소총탄 직격 위험', group:'Ballistic', tableOrder:1 },
    helmet:{ cutType:'normal', isBallistic:true, supportsVisor:false, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:24, linerArmor:8, material:'aramid', slotProfile:'normal' },
      temporal:{ shellArmor:23, linerArmor:8, material:'aramid', slotProfile:'normal' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.45 },
    compatibility:{ compatibleVisorIds:[], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
  'helmet_6b47_test': {
    id:'helmet_6b47_test',
    display:{ name:'6B47 헬멧', shortName:'6B47', desc:'shell 23 / liner 8 (aramid) — 표준 러시아식 전투헬멧', group:'Ballistic', tableOrder:2 },
    helmet:{ cutType:'normal', isBallistic:true, supportsVisor:false, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:23, linerArmor:8, material:'aramid', slotProfile:'normal' },
      temporal:{ shellArmor:22, linerArmor:8, material:'aramid', slotProfile:'normal' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.15 },
    compatibility:{ compatibleVisorIds:[], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
  'fast_mt': {
    id:'fast_mt',
    display:{ name:'FAST MT', shortName:'FAST MT', desc:'shell 25 / liner 8 (pe) — 경량 고컷. 측두부 방호 낮음', group:'Ballistic', tableOrder:3 },
    helmet:{ cutType:'high_cut', isBallistic:true, supportsVisor:true, supportsSlaap:true },
    protection:{
      skull:{ shellArmor:25, linerArmor:8, material:'pe', slotProfile:'normal' },
      temporal:{ shellArmor:22, linerArmor:8, material:'pe', slotProfile:'highCut' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.05 },
    compatibility:{ compatibleVisorIds:['fast_mt_visor'], compatibleSlaapIds:['fast_mt_slaap'] },
    ui:{ showInHelmetSelector:true },
  },
  'ech': {
    id:'ech',
    display:{ name:'ECH', shortName:'ECH', desc:'shell 28 / liner 8 (pe) — MICH 강화형', group:'Ballistic', tableOrder:4 },
    helmet:{ cutType:'normal', isBallistic:true, supportsVisor:false, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:28, linerArmor:8, material:'pe', slotProfile:'normal' },
      temporal:{ shellArmor:27, linerArmor:8, material:'pe', slotProfile:'normal' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.5 },
    compatibility:{ compatibleVisorIds:[], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
  'k6_3': {
    id:'k6_3',
    display:{ name:'K6-3 헬멧', shortName:'K6-3', desc:'shell 30 / liner 8 (titanium) — 매우 무거움. 측면/귀 매우 넓게 방호', group:'Ballistic', tableOrder:5 },
    helmet:{ cutType:'full_cut', isBallistic:true, supportsVisor:true, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:30, linerArmor:8, material:'titanium', slotProfile:'normal' },
      temporal:{ shellArmor:28, linerArmor:8, material:'titanium', slotProfile:'fullCut' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:3.2 },
    compatibility:{ compatibleVisorIds:['k6_3_visor'], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
  'helmet_6b47m': {
    id:'helmet_6b47m',
    display:{ name:'6B47M', shortName:'6B47M', desc:'shell 27 / liner 8 (pe) — 6B47 현대화/PE 강화', group:'Ballistic', tableOrder:6 },
    helmet:{ cutType:'normal', isBallistic:true, supportsVisor:false, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:27, linerArmor:8, material:'pe', slotProfile:'normal' },
      temporal:{ shellArmor:25, linerArmor:8, material:'pe', slotProfile:'normal' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.3 },
    compatibility:{ compatibleVisorIds:[], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
  'lshz_light': {
    id:'lshz_light',
    display:{ name:'LShZ 경량', shortName:'LShZ', desc:'shell 23 / liner 8 (aramid) — 경량 고컷 러시아식. 귀 노출 큼', group:'Ballistic', tableOrder:7 },
    helmet:{ cutType:'high_cut', isBallistic:true, supportsVisor:true, supportsSlaap:true },
    protection:{
      skull:{ shellArmor:23, linerArmor:8, material:'aramid', slotProfile:'normal' },
      temporal:{ shellArmor:20, linerArmor:8, material:'aramid', slotProfile:'highCut' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.1 },
    compatibility:{ compatibleVisorIds:['fast_mt_visor'], compatibleSlaapIds:['fast_mt_slaap'] },
    ui:{ showInHelmetSelector:true },
  },
  'helmet_fast_bump': {
    id:'helmet_fast_bump',
    display:{ name:'Ops-Core FAST Bump Helmet', shortName:'FAST Bump', desc:'shell 4 (비방탄재) — 460g 범프 헬멧. 낙상/충격 보호용, 실탄 방호 없음. 바이저/SLAAP 장착 가능.', group:'Bump', tableOrder:8 },
    helmet:{ cutType:'high_cut', isBallistic:false, supportsVisor:true, supportsSlaap:true },
    protection:{
      skull:{ shellArmor:4, linerArmor:2, material:'fabric', slotProfile:'normal' },
      temporal:{ shellArmor:2, linerArmor:1, material:'fabric', slotProfile:'highCut' },
      face:{ hardMaterial:'fabric', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:0.46 },
    compatibility:{ compatibleVisorIds:['fast_mt_visor'], compatibleSlaapIds:['fast_mt_slaap'] },
    ui:{ showInHelmetSelector:true },
  },
  'helmet_fast_carbon_bump': {
    id:'helmet_fast_carbon_bump',
    display:{ name:'Ops-Core FAST Carbon Composite Bump Helmet', shortName:'FAST Carbon', desc:'shell 6 (복합재) — 330g 카본 복합재 범프 헬멧. 일반 범프보다 약간 강하지만 방탄 헬멧은 아님.', group:'Bump', tableOrder:9 },
    helmet:{ cutType:'high_cut', isBallistic:false, supportsVisor:true, supportsSlaap:true },
    protection:{
      skull:{ shellArmor:6, linerArmor:2, material:'composite', slotProfile:'normal' },
      temporal:{ shellArmor:4, linerArmor:1, material:'composite', slotProfile:'highCut' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:0.33 },
    compatibility:{ compatibleVisorIds:['fast_mt_visor'], compatibleSlaapIds:['fast_mt_slaap'] },
    ui:{ showInHelmetSelector:true },
  },
  'helmet_ulach': {
    id:'helmet_ulach',
    display:{ name:'ULACH Helmet', shortName:'ULACH', desc:'shell 26 / liner 8 (pe) — PE 경량 방탄 헬멧. 귀/측면 방호가 일반 헬멧보다 넓지만 K6-3급은 아님.', group:'Ballistic', tableOrder:10 },
    helmet:{ cutType:'mid_cut', isBallistic:true, supportsVisor:false, supportsSlaap:false },
    protection:{
      skull:{ shellArmor:26, linerArmor:8, material:'pe', slotProfile:'normal' },
      temporal:{ shellArmor:25, linerArmor:8, material:'pe', slotProfile:'midCut' },
      face:{ hardMaterial:'composite', softMaterial:'fabric', protectedByDefault:false },
    },
    physical:{ weightKg:1.3 },
    compatibility:{ compatibleVisorIds:[], compatibleSlaapIds:[] },
    ui:{ showInHelmetSelector:true },
  },
};
const HELMET_ACCESSORY_REGISTRY = {
  'no_visor': {
    id:'no_visor',
    display:{ name:'No Visor', shortName:'없음', desc:'', group:'Visor', tableOrder:1 },
    accessory:{ accessoryType:'visor', isNone:true },
    compatibility:{ compatibleHelmetIds:[] },
    protection:{  },
    physical:{ weightKg:0 },
    ui:{ showInAccessorySelector:true },
  },
  'no_slaap': {
    id:'no_slaap',
    display:{ name:'No SLAAP', shortName:'없음', desc:'', group:'SLAAP', tableOrder:2 },
    accessory:{ accessoryType:'slaap', isNone:true },
    compatibility:{ compatibleHelmetIds:[] },
    protection:{  },
    physical:{ weightKg:0 },
    ui:{ showInAccessorySelector:true },
  },
  'fast_mt_visor': {
    id:'fast_mt_visor',
    display:{ name:'FAST/LShZ Ballistic Visor', shortName:'바이저', desc:'고컷 헬멧용 권총·파편 차단 바이저. 9mm FMJ는 막지만 AP·소총탄 취약. 막음시 얼굴 둔상 거의 없음 (어지러움)', group:'Visor', tableOrder:3 },
    accessory:{ accessoryType:'visor', isNone:false, armorType:'hard' },
    compatibility:{ compatibleHelmetIds:['fast_mt','lshz_light','helmet_fast_bump','helmet_fast_carbon_bump'] },
    protection:{ material:'pe', armorValue:22, bluntMul:0.1 },
    vision:{ fovMul:0.93, peripheralMul:0.88, targetAcquireTimeAdd:0.05, reactionDelayAdd:0.04, lowLightPenalty:0.05, closeAwarenessMul:0.95 },
    durability:{ glassMaxDurability:28 },
    physical:{ weightKg:0.8 },
    ui:{ showInAccessorySelector:true },
  },
  'k6_3_visor': {
    id:'k6_3_visor',
    display:{ name:'K6-3 Visor (Glass+Titanium)', shortName:'K6-3 바이저', desc:'K6-3 통합형 바이저 — 방탄유리(40%) + 티타늄 프레임(60%). 권총·파편 강함, 소총탄 취약. 7N31은 대체로 관통.', group:'Visor', tableOrder:4 },
    accessory:{ accessoryType:'visor', isNone:false, armorType:'mixed' },
    compatibility:{ compatibleHelmetIds:['k6_3'] },
    protection:{ visorHitTable:[{"id":"glass","label":"방탄유리","weight":0.4,"material":"pe","durabilityMaterial":"glass","armorValue":23,"bluntMul":0.08},{"id":"titanium","label":"티타늄부","weight":0.6,"material":"titanium","durabilityMaterial":"titanium","armorValue":28,"bluntMul":0.16}] },
    vision:{ fovMul:0.75, peripheralMul:0.62, targetAcquireTimeAdd:0.22, reactionDelayAdd:0.11, lowLightPenalty:0.18, closeAwarenessMul:0.80 },
    durability:{ glassMaxDurability:23, facePlateMaxDurability:42 },
    physical:{ weightKg:1 },
    ui:{ showInAccessorySelector:true },
  },
  'fast_mt_slaap': {
    id:'fast_mt_slaap',
    display:{ name:'FAST/LShZ SLAAP', shortName:'SLAAP', desc:'전면 두개부 하드 보강 플레이트 (소총탄 일부 대응)', group:'SLAAP', tableOrder:5 },
    accessory:{ accessoryType:'slaap', isNone:false, armorType:'hard' },
    compatibility:{ compatibleHelmetIds:['fast_mt','lshz_light','helmet_fast_bump','helmet_fast_carbon_bump'] },
    protection:{ material:'ceramic', armorValue:48, bluntMul:0.3 },
    physical:{ weightKg:0.75 },
    ui:{ showInAccessorySelector:true },
  },
};

// slotProfile → 헬멧 슬롯 빌더
function _helmetSlotByProfile(profile, shellArmor, linerArmor, material) {
  switch (profile) {
    case 'highCut': return helmetSlotHighCut(shellArmor, linerArmor, material);
    case 'midCut':  return helmetSlotMidCut(shellArmor, linerArmor, material);
    case 'fullCut': return helmetSlotFullCut(shellArmor, linerArmor, material);
    default:        return helmetSlot(shellArmor, linerArmor, material);
  }
}
function buildHelmetPresetFromRegistry(entry) {
  if (!entry) return null;
  const d = entry.display||{}, pr = entry.protection||{}, ph = entry.physical||{};
  const sk = pr.skull||{}, tp = pr.temporal||{}, fa = pr.face||{};
  return {
    id: entry.id, name: d.name, shortName: d.shortName, desc: d.desc,
    weightKg: ph.weightKg,
    head_skull:    _helmetSlotByProfile(sk.slotProfile||'normal', sk.shellArmor, sk.linerArmor, sk.material),
    head_temporal: _helmetSlotByProfile(tp.slotProfile||'normal', tp.shellArmor, tp.linerArmor, tp.material),
    head_face:     locSlot(0.00, 0.00, 1.00, 0, 0, false, fa.hardMaterial||'composite', fa.softMaterial||'fabric'),
  };
}
function buildLegacyHelmetPresetsFromRegistry() {
  const out = {};
  for (const id in HELMET_REGISTRY) out[id] = buildHelmetPresetFromRegistry(HELMET_REGISTRY[id]);
  return out;
}
// 헬멧 액세서리 (visor/slaap) → 기존 PROTECTION_ACCESSORY_PRESETS 형태
function buildHelmetAccessoryPresetFromRegistry(entry) {
  if (!entry) return null;
  const d = entry.display||{}, ac = entry.accessory||{}, co = entry.compatibility||{}, pr = entry.protection||{}, ph = entry.physical||{};
  const out = {
    id: entry.id, name: d.name, shortName: d.shortName,
    accessoryType: ac.accessoryType,
  };
  if (ac.isNone) out.isNone = true;
  if (ac.armorType !== undefined) out.armorType = ac.armorType;
  if (co.compatibleHelmetIds && co.compatibleHelmetIds.length) out.compatibleHelmetIds = co.compatibleHelmetIds.slice();
  if (pr.material !== undefined) out.material = pr.material;
  if (pr.armorValue !== undefined) out.armorValue = pr.armorValue;
  if (pr.bluntMul !== undefined) out.bluntMul = pr.bluntMul;
  if (pr.visorHitTable !== undefined) out.visorHitTable = JSON.parse(JSON.stringify(pr.visorHitTable));
  // 2A-6.2: 시야 패널티 + 분리 내구도 baseline 전달
  if (entry.vision !== undefined) out.vision = Object.assign({}, entry.vision);
  if (entry.durability !== undefined) out.visorDurabilitySpec = Object.assign({}, entry.durability);
  out.weightKg = ph.weightKg != null ? ph.weightKg : 0;
  if (d.desc) out.desc = d.desc;
  return out;
}
function buildHelmetAccessoryPresetsFromRegistry() {
  const out = {};
  for (const id in HELMET_ACCESSORY_REGISTRY) out[id] = buildHelmetAccessoryPresetFromRegistry(HELMET_ACCESSORY_REGISTRY[id]);
  return out;
}

// =============================================================
// 2A-6.1: HELMET / HELMET-ACCESSORY SOURCE SWITCH
// =============================================================
const USE_HELMET_REGISTRY_AS_SOURCE = true;
const USE_HELMET_ACCESSORY_REGISTRY_AS_SOURCE = true;
const HELMET_PRESETS = {};
const PROTECTION_ACCESSORY_PRESETS = {};
(function _switchHelmetSource() {
  function replaceInPlace(t, s) { for (const k in t) delete t[k]; Object.assign(t, s); }
  try {
    // 헬멧 본체
    if (USE_HELMET_REGISTRY_AS_SOURCE) {
      const hp = buildLegacyHelmetPresetsFromRegistry();
      for (const id in LEGACY_HELMET_PRESETS_MANUAL) if (!hp[id]) hp[id] = LEGACY_HELMET_PRESETS_MANUAL[id];
      replaceInPlace(HELMET_PRESETS, hp);
    } else {
      replaceInPlace(HELMET_PRESETS, LEGACY_HELMET_PRESETS_MANUAL);
    }
    // 액세서리: body armor accessory(manual) + helmet accessory(registry) 병합
    const acc = {};
    Object.assign(acc, LEGACY_PROTECTION_ACCESSORY_PRESETS_MANUAL);
    if (USE_HELMET_ACCESSORY_REGISTRY_AS_SOURCE) {
      const ha = buildHelmetAccessoryPresetsFromRegistry();
      for (const id in ha) acc[id] = ha[id];   // helmet accessory를 registry 생성물로 교체
    }
    replaceInPlace(PROTECTION_ACCESSORY_PRESETS, acc);
    if (typeof console !== 'undefined') console.log(`[HelmetSource] helmet=${USE_HELMET_REGISTRY_AS_SOURCE?'REGISTRY':'manual'} (${Object.keys(HELMET_PRESETS).length}) / accessory=${USE_HELMET_ACCESSORY_REGISTRY_AS_SOURCE?'REGISTRY(helmet)+manual(body)':'manual'} (${Object.keys(PROTECTION_ACCESSORY_PRESETS).length})`);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[HelmetSource] switch 실패 → manual fallback:', e && e.message);
    try { replaceInPlace(HELMET_PRESETS, LEGACY_HELMET_PRESETS_MANUAL); replaceInPlace(PROTECTION_ACCESSORY_PRESETS, LEGACY_PROTECTION_ACCESSORY_PRESETS_MANUAL); } catch (e2) {}
  }
})();

// =============================================================
// 2A-6.1: HELMET / HELMET-ACCESSORY 비교 / 검증
// =============================================================
function _slotEq(a, b, rep, ctx) {
  if (!a || !b) { if (a !== b) rep.warn('helmetReg', `${ctx}: 슬롯 존재 불일치`); return; }
  const TOL = 1e-6;
  for (const k of ['hardP','softP','noneP']) if (Math.abs((a[k]||0)-(b[k]||0))>TOL) rep.warn('helmetReg', `${ctx}.${k}: ${a[k]} ≠ ${b[k]}`);
  if ((a.hard&&a.hard.smallArmor) !== (b.hard&&b.hard.smallArmor)) rep.warn('helmetReg', `${ctx}.hard.smallArmor: ${a.hard&&a.hard.smallArmor} ≠ ${b.hard&&b.hard.smallArmor}`);
  if ((a.soft&&a.soft.smallArmor) !== (b.soft&&b.soft.smallArmor)) rep.warn('helmetReg', `${ctx}.soft.smallArmor: ${a.soft&&a.soft.smallArmor} ≠ ${b.soft&&b.soft.smallArmor}`);
  if ((a.hard&&a.hard.material) !== (b.hard&&b.hard.material)) rep.warn('helmetReg', `${ctx}.hard.material: ${a.hard&&a.hard.material} ≠ ${b.hard&&b.hard.material}`);
  if (!!a.isHelmet !== !!b.isHelmet) rep.warn('helmetReg', `${ctx}.isHelmet: ${a.isHelmet} ≠ ${b.isHelmet}`);
}
function compareRegistryHelmetsWithLegacy(opts) {
  const rep = _mkValidationReport();
  const MAN = (typeof LEGACY_HELMET_PRESETS_MANUAL!=='undefined')?LEGACY_HELMET_PRESETS_MANUAL:{};
  for (const id in HELMET_REGISTRY) {
    const gen = buildHelmetPresetFromRegistry(HELMET_REGISTRY[id]);
    const man = MAN[id];
    if (!man) { rep.warn('helmetReg', `${id}: manual 백업에 없음`); continue; }
    for (const f of ['name','shortName','desc']) if (gen[f] !== man[f]) rep.warn('helmetReg', `${id}.${f}: registry≠manual`);
    if (Math.abs((gen.weightKg||0)-(man.weightKg||0))>1e-6) rep.warn('helmetReg', `${id}.weightKg: ${gen.weightKg} ≠ ${man.weightKg}`);
    _slotEq(gen.head_skull, man.head_skull, rep, `${id}.head_skull`);
    _slotEq(gen.head_temporal, man.head_temporal, rep, `${id}.head_temporal`);
    _slotEq(gen.head_face, man.head_face, rep, `${id}.head_face`);
  }
  for (const id in MAN) if (!HELMET_REGISTRY[id]) rep.error('helmetReg', `${id}: manual에 있으나 HELMET_REGISTRY 미이관`);
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[HELMET_REGISTRY ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건 (대상 ${Object.keys(HELMET_REGISTRY).length}종)`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.errors===0 && s.warnings===0) console.log('  ✓ 모든 헬멧이 manual과 일치');
    }
  }
  return rep;
}
function compareHelmetAccessoriesWithLegacy(opts) {
  const rep = _mkValidationReport();
  const MAN = (typeof LEGACY_PROTECTION_ACCESSORY_PRESETS_MANUAL!=='undefined')?LEGACY_PROTECTION_ACCESSORY_PRESETS_MANUAL:{};
  const arrNeq = (a,b)=>{ if(!a&&!b)return false; if(!a||!b)return true; if(a.length!==b.length)return true; const x=a.slice().sort(),y=b.slice().sort(); for(let i=0;i<x.length;i++)if(x[i]!==y[i])return true; return false; };
  for (const id in HELMET_ACCESSORY_REGISTRY) {
    const gen = buildHelmetAccessoryPresetFromRegistry(HELMET_ACCESSORY_REGISTRY[id]);
    const man = MAN[id];
    if (!man) { rep.warn('helmetAccReg', `${id}: manual 백업에 없음`); continue; }
    for (const f of ['name','shortName','accessoryType','material','armorType']) if (gen[f] !== man[f]) rep.warn('helmetAccReg', `${id}.${f}: registry(${gen[f]}) ≠ manual(${man[f]})`);
    if (!!gen.isNone !== !!man.isNone) rep.warn('helmetAccReg', `${id}.isNone: ${gen.isNone} ≠ ${man.isNone}`);
    for (const f of ['armorValue','bluntMul','weightKg']) if ((gen[f]||0) !== (man[f]||0)) rep.warn('helmetAccReg', `${id}.${f}: ${gen[f]} ≠ ${man[f]}`);
    if (arrNeq(gen.compatibleHelmetIds, man.compatibleHelmetIds)) rep.warn('helmetAccReg', `${id}.compatibleHelmetIds: registry≠manual`);
    // visorHitTable (glass/titanium zone)
    if (man.visorHitTable || gen.visorHitTable) {
      if (JSON.stringify(gen.visorHitTable) !== JSON.stringify(man.visorHitTable)) rep.warn('helmetAccReg', `${id}.visorHitTable: registry≠manual`);
    }
  }
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[헬멧액세서리 ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.errors===0 && s.warnings===0) console.log('  ✓ visor/SLAAP 전부 manual과 일치 (K6-3 glass/titanium 포함)');
    }
  }
  return rep;
}
// =============================================================
// 2A-6.5: BODY_ARMOR_REGISTRY 검증 / 비교
// =============================================================
function _baSlotEq(a, b, rep, ctx) {
  if (!a || !b) { if (a !== b) rep.warn('bodyArmorReg', `${ctx}: 슬롯 존재 불일치`); return; }
  const TOL = 1e-6;
  for (const k of ['hardP','softP','noneP']) if (Math.abs((a[k]||0)-(b[k]||0))>TOL) rep.warn('bodyArmorReg', `${ctx}.${k}: ${a[k]} ≠ ${b[k]}`);
  if ((a.hard&&a.hard.smallArmor) !== (b.hard&&b.hard.smallArmor)) rep.warn('bodyArmorReg', `${ctx}.hard.smallArmor: ${a.hard&&a.hard.smallArmor} ≠ ${b.hard&&b.hard.smallArmor}`);
  if ((a.soft&&a.soft.smallArmor) !== (b.soft&&b.soft.smallArmor)) rep.warn('bodyArmorReg', `${ctx}.soft.smallArmor: ${a.soft&&a.soft.smallArmor} ≠ ${b.soft&&b.soft.smallArmor}`);
  if ((a.hard&&a.hard.material) !== (b.hard&&b.hard.material)) rep.warn('bodyArmorReg', `${ctx}.hard.material: ${a.hard&&a.hard.material} ≠ ${b.hard&&b.hard.material}`);
  if ((a.soft&&a.soft.material) !== (b.soft&&b.soft.material)) rep.warn('bodyArmorReg', `${ctx}.soft.material: ${a.soft&&a.soft.material} ≠ ${b.soft&&b.soft.material}`);
  if (!!a.softBacker !== !!b.softBacker) rep.warn('bodyArmorReg', `${ctx}.softBacker: ${a.softBacker} ≠ ${b.softBacker}`);
}
function compareBodyArmorRegistryWithLegacy(opts) {
  const rep = _mkValidationReport();
  const MAN = (typeof LEGACY_BODY_ARMOR_PRESETS_MANUAL!=='undefined')?LEGACY_BODY_ARMOR_PRESETS_MANUAL:{};
  const COV_KEYS = ['chest_front','chest_side','chest_rear','abdomen_front','abdomen_side','abdomen_rear','chest','abdomen','neck','arms','legs'];
  for (const id in BODY_ARMOR_REGISTRY) {
    const gen = buildBodyArmorPresetFromRegistry(BODY_ARMOR_REGISTRY[id]);
    const man = MAN[id];
    if (!man) { rep.warn('bodyArmorReg', `${id}: manual 백업에 없음`); continue; }
    for (const f of ['name','shortName','desc']) if (gen[f] !== man[f]) rep.warn('bodyArmorReg', `${id}.${f}: registry≠manual`);
    if (Math.abs((gen.weightKg||0)-(man.weightKg||0))>1e-6) rep.warn('bodyArmorReg', `${id}.weightKg: ${gen.weightKg} ≠ ${man.weightKg}`);
    if (!!gen.noPlateSlots !== !!man.noPlateSlots) rep.warn('bodyArmorReg', `${id}.noPlateSlots: ${gen.noPlateSlots} ≠ ${man.noPlateSlots}`);
    if (!!gen.allowReplicaPlatesOnly !== !!man.allowReplicaPlatesOnly) rep.warn('bodyArmorReg', `${id}.allowReplicaPlatesOnly: ${gen.allowReplicaPlatesOnly} ≠ ${man.allowReplicaPlatesOnly}`);
    const manDur = (man.softMaxDurability!=null) ? man.softMaxDurability : ((typeof ARMOR_SOFT_MAX_DURABILITY!=='undefined' && ARMOR_SOFT_MAX_DURABILITY[id])||0);
    if ((gen.softMaxDurability||0) !== (manDur||0)) rep.warn('bodyArmorReg', `${id}.softMaxDurability: ${gen.softMaxDurability} ≠ ${manDur}`);
    if (JSON.stringify(gen.plateWeightLimitKg||null) !== JSON.stringify(man.plateWeightLimitKg||null)) rep.warn('bodyArmorReg', `${id}.plateWeightLimitKg: registry≠manual`);
    const gc = gen.coverage||{}, mc = man.coverage||{};
    for (const k of COV_KEYS) _baSlotEq(gc[k], mc[k], rep, `${id}.${k}`);
  }
  for (const id in MAN) if (!BODY_ARMOR_REGISTRY[id]) rep.error('bodyArmorReg', `${id}: manual에 있으나 BODY_ARMOR_REGISTRY 미이관`);
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[BODY_ARMOR_REGISTRY ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건 (대상 ${Object.keys(BODY_ARMOR_REGISTRY).length}종)`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.errors===0 && s.warnings===0) console.log('  ✓ 모든 방탄복이 manual과 일치 (MSV soft 30 포함)');
    }
  }
  return rep;
}
function validateBodyArmorRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof BODY_ARMOR_REGISTRY==='undefined'){ rep.warn('bodyArmorReg','BODY_ARMOR_REGISTRY 미정의'); return rep; }
  const OKMAT = new Set(['aramid','pe','fabric','none','composite','steel','aluminum','ceramic','titanium']);
  const SOFTMAT = new Set(['aramid','pe','fabric','none']);
  const FORBIDDEN = ['shellMaterial','outerMaterial','coverMaterial'];
  const COV_KEYS = ['chest_front','chest_side','chest_rear','abdomen_front','abdomen_side','abdomen_rear','chest','abdomen','neck','arms','legs'];
  const seen={};
  for (const id in BODY_ARMOR_REGISTRY) {
    const e = BODY_ARMOR_REGISTRY[id], d = e.display||{}, sa = e.softArmor||{}, ps = e.plateSlots||{};
    if (e.id!==id) rep.warn('bodyArmorReg', `${id}: id 불일치`);
    if (seen[e.id]) rep.error('bodyArmorReg', `${e.id}: id 중복`); seen[e.id]=true;
    if (!d.name) rep.warn('bodyArmorReg', `${id}: display.name 누락`);
    if (!d.shortName) rep.warn('bodyArmorReg', `${id}: display.shortName 누락`);
    // 금지 필드
    for (const ff of FORBIDDEN) { if (ff in e || ff in (e.armor||{}) || ff in sa) rep.error('bodyArmorReg', `${id}: 금지필드 ${ff}`); }
    // softArmor
    if (typeof sa.value !== 'number') rep.warn('bodyArmorReg', `${id}: softArmor.value 비숫자`);
    if (sa.material && !SOFTMAT.has(sa.material)) rep.warn('bodyArmorReg', `${id}: softArmor.material ${sa.material} 비표준(aramid/pe/fabric/none)`);
    if (sa.material === 'hybrid_aramid_pe') rep.error('bodyArmorReg', `${id}: hybrid_aramid_pe 신규재질 금지`);
    if (typeof sa.maxDurability !== 'number') rep.warn('bodyArmorReg', `${id}: softArmor.maxDurability 비숫자`);
    // coverage 필수키 + shape
    const cov = e.coverage||{};
    for (const k of COV_KEYS) { if (!cov[k]) rep.warn('bodyArmorReg', `${id}.coverage.${k} 누락`); else if (!Array.isArray(cov[k]) || cov[k].length!==8) rep.warn('bodyArmorReg', `${id}.coverage.${k} 튜플 형식 오류`); }
    // plateSlots boolean
    for (const k of ['front','back','side','abdomenFront','abdomenRear']) if (ps[k]!=null && typeof ps[k]!=='boolean') rep.warn('bodyArmorReg', `${id}.plateSlots.${k} 비boolean`);
    // noPlateSlots ↔ plateSlots 모순
    if (e.armor && e.armor.noPlateSlots && (ps.front||ps.back||ps.side)) rep.warn('bodyArmorReg', `${id}: noPlateSlots=true인데 plateSlots true 존재`);
    // legs 기본방호 금지 (H0/S0/G100)
    const legs = cov.legs; if (legs && (legs[0]>0 || legs[1]>0)) rep.warn('bodyArmorReg', `${id}: legs 기본방호 존재(H${legs[0]}/S${legs[1]})`);
    // arms 기본방호 금지
    const arms = cov.arms; if (arms && (arms[0]>0 || arms[1]>0)) rep.warn('bodyArmorReg', `${id}: arms 기본방호 존재`);
    // neck — 6B23만 예외
    const neck = cov.neck; if (neck && (neck[0]>0 || neck[1]>0) && id!=='armor_6b23_test') rep.warn('bodyArmorReg', `${id}: neck 기본방호 존재(6B23만 예외)`);
    // abdomenRear plate 금지 (일반 장비)
    if (ps.abdomenRear === true) rep.warn('bodyArmorReg', `${id}: abdomenRear plate true (일반 장비는 후면복부 플레이트 없음)`);
  }
  // 특정 장비 규칙
  const get = (id)=>BODY_ARMOR_REGISTRY[id];
  if (get('police_vest')) { const a=get('police_vest'); if (!(a.armor&&a.armor.noPlateSlots)) rep.warn('bodyArmorReg','police_vest noPlateSlots=true 필요'); const p=a.plateSlots||{}; if (p.front||p.back||p.side) rep.warn('bodyArmorReg','police_vest plateSlots 전부 false 필요'); }
  if (get('jpc_test') && get('jpc_test').plateSlots && get('jpc_test').plateSlots.side !== false) rep.warn('bodyArmorReg','jpc_test side slot false 필요');
  if (get('armor_6b23_test') && get('armor_6b23_test').plateSlots && get('armor_6b23_test').plateSlots.side !== false) rep.warn('bodyArmorReg','6B23 side slot false 필요');
  if (get('armor_6b23_test') && !(get('armor_6b23_test').builtInProtection && get('armor_6b23_test').builtInProtection.neckGuard && get('armor_6b23_test').builtInProtection.neckGuard.enabled)) rep.warn('bodyArmorReg','6B23 built-in neckGuard 유지 필요');
  if (get('replica_tactical_vest') && !(get('replica_tactical_vest').armor && get('replica_tactical_vest').armor.allowReplicaPlatesOnly)) rep.warn('bodyArmorReg','replica_tactical_vest allowReplicaPlatesOnly 필요');
  // generated 결과 무결성
  if (typeof BODY_ARMOR_PRESETS !== 'undefined') {
    for (const id in BODY_ARMOR_REGISTRY) {
      const g = BODY_ARMOR_PRESETS[id];
      if (!g) { rep.error('bodyArmorReg', `${id}: BODY_ARMOR_PRESETS 미생성`); continue; }
      if (!g.coverage || !g.coverage.chest || !g.coverage.chest.soft) rep.error('bodyArmorReg', `${id}: generated coverage.chest.soft 누락`);
      if (g.softMaxDurability != null && isNaN(g.softMaxDurability)) rep.error('bodyArmorReg', `${id}: softMaxDurability NaN`);
    }
  }
  // 2A-6.5-FINAL §6: softArmor.value ↔ coverage soft 값 정합성 (torso slot만, soft>0인 칸 검사)
  const TORSO = ['chest_front','chest_side','chest_rear','abdomen_front','abdomen_side','abdomen_rear','chest','abdomen'];
  for (const id in BODY_ARMOR_REGISTRY) {
    const e = BODY_ARMOR_REGISTRY[id];
    if (e.armor && e.armor.category === 'replica') continue;            // 레플리카 0/1 혼재 허용
    if (e.allowCoverageSoftVariance) continue;                          // 명시적 예외
    const rep_v = (e.softArmor && e.softArmor.value) || 0;
    const cov = e.coverage || {};
    for (const k of TORSO) {
      const t = cov[k]; if (!t) continue;
      const sv = t[4] || 0;
      if (sv > 0 && sv !== rep_v) rep.warn('bodyArmorReg', `${id} coverage ${k} softArmor mismatch: registry=${rep_v}, coverage=${sv}`);
    }
  }
  // 2A-6.5-FINAL §5: 로드아웃 자동 생성 선택지 검사
  if (typeof LOADOUT_OPTIONS !== 'undefined') {
    const arr = LOADOUT_OPTIONS.bodyArmor;
    if (!Array.isArray(arr)) rep.warn('bodyArmorReg', 'LOADOUT_OPTIONS.bodyArmor 비배열');
    else {
      const seenL = {};
      for (const oid of arr) {
        if (seenL[oid]) rep.warn('bodyArmorReg', `LOADOUT_OPTIONS.bodyArmor 중복 id: ${oid}`); seenL[oid] = true;
        if (!BODY_ARMOR_REGISTRY[oid]) rep.warn('bodyArmorReg', `LOADOUT_OPTIONS.bodyArmor의 ${oid}: BODY_ARMOR_REGISTRY에 없음`);
        if (typeof BODY_ARMOR_PRESETS !== 'undefined' && !BODY_ARMOR_PRESETS[oid]) rep.warn('bodyArmorReg', `LOADOUT_OPTIONS.bodyArmor의 ${oid}: BODY_ARMOR_PRESETS에 없음`);
      }
      // showInArmorSelector !== false인 registry 항목이 전부 포함되는지
      for (const id in BODY_ARMOR_REGISTRY) {
        const ui = BODY_ARMOR_REGISTRY[id].ui || {};
        if (ui.showInArmorSelector === false || ui.hidden === true) continue;
        if (arr.indexOf(id) < 0) rep.warn('bodyArmorReg', `${id}: 선택 가능한데 LOADOUT_OPTIONS.bodyArmor 누락`);
      }
      // tableOrder 정렬 유지 확인
      const expected = (typeof buildBodyArmorLoadoutOptionsFromRegistry === 'function') ? buildBodyArmorLoadoutOptionsFromRegistry() : null;
      if (expected && JSON.stringify(expected) !== JSON.stringify(arr)) rep.info('bodyArmorReg', 'LOADOUT_OPTIONS.bodyArmor 정렬이 tableOrder 기준과 다름');
    }
  }
  return rep;
}

function validateHelmetRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof HELMET_REGISTRY==='undefined'){ rep.warn('helmetReg','HELMET_REGISTRY 미정의'); return rep; }
  const seen={};
  for (const id in HELMET_REGISTRY) {
    const e=HELMET_REGISTRY[id], d=e.display||{}, hm=e.helmet||{}, pr=e.protection||{}, ph=e.physical||{};
    if (e.id!==id) rep.warn('helmetReg', `${id}: id 불일치`);
    if (seen[e.id]) rep.error('helmetReg', `${e.id}: id 중복`); seen[e.id]=true;
    if (!d.name) rep.error('helmetReg', `${id}: display.name 누락`);
    if (!d.shortName) rep.warn('helmetReg', `${id}: display.shortName 누락`);
    if (!d.desc) rep.warn('helmetReg', `${id}: display.desc 누락`);
    if (!hm.cutType) rep.warn('helmetReg', `${id}: helmet.cutType 누락`);
    if (!_isFiniteNum(ph.weightKg)) rep.warn('helmetReg', `${id}: physical.weightKg 누락`);
    for (const z of ['skull','temporal']) {
      const s = pr[z]||{};
      if (!_isFiniteNum(s.shellArmor)) rep.warn('helmetReg', `${id}.${z}: shellArmor 누락`);
      if (!_isFiniteNum(s.linerArmor)) rep.warn('helmetReg', `${id}.${z}: linerArmor 누락`);
      if (!s.material) rep.warn('helmetReg', `${id}.${z}: material 누락`);
    }
    // bump helmet 저방호 성격
    if (hm.isBallistic === false) {
      const sk = pr.skull||{};
      if (sk.shellArmor > 12) rep.warn('helmetReg', `${id}: bump(비방탄)인데 skull shellArmor=${sk.shellArmor} (과대)`);
    }
    // 생성 검증
    const gen = buildHelmetPresetFromRegistry(e);
    if (!gen || !gen.name || !gen.head_skull || !gen.head_temporal || !gen.head_face) rep.error('helmetReg', `${id}: 생성 헬멧 preset 필수 슬롯 누락`);
    if (gen.head_skull && !gen.head_skull.isHelmet) rep.warn('helmetReg', `${id}: head_skull isHelmet 플래그 누락`);
  }
  // completeness
  if (typeof HELMET_PRESETS!=='undefined') {
    for (const id in HELMET_REGISTRY) if (!HELMET_PRESETS[id]) rep.error('helmetReg', `${id}: registry에 있으나 최종 HELMET_PRESETS에 없음`);
    for (const id in HELMET_PRESETS) if (!HELMET_REGISTRY[id]) rep.warn('helmetReg', `${id}: 최종 HELMET_PRESETS에 있으나 registry에 없음`);
  }
  return rep;
}
function validateHelmetAccessoryRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof HELMET_ACCESSORY_REGISTRY==='undefined'){ rep.warn('helmetAccReg','HELMET_ACCESSORY_REGISTRY 미정의'); return rep; }
  const helmetExists=(hid)=> (typeof HELMET_REGISTRY!=='undefined' && HELMET_REGISTRY[hid]) || (typeof HELMET_PRESETS!=='undefined' && HELMET_PRESETS[hid]);
  for (const id in HELMET_ACCESSORY_REGISTRY) {
    const e=HELMET_ACCESSORY_REGISTRY[id], ac=e.accessory||{}, co=e.compatibility||{}, pr=e.protection||{};
    if (!ac.accessoryType) rep.warn('helmetAccReg', `${id}: accessoryType 누락`);
    if (Array.isArray(co.compatibleHelmetIds)) for (const hid of co.compatibleHelmetIds) if (!helmetExists(hid)) rep.warn('helmetAccReg', `${id}: compatibleHelmetId '${hid}' 가 헬멧에 없음`);
    // visor의 visorHitTable 검사 (K6-3)
    if (pr.visorHitTable) {
      const zones = pr.visorHitTable;
      const hasGlass = zones.some(z=>z.id==='glass'), hasTi = zones.some(z=>z.id==='titanium');
      if (id==='k6_3_visor') { if (!hasGlass) rep.error('helmetAccReg', `${id}: glass zone 누락`); if (!hasTi) rep.error('helmetAccReg', `${id}: titanium zone 누락`); }
      let wsum=0; for (const z of zones) { wsum += z.weight||0; if (!z.material) rep.warn('helmetAccReg', `${id}.${z.id}: material 누락`); if (!_isFiniteNum(z.armorValue)) rep.warn('helmetAccReg', `${id}.${z.id}: armorValue 누락`); }
      if (Math.abs(wsum-1.0) > 0.001) rep.warn('helmetAccReg', `${id}: visorHitTable weight 합 ${wsum} (1.0 아님)`);
    }
    const gen = buildHelmetAccessoryPresetFromRegistry(e);
    if (!gen || !gen.id || !gen.accessoryType) rep.error('helmetAccReg', `${id}: 생성 액세서리 필수 필드 누락`);
    // 2A-6.2: visor 시야/내구도 검사
    if (ac.accessoryType === 'visor' && !ac.isNone) {
      const vis = e.vision, du = e.durability;
      if (!vis) rep.warn('helmetAccReg', `${id}: visor인데 vision 필드 누락`);
      else {
        if (!(vis.fovMul > 0 && vis.fovMul <= 1.0)) rep.warn('helmetAccReg', `${id}: vision.fovMul 범위 이상 (${vis.fovMul})`);
        if (!(vis.peripheralMul > 0 && vis.peripheralMul <= 1.0)) rep.warn('helmetAccReg', `${id}: vision.peripheralMul 범위 이상 (${vis.peripheralMul})`);
        for (const k of ['targetAcquireTimeAdd','reactionDelayAdd','lowLightPenalty']) if (vis[k] != null && vis[k] < 0) rep.warn('helmetAccReg', `${id}: vision.${k} 음수`);
      }
      if (!du || du.glassMaxDurability == null) rep.warn('helmetAccReg', `${id}: visor glass durability 기준(durability.glassMaxDurability) 누락`);
      // K6-3: glass + titanium 분리 내구도
      if (id === 'k6_3_visor') {
        if (!du || du.glassMaxDurability == null) rep.warn('helmetAccReg', `${id}: K6-3 glass durability 누락`);
        if (!du || du.facePlateMaxDurability == null) rep.warn('helmetAccReg', `${id}: K6-3 titanium faceplate durability 누락`);
      }
    }
    // SLAAP는 vision penalty 대상 아님
    if (ac.accessoryType === 'slaap' && e.vision) rep.warn('helmetAccReg', `${id}: SLAAP는 visor vision penalty 대상이 아님 (vision 필드 제거 권장)`);
    // no_visor는 vision penalty 없어야
    if (id === 'no_visor' && e.vision) rep.info('helmetAccReg', `no_visor: vision 필드가 있으나 패널티 없어야 함`);
  }
  // no_visor / no_slaap 존재
  for (const id of ['no_visor','no_slaap']) if (!HELMET_ACCESSORY_REGISTRY[id]) rep.error('helmetAccReg', `${id}: 필수 none 액세서리 누락`);
  // k6_3_visor가 k6_3에만 호환
  const k = HELMET_ACCESSORY_REGISTRY['k6_3_visor'];
  if (k && k.compatibility && k.compatibility.compatibleHelmetIds) {
    const ids = k.compatibility.compatibleHelmetIds;
    if (ids.length !== 1 || ids[0] !== 'k6_3') rep.warn('helmetAccReg', `k6_3_visor: k6_3 외 호환 (${ids.join(',')})`);
  }
  // 최종 PROTECTION_ACCESSORY_PRESETS에 생성됐는지
  if (typeof PROTECTION_ACCESSORY_PRESETS!=='undefined') {
    for (const id in HELMET_ACCESSORY_REGISTRY) if (!PROTECTION_ACCESSORY_PRESETS[id]) rep.error('helmetAccReg', `${id}: 최종 PROTECTION_ACCESSORY_PRESETS에 없음`);
  }
  return rep;
}
if (typeof window !== 'undefined') {
  window.compareRegistryHelmetsWithLegacy = compareRegistryHelmetsWithLegacy;
  window.compareHelmetAccessoriesWithLegacy = compareHelmetAccessoriesWithLegacy;
}
