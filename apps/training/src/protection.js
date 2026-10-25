import { CATALOG } from './catalog.js';
import { createLegacyProtection } from './generated/legacy-protection.js';
import { createLegacyBallistics } from './generated/legacy-ballistics.js';
import { helmetRicochetCandidate, applyHelmetRicochet } from './helmet-ricochet.js';

// Spatial adapter tuning, NOT original CQB constants or certified armor values.
export const SOFT_OBLIQUITY = Object.freeze({ threshold: 1.5, gain: .35, maximum: 1.6 });
export const BODY_REFERENCE_M = Object.freeze({ head: .19, neck: .12, chest: .24, abdomen: .24,
  left_arm: .09, right_arm: .09, left_leg: .15, right_leg: .15 });
export const BODY_EXIT_RULE_ID = 'body-exit-sqrt-pen-ratio-v1';
export const snapshotResidual = s => ({ penetration: s.pen, velocityMps: s.velocity, damage: s.damage,
  stability: s.stability, barrierCount: s.barrierCount });
export function softObliquity(ratio) {
  if (ratio === null || !Number.isFinite(ratio)) return 1;
  return Math.min(SOFT_OBLIQUITY.maximum, 1 + Math.max(0, ratio - SOFT_OBLIQUITY.threshold) * SOFT_OBLIQUITY.gain);
}
const legacyForState = createLegacyProtection(() => .5);
export class ArmorCondition {
  constructor(sensors) {
    this.initial = Object.fromEntries(sensors.map(s => {
      const plate = s.shape.kind === 'plate' ? CATALOG.PLATE_REGISTRY[s.shape.itemId] : null;
      const material = plate?.armor.material || s.shape.material, max = plate?.durability.maxDurability || s.shape.maxDurability;
      return [s.ownerId, { current: max, max, material, sourceId: s.shape.itemId, localZones: {} }];
    }));
    this.reset();
  }
  reset() { this.target = { armorDurability: structuredClone(this.initial) }; }
  snapshot() { return structuredClone(this.target.armorDurability); }
  multiplier(contact, zone, legacy = legacyForState) {
    const d = this.target.armorDurability[contact.ownerId];
    return d ? legacy.getDurabilityArmorMul(d.material, d.current / d.max) *
      legacy.getArmorLocalZoneMul(this.target, contact.ownerId, zone) : 1;
  }
  wear(contact, zone, effectiveArmor, effectivePen, before, penetrated, ammo, legacy, resultKind = penetrated ? 'penetrated' : 'stopped', wearMul = 1) {
    const d = this.target.armorDurability[contact.ownerId];
    if (!d) return null;
    const previous = d.current;
    const info = legacy.computeArmorDurabilityDamage({ target: this.target, slotKey: contact.ownerId,
      ammo, material: d.material, layerType: contact.kind === 'plate' ? 'hard' : contact.kind === 'helmet' ? 'helmet' : 'soft',
      baseArmor: contact.armorValue, effectiveArmor, shotPenOverride: effectivePen,
      impactVelocity: before.velocityMps, initialVelocity: before.initialVelocity,
      capMaxDurability: d.max, armorResult: resultKind, penetrated, localZone: zone });
    if (resultKind === 'ricochet') {
      for (const key of ['globalAmount', 'localAmount', 'neighborSplashAmount', 'spallRiskDelta', 'coatingDamageDelta', 'visibilityDamageDelta', 'backfaceDeformationHint']) info[key] *= wearMul;
      info.amount = info.globalAmount; info.ricochetWearMul = wearMul;
    }
    d.current = Math.max(0, d.current - info.globalAmount);
    legacy.applyArmorLocalZoneDamage(this.target, contact.ownerId, zone, info.localAmount);
    if (info.neighborSplashAmount > 0) {
      const neighbors = legacy.ARMOR_ZONE_NEIGHBORS[zone] || [];
      for (const next of neighbors) legacy.applyArmorLocalZoneDamage(this.target, contact.ownerId, next, info.neighborSplashAmount / Math.max(1, neighbors.length));
    }
    return { previous, current: d.current, max: d.max, localZones: { ...d.localZones }, ...info };
  }
}
function localZone(contact) {
  if (contact.kind !== 'plate') return contact.slot === 'front' || contact.slot === 'rear' ? 'center' : 'side';
  const [x, y] = contact.shapePoint;
  if (Math.abs(x) > .10 || Math.abs(y) > .13) return 'edge';
  return y > .065 ? 'upper' : y < -.065 ? 'lower' : 'center';
}
function effectivePen(s, material, legacy) {
  // Current residual, not fresh cartridge stats. A zero/low residual never revives.
  const ammo = { ...s.ammo, penetration: s.pen };
  const k = legacy.computeProjectileKinetics(ammo, s.velocity, s.initialVelocity);
  return Math.min(s.pen, legacy.effectivePenetration(ammo, null, material) * legacy.resolveKineticPenetrationMul(ammo, k));
}
function setResidual(s, pen, { integrity = null, velocityMul = null, damageMul = null } = {}) {
  const ratio = s.pen > 0 ? Math.min(1, Math.max(0, pen / s.pen)) : 0;
  s.pen = Math.min(s.pen, Math.max(0, pen));
  // Original armor code reports residual penetration, not a 3D exit speed.
  // This adapter bounds exit energy by remaining threat.
  s.velocity *= s.pen > 0 ? (velocityMul ?? Math.sqrt(ratio)) : 0;
  s.damage *= s.pen > 0 ? (damageMul ?? ratio) : 0;
  if (integrity !== null) s.stability = Math.min(s.stability, integrity);
}

// A single spatially paired plate/backer encounter. Rear surfaces are processed
// only after the body ray actually reaches them; they never back the front plate.
export function resolveArmorBatch(contacts, s, condition, random, ricochetRandom = random) {
  const legacy = createLegacyProtection(random), before = snapshotResidual(s), results = [];
  let plate = contacts.find(c => c.kind === 'plate' || c.kind === 'helmet');
  const isHelmet = plate?.kind === 'helmet';
  const helmetItem = isHelmet ? CATALOG.HELMET_REGISTRY[plate.itemId] : null;
  const helmetSlot = isHelmet ? helmetItem.protection[plate.helmetRegion] : null;
  const liner = isHelmet ? { ...plate, layerId: 'helmet-liner', armorValue: helmetSlot.linerArmor, integral: true } : null;
  const soft = liner || contacts.find(c => c.kind === 'soft');
  const rated = liner ? [...contacts, liner] : contacts;
  const values = new Map(rated.map(c => {
    const zone = localZone(c), durabilityMul = condition.multiplier(c, zone, legacy);
    const pathMul = c.kind === 'plate' ? c.losMm / c.thicknessMm : c.kind === 'helmet' ? 1 : softObliquity(c.normalPathRatio);
    return [c.layerId, { zone, durabilityMul, pathMul, value: c.armorValue * durabilityMul * pathMul }];
  }));
  let packet = null, backer = null, stopped = false;
  if (plate) {
    if (isHelmet) {
      const v = values.get(plate.layerId), armor = legacy.applyHelmetArmorPenalty(v.value, s.ammo, { isHelmet: true });
      const pen = effectivePen(s, plate.material, legacy);
      const ricochet = helmetRicochetCandidate(plate, s, armor, pen,
        condition.target.armorDurability[plate.ownerId]?.current > 0 ? v.durabilityMul : 0, legacy);
      // No new RNG draws at normal incidence, on exit, or for exhausted armor.
      if (ricochet.eligible) ricochet.roll = ricochetRandom();
      if (ricochet.eligible && ricochet.roll < ricochet.chance) {
        const response = applyHelmetRicochet(ricochet, plate, s, legacy, createLegacyBallistics(random));
        const result = { ...plate, ...v, effectiveArmor: armor, effectivePen: pen,
          before, after: snapshotResidual(s), outcome: 'ricochet', ricochet: response };
        result.wear = condition.wear(result, v.zone, armor, pen, { ...before, initialVelocity: s.initialVelocity },
          false, s.ammo, legacy, 'ricochet', response.wearMul);
        return { results: [result, { ...liner, outcome: 'not_reached', before: snapshotResidual(s), after: snapshotResidual(s) }],
          stopped: false, before, after: snapshotResidual(s), packet: null, ricochet: response };
      }
      // Keep the failed candidate for diagnostics; ordinary shell/liner rolls follow.
      if (ricochet.eligible) plate = { ...plate, ricochet };
    }
    const meta = isHelmet ? {} : CATALOG.PLATE_REGISTRY[plate.itemId].plateSystem;
    backer = legacy.computeBackerResolution({ _plateMeta: { plateId: plate.itemId,
      plateRatingMode: meta.ratingMode, plateMinBackerArmor: meta.minBackerArmor,
      plateBaseSoftArmor: soft ? values.get(soft.layerId).value : 0 } });
    const v = values.get(plate.layerId), armor = legacy.applyHelmetArmorPenalty(v.value * backer.armorMul, s.ammo, { isHelmet });
    const pen = effectivePen(s, plate.material, legacy), probability = legacy.penetrationProbability(pen - armor);
    const penetrated = s.pen > 0 && random() < probability;
    const result = { ...plate, ...v, effectiveArmor: armor, effectivePen: pen, penProbability: probability,
      before: snapshotResidual(s), outcome: penetrated ? 'penetrated' : 'hard_block' };
    backer.overmatchMargin = +(pen - armor).toFixed(1);
    if (penetrated) {
      packet = legacy.buildResidualThreatAfterHard(s.ammo, pen, armor, {}, backer);
      // The legacy random residual allowance cannot create penetration/energy.
      packet.residualPen = Math.min(s.pen, packet.residualPen);
      setResidual(s, packet.residualPen, { integrity: packet.residualIntegrity });
      s.barrierCount++;
      result.residualThreatPacket = { ...packet };
      backer.residualThreat = packet.residualPen; backer.residualKind = packet.residualKind;
    } else { setResidual(s, 0); stopped = true; }
    result.after = snapshotResidual(s);
    results.push(result);
  }
  for (const c of rated.filter(c => c.layerId !== plate?.layerId)) {
    if (stopped || s.pen <= 0) { results.push({ ...c, outcome: 'not_reached', before: snapshotResidual(s), after: snapshotResidual(s) }); continue; }
    const v = values.get(c.layerId), incoming = snapshotResidual(s);
    let armor = legacy.applyHelmetArmorPenalty(v.value, s.ammo, { isHelmet }), pen = effectivePen(s, c.material, legacy), probability, penetrated, attempted = true;
    if (packet) {
      const ratingMode = isHelmet ? 'helmet' : backer.ratingMode, sufficiency = isHelmet ? 'sufficient' : backer.backerResult;
      attempted = (isHelmet || backer.secondaryBackerChanceMul > 0) && legacy.canBackerAttemptStop(packet, armor, sufficiency, ratingMode);
      armor *= (isHelmet ? 1 : backer.residualStopMul) * packet.backerEfficiencyMul;
      pen = s.pen; probability = legacy.penetrationProbability(pen - armor);
      if (attempted) {
        backer.secondaryStopAttempted = true;
        const softPen = random() < probability;
        const gate = random() < legacy.backerStopChanceGate(packet, sufficiency, ratingMode);
        penetrated = softPen || !gate;
      } else penetrated = true;
      backer.secondaryStopSuccess = !penetrated;
      backer.backerMitigationMul = legacy.backerMitigationFactor(packet, sufficiency, ratingMode);
      backer.armorResultLabel = penetrated ? null : 'backer_stopped_residual';
      backer.penetrationResultLabel = penetrated ? 'penetrated_after_backer' : null;
      // The original ICW branch leaves packet.residualPen unchanged on a failed
      // catch. Do not run a second ordinary soft roll or subtract it twice.
    } else {
      probability = legacy.penetrationProbability(pen - armor);
      penetrated = s.pen > 0 && random() < probability;
      if (penetrated) setResidual(s, Math.max(0, pen - armor * .85)); // buildEntryArmorContext's soft residual rule.
    }
    if (!penetrated) { setResidual(s, 0); stopped = true; }
    const result = { ...c, ...v, effectiveArmor: armor, effectivePen: pen, penProbability: probability,
      outcome: penetrated ? 'penetrated' : packet ? 'backer_block' : 'soft_block', secondaryStopAttempted: !!packet && attempted,
      before: incoming, after: snapshotResidual(s) };
    results.push(result);
  }
  for (const result of results) if (result.outcome === 'penetrated' && result.after.penetration <= 0) result.outcome = 'spent';
  if (plate) results[0].backer = { ...backer };
  // Like resolveImpact, complete all armor rolls before equipment wear consumes
  // randomness. A plate punctured but caught by its backer uses the original partial result.
  for (const result of results) {
    if (result.integral || result.outcome === 'not_reached') continue;
    const penetrated = result.outcome === 'penetrated' || result.outcome === 'spent';
    const kind = result.layerId === plate?.layerId && backer?.secondaryStopSuccess ? 'partial_or_backer_stopped' : penetrated ? 'penetrated' : 'stopped';
    result.wear = condition.wear(result, result.zone, result.effectiveArmor, result.effectivePen,
      { ...result.before, initialVelocity: s.initialVelocity }, penetrated, s.ammo, legacy, kind);
  }
  return { results, stopped: stopped || s.pen <= 0, before, after: snapshotResidual(s), packet };
}

export function resolveBodyPath(path, s, personEntry = snapshotResidual(s)) {
  const legacy = createLegacyProtection(), profile = legacy.getCanonicalProjectileProfile(s.ammo);
  const raw = s.ammo.terminalProfile || CATALOG.AMMO_TERMINAL_PROFILE[s.ammo.id] || {};
  const mods = legacy._bodyTerminalMods({ ...raw, family: profile.terminalBehaviorClass,
    woundChannel: profile.apLike ? 'narrow' : profile.expandingLike ? 'expanding' : profile.fragmentingLike ? 'fragmenting' : 'normal' });
  let baseCost = 0;
  const cells = path.cells.map(cell => {
    const key = cell.shape.part === 'head' ? 'head' : cell.shape.part.replace(/(Arm|Leg)$/, word => `_${word.toLowerCase()}`);
    const br = legacy.BODY_RESISTANCE[key], length = cell.exit - cell.entry;
    const cost = br.cost * length / BODY_REFERENCE_M[key]; baseCost += cost;
    return { entryDistance: cell.entry, exitDistance: cell.exit, lengthM: length,
      shapeId: cell.shape.id, bodyPart: cell.shape.part, address: cell.address || path.address,
      resistanceKey: key, resistanceClass: br.cls, referenceLengthM: BODY_REFERENCE_M[key], cost: cost * mods.costMul };
  });
  const last = cells.at(-1), br = { cost: baseCost, exitCost: legacy.BODY_RESISTANCE[last.resistanceKey].exitCost };
  const before = snapshotResidual(s), depth = legacy.resolveBodyDepth(br, mods, s.pen);
  const through = depth.bttt && path.completeExit;
  let stopDistance = path.entry, budget = s.pen;
  if (depth.bodyEntered) for (const cell of cells) {
    if (budget <= cell.cost) { stopDistance = cell.entryDistance + cell.lengthM * Math.max(0, budget / cell.cost); break; }
    budget -= cell.cost; stopDistance = cell.exitDistance;
  }
  if (depth.nearExit) stopDistance = path.exit - Math.min(.001, (path.exit - path.entry) * .01);
  const incomplete = !path.completeExit && depth.bodyEntered && s.pen > depth.cost;
  const exitDistance = through || incomplete ? path.exit : Math.min(path.exit, stopDistance);
  s.pen = incomplete ? Math.max(0, s.pen - depth.cost) : through ? depth.penAfterBody : 0;
  // One anchored calculation for consecutive crossings of the same person.
  // Intermediate part boundaries do not apply the 2D continuation constants.
  const ratio = personEntry.penetration > 0 ? Math.max(0, Math.min(1, s.pen / personEntry.penetration)) : 0;
  s.velocity = incomplete ? before.velocityMps : through ? Math.min(before.velocityMps, personEntry.velocityMps * Math.sqrt(ratio)) : 0;
  s.damage = incomplete ? before.damage : through ? Math.min(before.damage, personEntry.damage * ratio) : 0;
  const massKg = legacy.computeProjectileKinetics(s.ammo, before.velocityMps, s.initialVelocity).massKg;
  const energyInJ = .5 * massKg * before.velocityMps ** 2, energyOutJ = .5 * massKg * s.velocity ** 2;
  const energyDepositedJ = Math.max(0, energyInJ - energyOutJ), parts = [];
  for (const cell of cells) {
    const lengthM = Math.max(0, Math.min(cell.exitDistance, exitDistance) - cell.entryDistance);
    if (!depth.bodyEntered || lengthM <= 1e-8) continue;
    const previous = parts.at(-1), cost = cell.cost * lengthM / cell.lengthM;
    if (previous?.bodyPart === cell.bodyPart) {
      previous.lengthM += lengthM; previous.cost += cost; previous.exitDistance = cell.entryDistance + lengthM;
      if (!previous.shapeIds.includes(cell.shapeId)) previous.shapeIds.push(cell.shapeId);
    } else parts.push({ bodyPart: cell.bodyPart, address: cell.address, shapeIds: [cell.shapeId],
      entryDistance: cell.entryDistance, exitDistance: cell.entryDistance + lengthM, lengthM, cost });
  }
  if (!depth.bodyEntered) parts.push({ bodyPart: cells[0].bodyPart, address: cells[0].address, shapeIds: [cells[0].shapeId],
    entryDistance: path.entry, exitDistance: path.entry, lengthM: 0, cost: 0 });
  const traversedCost = parts.reduce((sum, p) => sum + p.cost, 0);
  let assignedEnergy = 0, priorCost = 0;
  for (const [index, part] of parts.entries()) {
    part.energyShareJ = index === parts.length - 1 ? Math.max(0, energyDepositedJ - assignedEnergy)
      : energyDepositedJ * part.cost / traversedCost;
    part.velocityInMps = Math.sqrt(Math.max(0, 2 * (energyInJ - assignedEnergy) / massKg));
    part.penIn = Math.max(0, before.penetration - priorCost);
    part.damageIn = before.penetration > 0 ? before.damage * part.penIn / before.penetration : 0;
    part.depth = through || index < parts.length - 1 ? 'body_through_and_through' : incomplete ? 'incomplete_body_path' : depth.depth;
    part.exitWound = through || index < parts.length - 1;
    assignedEnergy += part.energyShareJ; priorCost += part.cost;
  }
  const continued = through && s.pen >= 6;
  return { targetId: path.actor.id, address: path.address, point: path.point.toArray(), normal: path.normal.toArray(),
    incomingDirection: path.direction.toArray(), ...depth, depth: incomplete ? 'incomplete_body_path' : depth.depth,
    bttt: through, exitWound: through, retained: incomplete ? false : depth.retained, cells, parts, pathLengthM: path.exit - path.entry,
    penIn: before.penetration, penAfterBody: s.pen, velocityInMps: before.velocityMps, velocityOutMps: s.velocity,
    massKg, energyInJ, energyOutJ, energyDepositedJ, energyAccountingComplete: !incomplete, ruleId: BODY_EXIT_RULE_ID,
    completeExit: path.completeExit, entryDistance: path.entry, exitDistance,
    outcome: incomplete ? 'incomplete_body_path' : through ? 'body_through_and_through' : depth.depth, continued, before, after: snapshotResidual(s) };
}
