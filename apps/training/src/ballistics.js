import { Quaternion, Vector3 } from 'three';
import { CATALOG } from './catalog.js';
import { createLegacyBallistics } from './generated/legacy-ballistics.js';
import { resolveArmorBatch, resolveBodyPath } from './protection.js';
import { resolveBodyChannel } from './body-channel.js';
import { helmetShotRandom } from './helmet-ricochet.js';
import { flightProfile, flightChord, advanceFlight, FLIGHT_LIMITS, FLIGHT_RULE_ID } from './flight.js';

export const MATERIAL_NAMES = Object.freeze({ drywall: '드라이월', wood: '목재', glass: '유리', thin_metal: '금속', concrete: '콘크리트', steel: '강철' });
const EPSILON = 0.0001;
// Shot-local RNG: render frames / particles never consume ballistic randomness.
export function shotRandom(shotId) {
  let seed = (shotId ^ 0xc0b556) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

// The collision boxes' actual 3D chords, including oblique and inside starts.
export function boxInterval(origin, direction, definition) {
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), definition.yaw || 0);
  const inverse = rotation.clone().invert();
  const o = origin.clone().sub(new Vector3(...definition.at)).applyQuaternion(inverse);
  const d = direction.clone().applyQuaternion(inverse);
  let entry = -Infinity, exit = Infinity, exitAxis = 'z', exitSign = 1;
  for (const [i, axis] of ['x', 'y', 'z'].entries()) {
    const half = definition.size[i] / 2;
    if (Math.abs(d[axis]) < 1e-10) { if (Math.abs(o[axis]) > half) return null; continue; }
    const a = (-half - o[axis]) / d[axis], b = (half - o[axis]) / d[axis];
    entry = Math.max(entry, Math.min(a, b));
    if (Math.max(a, b) < exit) { exit = Math.max(a, b); exitAxis = axis; exitSign = Math.sign(d[axis]); }
    if (entry > exit) return null;
  }
  if (exit < 0) return null;
  const exitNormal = new Vector3(); exitNormal[exitAxis] = exitSign; exitNormal.applyQuaternion(rotation);
  return { entry: Math.max(0, entry), exit, inside: entry < 0, exitNormal };
}

const residual = s => ({ penetration: s.pen, velocityMps: s.velocity, damage: s.damage, stability: s.stability, barrierCount: s.barrierCount,
  ...(s.massKg!=null?{projectileMassKg:s.massKg,yawRad:s.yawRad,fragmented:s.fragmented,fragmentMassKg:s.fragmentMassKg}:{}) });
// Original 2D angular response lifted into the 3D incidence plane. Magnitudes and
// random rolls come from the unchanged legacy helpers, not a new physical model.
function turn(direction, normal, legacyDirection) {
  const tangent = direction.clone().addScaledVector(normal, -direction.dot(normal));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0), normal);
  return tangent.normalize().multiplyScalar(legacyDirection.nx).addScaledVector(normal, legacyDirection.ny).normalize();
}

// Straight mode remains an explicit legacy diagnostic. Live game fire enables flight.
export function traceShot(physics, origin, direction, ballistics, { shotId = 1, random, maxDistance = 90, geometryOnly = false, simulateFlight = false, flightOptions = {}, bodyModel = physics.bodyModel || 's2' } = {}) {
  const ricochetRandom = random || helmetShotRandom(shotId);
  random ||= shotRandom(shotId);
  const legacy = createLegacyBallistics(random), ammo = CATALOG.AMMO_PRESETS[ballistics.ammoId];
  const s = { pen: ammo.penetration, damage: ammo.damage, velocity: ballistics.muzzleVelocityMps,
    initialVelocity: ballistics.muzzleVelocityMps, stability: 1, barrierCount: 0, ammo, ammoBarrier: legacy.getAmmoBarrier(ammo) };
  const events = [], segments = [], armorContacts = [], armorResults = [], bodyHits = [], excluded = new Set(), seenArmor = new Set();
  let from = origin.clone(), dir = direction.clone().normalize(), remaining = maxDistance, traveled = 0, hit = null, reason = 'range', flight = 'initial';
  let personEntry = null;
  let tissueState = null, tissueTargetId = null, lastTissueBody = null;
  const releaseFragmentCloud=()=>{
    if(tissueState?.fragmentEnergyJ>0){
      if(lastTissueBody)lastTissueBody.untracedFragmentEnergyJ=(lastTissueBody.untracedFragmentEnergyJ||0)+tissueState.fragmentEnergyJ;
      tissueState={...tissueState,fragmentEnergyJ:0};
    }
  };
  const profile = simulateFlight ? flightProfile(ammo, flightOptions) : null;
  let flightTime = 0, flightSteps = 0, chord = null;
  const segment = (start, end, state = flight, medium = 'air') => {
    const timeStart = flightTime, velocityFromMps = simulateFlight && medium === 'air' ? s.velocity : segments.at(-1)?.velocityMps ?? s.velocity;
    if (simulateFlight) {
      if (medium === 'air') {
        const dt = chord.dt * Math.min(1, start.distanceTo(end) / Math.max(EPSILON, chord.length));
        s.velocity = advanceFlight(start, chord.initialVelocity, dt, profile).velocity.length();
        flightTime += dt;
      } else flightTime += start.distanceTo(end) / Math.max(1, (velocityFromMps + s.velocity) / 2);
    }
    if (geometryOnly && medium === 'air') for (const contact of physics.armorContacts?.(start, dir, start.distanceTo(end)) || []) {
      armorContacts.push({ ...contact, segmentIndex: segments.length, flightState: state, incomingDirection: dir.toArray(),
        distance: traveled + contact.entryDistance, residual: residual(s) });
    }
    segments.push({ from: start.toArray(), to: end.toArray(), state, medium, ...residual(s),
      ...(simulateFlight ? {timeStartS:timeStart,timeEndS:flightTime,velocityFromMps} : {}) });
  };
  for (let i = 0; i < legacy.RAY_MAX_SEGMENTS && remaining > EPSILON; i++) {
    if (simulateFlight) {
      if (flightSteps++ >= FLIGHT_LIMITS.maxSteps || flightTime >= FLIGHT_LIMITS.maxTimeS) { reason = 'flight_limit'; break; }
      chord = flightChord(from, dir, s.velocity, remaining, profile); dir = chord.direction;
    }
    const searchDistance = simulateFlight ? chord.length : remaining;
    const contact = physics.contact(from, dir, searchDistance, excluded, { includeHumans: geometryOnly });
    if (!geometryOnly && (!simulateFlight || physics.hasHumanPath?.(from,dir,searchDistance)!==false)) {
      const limit = contact?.distance ?? remaining;
      const candidateBody = physics.bodyPaths(from, dir, limit)[0];
      const body = candidateBody?.entry <= searchDistance ? candidateBody : null;
      const contacts = (physics.armorContacts?.(from, dir, limit) || []).flatMap(c => c.kind !== 'plate' ? [c] : c.materialIntervals.map(interval => ({
        ...c, ...interval, point: from.clone().addScaledVector(dir, interval.entryDistance).toArray(),
        exitPoint: from.clone().addScaledVector(dir, interval.exitDistance).toArray(),
        pathLengthM: interval.exitDistance - interval.entryDistance, losMm: (interval.exitDistance - interval.entryDistance) * 1000,
        materialIntervals: [interval] })))
        .filter(c => !seenArmor.has(`${c.targetId}:${c.layerId}`)).sort((a, b) => a.entryDistance - b.entryDistance);
      const first = contacts[0]?.entryDistance <= searchDistance ? contacts[0] : null;
      if (first && (!body || first.entryDistance <= body.entry + 1e-6)) {
        releaseFragmentCloud();
        let batch = [first];
        // Override physical cloth-before-plate ordering only for an actual same
        // face intersection. A rear panel cannot supply the entry ICW backer.
        if (first.kind === 'plate' || first.ownerId === `${first.targetId}:vest-soft`) {
          const plate = first.kind === 'plate' ? first : contacts.find(c => c.kind === 'plate' &&
            c.targetId === first.targetId && c.slot === first.slot &&
            (!body || c.entryDistance < body.entry + .01));
          if (plate) {
            const soft = contacts.find(c => c.kind === 'soft' && c.ownerId === `${plate.targetId}:vest-soft` &&
              c.slot === plate.slot && (!body || c.entryDistance < body.entry + .01));
            batch = soft ? [plate, soft] : [plate];
          }
        }
        const startDistance = Math.min(...batch.map(c => c.entryDistance));
        const start = from.clone().addScaledVector(dir, startDistance); segment(from, start);
        const observed = batch.map((c, protectionOrder) => ({ ...c, protectionOrder, segmentIndex: segments.length - 1,
          ...(c.kind === 'helmet' && flight === 'body' && bodyHits.at(-1)?.targetId === c.targetId && bodyHits.at(-1)?.parts.at(-1)?.bodyPart === 'head' ? { exitingHead: true } : {}),
          flightState: flight, incomingDirection: dir.toArray(), distance: traveled + c.entryDistance, residual: residual(s) }));
        armorContacts.push(...observed);
        const partialPlate = batch.find(c => c.kind === 'plate' && !c.completeExit);
        if (partialPlate) {
          const end = from.clone().addScaledVector(dir, partialPlate.exitDistance);
          segment(start, end, 'armor', 'armor');
          hit = { id: first.targetId, kind: 'armor', point: end, normal: new Vector3(...partialPlate.normal), distance: traveled + partialPlate.exitDistance };
          reason = 'incomplete_exit'; break;
        }
        const resolved = resolveArmorBatch(observed, s, physics.armorCondition, random, ricochetRandom);
        personEntry = null;
        armorResults.push(...resolved.results);
        for (const c of batch) if (c.kind === 'soft') seenArmor.add(`${c.targetId}:${c.layerId}`);
        const hard = batch.find(c => c.kind === 'plate' || c.kind === 'helmet');
        const hardResult = resolved.results.find(c => c.layerId === hard?.layerId);
        const endDistance = hard?.kind === 'plate' ? (hardResult.outcome === 'hard_block' ? hard.entryDistance : hard.exitDistance)
          : Math.max(...batch.map(c => c.entryDistance));
        const end = from.clone().addScaledVector(dir, Math.max(startDistance, endDistance));
        segment(start, end, 'armor', 'armor');
        if (resolved.ricochet) {
          const next = new Vector3(...resolved.ricochet.outgoingDirection);
          flight = 'ricochet';
          resolved.ricochet.continued = !legacy._shotIsDead(s);
          if (!resolved.ricochet.continued) {
            hit = { id: first.targetId, kind: 'armor', point: end, normal: new Vector3(...hard.normal), distance: traveled + endDistance };
            reason = 'armor_spent'; break;
          }
          traveled += endDistance + EPSILON; remaining -= endDistance + EPSILON;
          // Re-query the world along the reflected ray: no whole-collider exclusion.
          from = end.clone().addScaledVector(next, EPSILON); dir = next; hit = null;
          reason = i === legacy.RAY_MAX_SEGMENTS - 1 ? 'segment_limit' : 'range'; continue;
        }
        if (resolved.stopped) {
          hit = { id: first.targetId, kind: 'armor', point: end, normal: new Vector3(...(hard?.normal || first.normal)), distance: traveled + endDistance };
          reason = resolved.results.some(r => /block$/.test(r.outcome)) ? 'armor_stop' : 'armor_spent'; break;
        }
        let next = dir;
        if (hard) {
          const post = legacy.applyLegacyPenetrationWobble(1, 0, s), normal = new Vector3(...hard.normal);
          const axis = new Vector3().crossVectors(dir, normal);
          if (axis.lengthSq() < 1e-12) axis.crossVectors(dir, Math.abs(dir.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
          next = dir.clone().applyAxisAngle(axis.normalize(), post.wobbleRad).normalize();
          hardResult.wobbleDeg = post.wobbleDeg;
        }
        traveled += endDistance + EPSILON; remaining -= endDistance + EPSILON;
        from = end.addScaledVector(next, EPSILON); dir = next; flight = 'armor'; hit = null;
        reason = i === legacy.RAY_MAX_SEGMENTS - 1 ? 'segment_limit' : 'range'; continue;
      }
      if (body) {
        segment(from, body.point);
        if (personEntry?.targetId !== body.actor.id) personEntry = { targetId: body.actor.id, ...residual(s) };
        if(tissueTargetId!==body.actor.id){releaseFragmentCloud();if(tissueState)tissueState={...tissueState,penetratedBoneIds:[]};}
        const resolved = bodyModel === 'legacy' ? resolveBodyPath(body, s, personEntry)
          : resolveBodyChannel(body,s,{ammoId:ballistics.ammoId,geometry:physics.describeBodyPath?.(body,ammo)||{},stateIn:tissueState});
        if(bodyModel !== 'legacy'){
          tissueState=resolved.stateOut;tissueTargetId=body.actor.id;lastTissueBody=resolved;
        }
        resolved.flightState = flight;
        resolved.distance = traveled + body.entry;
        resolved.exitPoint = from.clone().addScaledVector(dir, resolved.exitDistance).toArray();
        bodyHits.push(resolved);
        const end = new Vector3(...resolved.exitPoint); segment(body.point, end, 'body', 'body');
        if (!resolved.continued) {
          hit = { id: body.actor.id, kind: 'human', point: end, normal: body.normal, distance: traveled + resolved.exitDistance,
            address: body.address, incomingDirection: dir.clone(), flightState: flight };
          reason = resolved.outcome === 'incomplete_body_path' ? 'range_in_body' : resolved.outcome === 'body_through_and_through' ? 'body_exit_spent' : 'body_stop'; break;
        }
        // The next real surface (including the rear helmet/vest) must be queried
        // again after the body exit; no abstract rear-coverage roll is used.
        for (const key of seenArmor) if (key.startsWith(`${body.actor.id}:`)) seenArmor.delete(key);
        traveled += resolved.exitDistance + EPSILON; remaining -= resolved.exitDistance + EPSILON;
        from = end.addScaledVector(dir, EPSILON); flight = 'body'; hit = null;
        reason = i === legacy.RAY_MAX_SEGMENTS - 1 ? 'segment_limit' : 'range'; continue;
      }
    }
    if (!contact) {
      const end = simulateFlight ? chord.end : from.clone().addScaledVector(dir, remaining); segment(from, end);
      if (!simulateFlight) break;
      traveled += chord.length; remaining -= chord.length; from = end;
      dir = chord.velocity.clone().normalize();
      i--; continue; // Air samples do not consume the 16 solid-encounter budget.
    }
    segment(from, contact.point);
    hit = { id: contact.id, kind: contact.kind, material: contact.material, point: contact.point.clone(), normal: contact.normal.clone(), distance: traveled + contact.distance };
    if (contact.kind === 'human') {
      Object.assign(hit, { address: contact.address, incomingDirection: dir.clone(), flightState: flight });
      reason = 'human'; break;
    }
    if (contact.kind === 'target') { reason = 'target'; break; }
    const { definition, interval } = contact;
    releaseFragmentCloud();
    if (!interval || interval.exit > remaining) { reason = 'incomplete_exit'; break; }
    const incident = Math.acos(Math.min(1, Math.abs(dir.dot(contact.normal))));
    personEntry = null;
    const effective = legacy.computeBarrierEffectiveArmor(definition, { entryT: legacy.mToPx(interval.entry), exitT: legacy.mToPx(interval.exit), incidentDeg: incident * 180 / Math.PI });
    const barrierPen = s.pen * s.ammoBarrier.barrierPenMul * (0.5 + 0.5 * s.velocity / Math.max(1, s.initialVelocity));
    const difference = barrierPen - effective.effectiveArmor;
    const probability = difference < -17.9 ? 0 : legacy.penetrationProbability(difference);
    const penetrated = random() < probability && !legacy.isBallisticAbsoluteStopper(definition);
    const event = { id: contact.id, material: definition.material, ...effective, point: contact.point.toArray(), normal: contact.normal.toArray(),
      barrierPen, penProbability: probability, before: residual(s) };
    let next;
    if (penetrated) {
      const exitPoint = from.clone().addScaledVector(dir, interval.exit);
      const loss = legacy._applyBarrierLoss(s, definition.material, effective.effectiveArmor);
      const post = legacy.applyLegacyPenetrationWobble(1, 0, s);
      // A rotation in the incidence plane preserves the original signed wobble.
      const axis = new Vector3().crossVectors(dir, contact.normal);
      if (axis.lengthSq() < 1e-12) axis.crossVectors(dir, Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
      next = dir.clone().applyAxisAngle(axis.normalize(), post.wobbleRad).normalize();
      Object.assign(event, { outcome: 'penetrated', exitPoint: exitPoint.toArray(), exitNormal: interval.exitNormal.toArray(), loss,
        wobbleDeg: post.wobbleDeg, after: residual(s), continued: !legacy._shotIsDead(s) });
      events.push(event);
      // Display the actual entry-to-exit chord, even when the shot expires there.
      segment(contact.point, exitPoint, 'penetrated', 'barrier'); flight = 'penetrated';
      if (!event.continued) { hit.point.copy(exitPoint); hit.distance = traveled + interval.exit; reason = 'spent'; break; }
      traveled += interval.exit; remaining -= interval.exit;
      from = exitPoint;
    } else {
      const ricChance = legacy.calcRicochetChance({ incidentAngleRad: incident, material: definition.material, ammoBarrier: s.ammoBarrier,
        impactVel: s.velocity, initialVel: s.initialVelocity, effectivePen: barrierPen, barrierResistance: effective.effectiveArmor });
      if (random() < ricChance) {
        const dot = dir.dot(contact.normal), tangent = Math.sqrt(Math.max(0, 1 - dot * dot));
        const post = legacy.calcRicochetDirection(tangent, dot, 0, 1, definition.material, s.ammoBarrier.barrierBehavior);
        next = turn(dir, contact.normal, post);
        const decay = legacy.getRicochetDecay(s.ammoBarrier);
        s.pen *= decay.pen; s.velocity *= decay.vel; s.damage *= decay.dmg; s.stability *= decay.stab; s.barrierCount++;
        Object.assign(event, { outcome: 'ricochet', ricChance, after: residual(s), continued: !legacy._shotIsDead(s) }); events.push(event);
        flight = 'ricochet';
        if (!event.continued) { reason = 'spent'; break; }
        traveled += contact.distance; remaining = (remaining - contact.distance) * 0.5; from = contact.point.clone();
      } else {
        event.outcome = legacy.getAmmoBallistic(s.ammoBarrier).type === 'frangible' && random() < 0.5 ? 'shattered' : 'stopped';
        event.ricChance = ricChance; event.after = residual(s); event.continued = false; events.push(event); reason = event.outcome; break;
      }
    }
    excluded.add(contact.handle); dir = next; from.addScaledVector(dir, EPSILON); remaining -= EPSILON; traveled += EPSILON;
    hit = null; reason = i === legacy.RAY_MAX_SEGMENTS - 1 ? 'segment_limit' : 'range';
  }
  const trace={ hit, events, segments, armorContacts, armorResults, bodyHits, residual: residual(s), reason,
    ...(simulateFlight ? {flight:{ruleId:FLIGHT_RULE_ID,...profile,timeS:flightTime,distanceM:segments.reduce((sum,p)=>sum+new Vector3(...p.from).distanceTo(new Vector3(...p.to)),0),samples:flightSteps}} : {}) };
  releaseFragmentCloud();
  physics.annotateInternal?.(trace,ammo);
  return trace;
}
