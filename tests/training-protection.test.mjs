import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { Vector3 } from 'three';
import { CATALOG, shotBallistics, compatibleAmmo } from '../apps/training/src/catalog.js';
import { createPhysics } from '../apps/training/src/physics.js';
import { traceShot } from '../apps/training/src/ballistics.js';
import { createLegacyProtection } from '../apps/training/src/generated/legacy-protection.js';
import { extractProtection } from '../scripts/training-protection.mjs';
import { resolveArmorBatch, resolveBodyPath, softObliquity } from '../apps/training/src/protection.js';
import { unionBodyIntervals } from '../apps/training/src/body-path.js';
import { HumanHitLog, BODY_PROFILE, HUMAN_TARGETS, worldPoint, actorRotation } from '../apps/training/src/human-targets.js';
import { ARMOR_PROFILE } from '../apps/training/src/armor-targets.js';

const referenceRoot = new URL('../reference/2d/',import.meta.url);
const root = new URL('../', import.meta.url), plain = v => JSON.parse(JSON.stringify(v));
const forward = new Vector3(0, 0, -1), b = shotBallistics('556_m855');
const shoot = (p, x = 0, y = 1.335, id = '556_m855', options = {}) => traceShot(p, new Vector3(17 + x, y, 0), forward, shotBallistics(id), { maxDistance: 6, ...options });
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
async function originalContext() {
  const c = createContext({ console: { log() {}, warn() {} } });
  const manifest = JSON.parse(await readFile(new URL('src/manifest.json', referenceRoot), 'utf8'));
  for (const { path } of manifest.scripts) {
    runInContext(await readFile(new URL(path, referenceRoot), 'utf8'), c, { timeout: 5000, filename: path });
    if (path === 'src/data/ammunition-registry.js') break;
  }
  for (const path of ['src/medical/wound-metadata.js', 'src/medical/body-trauma.js', 'src/combat/damage-outcomes.js'])
    runInContext(await readFile(new URL(path, referenceRoot), 'utf8'), c, { filename: path });
  runInContext('Math.random=()=>.5', c); return c;
}

test('armor, backer, projectile and wear helpers match the initialized original VM for all 12 M4 cartridges', async () => {
  const generated = await extractProtection();
  assert.equal(await readFile(new URL('apps/training/src/generated/legacy-protection.js', root), 'utf8'), generated.source);
  const vm = await originalContext(), legacy = createLegacyProtection(() => .5, { resolvedScale: false });
  for (const id of compatibleAmmo()) {
    const ammo = CATALOG.AMMO_PRESETS[id]; vm.ammo = ammo;
    for (const material of ['ceramic', 'aramid', 'pe']) for (const armor of [0, 18, 32, 51]) {
      vm.material = material; vm.armor = armor;
      const pen = legacy.effectivePenetration(ammo, null, material);
      near(pen, runInContext('effectivePenetration(ammo,null,material)', vm));
      assert.deepEqual(plain(legacy.getCanonicalProjectileProfile(ammo)), plain(runInContext('getCanonicalProjectileProfile(ammo)', vm)));
      assert.deepEqual(plain(legacy.buildResidualThreatAfterHard(ammo, pen, armor, {}, {})),
        plain(runInContext('buildResidualThreatAfterHard(ammo,effectivePenetration(ammo,null,material),armor,{},{})', vm)));
      const ctx = { ammo, material, layerType: material === 'aramid' ? 'soft' : 'hard', baseArmor: armor,
        effectiveArmor: armor, shotPenOverride: pen, impactVelocity: 800, initialVelocity: 925,
        armorResult: pen > armor ? 'penetrated' : 'stopped', penetrated: pen > armor, localZone: 'center', capMaxDurability: 48 };
      vm.wearContext = ctx;
      assert.deepEqual(plain(legacy.computeArmorDurabilityDamage(ctx)), plain(runInContext('computeArmorDurabilityDamage(wearContext)', vm)));
    }
    for (const shell of [22, 23]) near(legacy.applyHelmetArmorPenalty(shell, ammo, { isHelmet: true }),
      runInContext(`applyHelmetArmorPenalty(${shell},ammo,{isHelmet:true})`, vm));
  }
  for (const external of [0, 10, 18, 32]) {
    const protection = { _plateMeta: { plateRatingMode: 'icw', plateMinBackerArmor: 18, plateBaseSoftArmor: external } };
    vm.protection = protection;
    assert.deepEqual(plain(legacy.computeBackerResolution(protection)), plain(runInContext('computeBackerResolution(protection)', vm)));
  }
});

test('resolved low residuals and spent projectiles never multiply by ten or gain penetration, speed or energy', async () => {
  const p = await createPhysics();
  try {
    const contacts = p.armorContacts(new Vector3(17, 1.335, 0), forward, 3.9).filter(c => c.kind === 'plate' || c.slot === 'front');
    for (const pen of [0, 1, 6, 9, 46, 64]) {
      p.armorCondition.reset();
      const s = { pen, velocity: pen ? 879 : 0, initialVelocity: 879, damage: 52, stability: 1, barrierCount: 0, ammo: CATALOG.AMMO_PRESETS['556_m855'] };
      const result = resolveArmorBatch(contacts, s, p.armorCondition, () => .001);
      for (const r of result.results) {
        assert.ok(r.after.penetration <= r.before.penetration); assert.ok(r.after.velocityMps <= r.before.velocityMps);
        assert.ok(r.after.damage <= r.before.damage); assert.ok(r.after.stability <= r.before.stability);
      }
      assert.ok(s.pen <= pen); if (!pen) assert.equal(s.velocity, 0);
    }
  } finally { p.dispose(); }
});

test('Br4 uses original 51/15mm and actual curved LOS; soft rating boosts only above its threshold', async () => {
  assert.equal(ARMOR_PROFILE.frontPlateId, 'plate_granit_br4'); assert.equal(ARMOR_PROFILE.plate.armorValue, 51);
  assert.equal(ARMOR_PROFILE.plate.thicknessMm, 15); assert.equal(ARMOR_PROFILE.soft.armorValue, 32);
  assert.equal(softObliquity(1), 1); assert.equal(softObliquity(1.5), 1); assert.ok(softObliquity(2) > 1);
  assert.equal(softObliquity(100), 1.6); assert.equal(softObliquity(null), 1);
  const p = await createPhysics();
  try {
    const d = new Vector3(1, 0, -1).normalize(), target = new Vector3(17, 1.31, -3.85);
    const contacts = p.armorContacts(target.clone().addScaledVector(d, -2), d, 2.1);
    const s = { pen: 46, velocity: 879, initialVelocity: 879, damage: 52, stability: 1, barrierCount: 0, ammo: CATALOG.AMMO_PRESETS['556_m855'] };
    const result = resolveArmorBatch(contacts, s, p.armorCondition, () => .999), plate = result.results.find(r => r.kind === 'plate');
    near(plate.effectiveArmor, 51 * plate.losMm / 15 * plate.backer.armorMul);
    assert.ok(plate.losMm > 20); assert.equal(plate.outcome, 'hard_block');
  } finally { p.dispose(); }
});

test('plate-first ICW requires the actually intersected same-face soft backer; a hard stop never reaches body', async () => {
  const p = await createPhysics(), stripped = await createPhysics({ armorProfile: { ...ARMOR_PROFILE, shapes: ARMOR_PROFILE.shapes.filter(s => s.kind !== 'soft') } });
  try {
    const result = shoot(p, 0, 1.335, '556_m855', { random: () => .999 });
    assert.deepEqual(result.armorResults.map(r => r.layerId), ['plate-front', 'soft-front']);
    assert.equal(result.armorResults[0].outcome, 'hard_block'); assert.equal(result.armorResults[1].outcome, 'not_reached');
    assert.equal(result.armorResults[0].backer.backerResult, 'sufficient'); assert.equal(result.bodyHits.length, 0);
    assert.equal(result.reason, 'armor_stop'); assert.equal(result.residual.penetration, 0);
    const absent = shoot(stripped, 0, 1.335, '556_m855', { random: () => .999 });
    assert.equal(absent.armorResults[0].backer.backerResult, 'insufficient');
    near(absent.armorResults[0].effectiveArmor, result.armorResults[0].effectiveArmor * .91);
  } finally { p.dispose(); stripped.dispose(); }
});

test('front penetration reaches the body before rear protection; entry records preserve incoming energy', async () => {
  const p = await createPhysics();
  try {
    const result = shoot(p, 0, 1.335, '556_m995_ap', { random: () => .001 }), log = new HumanHitLog();
    assert.equal(result.armorResults[0].outcome, 'penetrated'); assert.equal(result.bodyHits[0].outcome, 'body_through_and_through');
    assert.ok(result.armorResults.find(r => r.layerId === 'plate-rear')); assert.equal(result.reason, 'armor_spent');
    const body = result.bodyHits[0]; assert.ok(body.distance > result.armorContacts[0].distance);
    assert.ok(result.armorContacts.find(c => c.layerId === 'plate-rear').distance > body.distance + body.pathLengthM);
    const event = { shotId: 1, time: 0, hit: result.hit, trace: result, ammoId: '556_m995_ap', ballistics: shotBallistics('556_m995_ap') };
    const record = log.record(event); assert.equal(record.targetId, 'H01'); assert.deepEqual(record.residual, body.before);
    assert.ok(record.energyJ > 0); assert.equal(result.residual.velocityMps, 0); assert.equal(log.record(event), null);
    record.bodyPaths[0].energyDepositedJ = -1; assert.ok(log.snapshot().history[0].bodyPaths[0].energyDepositedJ > 0);
  } finally { p.dispose(); }
});

test('posed mesh union counts elbow/knee overlaps once and actual body chords reproduce part resistance', async () => {
  const core = { id: 'core', part: 'leftArm', joint: false }, cover = { id: 'joint', part: 'leftArm', joint: true };
  const merged = unionBodyIntervals([{ entry: 1, exit: 3, shape: core, completeExit: true }, { entry: 2, exit: 4, shape: cover, completeExit: true }]);
  assert.equal(merged.length, 1); assert.equal(merged[0].exit - merged[0].entry, 3);
  assert.equal(merged[0].cells.reduce((n, c) => n + c.exit - c.entry, 0), 3);
  assert.equal(merged[0].cells[1].shape.id, 'core');
  const p = await createPhysics({ armorProfile: null });
  try {
    for (const pose of ['rest', 'standing', 'aim', 'crouch', 'walk']) {
      p.setHumanPose(pose, .3);
      for (const id of ['head', 'chest', 'left-forearm', 'left-hand', 'left-knee', 'left-foot']) {
        const sensor = p.humanSensors.find(s => s.shape.id === id), center = new Vector3(...Object.values(sensor.collider.translation()));
        const origin = center.clone().add(new Vector3(0, 0, 2));
        const paths = p.bodyPaths(origin, forward, 4);
        assert.ok(paths.length, `${pose}/${id}`);
        for (const path of paths) {
          near(path.cells.reduce((sum, c) => sum + c.exit - c.entry, 0), path.exit - path.entry);
          assert.equal(path.completeExit, true); assert.ok(path.exit > path.entry);
        }
      }
    }
  } finally { p.dispose(); }
});

test('original depth thresholds distinguish surface, shallow, deep, exit-lodged and through paths', () => {
  const legacy = createLegacyProtection(), br = legacy.BODY_RESISTANCE.chest, mods = legacy._bodyTerminalMods({family:'rifle_ball'});
  for (const [pen, expected] of [[0, 'surface_only'], [2, 'surface_only'], [3, 'shallow_entry'], [8, 'deep_penetration'], [16, 'near_exit_lodged'], [19, 'body_through_and_through']])
    assert.equal(legacy.resolveBodyDepth(br, mods, pen).depth, expected);
  const path = { actor: HUMAN_TARGETS[0], entry: 1, exit: 1.24, completeExit: true,
    cells: [{entry:1,exit:1.24,shape:BODY_PROFILE.find(s=>s.id==='chest')}], point:new Vector3(17,1.3,-3.9), normal:new Vector3(0,0,1), direction:forward, address:{} };
  const s = { pen: 30, velocity: 879, initialVelocity: 879, damage: 52, stability:1, barrierCount:0,ammo:CATALOG.AMMO_PRESETS['556_m193'] };
  const r = resolveBodyPath(path, s); near(r.cost,14); assert.equal(r.outcome,'body_through_and_through');
  // M1 intentionally replaces the old fixed .5/.4 continuation contract.
  // Depth inputs/expectations above remain the original unmodified thresholds.
  near(s.velocity,879*Math.sqrt(16/30));near(s.damage,52*16/30);
});

test('explicit legacy M193/Mk262/tracer shots retain old depth thresholds and clipped path behavior', async () => {
  const p=await createPhysics({bodyModel:'legacy'});
  try {
    for(const [id,stage]of [['556_m193','shallow_entry'],['556_mk262_mod1','deep_penetration'],['556_m856_tracer','near_exit_lodged']]){
      p.armorCondition.reset();const r=shoot(p,0,1.11,id,{random:()=>.001}); assert.equal(r.reason,'body_stop');
      assert.equal(r.bodyHits[0].outcome,stage);assert.ok(r.bodyHits[0].exitDistance>r.bodyHits[0].entryDistance);
      assert.equal(r.armorResults.length,1);assert.equal(r.residual.velocityMps,0);
    }
    const limb=shoot(p,.445,1.10);assert.equal(limb.bodyHits[0].address.bodyPart,'leftArm');assert.equal(limb.bodyHits[0].outcome,'body_through_and_through');
    assert.equal(limb.armorResults.length,0);assert.ok(limb.segments.some(s=>s.medium==='air'&&s.state==='body'));
    const clipped=shoot(p,.445,1.10,'556_m855',{maxDistance:3.99});assert.equal(clipped.reason,'range_in_body');assert.equal(clipped.bodyHits[0].completeExit,false);
    assert.equal(clipped.bodyHits[0].bttt,false);assert.equal(clipped.bodyHits[0].exitWound,false);assert.ok(clipped.residual.penetration>0);
  }finally{p.dispose();}
});

test('6B47 actual shell uses original skull/temporal values and rifle penalty; exposed face has no helmet layer', async () => {
  const p=await createPhysics();
  try{
    const r=shoot(p,0,1.71,'556_m855',{random:()=>.5});const shell=r.armorResults.find(c=>c.layerId==='helmet-shell');
    assert.equal(shell.itemId,'helmet_6b47_test');assert.equal(shell.armorValue,23);near(shell.effectiveArmor,15);
    assert.ok(r.armorResults.some(c=>c.integral));assert.equal(shell.thicknessMm,null);assert.ok(r.bodyHits.length);
    p.armorCondition.reset();const face=shoot(p,0,1.65,'556_m855',{random:()=>.5});assert.equal(face.armorResults.some(r=>r.kind==='helmet'&&r.before.penetration===46),false);
    assert.equal(face.bodyHits[0].address.hitPart,'face');
    const side=p.armorContacts(new Vector3(19,1.71,-4),new Vector3(-1,0,0),2);assert.equal(side[0].helmetRegion,'temporal');assert.equal(side[0].armorValue,22);
  }finally{p.dispose();}
});

test('repeat impacts wear the correct owner and local zone, degrade protection and reset completely', async () => {
  const p=await createPhysics();
  try{
    const fresh=p.armorCondition.snapshot(), first=shoot(p,0,1.335,'556_m855',{random:()=>.999});
    const front=first.armorResults[0]; assert.ok(front.wear.current<front.wear.previous);assert.ok(front.wear.localZones.center>0);
    assert.equal(p.armorCondition.snapshot()['H01:plate-rear'].current,fresh['H01:plate-rear'].current);
    assert.equal(p.armorCondition.snapshot()['H01:vest-soft'].current,fresh['H01:vest-soft'].current);
    const next=shoot(p,0,1.335,'556_m855',{random:()=>.999});assert.ok(next.armorResults[0].effectiveArmor<front.effectiveArmor);
    p.reset();assert.deepEqual(p.armorCondition.snapshot(),fresh);
    const detached=p.armorCondition.snapshot();detached['H01:plate-front'].current=0;assert.equal(p.armorCondition.snapshot()['H01:plate-front'].current,48);
  }finally{p.dispose();}
});

test('yaw and crouch keep armor/body order; misses and stopped obstacles cannot damage equipment behind them', async()=>{
  const actor={...HUMAN_TARGETS[0],yaw:Math.PI/2},p=await createPhysics({humanTargets:[actor]});
  try{
    p.setHumanPose('crouch');const center=p.armorSensors.find(s=>s.shape.id==='plate-front').pose.position;
    const d=forward.clone().applyQuaternion(actorRotation(actor));const r=traceShot(p,center.clone().addScaledVector(d,-2),d,b,{random:()=>.999,maxDistance:3});
    assert.equal(r.armorResults[0].layerId,'plate-front');assert.equal(r.bodyHits.length,0);
    const fresh=p.armorCondition.snapshot();traceShot(p,new Vector3(17,2.5,0),forward,b);assert.deepEqual(p.armorCondition.snapshot(),fresh);
  }finally{p.dispose();}
  const blocked=await createPhysics({humanTargets:[{...HUMAN_TARGETS[0],at:[21.5,0,-19]}]});
  try{const fresh=blocked.armorCondition.snapshot();const r=traceShot(blocked,new Vector3(21.5,1.335,-8),forward,b,{random:()=>.999});assert.equal(r.armorResults.length,0);assert.equal(r.bodyHits.length,0);assert.deepEqual(blocked.armorCondition.snapshot(),fresh);}finally{blocked.dispose();}
});

test('one projectile can exit into a second target; each actor logs one entry with its own residual',async()=>{
  const targets=[HUMAN_TARGETS[0],{...HUMAN_TARGETS[0],id:'H02',at:[17,0,-6]}],p=await createPhysics({humanTargets:targets,armorProfile:null});
  try{
    const r=traceShot(p,new Vector3(17,1.335,0),forward,b,{maxDistance:8});assert.deepEqual(r.bodyHits.map(h=>h.targetId),['H01','H02']);
    assert.ok(r.bodyHits[1].before.penetration<r.bodyHits[0].before.penetration);assert.ok(r.bodyHits[1].before.velocityMps<r.bodyHits[0].before.velocityMps);
    const log=new HumanHitLog(targets);log.record({shotId:1,time:0,hit:r.hit,trace:r,ammoId:b.ammoId,ballistics:b});assert.deepEqual(log.snapshot().counts,{H01:1,H02:1});
  }finally{p.dispose();}
});

test('a low residual is caught by the actual ICW backer and uses original partial plate wear',async()=>{
  const p=await createPhysics();try{
    const draws=[.001,.9,.999,.001];
    const r=shoot(p,0,1.335,'556_m855',{random:()=>draws.shift()??.5});
    assert.equal(r.reason,'armor_stop');assert.equal(r.bodyHits.length,0);
    assert.deepEqual(r.armorResults.map(r=>r.outcome),['penetrated','backer_block']);
    assert.equal(r.armorResults[0].backer.secondaryStopSuccess,true);
    assert.equal(r.armorResults[0].wear.resultKind,'partial_or_backer_stopped');
  }finally{p.dispose();}
});

test('separate curved-plate crossings preserve the hollow air gap; a clipped plate never pretends to exit',async()=>{
  const p=await createPhysics({armorProfile:{...ARMOR_PROFILE,shapes:ARMOR_PROFILE.shapes.filter(s=>s.kind==='plate')}});try{
    for(const d of Object.values(p.armorCondition.target.armorDurability)){d.current=0;d.localZones={center:100,upper:100,lower:100,edge:100};}
    const mount=p.armorSensors.find(s=>s.shape.id==='plate-front').pose;
    const o=new Vector3(-.3,0,-.015).applyQuaternion(mount.rotation).add(mount.position),d=new Vector3(1,0,0).applyQuaternion(mount.rotation);
    const r=traceShot(p,o,d,shotBallistics('556_m995_ap'),{random:()=>.001,maxDistance:.6});
    assert.ok(r.armorResults.filter(r=>r.layerId==='plate-front').length>=2);
    assert.ok(r.segments.some(s=>s.medium==='air'&&new Vector3(...s.from).distanceTo(new Vector3(...s.to))>.15&&s.state==='armor'));
    p.reset();const fresh=p.armorCondition.snapshot(),clipped=shoot(p,0,1.335,'556_m855',{maxDistance:3.857});
    assert.equal(clipped.reason,'incomplete_exit');assert.equal(clipped.armorResults.length,0);assert.deepEqual(p.armorCondition.snapshot(),fresh);
  }finally{p.dispose();}
});

test('oblique entry keeps plate before its actual same-face backer regardless of the air spacing',async()=>{
  const p=await createPhysics();try{
    let tested=0;
    for(const angle of [0,15,30,45,60,70]){
      const a=angle*Math.PI/180,d=new Vector3(Math.sin(a),0,-Math.cos(a)),o=new Vector3(17,1.335,-3.85).addScaledVector(d,-2);
      const contacts=p.armorContacts(o,d,3),plate=contacts.find(c=>c.layerId==='plate-front'),soft=contacts.find(c=>c.layerId==='soft-front'),body=p.bodyPaths(o,d,3)[0];
      if(!plate||!soft||!body||plate.entryDistance>=body.entry)continue;
      p.armorCondition.reset();const r=traceShot(p,o,d,b,{random:()=>.999,maxDistance:3});
      assert.equal(r.armorResults[0].layerId,'plate-front',`incidence ${angle}`);tested++;
    }
    assert.ok(tested>=3);
  }finally{p.dispose();}
});
