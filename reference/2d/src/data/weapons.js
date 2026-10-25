// 2A-5.0: WEAPON REGISTRY (총기 데이터 source of truth)
//   실제 전투/사격/재장전/AAR은 여전히 WEAPONS를 읽는다. registry는 원본.
//   테스트 총기(cqb_rifle_test/rifle_test)는 registry에 넣지 않는다 → 최종 WEAPONS에서 제외.
//   새 총기 추가 시 이 registry 한 곳만 작성하면 WEAPONS + velocityMul이 생성됨.
// =============================================================
const WEAPON_REGISTRY_GROUPS = {
  'SMG':     { label:'기관단총', tableOrder: 10 },
  'Rifle':   { label:'소총',     tableOrder: 20 },
  'Shotgun': { label:'산탄총',   tableOrder: 30 },
};
const WEAPON_REGISTRY = {
  'mp5': {
    id:'mp5',
    display:{ name:'MP5', type:'small', group:'SMG', tableOrder:1 },
    ammo:{ caliber:'9x19mm', ammoId:'9mm_124gr', defaultAmmoId:'9mm_124gr', allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31','9mm_jhp','9mm_jhp_p','9mm_rip','9mm_luger_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:0.55, rateOfFire:800, burstCount:3, fullAutoCount:6, fullAutoMin:4, fullAutoMax:9, burstShotDelay:0.06 },
    handling:{ accuracy:0.7, range:1400, falloffStart:120, handling:1.3, recoilBase:0.3, spreadBaseDeg:1.6, spreadMinDeg:0.4, spreadMaxDeg:7.5, spreadMovingMul:1.6, spreadSuppressionMul:2, suppressionHit:4, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:14, damageScale:0.85, velocityMul:1 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.4, tacticalReloadTime:1.8 },
    physical:{ weightKg:2.6 },
    ui:{ showInLoadout:true },
  },
  'm4a1': {
    id:'m4a1',
    display:{ name:'M4A1', type:'small', group:'Rifle', tableOrder:2 },
    ammo:{ caliber:'5.56x45mm', ammoId:'556_m855', defaultAmmoId:'556_m855', allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost','556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:0.85, rateOfFire:800, burstCount:3, fullAutoCount:5, fullAutoMin:3, fullAutoMax:8, burstShotDelay:0.075 },
    handling:{ accuracy:0.66, range:2200, falloffStart:220, handling:1.1, recoilBase:0.8, spreadBaseDeg:2, spreadMinDeg:0.45, spreadMaxDeg:8.5, spreadMovingMul:2, spreadSuppressionMul:2.3, suppressionHit:5, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:42, damageScale:0.95, velocityMul:0.95 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.6, tacticalReloadTime:2 },
    physical:{ weightKg:3, weaponClass:'rifle', platformId:'ar15_556', baseBodyLengthMm:460, defaultBarrelLengthMm:368, defaultMuzzleForwardAddMm:35, defaultOpticId:'red_dot', defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:1.0 },
    ui:{ showInLoadout:true },
  },
  'm16a2': {
    id:'m16a2',
    display:{ name:'M16A2', type:'small', group:'Rifle', tableOrder:3 },
    ammo:{ caliber:'5.56x45mm', ammoId:'556_m855', defaultAmmoId:'556_m855', allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost','556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst'], defaultFireMode:'auto', fireCooldown:0.95, rateOfFire:800, burstCount:3, fullAutoCount:5, fullAutoMin:3, fullAutoMax:8, burstShotDelay:0.075 },
    handling:{ accuracy:0.74, range:2600, falloffStart:280, handling:0.85, recoilBase:0.7, spreadBaseDeg:1.6, spreadMinDeg:0.3, spreadMaxDeg:7.5, spreadMovingMul:2.4, spreadSuppressionMul:2.4, suppressionHit:5, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:42, damageScale:0.92, velocityMul:1.05 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.8, tacticalReloadTime:2.2 },
    physical:{ weightKg:3.5 },
    ui:{ showInLoadout:true },
  },
  'ak74': {
    id:'ak74',
    display:{ name:'AK-74', type:'small', group:'Rifle', tableOrder:4 },
    ammo:{ caliber:'5.45x39mm', ammoId:'545_ps_gs', defaultAmmoId:'545_ps_gs', allowedAmmoIds:['545_hp','545_prs_gs','545_sp','545_us_gs','545_fmj','545_ps_gs','545_pp_gs','545_bp_gs','545_bs_gs','545_7n40','545_ppbs_gs','545_7t3_tracer','545_7bt4_aptracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:0.92, rateOfFire:650, burstCount:3, fullAutoCount:5, fullAutoMin:3, fullAutoMax:8, burstShotDelay:0.085 },
    handling:{ accuracy:0.62, range:2200, falloffStart:220, handling:1.05, recoilBase:0.7, spreadBaseDeg:2.2, spreadMinDeg:0.5, spreadMaxDeg:9, spreadMovingMul:2.1, spreadSuppressionMul:2.3, suppressionHit:5, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:35, damageScale:0.92, velocityMul:1 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.7, tacticalReloadTime:2.1 },
    physical:{ weightKg:3.3 },
    ui:{ showInLoadout:true },
  },
  'akm': {
    id:'akm',
    display:{ name:'AKM', type:'small', group:'Rifle', tableOrder:5 },
    ammo:{ caliber:'7.62x39mm', ammoId:'762x39_ps', defaultAmmoId:'762x39_ps', allowedAmmoIds:['762x39_hp','762x39_sp','762x39_us','762x39_ps','762x39_pp','762x39_bp','762x39_t45m_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:1, rateOfFire:600, burstCount:3, fullAutoCount:4, fullAutoMin:3, fullAutoMax:6, burstShotDelay:0.1 },
    handling:{ accuracy:0.55, range:2200, falloffStart:200, handling:0.9, recoilBase:1.4, spreadBaseDeg:2.6, spreadMinDeg:0.65, spreadMaxDeg:11, spreadMovingMul:2.2, spreadSuppressionMul:2.4, suppressionHit:6, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:40, damageScale:1, velocityMul:1 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.8, tacticalReloadTime:2.2 },
    physical:{ weightKg:3.3 },
    ui:{ showInLoadout:true },
  },
  'scar_h': {
    id:'scar_h',
    display:{ name:'SCAR-H', type:'small', group:'Rifle', tableOrder:6 },
    ammo:{ caliber:'7.62x51mm', ammoId:'762_m80', defaultAmmoId:'762_m80', allowedAmmoIds:['762_308_fmj','762_m80','762_m80a1','762_m61_ap','762_m993_ap','762x51_m62_tracer','762x51_m948_slap'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:1.05, rateOfFire:600, burstCount:3, fullAutoCount:4, fullAutoMin:3, fullAutoMax:5, burstShotDelay:0.1 },
    handling:{ accuracy:0.6, range:2800, falloffStart:300, handling:0.8, recoilBase:2, spreadBaseDeg:2.4, spreadMinDeg:0.55, spreadMaxDeg:12, spreadMovingMul:2.5, spreadSuppressionMul:2.6, suppressionHit:7, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:55, damageScale:1.1, velocityMul:1 },
    reload:{ magazineSize:20, reserveMags:5, reloadTime:3, tacticalReloadTime:2.4 },
    physical:{ weightKg:3.7 },
    ui:{ showInLoadout:true },
  },
  'shotgun_m870': {
    id:'shotgun_m870',
    display:{ name:'Remington M870', type:'small', group:'Shotgun', tableOrder:7 },
    ammo:{ caliber:'12ga', ammoId:'12g_00buck', defaultAmmoId:'12g_00buck', allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:1.1, rateOfFire:60, burstCount:1, fullAutoCount:1, burstShotDelay:0.1 },
    handling:{ accuracy:0.55, range:600, falloffStart:30, handling:0.95, recoilBase:3, spreadBaseDeg:1, spreadMinDeg:0.4, spreadMaxDeg:6, spreadMovingMul:2, spreadSuppressionMul:2.2, suppressionHit:8, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:30, damageScale:1, velocityMul:1 },
    reload:{ magazineSize:7, reserveMags:2, reloadTime:4.5, tacticalReloadTime:4, tubeReload:true },
    shotgun:{ pelletSpreadDeg:2.6, isShotgun:true },
    physical:{ weightKg:3.2 },
    ui:{ showInLoadout:true },
  },
  'shotgun_m590a1': {
    id:'shotgun_m590a1',
    display:{ name:'Mossberg M590A1', type:'small', group:'Shotgun', tableOrder:8 },
    ammo:{ caliber:'12ga', ammoId:'12g_00buck', defaultAmmoId:'12g_00buck', allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:1.15, rateOfFire:55, burstCount:1, fullAutoCount:1, burstShotDelay:0.1 },
    handling:{ accuracy:0.55, range:600, falloffStart:30, handling:0.88, recoilBase:3.1, spreadBaseDeg:1, spreadMinDeg:0.42, spreadMaxDeg:6.5, spreadMovingMul:2, spreadSuppressionMul:2.2, suppressionHit:8, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:30, damageScale:1, velocityMul:1 },
    reload:{ magazineSize:8, reserveMags:2, reloadTime:5, tacticalReloadTime:4.4, tubeReload:true },
    shotgun:{ pelletSpreadDeg:2.6, isShotgun:true },
    physical:{ weightKg:3.45 },
    ui:{ showInLoadout:true },
  },
  'shotgun_m1014': {
    id:'shotgun_m1014',
    display:{ name:'Benelli M1014', type:'small', group:'Shotgun', tableOrder:9 },
    ammo:{ caliber:'12ga', ammoId:'12g_00buck', defaultAmmoId:'12g_00buck', allowedAmmoIds:['12g_00buck','12g_slug','12g_flechette'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:0.55, rateOfFire:120, burstCount:1, fullAutoCount:1, burstShotDelay:0.1 },
    handling:{ accuracy:0.58, range:600, falloffStart:30, handling:0.82, recoilBase:2.8, spreadBaseDeg:1, spreadMinDeg:0.4, spreadMaxDeg:6, spreadMovingMul:2, spreadSuppressionMul:2.2, suppressionHit:8, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:30, damageScale:1, velocityMul:1 },
    reload:{ magazineSize:7, reserveMags:2, reloadTime:4.8, tacticalReloadTime:4.2, tubeReload:true },
    shotgun:{ pelletSpreadDeg:2.6, isShotgun:true },
    physical:{ weightKg:3.9 },
    ui:{ showInLoadout:true },
  },

  'glock17': {
    id:'glock17',
    display:{ name:'Glock 17', type:'small', group:'Secondary', tableOrder:20 },
    ammo:{ caliber:'9x19mm', ammoId:'9mm_124gr', defaultAmmoId:'9mm_124gr', allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31','9mm_jhp','9mm_jhp_p','9mm_rip','9mm_luger_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:0.28, rateOfFire:0, burstCount:1, fullAutoCount:1, burstShotDelay:0.06 },
    handling:{ accuracy:0.62, range:700, falloffStart:40, handling:1.5, recoilBase:0.5, spreadBaseDeg:2.2, spreadMinDeg:0.6, spreadMaxDeg:9, spreadMovingMul:1.4, spreadSuppressionMul:1.9, suppressionHit:3, suppressionMiss:1 },
    ballistic:{ damage:5, penetration:12, damageScale:0.8, velocityMul:1 },
    reload:{ magazineSize:17, reserveMags:3, reloadTime:2.0, tacticalReloadTime:1.6 },
    physical:{ weightKg:0.9, weaponClass:'pistol', platformId:'glock', baseBodyLengthMm:186, defaultBarrelLengthMm:114, defaultMuzzleForwardAddMm:0, defaultOpticId:'iron', defaultMountable:false, baseNoise:1.0, baseMuzzleFlash:0.6 },
    ui:{ showInLoadout:true },
  },
  'm9': {
    id:'m9',
    display:{ name:'M9 (Beretta 92FS)', type:'small', group:'Secondary', tableOrder:21 },
    ammo:{ caliber:'9x19mm', ammoId:'9mm_124gr', defaultAmmoId:'9mm_124gr', allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31','9mm_jhp','9mm_jhp_p','9mm_rip','9mm_luger_tracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:0.3, rateOfFire:0, burstCount:1, fullAutoCount:1, burstShotDelay:0.06 },
    handling:{ accuracy:0.63, range:700, falloffStart:40, handling:1.45, recoilBase:0.52, spreadBaseDeg:2.1, spreadMinDeg:0.58, spreadMaxDeg:8.8, spreadMovingMul:1.4, spreadSuppressionMul:1.9, suppressionHit:3, suppressionMiss:1 },
    ballistic:{ damage:5, penetration:12, damageScale:0.8, velocityMul:1 },
    reload:{ magazineSize:15, reserveMags:3, reloadTime:2.1, tacticalReloadTime:1.7 },
    physical:{ weightKg:0.95, weaponClass:'pistol', platformId:'beretta', baseBodyLengthMm:217, defaultBarrelLengthMm:125, defaultMuzzleForwardAddMm:0, defaultOpticId:'iron', defaultMountable:false, baseNoise:1.0, baseMuzzleFlash:0.6 },
    ui:{ showInLoadout:true },
  },
  'five_seven': {
    id:'five_seven',
    display:{ name:'FN Five-seveN', type:'small', group:'Secondary', tableOrder:22 },
    ammo:{ caliber:'5.7x28mm', ammoId:'5.7_ss190', defaultAmmoId:'5.7_ss190', allowedAmmoIds:['5.7_ss190','5.7_l191_tracer','5.7_ss192_jhp','5.7_sb193_subsonic','5.7_r37f'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:0.26, rateOfFire:0, burstCount:1, fullAutoCount:1, burstShotDelay:0.06 },
    handling:{ accuracy:0.64, range:900, falloffStart:60, handling:1.5, recoilBase:0.4, spreadBaseDeg:2.0, spreadMinDeg:0.55, spreadMaxDeg:8.5, spreadMovingMul:1.35, spreadSuppressionMul:1.85, suppressionHit:3, suppressionMiss:1 },
    ballistic:{ damage:5, penetration:28, damageScale:0.78, velocityMul:1 },
    reload:{ magazineSize:20, reserveMags:3, reloadTime:2.1, tacticalReloadTime:1.7 },
    physical:{ weightKg:0.74, weaponClass:'pistol', platformId:'fiveseven', baseBodyLengthMm:208, defaultBarrelLengthMm:122, defaultMuzzleForwardAddMm:0, defaultOpticId:'iron', defaultMountable:false, baseNoise:1.0, baseMuzzleFlash:0.65 },
    ui:{ showInLoadout:true },
  },
  'mp7': {
    id:'mp7',
    display:{ name:'MP7', type:'small', group:'PDW', tableOrder:23 },
    ammo:{ caliber:'4.6x30mm', ammoId:'4.6_fmj_sx', defaultAmmoId:'4.6_fmj_sx', allowedAmmoIds:['4.6_dm11_ap_sx','4.6_action_sx','4.6_fmj_sx','4.6_jsp_sx','4.6_subsonic_sx'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:0.5, rateOfFire:950, burstCount:3, fullAutoCount:6, fullAutoMin:4, fullAutoMax:9, burstShotDelay:0.05 },
    handling:{ accuracy:0.68, range:1200, falloffStart:100, handling:1.4, recoilBase:0.25, spreadBaseDeg:1.5, spreadMinDeg:0.4, spreadMaxDeg:7, spreadMovingMul:1.5, spreadSuppressionMul:2, suppressionHit:4, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:26, damageScale:0.82, velocityMul:1 },
    reload:{ magazineSize:40, reserveMags:4, reloadTime:2.3, tacticalReloadTime:1.8 },
    physical:{ weightKg:1.9, weaponClass:'pdw', platformId:'mp7', baseBodyLengthMm:415, defaultBarrelLengthMm:180, defaultMuzzleForwardAddMm:0, defaultOpticId:'red_dot', defaultMountable:true, baseNoise:0.92, baseMuzzleFlash:0.7 },
    ui:{ showInLoadout:true },
  },
  'aks74u': {
    id:'aks74u',
    display:{ name:'AKS-74U', type:'small', group:'PDW', tableOrder:24 },
    ammo:{ caliber:'5.45x39mm', ammoId:'545_ps_gs', defaultAmmoId:'545_ps_gs', allowedAmmoIds:['545_hp','545_prs_gs','545_sp','545_us_gs','545_fmj','545_ps_gs','545_pp_gs','545_bp_gs','545_bs_gs','545_7n40','545_ppbs_gs','545_7t3_tracer','545_7bt4_aptracer'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','full'], defaultFireMode:'auto', fireCooldown:0.78, rateOfFire:700, burstCount:3, fullAutoCount:5, fullAutoMin:3, fullAutoMax:8, burstShotDelay:0.08 },
    handling:{ accuracy:0.56, range:1500, falloffStart:120, handling:1.2, recoilBase:0.9, spreadBaseDeg:2.6, spreadMinDeg:0.6, spreadMaxDeg:10, spreadMovingMul:2, spreadSuppressionMul:2.3, suppressionHit:5, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:30, damageScale:0.9, velocityMul:0.86 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.7, tacticalReloadTime:2.1 },
    physical:{ weightKg:2.7, weaponClass:'pdw', platformId:'ak_545_short', baseBodyLengthMm:420, defaultBarrelLengthMm:206, defaultMuzzleForwardAddMm:30, defaultOpticId:'iron', defaultMountable:true, baseNoise:1.1, baseMuzzleFlash:1.4 },
    ui:{ showInLoadout:true },
  },
  'sr25': {
    id:'sr25',
    display:{ name:'SR-25', type:'small', group:'DMR', tableOrder:25 },
    ammo:{ caliber:'7.62x51mm', ammoId:'762_m80', defaultAmmoId:'762_m80', allowedAmmoIds:['762_308_fmj','762_m80','762_m80a1','762_m61_ap','762_m993_ap','762x51_m62_tracer','762x51_m948_slap'] },
    action:{ fireMode:'semi', supportsFireModes:['semi'], defaultFireMode:'semi', fireCooldown:0.5, rateOfFire:0, burstCount:1, fullAutoCount:1, burstShotDelay:0.1 },
    handling:{ accuracy:0.78, range:3200, falloffStart:400, handling:0.7, recoilBase:1.8, spreadBaseDeg:1.4, spreadMinDeg:0.25, spreadMaxDeg:9, spreadMovingMul:2.6, spreadSuppressionMul:2.6, suppressionHit:7, suppressionMiss:3 },
    ballistic:{ damage:5, penetration:55, damageScale:1.1, velocityMul:1 },
    reload:{ magazineSize:20, reserveMags:4, reloadTime:3.0, tacticalReloadTime:2.4 },
    physical:{ weightKg:4.9, weaponClass:'dmr', platformId:'sr25', baseBodyLengthMm:560, defaultBarrelLengthMm:508, defaultMuzzleForwardAddMm:30, defaultOpticId:'scope_4x', defaultMountable:true, baseNoise:1.25, baseMuzzleFlash:1.1 },
    ui:{ showInLoadout:true },
  },
  'm249': {
    id:'m249',
    display:{ name:'M249 SAW', type:'small', group:'LMG', tableOrder:26 },
    ammo:{ caliber:'5.56x45mm', ammoId:'556_m855', defaultAmmoId:'556_m855', allowedAmmoIds:['556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost','556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','556_m856_tracer','556_m856a1_tracer'] },
    action:{ fireMode:'full', supportsFireModes:['full'], defaultFireMode:'full', fireCooldown:0.9, rateOfFire:800, burstCount:5, fullAutoCount:10, fullAutoMin:6, fullAutoMax:18, burstShotDelay:0.075 },
    handling:{ accuracy:0.5, range:3000, falloffStart:300, handling:0.55, recoilBase:1.6, spreadBaseDeg:2.8, spreadMinDeg:0.7, spreadMaxDeg:12, spreadMovingMul:3, spreadSuppressionMul:2.2, suppressionHit:9, suppressionMiss:4 },
    ballistic:{ damage:5, penetration:42, damageScale:0.95, velocityMul:1.02 },
    reload:{ magazineSize:200, reserveMags:1, reloadTime:6.5, tacticalReloadTime:6.0 },
    physical:{ weightKg:7.5, weaponClass:'lmg', platformId:'m249', baseBodyLengthMm:640, defaultBarrelLengthMm:465, defaultMuzzleForwardAddMm:35, defaultOpticId:'iron', defaultMountable:true, baseNoise:1.3, baseMuzzleFlash:1.5 },
    ui:{ showInLoadout:true },
  },

  'dev_allammo_test': {
    id:'dev_allammo_test',
    display:{ name:'[DEV] 전탄종 테스트 소총', type:'small', group:'Rifle', tableOrder:99 },
    ammo:{ caliber:'5.56x45mm', ammoId:'556_m855', defaultAmmoId:'556_m855', allowedAmmoIds:['9mm_115gr','9mm_124gr','9mm_m882','9mm_7n21','9mm_7n31','9mm_jhp','9mm_jhp_p','9mm_rip','556_223_fmj','556_m193','556_m855','556_m855a1','556_mk318_sost','556_mk255_rrlp','556_m995_ap','556_varmageddon','556_hp','556_mk262_mod1','545_hp','545_prs_gs','545_sp','545_us_gs','545_fmj','545_ps_gs','545_pp_gs','545_bp_gs','545_bs_gs','545_7n40','545_ppbs_gs','762x39_hp','762x39_sp','762x39_us','762x39_ps','762x39_pp','762x39_bp','762_308_fmj','762_m80','762_m80a1','762_m61_ap','762_m993_ap','4.6_dm11_ap_sx','4.6_action_sx','4.6_fmj_sx','4.6_jsp_sx','4.6_subsonic_sx','5.7_ss190','5.7_l191_tracer','5.7_ss192_jhp','5.7_sb193_subsonic','5.7_r37f','9mm_luger_tracer','9x21_sp10_7n29','9x21_sp11_7n28','9x21_sp12_jhp','9x21_sp13_7bt3','9x21_7n42','9x21_7u4_subsonic','9x39_sp5_7n8','9x39_sp6_7n9','9x39_pab9','9x39_bp_7n12','300blk_vmax_110','300blk_fmj_147','300blk_m62_tracer','300blk_cbj','300blk_ap_hardcore','300blk_220_subsonic','556_m856_tracer','556_m856a1_tracer','545_7t3_tracer','545_7bt4_aptracer','762x39_t45m_tracer','762x51_m62_tracer','762x51_m948_slap','762x54r_lps_gzh','762x54r_t46m','762x54r_7n1','762x54r_7bt1','762x54r_7n14_snb','762x54r_7n37_bs','68x51_sig_fmj','68x51_sig_hybrid','68x51_xm1186','68x51_xm1188_rra','68x51_xm1184_ap','93x64_fmj','93x64_sp','93x64_9sn_7n33_ap','338lm_fmj','338lm_ap','338lm_tacx','338lm_ucw_subsonic','338nm_fmj','338nm_ap','127x55_ps12','127x55_ps12a','127x55_ps12b','127x99_m33_ball','127x99_m17_tracer','127x99_m8_api','127x99_m20_apit','127x99_mk211_heiap','127x99_m903_slap','127x108_b32_api','127x108_bzt44_apit','127x108_mdz_hei','30_06_m2_ball','30_06_m2_ap','30_06_m25_tracer','30_06_sp','30_06_m72_match'] },
    action:{ fireMode:'semi', supportsFireModes:['semi','burst','full'], defaultFireMode:'auto', fireCooldown:0.85, rateOfFire:800, burstCount:3, fullAutoCount:5, fullAutoMin:3, fullAutoMax:8, burstShotDelay:0.075 },
    handling:{ accuracy:0.66, range:2200, falloffStart:220, handling:1.1, recoilBase:0.8, spreadBaseDeg:2, spreadMinDeg:0.45, spreadMaxDeg:8.5, spreadMovingMul:2, spreadSuppressionMul:2.3, suppressionHit:5, suppressionMiss:2 },
    ballistic:{ damage:5, penetration:42, damageScale:0.95, velocityMul:0.95 },
    reload:{ magazineSize:30, reserveMags:4, reloadTime:2.6, tacticalReloadTime:2 },
    physical:{ weightKg:3 },
    ui:{ showInLoadout:true },
  },
};

// registry 항목 → 기존 WEAPONS 형태 생성 (섹션 → 플랫). 정의된 필드만 emit.
const _WPN_FIELD_MAP = {
  name:'display.name', type:'display.type',
  caliber:'ammo.caliber', ammoId:'ammo.ammoId', defaultAmmoId:'ammo.defaultAmmoId', allowedAmmoIds:'ammo.allowedAmmoIds',
  fireMode:'action.fireMode', supportsFireModes:'action.supportsFireModes', defaultFireMode:'action.defaultFireMode',
  fireCooldown:'action.fireCooldown', rateOfFire:'action.rateOfFire', burstCount:'action.burstCount',
  fullAutoCount:'action.fullAutoCount', fullAutoMin:'action.fullAutoMin', fullAutoMax:'action.fullAutoMax', burstShotDelay:'action.burstShotDelay',
  accuracy:'handling.accuracy', range:'handling.range', falloffStart:'handling.falloffStart', handling:'handling.handling',
  recoilBase:'handling.recoilBase', spreadBaseDeg:'handling.spreadBaseDeg', spreadMinDeg:'handling.spreadMinDeg', spreadMaxDeg:'handling.spreadMaxDeg',
  spreadMovingMul:'handling.spreadMovingMul', spreadSuppressionMul:'handling.spreadSuppressionMul', suppressionHit:'handling.suppressionHit', suppressionMiss:'handling.suppressionMiss',
  damage:'ballistic.damage', penetration:'ballistic.penetration', damageScale:'ballistic.damageScale', velocityMul:'ballistic.velocityMul',
  magazineSize:'reload.magazineSize', reserveMags:'reload.reserveMags', reloadTime:'reload.reloadTime', tacticalReloadTime:'reload.tacticalReloadTime', tubeReload:'reload.tubeReload',
  pelletSpreadDeg:'shotgun.pelletSpreadDeg',
  weightKg:'physical.weightKg',
};
function buildWeaponPresetFromRegistry(entry) {
  if (!entry) return null;
  const out = { id: entry.id };
  for (const f in _WPN_FIELD_MAP) {
    const [s,k] = _WPN_FIELD_MAP[f].split('.');
    const v = entry[s] && entry[s][k];
    if (v !== undefined) out[f] = Array.isArray(v) ? v.slice() : v;
  }
  return out;
}
function buildLegacyWeaponsFromRegistry() {
  const out = {};
  for (const id in WEAPON_REGISTRY) out[id] = buildWeaponPresetFromRegistry(WEAPON_REGISTRY[id]);
  return out;
}
function buildWeaponVelocityMulFromRegistry() {
  const out = {};
  for (const id in WEAPON_REGISTRY) { const v = WEAPON_REGISTRY[id].ballistic && WEAPON_REGISTRY[id].ballistic.velocityMul; out[id] = (v != null) ? v : 1.00; }
  return out;
}

// ============================================================================
// SIDE-WEAPON-PLATFORM-1A §8: 공용 무기 파츠 레지스트리 (M4A1 전용 아님 — compatibleWeaponIds/Platforms로 제한)
// ============================================================================

// §8.1 조준경 — 모든 총기 호환 (compatiblePlatforms: 'all')
const WEAPON_OPTIC_REGISTRY = {
  iron:        { id:'iron',        name:'기계식 조준기', shortName:'Iron', weightKg:0.0, opticBulk:0.0, acquisitionMul:1.05, cqbHandlingMul:1.05, aimedAccuracyMul:0.98, longRangeAid:0.0, compatiblePlatforms:['all'], tags:['Iron'], description:'기본 기계식 조준기. 빠른 조준, 장거리 정밀도 보통.' },
  red_dot:     { id:'red_dot',     name:'레드도트', shortName:'RDS', weightKg:0.12, opticBulk:0.1, acquisitionMul:1.15, cqbHandlingMul:1.1, aimedAccuracyMul:1.04, longRangeAid:0.1, compatiblePlatforms:['all'], tags:['RDS','CQB'], description:'레드도트 사이트. CQB 조준 획득 우수.' },
  holographic: { id:'holographic', name:'홀로그래픽', shortName:'Holo', weightKg:0.18, opticBulk:0.15, acquisitionMul:1.18, cqbHandlingMul:1.08, aimedAccuracyMul:1.06, longRangeAid:0.15, compatiblePlatforms:['all'], tags:['Holo','CQB'], description:'홀로그래픽 사이트. 빠른 표적 획득과 약간의 중거리 보조.' },
  scope_4x:    { id:'scope_4x',    name:'4배율 조준경', shortName:'4x', weightKg:0.34, opticBulk:0.4, acquisitionMul:0.85, cqbHandlingMul:0.82, aimedAccuracyMul:1.18, longRangeAid:0.5, compatiblePlatforms:['all'], tags:['4x','Precision','CQB Penalty'], description:'4배율 조준경. 중장거리 정밀도 우수, 실내 조작성 불리.' },
};
// §8.2 배럴 — 현재 호환은 AR-15 계열(M4A1)만. velocityMul = referenceVelocityMps / 925.
const WEAPON_BARREL_REGISTRY = {
  ar15_103_cqbr:    { id:'ar15_103_cqbr',    name:'10.3" CQBR Barrel', shortName:'10.3" CQBR', barrelLengthInch:10.3, barrelLengthMm:262, compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], referenceAmmoId:'556_m855', referenceVelocityMps:792, velocityMul:792/925, handlingMul:1.12, falloffMul:0.85, noiseMul:1.1, flashMul:1.35, tags:['Short Barrel','CQB','Compact'], description:'M855 기준 약 792 m/s. 실내 조작성 우수, 탄속/유효거리 감소.' },
  ar15_115_commando:{ id:'ar15_115_commando',name:'11.5" Commando Barrel', shortName:'11.5"', barrelLengthInch:11.5, barrelLengthMm:292, compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], referenceAmmoId:'556_m855', referenceVelocityMps:815, velocityMul:815/925, handlingMul:1.08, falloffMul:0.9, noiseMul:1.06, flashMul:1.2, tags:['Short Barrel','Compact'], description:'단총열과 표준 카빈 사이의 절충.' },
  ar15_145_m4:      { id:'ar15_145_m4',      name:'14.5" M4 Barrel', shortName:'14.5" M4', barrelLengthInch:14.5, barrelLengthMm:368, compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], referenceAmmoId:'556_m855', referenceVelocityMps:879, velocityMul:879/925, handlingMul:1.0, falloffMul:1.0, noiseMul:1.0, flashMul:1.0, tags:['Carbine','General Purpose'], description:'표준 M4A1 카빈 기준형 (기존 0.95 보정과 일치).' },
  ar15_16_recce:    { id:'ar15_16_recce',    name:'16" Recce Barrel', shortName:'16" Recce', barrelLengthInch:16.0, barrelLengthMm:406, compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], referenceAmmoId:'556_m855', referenceVelocityMps:890, velocityMul:890/925, handlingMul:0.96, falloffMul:1.05, noiseMul:0.98, flashMul:0.95, tags:['Standard','General Purpose'], description:'표준보다 약간 긴 범용/정밀 셋업.' },
  ar15_18_spr:      { id:'ar15_18_spr',      name:'18" SPR Barrel', shortName:'18" SPR', barrelLengthInch:18.0, barrelLengthMm:457, compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], referenceAmmoId:'556_m855', referenceVelocityMps:914, velocityMul:914/925, handlingMul:0.9, falloffMul:1.15, noiseMul:0.95, flashMul:0.85, tags:['Long Barrel','SPR','Mount-friendly','CQB Penalty'], description:'장총열 정밀 셋업. 탄속/유효거리 유리, 실내 조작성 불리.' },
};
// §8.3 머즐
const WEAPON_MUZZLE_REGISTRY = {
  a2_flash_hider: { id:'a2_flash_hider', name:'A2 소염기', shortName:'A2', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], muzzleForwardAddMm:35, weightKg:0.07, recoilMul:1.0, muzzleClimbMul:1.0, noiseMul:1.0, flashMul:0.7, velocityMul:1.0, tags:['Unsuppressed'], description:'표준 A2 소염기. 화염 억제.' },
  compensator:    { id:'compensator',    name:'컴펜세이터', shortName:'Comp', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], muzzleForwardAddMm:40, weightKg:0.11, recoilMul:0.85, muzzleClimbMul:0.78, noiseMul:1.15, flashMul:1.1, velocityMul:1.0, tags:['Unsuppressed','Recoil'], description:'반동/머즐 상승 억제. 소음/화염 증가.' },
  suppressor:     { id:'suppressor',     name:'소음기', shortName:'Suppr', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], muzzleForwardAddMm:170, weightKg:0.5, recoilMul:0.92, muzzleClimbMul:0.9, noiseMul:0.45, flashMul:0.2, velocityMul:1.0, tags:['Suppressed'], description:'소음/화염 크게 감소. 길이/무게 증가 — 무음 아님.' },
};
// §8.4 손잡이
const WEAPON_FOREGRIP_REGISTRY = {
  none:          { id:'none',          name:'없음', shortName:'없음', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], weightKg:0.0, recoilControlMul:1.0, readySpeedMul:1.0, cqbHandlingMul:1.0, burstControlMul:1.0, fullAutoControlMul:1.0, tags:[], description:'손잡이 없음.' },
  vertical_grip: { id:'vertical_grip', name:'수직 손잡이', shortName:'VG', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], weightKg:0.09, recoilControlMul:0.92, readySpeedMul:1.03, cqbHandlingMul:1.05, burstControlMul:0.9, fullAutoControlMul:0.88, tags:['CQB'], description:'수직 손잡이. 연사 제어/CQB 조작성 향상.' },
  angled_grip:   { id:'angled_grip',   name:'앵글드 손잡이', shortName:'AG', compatibleWeaponIds:['m4a1'], compatiblePlatforms:['ar15_556'], weightKg:0.07, recoilControlMul:0.95, readySpeedMul:1.06, cqbHandlingMul:1.02, burstControlMul:0.93, fullAutoControlMul:0.92, tags:[], description:'앵글드 손잡이. 빠른 견착/반동 제어 균형.' },
};
// §6 공용 프리셋 레지스트리 — 현재 M4A1만 실제 프리셋 보유
const WEAPON_PRESET_REGISTRY = {
  m4a1_cqbr_103:    { id:'m4a1_cqbr_103',    weaponId:'m4a1', platformId:'ar15_556', name:'CQBR 10.3"', shortName:'CQBR 10.3"', description:'짧은 실내형 AR 카빈 셋업. CQB 조작성 우수, 탄속/유효거리 감소.', parts:{ barrelId:'ar15_103_cqbr', opticId:'red_dot', muzzleId:'a2_flash_hider', foregripId:'vertical_grip' }, tags:['CQB','Compact','Short Barrel'], uiOrder:1 },
  m4a1_standard_145:{ id:'m4a1_standard_145',weaponId:'m4a1', platformId:'ar15_556', name:'M4A1 14.5"', shortName:'M4A1 14.5"', description:'표준 M4A1 카빈 셋업. CQB와 중거리 균형.', parts:{ barrelId:'ar15_145_m4', opticId:'red_dot', muzzleId:'a2_flash_hider', foregripId:'none' }, tags:['Carbine','General Purpose'], uiOrder:2 },
  m4a1_spr_18:      { id:'m4a1_spr_18',      weaponId:'m4a1', platformId:'ar15_556', name:'SPR 18"', shortName:'SPR 18"', description:'장총열 정밀 사격 셋업. 탄속/유효거리·거치 안정성 우수, 실내 조작성 불리.', parts:{ barrelId:'ar15_18_spr', opticId:'scope_4x', muzzleId:'compensator', foregripId:'angled_grip' }, tags:['SPR','Long Barrel','Mount-friendly','CQB Penalty'], uiOrder:3 },
};

// 2A-5.1: WEAPON_REGISTRY 기반 로드아웃 총기 목록 자동 생성
//   showInLoadout===false / hidden===true / isTestWeapon===true / TEST_WEAPON_IDS → 제외
//   ui.group||display.group 으로 그룹, ui.tableOrder||display.tableOrder 으로 정렬
function buildLoadoutWeaponListFromRegistry() {
  const test = (typeof TEST_WEAPON_IDS !== 'undefined') ? TEST_WEAPON_IDS : ['cqb_rifle_test','rifle_test'];
  const items = [];
  for (const id in WEAPON_REGISTRY) {
    const e = WEAPON_REGISTRY[id];
    const ui = e.ui || {}, disp = e.display || {};
    if (test.indexOf(id) >= 0) continue;
    if (ui.showInLoadout === false || ui.hidden === true || e.hidden === true || ui.isTestWeapon === true || e.isTestWeapon === true) continue;
    // 최종 WEAPONS에 실제 존재하는 총기만
    if (typeof WEAPONS !== 'undefined' && !WEAPONS[id]) continue;
    const order = (ui.tableOrder != null) ? ui.tableOrder : (disp.tableOrder != null ? disp.tableOrder : 999);
    const group = ui.group || disp.group || 'Other';
    items.push({ id, order, group });
  }
  items.sort((a, b) => a.order - b.order);
  return items.map(x => x.id);
}
// 2A-5.1: 유닛 weaponId가 삭제/숨김 총기를 가리키면 실제 총기로 fallback
function _resolveLoadoutWeaponId(id) {
  if (typeof WEAPONS !== 'undefined' && id && WEAPONS[id]) return id;
  // 테스트 총기 또는 미존재 → 실총 fallback (m4a1 우선, 없으면 mp5, 그래도 없으면 첫 실총)
  if (typeof WEAPONS !== 'undefined') {
    if (WEAPONS['m4a1']) return 'm4a1';
    if (WEAPONS['mp5']) return 'mp5';
    const first = Object.keys(WEAPONS)[0];
    if (first) return first;
  }
  return 'm4a1';
}

// =============================================================
// 2A-5.0: WEAPON SOURCE SWITCH
//   true  → WEAPONS = registry 생성 (테스트 총기 제외)
//   false → WEAPONS = manual 백업에서 테스트 총기 제외
// =============================================================
const TEST_WEAPON_IDS = ['cqb_rifle_test', 'rifle_test'];
const USE_WEAPON_REGISTRY_AS_SOURCE = true;
const WEAPONS = {};
const WEAPON_VELOCITY_MUL = {};
(function _switchWeaponSource() {
  function replaceInPlace(t, s) { for (const k in t) delete t[k]; Object.assign(t, s); }
  // SIDE-METRIC-SCALE-1 §6: range/falloffStart는 legacy 20px/m 값 → rangeM/falloffStartM(m) source-of-truth 이행 후 현행 PX_PER_M으로 px 재계산.
  function _migrateWeaponMetric() {
    for (const id in WEAPONS) {
      const wp = WEAPONS[id];
      if (wp.rangeM == null && wp.range != null) wp.rangeM = legacyPxToM(wp.range);
      if (wp.falloffStartM == null && wp.falloffStart != null) wp.falloffStartM = legacyPxToM(wp.falloffStart);
      if (wp.rangeM != null) wp.range = mToPx(wp.rangeM);
      if (wp.falloffStartM != null) wp.falloffStart = mToPx(wp.falloffStartM);
    }
  }
  function manualFallback() {
    const w = {};
    for (const id in LEGACY_WEAPONS_MANUAL) if (TEST_WEAPON_IDS.indexOf(id) < 0) w[id] = LEGACY_WEAPONS_MANUAL[id];
    replaceInPlace(WEAPONS, w);
    const vm = {};
    for (const id in LEGACY_WEAPON_VELOCITY_MUL_MANUAL) if (TEST_WEAPON_IDS.indexOf(id) < 0) vm[id] = LEGACY_WEAPON_VELOCITY_MUL_MANUAL[id];
    replaceInPlace(WEAPON_VELOCITY_MUL, vm);
  }
  try {
    if (USE_WEAPON_REGISTRY_AS_SOURCE) {
      const w = buildLegacyWeaponsFromRegistry();
      // velocityMul 누락 fallback
      for (const id in w) if (w[id].velocityMul == null) w[id].velocityMul = 1.00;
      replaceInPlace(WEAPONS, w);
      replaceInPlace(WEAPON_VELOCITY_MUL, buildWeaponVelocityMulFromRegistry());
    } else {
      manualFallback();
    }
    // 테스트 총기가 최종 테이블에 남지 않도록 방어
    for (const id of TEST_WEAPON_IDS) { delete WEAPONS[id]; delete WEAPON_VELOCITY_MUL[id]; }
    _migrateWeaponMetric();
    if (typeof console !== 'undefined') console.log(`[WeaponSource] source=${USE_WEAPON_REGISTRY_AS_SOURCE?'WEAPON_REGISTRY':'manual'} (${Object.keys(WEAPONS).length}종, 테스트총기 제외)`);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[WeaponSource] switch 실패 → manual fallback:', e && e.message);
    try { manualFallback(); for (const id of TEST_WEAPON_IDS){ delete WEAPONS[id]; delete WEAPON_VELOCITY_MUL[id]; } _migrateWeaponMetric(); } catch (e2) {}
  }
})();


// ============================================================================
// SIDE-WEAPON-PLATFORM-1A §10~§21: weaponBuild / weaponState / resolved profile / obstruction / mount / switch
//   기존 WEAPONS 평탄화·사격·탄도·관통은 유지. resolved profile은 velocityMul/handling/length/noise만 제한 반영.
// ============================================================================

function getWeaponPhysicalProfile(weaponId) {
  const reg = WEAPON_REGISTRY[weaponId];
  const phys = (reg && reg.physical) || {};
  const grp = (reg && ((reg.ui && reg.ui.group) || (reg.display && reg.display.group))) || 'Rifle';
  const FB = {
    Secondary:{ weaponClass:'pistol', baseBodyLengthMm:200, defaultBarrelLengthMm:115, defaultMuzzleForwardAddMm:0, defaultMountable:false, baseNoise:1.0, baseMuzzleFlash:0.6 },
    PDW:{ weaponClass:'pdw', baseBodyLengthMm:430, defaultBarrelLengthMm:200, defaultMuzzleForwardAddMm:20, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:1.0 },
    SMG:{ weaponClass:'smg', baseBodyLengthMm:500, defaultBarrelLengthMm:225, defaultMuzzleForwardAddMm:0, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:0.9 },
    Rifle:{ weaponClass:'rifle', baseBodyLengthMm:460, defaultBarrelLengthMm:368, defaultMuzzleForwardAddMm:35, defaultMountable:true, baseNoise:1.0, baseMuzzleFlash:1.0 },
    DMR:{ weaponClass:'dmr', baseBodyLengthMm:560, defaultBarrelLengthMm:500, defaultMuzzleForwardAddMm:30, defaultMountable:true, baseNoise:1.2, baseMuzzleFlash:1.1 },
    LMG:{ weaponClass:'lmg', baseBodyLengthMm:640, defaultBarrelLengthMm:465, defaultMuzzleForwardAddMm:35, defaultMountable:true, baseNoise:1.3, baseMuzzleFlash:1.4 },
    Shotgun:{ weaponClass:'shotgun', baseBodyLengthMm:760, defaultBarrelLengthMm:470, defaultMuzzleForwardAddMm:0, defaultMountable:true, baseNoise:1.2, baseMuzzleFlash:1.3 },
  };
  const fb = FB[grp] || FB.Rifle;
  return {
    weaponClass: phys.weaponClass || fb.weaponClass,
    platformId: phys.platformId || ('generic_' + (phys.weaponClass || fb.weaponClass)),
    baseBodyLengthMm: phys.baseBodyLengthMm != null ? phys.baseBodyLengthMm : fb.baseBodyLengthMm,
    defaultBarrelLengthMm: phys.defaultBarrelLengthMm != null ? phys.defaultBarrelLengthMm : fb.defaultBarrelLengthMm,
    defaultMuzzleForwardAddMm: phys.defaultMuzzleForwardAddMm != null ? phys.defaultMuzzleForwardAddMm : fb.defaultMuzzleForwardAddMm,
    weightKg: phys.weightKg != null ? phys.weightKg : 3.0,
    defaultOpticId: phys.defaultOpticId || 'iron',
    defaultMountable: phys.defaultMountable != null ? phys.defaultMountable : fb.defaultMountable,
    baseNoise: phys.baseNoise != null ? phys.baseNoise : fb.baseNoise,
    baseMuzzleFlash: phys.baseMuzzleFlash != null ? phys.baseMuzzleFlash : fb.baseMuzzleFlash,
  };
}
function getWeaponPlatformId(weaponId) { return getWeaponPhysicalProfile(weaponId).platformId; }

function _isPartCompatibleWith(part, weaponId) {
  if (!part) return false;
  const plat = getWeaponPlatformId(weaponId);
  if (part.compatibleWeaponIds && part.compatibleWeaponIds.indexOf(weaponId) >= 0) return true;
  if (part.compatiblePlatforms && (part.compatiblePlatforms.indexOf('all') >= 0 || part.compatiblePlatforms.indexOf(plat) >= 0)) return true;
  return false;
}
function getCompatibleOptics(weaponId) {
  const cls = getWeaponPhysicalProfile(weaponId).weaponClass;
  return Object.keys(WEAPON_OPTIC_REGISTRY).filter(id => {
    if (!_isPartCompatibleWith(WEAPON_OPTIC_REGISTRY[id], weaponId)) return false;
    if (cls === 'pistol' && id !== 'iron' && id !== 'red_dot') return false;   // 권총은 레드도트까지만
    return true;
  });
}
function getCompatibleBarrels(weaponId) { return Object.keys(WEAPON_BARREL_REGISTRY).filter(id => _isPartCompatibleWith(WEAPON_BARREL_REGISTRY[id], weaponId)); }
function getCompatibleMuzzles(weaponId) { return Object.keys(WEAPON_MUZZLE_REGISTRY).filter(id => _isPartCompatibleWith(WEAPON_MUZZLE_REGISTRY[id], weaponId)); }
function getCompatibleForegrips(weaponId) { return Object.keys(WEAPON_FOREGRIP_REGISTRY).filter(id => _isPartCompatibleWith(WEAPON_FOREGRIP_REGISTRY[id], weaponId)); }
function weaponSupportsPartModding(weaponId) { return getCompatibleBarrels(weaponId).length > 0; }

function getWeaponPresets(weaponId) {
  return Object.keys(WEAPON_PRESET_REGISTRY).filter(id => WEAPON_PRESET_REGISTRY[id].weaponId === weaponId)
    .map(id => WEAPON_PRESET_REGISTRY[id]).sort((a, b) => (a.uiOrder || 0) - (b.uiOrder || 0));
}
function getDefaultWeaponPresetId(weaponId) { const ps = getWeaponPresets(weaponId); return ps.length ? ps[0].id : null; }

function applyWeaponPresetToBuild(build, presetId) {
  const preset = WEAPON_PRESET_REGISTRY[presetId];
  if (!preset) return build;
  const p = preset.parts || {};
  return Object.assign({}, build, {
    presetId, customModified: false,
    opticId: p.opticId != null ? p.opticId : build.opticId,
    barrelId: p.barrelId != null ? p.barrelId : build.barrelId,
    muzzleId: p.muzzleId != null ? p.muzzleId : build.muzzleId,
    foregripId: p.foregripId != null ? p.foregripId : build.foregripId,
    updatedAt: (typeof GAME !== 'undefined' && GAME.gameTime) || 0,
  });
}
function createDefaultWeaponBuild(weaponId) {
  const phys = getWeaponPhysicalProfile(weaponId);
  let build = { weaponId, platformId: phys.platformId, presetId: null, customModified: false,
    opticId: phys.defaultOpticId, barrelId: null, muzzleId: null, foregripId: null, buildName: null, updatedAt: 0 };
  const presetId = getDefaultWeaponPresetId(weaponId);
  if (presetId) build = applyWeaponPresetToBuild(build, presetId);
  return build;
}
function getPresetPreviewBuild(weaponId, presetId) {
  let build = createDefaultWeaponBuild(weaponId);
  if (presetId) build = applyWeaponPresetToBuild(build, presetId);
  return build;
}
function setWeaponBuildPart(build, partType, partId) {
  const next = Object.assign({}, build);
  next[partType] = partId;
  next.presetId = null; next.customModified = true;
  next.updatedAt = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  return next;
}

function getResolvedWeaponLengthData(weaponId, build) {
  const phys = getWeaponPhysicalProfile(weaponId);
  let barrelMm = phys.defaultBarrelLengthMm, muzzleAddMm = phys.defaultMuzzleForwardAddMm;
  if (build) {
    if (build.barrelId && WEAPON_BARREL_REGISTRY[build.barrelId]) barrelMm = WEAPON_BARREL_REGISTRY[build.barrelId].barrelLengthMm;
    if (build.muzzleId && WEAPON_MUZZLE_REGISTRY[build.muzzleId]) muzzleAddMm = WEAPON_MUZZLE_REGISTRY[build.muzzleId].muzzleForwardAddMm;
  }
  return { baseBodyLengthMm: phys.baseBodyLengthMm, barrelLengthMm: barrelMm, muzzleForwardAddMm: muzzleAddMm, obstructionLengthMm: phys.baseBodyLengthMm + barrelMm + muzzleAddMm };
}
function deriveWeaponLengthClass(mm) {
  if (mm <= 300) return 'Very Short';
  if (mm <= 500) return 'Short';
  if (mm <= 700) return 'Compact';
  if (mm <= 850) return 'Carbine';
  if (mm <= 1000) return 'Standard';
  if (mm <= 1150) return 'Long';
  return 'Very Long';
}
function deriveIndoorHandlingClass(lengthClass) {
  return { 'Very Short':'excellent', 'Short':'excellent', 'Compact':'good', 'Carbine':'good', 'Standard':'average', 'Long':'poor', 'Very Long':'very_poor' }[lengthClass] || 'average';
}
function deriveMountBenefit(weaponClass, lengthClass) {
  if (weaponClass === 'pistol') return 0.1;
  if (weaponClass === 'lmg' || weaponClass === 'dmr') return 1.0;
  if (lengthClass === 'Long' || lengthClass === 'Very Long') return 0.9;
  if (lengthClass === 'Standard') return 0.7;
  return 0.5;
}
function deriveWeaponAutoTags(profile) {
  const tags = [];
  const CLSMAP = { pistol:'Pistol', smg:'SMG', pdw:'SMG', rifle:'Rifle', dmr:'DMR', lmg:'LMG', shotgun:'Shotgun' };
  if (CLSMAP[profile.weaponClass]) tags.push(CLSMAP[profile.weaponClass]);
  if (profile.weaponClass === 'pistol') tags.push('Secondary');
  tags.push(profile.lengthClass);
  if (profile.indoorHandlingClass === 'excellent' || profile.indoorHandlingClass === 'good') tags.push('CQB');
  else if (profile.indoorHandlingClass === 'average') tags.push('CQB-capable');
  else tags.push('CQB Penalty');
  if (profile.noiseSignature.suppressed) tags.push('Suppressed'); else tags.push('Unsuppressed');
  if (profile.mountBenefit >= 0.9) tags.push('Mount-friendly');
  if (profile.weightKg >= 5) tags.push('Heavy');
  if (profile.customModified) tags.push('Custom'); else if (profile.presetId) tags.push('Preset');
  return tags;
}
function buildResolvedWeaponProfile(weaponId, ammoId, build) {
  const base = (typeof WEAPONS !== 'undefined' && WEAPONS[weaponId]) || {};
  const phys = getWeaponPhysicalProfile(weaponId);
  const len = getResolvedWeaponLengthData(weaponId, build);
  const optic = build && build.opticId && WEAPON_OPTIC_REGISTRY[build.opticId];
  const barrel = build && build.barrelId && WEAPON_BARREL_REGISTRY[build.barrelId];
  const muzzle = build && build.muzzleId && WEAPON_MUZZLE_REGISTRY[build.muzzleId];
  const grip = build && build.foregripId && WEAPON_FOREGRIP_REGISTRY[build.foregripId];
  let velocityMul = (base.velocityMul != null ? base.velocityMul : 1.0);
  if (barrel) velocityMul = barrel.velocityMul;
  if (muzzle && muzzle.velocityMul != null) velocityMul *= muzzle.velocityMul;
  let recoilMul = 1.0, muzzleClimbMul = 1.0, readySpeedMul = 1.0, acquisitionMul = 1.0, aimedAccuracyMul = 1.0, cqbHandlingMul = 1.0;
  if (muzzle) { recoilMul *= muzzle.recoilMul; muzzleClimbMul *= muzzle.muzzleClimbMul; }
  if (grip) { recoilMul *= grip.recoilControlMul; readySpeedMul *= grip.readySpeedMul; cqbHandlingMul *= grip.cqbHandlingMul; }
  if (optic) { acquisitionMul *= optic.acquisitionMul; aimedAccuracyMul *= optic.aimedAccuracyMul; cqbHandlingMul *= optic.cqbHandlingMul; }
  if (barrel) cqbHandlingMul *= barrel.handlingMul;
  let noiseLoud = phys.baseNoise, flash = phys.baseMuzzleFlash;
  if (barrel) { noiseLoud *= barrel.noiseMul; flash *= barrel.flashMul; }
  if (muzzle) { noiseLoud *= muzzle.noiseMul; flash *= muzzle.flashMul; }
  const subsonic = !!(ammoId && /subsonic/i.test(ammoId));
  const suppressed = !!(muzzle && muzzle.id === 'suppressor');
  if (subsonic) noiseLoud *= 0.8;
  const lengthClass = deriveWeaponLengthClass(len.obstructionLengthMm);
  const indoorClass = deriveIndoorHandlingClass(lengthClass);
  const profile = {
    baseWeaponId: weaponId, resolvedName: (base.name || weaponId), weaponClass: phys.weaponClass, platformId: phys.platformId,
    presetId: build ? build.presetId : null, customModified: build ? !!build.customModified : false,
    opticId: build ? build.opticId : phys.defaultOpticId, barrelId: build ? build.barrelId : null, muzzleId: build ? build.muzzleId : null, foregripId: build ? build.foregripId : null,
    ammoId: ammoId || base.defaultAmmoId,
    baseBodyLengthMm: len.baseBodyLengthMm, barrelLengthMm: len.barrelLengthMm, muzzleForwardAddMm: len.muzzleForwardAddMm,
    obstructionLengthMm: len.obstructionLengthMm, resolvedLengthMm: len.obstructionLengthMm,
    weightKg: phys.weightKg + (optic ? optic.weightKg : 0) + (muzzle ? muzzle.weightKg : 0) + (grip ? grip.weightKg : 0),
    velocityMul, recoilMul, muzzleClimbMul, readySpeedMul, acquisitionMul, aimedAccuracyMul, cqbHandlingMul,
    lengthClass, indoorHandlingClass: indoorClass, mountBenefit: deriveMountBenefit(phys.weaponClass, lengthClass),
    noiseSignature: { loudness: +noiseLoud.toFixed(3), audibleRangeM: +(15 * noiseLoud).toFixed(1), audibleRange: Math.round(mToPx(15 * noiseLoud)), suppressed, subsonic, muzzleFlash: +flash.toFixed(3) },
    defaultMountable: phys.defaultMountable, autoTags: [],
  };
  profile.autoTags = deriveWeaponAutoTags(profile);
  return profile;
}
function getResolvedWeaponLength(profile) { return profile ? profile.obstructionLengthMm : 0; }
function getResolvedWeaponTags(profile) { return profile ? profile.autoTags : []; }
function getResolvedNoiseSignature(profile) { return profile ? profile.noiseSignature : null; }

// ===== §10/§11: team loadout migration + unit weaponState =====
const DEFAULT_SECONDARY_WEAPON_ID = 'glock17';
function migrateTeamLoadout(ld) {
  if (!ld) return ld;
  if (!ld.primaryWeaponId) ld.primaryWeaponId = ld.weaponId || 'm4a1';
  if (!ld.primaryAmmoId) ld.primaryAmmoId = ld.ammoId || (WEAPON_REGISTRY[ld.primaryWeaponId] && WEAPON_REGISTRY[ld.primaryWeaponId].ammo.defaultAmmoId);
  if (!ld.secondaryWeaponId) ld.secondaryWeaponId = DEFAULT_SECONDARY_WEAPON_ID;
  if (!ld.secondaryAmmoId) ld.secondaryAmmoId = (WEAPON_REGISTRY[ld.secondaryWeaponId] && WEAPON_REGISTRY[ld.secondaryWeaponId].ammo.defaultAmmoId);
  if (!ld.primaryBuild) ld.primaryBuild = createDefaultWeaponBuild(ld.primaryWeaponId);
  if (!ld.secondaryBuild) ld.secondaryBuild = createDefaultWeaponBuild(ld.secondaryWeaponId);
  // legacy 동기화 유지
  ld.weaponId = ld.primaryWeaponId; ld.ammoId = ld.primaryAmmoId;
  return ld;
}
function getAllowedAmmoForWeapon(weaponId) {
  const reg = WEAPON_REGISTRY[weaponId];
  return (reg && reg.ammo && reg.ammo.allowedAmmoIds) ? reg.ammo.allowedAmmoIds.slice() : [];
}
function sanitizeWeaponAmmoSelection(weaponId, ammoId) {
  const allowed = getAllowedAmmoForWeapon(weaponId);
  if (ammoId && allowed.indexOf(ammoId) >= 0) return ammoId;
  const reg = WEAPON_REGISTRY[weaponId];
  return (reg && reg.ammo && reg.ammo.defaultAmmoId) || (allowed[0] || null);
}
function initializeWeaponStateFromLoadout(unit, ld) {
  ld = migrateTeamLoadout(ld || {});
  // unit literal이 opts.weaponId/ammoId로 이미 설정했으면 그것을 primary로 존중 (per-unit override / 테스트)
  const pW = (unit.weaponId && WEAPON_REGISTRY[unit.weaponId]) ? unit.weaponId : ld.primaryWeaponId;
  const sW = ld.secondaryWeaponId;
  const pAmmoRaw = (unit.weaponId === ld.primaryWeaponId) ? (unit.ammoId || ld.primaryAmmoId) : (unit.ammoId || ld.primaryAmmoId);
  const pAmmo = sanitizeWeaponAmmoSelection(pW, pAmmoRaw);
  const sAmmo = sanitizeWeaponAmmoSelection(sW, ld.secondaryAmmoId);
  const pProf = (typeof getWeaponAmmoProfile === 'function') ? getWeaponAmmoProfile(WEAPONS[pW]) : { magazineSize: 30, reserveMags: 4 };
  const sProf = (typeof getWeaponAmmoProfile === 'function') ? getWeaponAmmoProfile(WEAPONS[sW]) : { magazineSize: 17, reserveMags: 3 };
  // build: loadout build가 해당 무기와 일치할 때만 사용, 아니면 기본 생성
  const pBuild = (ld.primaryBuild && ld.primaryBuild.weaponId === pW) ? Object.assign({}, ld.primaryBuild) : createDefaultWeaponBuild(pW);
  const sBuild = (ld.secondaryBuild && ld.secondaryBuild.weaponId === sW) ? Object.assign({}, ld.secondaryBuild) : createDefaultWeaponBuild(sW);
  unit.weaponState = {
    activeSlot: 'primary',
    primaryWeaponId: pW, secondaryWeaponId: sW,
    primaryAmmoId: pAmmo, secondaryAmmoId: sAmmo,
    primaryMagAmmo: pProf.magazineSize, primaryReserveAmmo: pProf.magazineSize * pProf.reserveMags,
    secondaryMagAmmo: sProf.magazineSize, secondaryReserveAmmo: sProf.magazineSize * sProf.reserveMags,
    primaryBuild: pBuild, secondaryBuild: sBuild,
    switching: false, switchTimer: 0, switchTarget: null,
    mounted: false, mountObjectId: null, mountArcCenter: null, mountArcLimit: 0, mountStartedAt: 0,
    obstructionState: 'clear',
    _stats: { switchCount: 0, mountedShots: 0, obstructInhibitedShots: 0 },
  };
  syncLegacyWeaponFieldsFromActiveSlot(unit);
}
function getActiveWeaponSlot(unit) { return (unit.weaponState && unit.weaponState.activeSlot) || 'primary'; }
function getActiveWeaponId(unit) { const ws = unit.weaponState; if (!ws) return unit.weaponId; return ws.activeSlot === 'secondary' ? ws.secondaryWeaponId : ws.primaryWeaponId; }
function getActiveWeapon(unit) { return WEAPONS[getActiveWeaponId(unit)]; }
function getActiveAmmoId(unit) { const ws = unit.weaponState; if (!ws) return unit.ammoId; return ws.activeSlot === 'secondary' ? ws.secondaryAmmoId : ws.primaryAmmoId; }
function getActiveAmmo(unit) { return (typeof AMMO_PRESETS !== 'undefined') ? AMMO_PRESETS[getActiveAmmoId(unit)] : null; }
function getActiveWeaponBuild(unit) { const ws = unit.weaponState; if (!ws) return null; return ws.activeSlot === 'secondary' ? ws.secondaryBuild : ws.primaryBuild; }
function getActiveMagAmmo(unit) { const ws = unit.weaponState; if (!ws) return unit.magAmmo; return ws.activeSlot === 'secondary' ? ws.secondaryMagAmmo : ws.primaryMagAmmo; }
function getActiveReserveAmmo(unit) { const ws = unit.weaponState; if (!ws) return unit.reserveAmmo; return ws.activeSlot === 'secondary' ? ws.secondaryReserveAmmo : ws.primaryReserveAmmo; }
function setActiveMagAmmo(unit, v) { const ws = unit.weaponState; if (!ws) { unit.magAmmo = v; return; } if (ws.activeSlot === 'secondary') ws.secondaryMagAmmo = v; else ws.primaryMagAmmo = v; unit.magAmmo = v; }
function setActiveReserveAmmo(unit, v) { const ws = unit.weaponState; if (!ws) { unit.reserveAmmo = v; return; } if (ws.activeSlot === 'secondary') ws.secondaryReserveAmmo = v; else ws.primaryReserveAmmo = v; unit.reserveAmmo = v; }
function resolveActiveWeapon(unit) { return buildResolvedWeaponProfile(getActiveWeaponId(unit), getActiveAmmoId(unit), getActiveWeaponBuild(unit)); }
function resolveWeaponForSlot(unit, slot) {
  const ws = unit.weaponState; if (!ws) return null;
  const wId = slot === 'secondary' ? ws.secondaryWeaponId : ws.primaryWeaponId;
  const aId = slot === 'secondary' ? ws.secondaryAmmoId : ws.primaryAmmoId;
  const b = slot === 'secondary' ? ws.secondaryBuild : ws.primaryBuild;
  return buildResolvedWeaponProfile(wId, aId, b);
}
function syncLegacyWeaponFieldsFromActiveSlot(unit) {
  const ws = unit.weaponState; if (!ws) return;
  unit.weaponId = getActiveWeaponId(unit);
  unit.ammoId = getActiveAmmoId(unit);
  unit.magAmmo = getActiveMagAmmo(unit);
  unit.reserveAmmo = getActiveReserveAmmo(unit);
}
function setActiveWeaponSlot(unit, slot) {
  const ws = unit.weaponState; if (!ws) return;
  // 전환 전 현재 슬롯의 탄약을 legacy 필드에서 저장 (사격/재장전 중 변동 반영)
  if (ws.activeSlot === 'secondary') { ws.secondaryMagAmmo = unit.magAmmo; ws.secondaryReserveAmmo = unit.reserveAmmo; }
  else { ws.primaryMagAmmo = unit.magAmmo; ws.primaryReserveAmmo = unit.reserveAmmo; }
  ws.activeSlot = (slot === 'secondary') ? 'secondary' : 'primary';
  syncLegacyWeaponFieldsFromActiveSlot(unit);
}
// 매 tick: 현재 active slot 탄약을 legacy 변동값으로 동기화 (사격/재장전 결과 보존)
function syncActiveSlotAmmoFromLegacy(unit) {
  const ws = unit.weaponState; if (!ws) return;
  if (ws.activeSlot === 'secondary') { ws.secondaryMagAmmo = unit.magAmmo; ws.secondaryReserveAmmo = unit.reserveAmmo; }
  else { ws.primaryMagAmmo = unit.magAmmo; ws.primaryReserveAmmo = unit.reserveAmmo; }
}

// ===== §18: 총기 길이 간섭 레이어 (총알 raycast 아님 — 화기 몸체 공간 점유) =====
function computeWeaponPivot(unit) { return { x: unit.x, y: unit.y }; }
function computeWeaponMuzzlePoint(unit, profile) {
  const lenPx = mToPx((profile ? profile.obstructionLengthMm : 600) / 1000);   // SIDE-METRIC-SCALE-1 §7: mm→m→px (PX_PER_M 기준)
  const ang = unit.facing || 0;
  return { x: unit.x + Math.cos(ang) * lenPx, y: unit.y + Math.sin(ang) * lenPx };
}
function isWeaponSegmentBlocked(unit, start, end) {
  // 벽
  if (typeof MAP_DATA !== 'undefined' && MAP_DATA.walls) {
    for (const w of MAP_DATA.walls) {
      if (w.penetrable === false || w.blocksLOS !== false) {
        if (typeof segmentIntersectsRect === 'function' && segmentIntersectsRect(start.x, start.y, end.x, end.y, w)) return { blocked: true, kind: 'wall' };
      }
    }
  }
  // 시야 차단형 fullCover
  if (typeof MAP_DATA !== 'undefined' && MAP_DATA.coverObjects) {
    for (const o of MAP_DATA.coverObjects) {
      if (o.category === 'fullCover' && typeof segmentIntersectsRect === 'function' && segmentIntersectsRect(start.x, start.y, end.x, end.y, o)) return { blocked: true, kind: 'cover' };
    }
  }
  return { blocked: false, kind: null };
}
function computeWeaponObstructionState(unit, profile) {
  if (!unit || unit.isDead) return 'clear';
  const pivot = computeWeaponPivot(unit);
  const muzzle = computeWeaponMuzzlePoint(unit, profile);
  const seg = isWeaponSegmentBlocked(unit, pivot, muzzle);
  if (seg.blocked) {
    // 머즐이 벽/엄폐물에 박힘 — hard
    return 'hard_obstructed';
  }
  // 근접 아군 — friendly_obstructed
  if (typeof UNITS !== 'undefined') {
    for (const o of UNITS) {
      if (o === unit || o.isDead) continue;
      if (o.team === unit.team) {
        const d = Math.hypot(o.x - muzzle.x, o.y - muzzle.y);
        if (d < 9) return 'friendly_obstructed';
      }
    }
  }
  // 머즐 끝이 벽에 매우 근접 — near_obstructed
  const aheadPivot = { x: muzzle.x, y: muzzle.y };
  const aheadEnd = { x: muzzle.x + Math.cos(unit.facing || 0) * 8, y: muzzle.y + Math.sin(unit.facing || 0) * 8 };
  if (isWeaponSegmentBlocked(unit, aheadPivot, aheadEnd).blocked) return 'near_obstructed';
  return 'clear';
}
function getWeaponObstructionLabel(state) {
  return { clear: 'clear', near_obstructed: '총구 근접 간섭', hard_obstructed: '총구 간섭', friendly_obstructed: '아군 전방 주의' }[state] || state;
}

// ===== §19: half-cover 거치 =====
function canMountWeapon(unit) {
  if (!unit || unit.isDead || unit.isDowned) return false;
  if (unit.team !== 'friend') return false;
  const ws = unit.weaponState; if (!ws) return false;
  const prof = resolveActiveWeapon(unit);
  if (!prof.defaultMountable) return false;
  if (ws.switching) return false;
  if (unit.isReloading && !(unit.tubeReloading && unit.magAmmo >= 1)) return false;   // 튜브식 재장전은 1발 이상이면 사격 가능(중단)
  if (unit.treatmentTimer > 0 || unit.draggingTarget != null) return false;
  if (unit.movePath && unit.movePath.length) return false;
  if (ws.obstructionState === 'hard_obstructed') return false;
  return !!findMountableHalfCover(unit);
}
function findMountableHalfCover(unit) {
  if (typeof MAP_DATA === 'undefined' || !MAP_DATA.coverObjects) return null;
  let best = null, bestD = 36;   // ~1.8m
  for (const o of MAP_DATA.coverObjects) {
    if (o.category !== 'halfCover') continue;
    const cx = o.x + (o.w || 0) / 2, cy = o.y + (o.h || 0) / 2;
    const d = Math.hypot(cx - unit.x, cy - unit.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}
function startWeaponMount(unit, cover) {
  const ws = unit.weaponState; if (!ws || !cover) return false;
  ws.mounted = true;
  ws.mountObjectId = cover._id || (cover.x + ',' + cover.y);
  ws.mountArcCenter = unit.facing || 0;
  ws.mountArcLimit = (Math.PI / 180) * 35;   // ±35°
  ws.mountStartedAt = (typeof GAME !== 'undefined' && GAME.gameTime) || 0;
  if (typeof log === 'function') log(`[${unit.name}] 거치 — 사격 안정 (사격각 ±35°)`, 'info');
  return true;
}
function stopWeaponMount(unit, reason) {
  const ws = unit.weaponState; if (!ws || !ws.mounted) return;
  ws.mounted = false; ws.mountObjectId = null; ws.mountArcCenter = null;
  if (typeof log === 'function') log(`[${unit.name}] 거치 해제${reason ? ' (' + reason + ')' : ''}`, 'info');
}
function updateMountedWeaponArc(unit) {
  const ws = unit.weaponState; if (!ws || !ws.mounted) return;
  if (unit.movePath && unit.movePath.length) { stopWeaponMount(unit, '이동'); return; }
  if (ws.switching) { stopWeaponMount(unit, '무기 전환'); return; }
  if (unit.isDead || unit.isDowned) { stopWeaponMount(unit, '무력화'); return; }
  if (ws.mountArcCenter != null && typeof angleDiff === 'function') {
    const off = Math.abs(angleDiff(unit.facing || 0, ws.mountArcCenter));
    ws._outsideArc = (off > ws.mountArcLimit);
  }
}
function applyMountedWeaponModifiers(unit, profile) {
  const ws = unit.weaponState;
  if (!ws || !ws.mounted || !profile) return profile;
  const benefit = profile.mountBenefit || 0.5;
  profile.recoilMul *= (1 - 0.35 * benefit);
  profile.muzzleClimbMul *= (1 - 0.45 * benefit);
  profile.aimedAccuracyMul *= (1 + 0.12 * benefit);
  profile._mounted = true;
  return profile;
}

// ===== §20: 무기 전환 =====
function canSwitchWeapon(unit) {
  if (!unit || unit.isDead) return false;
  const ws = unit.weaponState; if (!ws) return false;
  if (ws.switching) return false;
  if (unit.treatmentTimer > 0 || unit.draggingTarget != null) return false;
  if (ws.primaryWeaponId === ws.secondaryWeaponId) return true;
  return true;
}
function startWeaponSwitch(unit, targetSlot, timeMul, opts) {
  const ws = unit.weaponState; if (!ws) return false;
  if (!canSwitchWeapon(unit)) return false;
  if (!(opts && opts.force) && getAcuteActionBlockState(unit).blocksWeaponSwitch) return false;   // [0.39.3 A-Closure] knockdown 중 전환 시작 불가 (부상 강제전환 force는 예외)
  const tgt = (targetSlot === 'secondary') ? 'secondary' : 'primary';
  if (tgt === ws.activeSlot) return false;
  // SIDE-WEAPON-INJURY-HANDLING-1A: 대상 슬롯 방어 검사 (UI disabled와 별개로 함수 내부에서도)
  const tgtWeaponId = (tgt === 'secondary') ? ws.secondaryWeaponId : ws.primaryWeaponId;
  if (!tgtWeaponId) return false;   // 대상 슬롯 무기 없음 → 조용히 false (shotQueue 미변경)
  if (!(opts && opts.force) && typeof isWeaponSlotUsable === 'function' && !isWeaponSlotUsable(unit, tgt)) return false;   // 사용 불가 슬롯 (명시적 force만 예외)
  if (unit.isReloading) cancelReloadForWeaponSwitch(unit);
  if (ws.mounted) stopWeaponMount(unit, '무기 전환');
  // 전환 시간: primary→secondary 짧음, secondary→primary 약간 더 김(중량 반영)
  let t = (tgt === 'secondary') ? 0.45 : 0.7;
  const primProf = resolveWeaponForSlot(unit, 'primary');
  if (tgt === 'primary' && primProf && primProf.weightKg >= 5) t += 0.3;
  if (timeMul && timeMul > 0) t *= timeMul;   // SIDE-WEAPON-INJURY-HANDLING-1: 부상 강제전환 지연
  ws.switching = true; ws.switchTimer = t; ws.switchTarget = tgt;
  ws._stats.switchCount++;
  if (unit.shotQueue) unit.shotQueue = null;
  if (typeof log === 'function') log(`[${unit.name}] 무기 전환 → ${tgt === 'secondary' ? '보조무기' : '주무기'} (${t.toFixed(2)}s)`, 'info');
  return true;
}
function cancelReloadForWeaponSwitch(unit) {
  if (unit.isReloading) { unit.isReloading = false; unit.reloadTimer = 0; }
}
function completeWeaponSwitch(unit) {
  const ws = unit.weaponState; if (!ws || !ws.switching) return;
  ws.switching = false; ws.switchTimer = 0;
  setActiveWeaponSlot(unit, ws.switchTarget || 'primary');
  ws.switchTarget = null;
  if (typeof log === 'function') log(`[${unit.name}] 무기 전환 완료 — ${getActiveWeapon(unit) ? (WEAPONS[getActiveWeaponId(unit)].name) : ''}`, 'info');
}
function updateWeaponSwitch(unit, dt) {
  const ws = unit.weaponState; if (!ws || !ws.switching) return;
  ws.switchTimer -= dt;
  if (ws.switchTimer <= 0) completeWeaponSwitch(unit);
}

// =============================================================
// 2A-5.0: WEAPON REGISTRY 비교 / 검증
// =============================================================
function compareRegistryWeaponsWithLegacy(opts) {
  const rep = _mkValidationReport();
  const TOL = 1e-6;
  const neq = (a,b) => (typeof a==='number'&&typeof b==='number') ? Math.abs(a-b)>TOL : a!==b;
  const arrNeq = (a,b) => { if(!Array.isArray(a)||!Array.isArray(b)) return a!==b; if(a.length!==b.length) return true; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return true; return false; };
  const FIELDS = ['name','type','caliber','ammoId','defaultAmmoId','weightKg','accuracy','range','falloffStart','handling',
    'damage','penetration','damageScale','suppressionHit','suppressionMiss','fireMode','defaultFireMode','fireCooldown','rateOfFire',
    'recoilBase','spreadBaseDeg','spreadMinDeg','spreadMaxDeg','spreadMovingMul','spreadSuppressionMul','magazineSize','reserveMags',
    'reloadTime','tacticalReloadTime','burstCount','fullAutoCount','fullAutoMin','fullAutoMax','burstShotDelay','pelletSpreadDeg','tubeReload','velocityMul'];
  const TEST = (typeof TEST_WEAPON_IDS!=='undefined')?TEST_WEAPON_IDS:['cqb_rifle_test','rifle_test'];
  const MAN = (typeof LEGACY_WEAPONS_MANUAL!=='undefined')?LEGACY_WEAPONS_MANUAL:{};
  for (const id in WEAPON_REGISTRY) {
    const gen = buildWeaponPresetFromRegistry(WEAPON_REGISTRY[id]);
    const man = MAN[id];
    const allow = (WEAPON_REGISTRY[id].allowDifference)||{};
    if (!man) { rep.warn('weaponReg', `${id}: manual 백업에 없음 (신규 총기?)`); continue; }
    if (TEST.indexOf(id) >= 0) { rep.error('weaponReg', `${id}: 테스트 총기가 registry에 포함됨`); continue; }
    for (const f of FIELDS) {
      if (allow[f]) continue;
      const gv = gen[f], mv = man[f];
      if (gv === undefined && mv === undefined) continue;
      if (Array.isArray(gv)||Array.isArray(mv)) { if (arrNeq(gv,mv)) rep.warn('weaponReg', `${id}.${f}: registry≠manual`); }
      else if (neq(gv, mv)) rep.warn('weaponReg', `${id}.${f}: registry(${JSON.stringify(gv)}) ≠ manual(${JSON.stringify(mv)})`);
    }
    // allowedAmmoIds 비교
    if (arrNeq(gen.allowedAmmoIds, man.allowedAmmoIds)) rep.warn('weaponReg', `${id}.allowedAmmoIds: registry≠manual`);
  }
  // 테스트 총기가 최종 WEAPONS에 남으면 error
  for (const id of TEST) if (typeof WEAPONS!=='undefined' && WEAPONS[id]) rep.error('weaponReg', `${id}: 테스트 총기가 최종 WEAPONS에 잔존`);
  // manual 실총(테스트 제외)이 전부 registry에 있는지
  for (const id in MAN) if (TEST.indexOf(id)<0 && !WEAPON_REGISTRY[id]) rep.error('weaponReg', `${id}: manual 실총이 WEAPON_REGISTRY에 미이관`);
  if (!opts || opts.log !== false) {
    const s = rep.summary();
    if (typeof console !== 'undefined') {
      console.log(`[WEAPON_REGISTRY ↔ manual 비교] error ${s.errors} / 불일치 ${s.warnings}건 (대상 ${Object.keys(WEAPON_REGISTRY).length}종)`);
      for (const e of rep.errors) console.error(`  ✖ ${e.msg}`);
      for (const w of rep.warnings) console.warn(`  ⚠ ${w.msg}`);
      if (s.errors===0 && s.warnings===0) console.log('  ✓ 모든 실총이 manual과 일치, 테스트 총기 제외 확인');
    }
  }
  return rep;
}

function validateWeaponRegistry(rep) {
  rep = rep || _mkValidationReport();
  if (typeof WEAPON_REGISTRY === 'undefined') { rep.warn('weaponReg', 'WEAPON_REGISTRY 미정의'); return rep; }
  const TEST = (typeof TEST_WEAPON_IDS!=='undefined')?TEST_WEAPON_IDS:['cqb_rifle_test','rifle_test'];
  const seen = {};
  for (const id in WEAPON_REGISTRY) {
    const e = WEAPON_REGISTRY[id];
    if (e.id !== id) rep.warn('weaponReg', `${id}: id 필드 불일치`);
    if (seen[e.id]) rep.error('weaponReg', `${e.id}: registry id 중복`); seen[e.id]=true;
    if (TEST.indexOf(id) >= 0) rep.error('weaponReg', `${id}: 테스트 총기가 registry에 있음`);
    const d=e.display||{}, am=e.ammo||{}, ac=e.action||{}, h=e.handling||{}, b=e.ballistic||{}, r=e.reload||{}, ph=e.physical||{};
    if (!d.name) rep.error('weaponReg', `${id}: display.name 누락`);
    if (!_has(r,'magazineSize')) rep.warn('weaponReg', `${id}: reload.magazineSize 누락`);
    if (!_has(r,'reserveMags')) rep.warn('weaponReg', `${id}: reload.reserveMags 누락`);
    if (!_has(r,'reloadTime')) rep.warn('weaponReg', `${id}: reload.reloadTime 누락`);
    if (!_has(r,'tacticalReloadTime')) rep.warn('weaponReg', `${id}: reload.tacticalReloadTime 누락`);
    if (!ac.supportsFireModes) rep.warn('weaponReg', `${id}: action.supportsFireModes 누락`);
    if (!ac.defaultFireMode) rep.warn('weaponReg', `${id}: action.defaultFireMode 누락`);
    if (!_has(ph,'weightKg')) rep.warn('weaponReg', `${id}: physical.weightKg 누락`);
    if (!_has(h,'accuracy')) rep.warn('weaponReg', `${id}: handling.accuracy 누락`);
    if (!_has(b,'recoilBase') && !_has(h,'recoilBase')) rep.warn('weaponReg', `${id}: recoilBase 누락`);
    if (!_has(ac,'rateOfFire')) rep.warn('weaponReg', `${id}: action.rateOfFire 누락`);
    if (!_has(ac,'fireCooldown')) rep.warn('weaponReg', `${id}: action.fireCooldown 누락`);
    if (!_has(b,'velocityMul')) rep.warn('weaponReg', `${id}: ballistic.velocityMul 누락 (1.00 fallback)`);
    // ammo 연결
    const allowed = am.allowedAmmoIds;
    if (Array.isArray(allowed)) {
      for (const aid of allowed) if (typeof AMMO_PRESETS!=='undefined' && !AMMO_PRESETS[aid]) rep.error('weaponReg', `${id}: allowedAmmoId '${aid}' 가 AMMO_PRESETS에 없음`);
    } else rep.warn('weaponReg', `${id}: ammo.allowedAmmoIds 누락`);
    const def = am.defaultAmmoId;
    if (def && typeof AMMO_PRESETS!=='undefined' && !AMMO_PRESETS[def]) rep.error('weaponReg', `${id}: defaultAmmoId '${def}' 가 AMMO_PRESETS에 없음`);
    if (def && Array.isArray(allowed) && allowed.indexOf(def)<0) rep.warn('weaponReg', `${id}: defaultAmmoId '${def}' 가 allowedAmmoIds에 미포함`);
    // 산탄총
    const isShotgun = (e.shotgun && e.shotgun.isShotgun) || am.caliber==='12ga';
    if (isShotgun) {
      if (!e.shotgun || !_has(e.shotgun,'pelletSpreadDeg')) rep.warn('weaponReg', `${id}: 산탄총인데 shotgun.pelletSpreadDeg 누락`);
      if (!r.tubeReload) rep.info('weaponReg', `${id}: 산탄총인데 reload.tubeReload 미설정`);
      if (am.caliber !== '12ga') rep.warn('weaponReg', `${id}: 산탄총인데 caliber가 12ga 아님`);
    }
    // 생성 검증
    const gen = buildWeaponPresetFromRegistry(e);
    if (!gen || !gen.name) rep.error('weaponReg', `${id}: 생성 weapon preset 필수 필드 누락`);
  }
  // 최종 WEAPONS / LOADOUT 테스트 총기 잔존 검사
  for (const id of TEST) {
    if (typeof WEAPONS!=='undefined' && WEAPONS[id]) rep.error('weaponReg', `${id}: 최종 WEAPONS에 테스트 총기 잔존`);
    if (typeof WEAPON_VELOCITY_MUL!=='undefined' && WEAPON_VELOCITY_MUL[id]) rep.error('weaponReg', `${id}: WEAPON_VELOCITY_MUL에 테스트 총기 잔존`);
    if (typeof LOADOUT_OPTIONS!=='undefined' && LOADOUT_OPTIONS.weapon && LOADOUT_OPTIONS.weapon.indexOf(id)>=0) rep.error('weaponReg', `${id}: LOADOUT_OPTIONS.weapon에 테스트 총기 잔존`);
  }
  // LOADOUT_OPTIONS.weapon의 모든 id가 최종 WEAPONS에 존재
  if (typeof LOADOUT_OPTIONS!=='undefined' && LOADOUT_OPTIONS.weapon) {
    for (const id of LOADOUT_OPTIONS.weapon) if (typeof WEAPONS!=='undefined' && !WEAPONS[id]) rep.error('weaponReg', `LOADOUT_OPTIONS.weapon '${id}' 가 최종 WEAPONS에 없음`);
  }
  // registry의 모든 id가 최종 WEAPONS로 생성됐는지
  for (const id in WEAPON_REGISTRY) if (typeof WEAPONS!=='undefined' && !WEAPONS[id]) rep.error('weaponReg', `${id}: registry에 있으나 최종 WEAPONS에 없음`);
  // 2A-5.1: 로드아웃 자동 동기화 검사
  if (typeof buildLoadoutWeaponListFromRegistry === 'function' && typeof LOADOUT_OPTIONS!=='undefined' && Array.isArray(LOADOUT_OPTIONS.weapon)) {
    const auto = buildLoadoutWeaponListFromRegistry();
    const loRaw = LOADOUT_OPTIONS.weapon;
    const lo = loRaw.slice().sort();
    const autoSorted = auto.slice().sort();
    // (a) 테스트 총기가 자동 목록/실제 목록에 없어야
    for (const id of TEST) {
      if (auto.indexOf(id) >= 0) rep.error('weaponReg', `${id}: 자동 로드아웃 목록에 테스트 총기 포함`);
      if (loRaw.indexOf(id) >= 0) rep.error('weaponReg', `${id}: LOADOUT_OPTIONS.weapon에 테스트 총기 포함`);
    }
    // (b) showInLoadout 노출 총기가 LOADOUT_OPTIONS.weapon에 모두 있는지 (양방향)
    for (const id of auto) if (loRaw.indexOf(id) < 0) rep.warn('weaponReg', `${id}: registry 노출 대상인데 LOADOUT_OPTIONS.weapon에 없음 (동기화 누락)`);
    for (const id of loRaw) {
      if (auto.indexOf(id) < 0) {
        const e = WEAPON_REGISTRY[id], ui = (e&&e.ui)||{};
        if (!e) rep.error('weaponReg', `LOADOUT_OPTIONS.weapon '${id}' 가 WEAPON_REGISTRY에 없음`);
        else if (ui.showInLoadout === false || ui.hidden === true || ui.isTestWeapon === true) rep.error('weaponReg', `LOADOUT_OPTIONS.weapon '${id}' 는 숨김 처리 총기인데 노출됨`);
        else rep.warn('weaponReg', `LOADOUT_OPTIONS.weapon '${id}' 가 자동 목록과 불일치`);
      }
    }
    if (JSON.stringify(lo) !== JSON.stringify(autoSorted)) rep.info('weaponReg', `로드아웃 목록(${loRaw.length})이 registry 자동 목록(${auto.length})과 구성 차이 있음`);
  }
  return rep;
}
if (typeof window !== 'undefined') {
  window.compareRegistryWeaponsWithLegacy = compareRegistryWeaponsWithLegacy;
  window.buildLegacyWeaponsFromRegistry = buildLegacyWeaponsFromRegistry;
}


//   type: 'frag' / (미래) 'smoke' / 'flash' / 'incendiary' / 'mine' 등
//   fuseTime: 신관 시간 (초)
//   throwRange: 최대 투척 거리 (m)
//   blast_*: 폭압 효과
//   fragment_*: 파편 정보 (frag 타입만)
const THROWABLE_PRESETS = {
  grenade_m67: {
    id: 'grenade_m67',
    name: 'M67 Fragmentation Grenade',
    shortName: 'M67',
    type: 'frag',
    weightKg: 0.41,
    fuseTime: 4.7,
    throwRange: 20,
    throwSpeed: 25,
    prepDelay: 0.6,
    blastRadiusLethal: 2.0,
    blastRadiusInner:  3.5,
    blastRadiusOuter:  5.0,
    fragmentCount: 850,
    fragmentRadius: 18,
    fragmentVelocityMul: 1.00,
    fragmentRatioRange: {
      large:  [0.02, 0.04],
      medium: [0.21, 0.24],
      // small = 1 - large - medium (72~76%)
    },
    soundLevel: 'explosion_loud',
    desc: '미군 표준 파편 수류탄. 850개 소형 파편 중심으로 광범위한 살상 효과. 신관 4.7초.',
  },
  grenade_rgd5: {
    id: 'grenade_rgd5',
    name: 'RGD-5 Fragmentation Grenade',
    shortName: 'RGD-5',
    type: 'frag',
    weightKg: 0.336,
    fuseTime: 3.7,
    throwRange: 25,
    throwSpeed: 26,
    prepDelay: 0.6,
    blastRadiusLethal: 1.8,
    blastRadiusInner:  3.2,
    blastRadiusOuter:  4.8,
    fragmentCount: 340,
    fragmentRadius: 16,
    fragmentVelocityMul: 0.93,
    fragmentRatioRange: {
      large:  [0.02, 0.04],
      medium: [0.21, 0.24],
    },
    soundLevel: 'explosion_loud',
    desc: '소련/러시아 파편 수류탄. 가볍고 멀리 던질 수 있으며 신관이 빠름. 파편 수와 위력 밀도는 낮음.',
  },
  grenade_m84: {
    id: 'grenade_m84',
    name: 'M84 Stun Grenade',
    shortName: 'M84',
    type: 'flash',
    weightKg: 0.26,
    fuseTime: 1.5,
    throwRange: 18,
    throwSpeed: 24,
    prepDelay: 0.5,
    // 섬광은 살상이 아니라 **지각**을 때린다. 아래 셋이 세기의 전부다.
    flashRadius: 8.0,        // 이 밖은 아무 효과 없음
    flashBlindMax: 5.0,      // 정면 최근접에서의 실명 시간(초)
    flashDeafMax: 7.0,       // 청각 상실은 더 오래 간다
    flashSuppression: 45,    // 폭음 자체의 제압
    // 파편이 없다 — blastRadius* 를 두지 않는 것이 그 사실의 표현이다.
    soundLevel: 'explosion_loud',
    desc: '섬광음향 수류탄. 파편이 없고 시각·청각·평형을 일시적으로 마비시킨다. 신관 1.5초.',
  },
  grenade_m18: {
    id: 'grenade_m18',
    name: 'M18 Smoke Grenade',
    shortName: 'M18',
    type: 'smoke',
    weightKg: 0.54,
    fuseTime: 1.8,
    throwRange: 15,
    throwSpeed: 21,
    prepDelay: 0.5,
    // 연막은 몸도 지각도 안 때린다 — **사선을 끊는다.** 그래서 세기는 반경·밀도·수명뿐이다.
    smokeRadius: 5.0,        // m
    smokeDensity: 1.05,      // 실측상 10 m 사선을 끊으려면 ~1.0 필요
    smokeDuration: 26.0,     // 초 — 오래 서 있는 것이 값이다
    // 파편도 섬광도 없다 — blastRadius*/flash* 를 두지 않는 것이 그 사실의 표현이다.
    soundLevel: 'impact',    // 폭음이 아니다. 퍽 하고 피어오른다
    desc: '연막 수류탄. 살상력이 없고 사선을 끊는다. 신관 1.8초, 약 26초 지속.',
  },
  // 미래 확장 예시 (비활성):
  // grenade_f1: { type:'frag', fragmentCount:300, fuseTime:3.6 ... }
};

// 파편 등급별 능력치 범위 — 각 파편은 이 범위 내에서 랜덤
const FRAGMENT_TIERS = {
  small: {
    damageRange:   [3, 7],
    penRange:      [6, 14],
    velocityRange: [1250, 1350],
    rangeRange:    [4, 9],
    velDragPerM:   0.165,
    bleedChanceBase: 0.18,
    fractureChance:  0.01,
    shockMul:        0.50,
    damageVelExp: 1.5,
    penVelExp:    1.8,
    // 관통 후 감쇠
    postPenDmgMul: 0.25, postPenPenMul: 0.20, postPenVelMul: 0.30,
    // 도탄
    ricochetMul:    0.05,
    postRicDmgMul:  0.22, postRicPenMul: 0.28, postRicVelMul: 0.38,
    barrierBehavior: 'fragment_small',
  },
  medium: {
    damageRange:   [8, 16],
    penRange:      [22, 38],
    velocityRange: [1100, 1200],
    rangeRange:    [8, 15],
    velDragPerM:   0.105,
    bleedChanceBase: 0.35,
    fractureChance:  0.10,
    shockMul:        0.85,
    damageVelExp: 1.15,
    penVelExp:    1.35,
    postPenDmgMul: 0.35, postPenPenMul: 0.30, postPenVelMul: 0.40,
    ricochetMul:    0.12,
    postRicDmgMul:  0.27, postRicPenMul: 0.32, postRicVelMul: 0.42,
    barrierBehavior: 'fragment_medium',
  },
  large: {
    damageRange:   [18, 35],
    penRange:      [38, 58],
    velocityRange: [950, 1050],
    rangeRange:    [12, 20],
    velDragPerM:   0.070,
    damageVelExp: 0.9,
    bleedChanceBase: 0.55,
    fractureChance:  0.25,
    shockMul:        1.20,
    penVelExp:    1.1,
    postPenDmgMul: 0.45, postPenPenMul: 0.40, postPenVelMul: 0.50,
    ricochetMul:    0.18,
    postRicDmgMul:  0.30, postRicPenMul: 0.35, postRicVelMul: 0.48,
    barrierBehavior: 'fragment_large',
  },
};

// =============================================================
