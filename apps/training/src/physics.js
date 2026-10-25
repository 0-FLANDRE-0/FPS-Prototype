import {PLAYER_COLLISION_GROUPS} from './ragdoll-lifecycle.js';
import{partitionBodyAtSidePlates}from'./side-plate-path.js';
import {buildInternalAnatomy,intersectInternalBody} from './internal-anatomy.js';
import {createLegacyMedical} from './generated/legacy-medical.js';
import { createSoldierRig } from './soldier-rig.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { BOXES, PLAYER, STEP, TARGETS } from './config.js';
import { approach } from './aim.js';
import { boxInterval } from './ballistics.js';
import { BODY_PROFILE, HUMAN_TARGETS, shapePose, resolveBodyAddress, actorRotation, bodyMesh } from './human-targets.js';
import { ARMOR_PROFILE, armorVertices, armorIndices, armorPose, armorOwnerId, prioritizeArmorContacts } from './armor-targets.js';
import { meshTriangles, solidMeshIntervals, firstMeshSurface } from './armor-geometry.js';
import { unionBodyIntervals } from './body-path.js';
import { ArmorCondition } from './protection.js';
import { CATALOG } from './catalog.js';
import { SPRINT, canSprint } from './sprint.js';

export async function createPhysics(options) {
  await RAPIER.init();
  return new TrainingPhysics(options);
}
export class TrainingPhysics {
  constructor({ humanTargets = HUMAN_TARGETS, armorProfile = ARMOR_PROFILE, bodyModel = 's2' } = {}) {
    this.bodyModel=bodyModel;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.surface = new Map();
    this.armorSensors = [];
    this.humanSensors = [];
    this.humanRigs = new Map(humanTargets.map(actor=>[actor.id,createSoldierRig()]));
    this.internalAnatomies = new Map(humanTargets.map(actor=>[actor.id,buildInternalAnatomy(this.humanRigs.get(actor.id))]));
    this.internalActors = new Map(humanTargets.map(actor=>[actor.id,actor]));
    this.projectileDiameter = createLegacyMedical(CATALOG,()=>0,()=>({})).getProjectileDiameterMm;
    for (const box of BOXES) {
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(...box.size.map(value => value / 2)).setTranslation(...box.at));
      this.surface.set(collider.handle, { id: box.id, kind: box.kind, material: box.material, definition: box });
    }
    for (const target of TARGETS) {
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.39, 0.58, 0.055).setTranslation(target.x, 1.5, target.z).setRotation({ x: 0, y: Math.sin(target.yaw / 2), z: 0, w: Math.cos(target.yaw / 2) }));
      this.surface.set(collider.handle, { id: target.id, kind: 'target', definition: { at: [target.x, 1.5, target.z], size: [0.78, 1.16, 0.11], yaw: target.yaw } });
    }
    for (const actor of humanTargets) {
      for (const shape of armorProfile?.shapes || []) {
        const pose = armorPose(actor, shape, this.humanRigs.get(actor.id)), vertices = armorVertices(shape), indices = armorIndices(shape);
        const desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
        if (!desc) throw new Error(`Invalid armor hull: ${shape.id}`);
        const collider = this.world.createCollider(desc.setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.rotation).setSensor(true));
        const surface = { id: actor.id, kind: 'armor-sensor', actor, shape, ownerId: armorOwnerId(actor, shape) };
        this.surface.set(collider.handle, surface); this.armorSensors.push({ collider, ...surface, pose,
          triangles: shape.kind === 'plate' || shape.kind === 'helmet' ? meshTriangles(vertices, indices) : null });
      }
      for (const shape of BODY_PROFILE) {
        const pose = shapePose(actor, shape, this.humanRigs.get(actor.id));
        const data = bodyMesh(shape);
        const desc = data ? RAPIER.ColliderDesc.trimesh(data.vertices, data.indices)
          : shape.type === 'capsule' ? RAPIER.ColliderDesc.capsule(pose.halfHeight, shape.radius)
          : shape.type === 'ball' ? RAPIER.ColliderDesc.ball(shape.radius) : RAPIER.ColliderDesc.cuboid(...shape.size.map(value => value / 2));
        const collider = this.world.createCollider(desc.setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.rotation).setSensor(true));
        const surface={id:actor.id,kind:'human',actor,shape};this.surface.set(collider.handle,surface);this.humanSensors.push({collider,...surface,pose,
          triangles: meshTriangles(data.vertices, data.indices)});
      }
      // Movement has one compact body capsule, independent of the ballistic sensors and joint covers.
      const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.62, 0.23).setTranslation(actor.at[0], actor.at[1] + 0.85, actor.at[2]));
      this.surface.set(collider.handle, { id: actor.id, kind: 'human-movement' });
    }
    this.armorCondition = new ArmorCondition(this.armorSensors);
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(PLAYER.spawn.x, PLAYER.standHalf + PLAYER.radius + 0.02, PLAYER.spawn.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER.standHalf, PLAYER.radius).setCollisionGroups(PLAYER_COLLISION_GROUPS), this.body);
    this.controller = this.world.createCharacterController(0.008);
    this.controller.enableAutostep(0.15, 0.18, false);
    this.controller.enableSnapToGround(0.15);
    this.feet = new Vector3();
    this.velocity = new Vector3();
    this.movementVelocity = new Vector3(); // Collision-resolved translation, distinct from controller intent.
    this.crouched = false;
    this.sprinting = false;
    this.grounded = false;
    this.half = PLAYER.standHalf;
    this.world.step();
    this.sync();
  }
  annotateInternal(trace,ammo){
    const radius=this.projectileDiameter(ammo)/2000;
    for(const body of trace.bodyHits){if(body.internalGeometryCached)continue;const anatomy=this.internalAnatomies.get(body.targetId);if(anatomy)Object.assign(body,intersectInternalBody(anatomy,this.internalActors.get(body.targetId),body,radius));}
  }
  describeBodyPath(path,ammo){
    const anatomy=this.internalAnatomies.get(path.actor.id);
    if(!anatomy)return {internalHits:[],nearMisses:[],cavityCandidates:[],tissueIntervals:[],enclosureHits:[]};
    return intersectInternalBody(anatomy,path.actor,{bodyEntered:true,point:path.point.toArray(),incomingDirection:path.direction.toArray(),entryDistance:path.entry,exitDistance:path.exit},this.projectileDiameter(ammo)/2000);
  }
  setHumanPose(id='rest',time=0,targetIds=null) {
    let changed=false;for(const [actorId,rig]of this.humanRigs)if(!targetIds||targetIds.includes(actorId))changed=rig.setPose(id,id==='walk'?time:0)||changed;
    if(!changed)return false;
    this.syncHumanTransforms();return true;
  }
  syncHumanTransforms() {
    for(const rig of this.humanRigs.values()){rig.root.updateMatrixWorld(true);rig.skeleton.update();}
    for(const sensor of this.humanSensors){const pose=shapePose(sensor.actor,sensor.shape,this.humanRigs.get(sensor.actor.id));sensor.pose=pose;sensor.collider.setTranslation(pose.position);sensor.collider.setRotation(pose.rotation);}
    for(const sensor of this.armorSensors){const pose=armorPose(sensor.actor,sensor.shape,this.humanRigs.get(sensor.actor.id));sensor.pose=pose;sensor.collider.setTranslation(pose.position);sensor.collider.setRotation(pose.rotation);}
    // Body ray queries below use live collider poses; Rapier's world broadphase
    // otherwise waits until the next physics step after a pose change.
    this.world.propagateModifiedBodyPositionsToColliders();
  }
  sync() {
    const p = this.body.translation();
    this.feet.set(p.x, p.y - this.half - PLAYER.radius, p.z);
  }
  stance(crouched) {
    if (crouched === this.crouched) return;
    const half = crouched ? PLAYER.crouchHalf : PLAYER.standHalf;
    const p = { x: this.feet.x, y: this.feet.y + half + PLAYER.radius + 0.003, z: this.feet.z };
    if (!crouched && this.world.intersectionWithShape(p, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(half, PLAYER.radius), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body, collider => this.surface.get(collider.handle)?.kind !== 'floor'&&!this.surface.get(collider.handle)?.ragdoll)) return;
    this.crouched = crouched;
    this.half = half;
    this.collider.setShape(new RAPIER.Capsule(half, PLAYER.radius));
    this.body.setTranslation(p, true);
    this.body.setNextKinematicTranslation(p);
    this.world.propagateModifiedBodyPositionsToColliders();
  }
  step(input, yaw) {
    this.stance(input.crouch);
    this.sprinting = canSprint(input, { crouched: this.crouched });
    const topSpeed = (this.crouched ? PLAYER.crouchSpeed : this.sprinting ? SPRINT.speedMps : PLAYER.speed)*(input.speedMultiplier??1);
    let x = input.move.x, y = input.move.y;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    const desiredX = (Math.cos(yaw) * x + Math.sin(yaw) * y) * topSpeed;
    const desiredZ = (-Math.sin(yaw) * x + Math.cos(yaw) * y) * topSpeed;
    this.velocity.x = approach(this.velocity.x, desiredX, 14, STEP);
    this.velocity.z = approach(this.velocity.z, desiredZ, 14, STEP);
    this.velocity.y = this.grounded ? -0.8 : Math.max(-20, this.velocity.y - 9.81 * STEP);
    this.controller.computeColliderMovement(this.collider, { x: this.velocity.x * STEP, y: this.velocity.y * STEP, z: this.velocity.z * STEP }, input.collisionFilter?0:RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,this.collider.collisionGroups(),c=>!this.surface.get(c.handle)?.ragdoll&&(input.collisionFilter?input.collisionFilter(c):true));
    const movement = this.controller.computedMovement();
    const previous = this.body.translation();
    this.body.setNextKinematicTranslation({ x: previous.x + movement.x, y: previous.y + movement.y, z: previous.z + movement.z });
    this.grounded = this.controller.computedGrounded();
    this.world.step();
    this.sync();
    const actual=this.body.translation();
    this.movementVelocity.set(actual.x-previous.x,actual.y-previous.y,actual.z-previous.z).divideScalar(STEP);
    return Math.hypot(movement.x, movement.z) / STEP;
  }
  sweepSphere(origin,end,radius=.12){
    const delta=end.clone().sub(origin),length=delta.length();if(length<1e-12)return null;
    const hit=this.world.castShape(origin,{x:0,y:0,z:0,w:1},delta.divideScalar(length),new RAPIER.Ball(radius),0,length,true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.collider,this.body);
    return hit?{distance:hit.time_of_impact,id:this.surface.get(hit.collider.handle)?.id}:null;
  }
  ray(origin, direction, distance = 50) {
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(origin, direction), distance, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider,this.body,c=>this.surface.get(c.handle)?.kind!=='world-loot');
    if (!hit) return null;
    const length = hit.timeOfImpact;
    const { id, kind, material } = this.surface.get(hit.collider.handle);
    return { id, kind, material, distance: length,
      point: new Vector3(origin.x, origin.y, origin.z).addScaledVector(direction, length),
      normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z) };
  }
  contact(origin, direction, distance, excluded = new Set(), { includeHumans = true } = {}) {
    const ray=new RAPIER.Ray(origin,direction);
    let hit = this.world.castRayAndGetNormal(ray, distance, true,
      undefined, undefined, this.collider, this.body, collider => !excluded.has(collider.handle) && !['human','human-movement','armor-sensor','player-boundary','world-loot'].includes(this.surface.get(collider.handle)?.kind));
    for(const {collider}of includeHumans ? this.humanSensors : []){if(excluded.has(collider.handle))continue;
      const candidate=collider.castRayAndGetNormal(ray,distance,true);
      if(candidate&&(!hit||candidate.timeOfImpact<hit.timeOfImpact))hit={...candidate,collider};
    }
    if (!hit) return null;
    const surface = this.surface.get(hit.collider.handle);
    const interval = surface.kind === 'human' ? null : boxInterval(origin, direction, surface.definition);
    const normal = new Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    if (normal.lengthSq() < 1e-12) normal.copy(direction).negate();
    const point = origin.clone().addScaledVector(direction, hit.timeOfImpact);
    return { ...surface, handle: hit.collider.handle, interval, distance: hit.timeOfImpact, point, normal,
      ...(surface.kind === 'human' ? { address: resolveBodyAddress(surface.actor, surface.shape, point, direction, this.humanRigs.get(surface.actor.id)) } : {}) };
  }
  bodyPaths(origin, direction, distance) {
    const byActor = new Map();
    for (const sensor of this.humanSensors) {
      const { actor, shape, pose, triangles } = sensor, inverse = pose.rotation.clone().invert();
      const localOrigin = origin.clone().sub(pose.position).applyQuaternion(inverse), localDirection = direction.clone().applyQuaternion(inverse);
      const intervals = solidMeshIntervals(triangles, localOrigin, localDirection, distance);
      if (!byActor.has(actor)) byActor.set(actor, []);
      for (const interval of intervals) byActor.get(actor).push({ ...interval, shape,
        normal: interval.normal.clone().applyQuaternion(pose.rotation) });
    }
    const paths=[...byActor].flatMap(([actor, intervals]) => unionBodyIntervals(intervals).map(path => {
      const point = origin.clone().addScaledVector(direction, path.entry), normal = path.source.normal.clone();
      if (normal.lengthSq() < 1e-12) normal.copy(direction).negate();
      return { ...path, actor, point, normal, direction: direction.clone(),
        cells: path.cells.map(cell => ({ ...cell, address: resolveBodyAddress(actor, cell.shape,
          origin.clone().addScaledVector(direction, cell.entry), direction, this.humanRigs.get(actor.id)) })),
        address: resolveBodyAddress(actor, path.source.shape, point, direction, this.humanRigs.get(actor.id)) };
    })).sort((a, b) => a.entry - b.entry);
    const sides=this.armorSensors.filter(r=>r.shape.kind==='plate'&&['left','right'].includes(r.shape.slot)&&byActor.has(r.actor));if(!paths.length||!sides.length)return paths;
    const scope=Object.create(this);scope.armorSensors=sides;return partitionBodyAtSidePlates(paths,scope.armorContacts(origin,direction,distance));
  }
  // Conservative 3 m spheres cover the current soldier and all supported poses.
  // Flight chords away from actors skip expensive full mesh intersections.
  hasHumanPath(origin,direction,distance) {
    for(const actor of this.internalActors.values()) {
      const offset=new Vector3(...actor.at).add(new Vector3(0,.9,0)).sub(origin);
      if(actor.ballisticCenter)offset.fromArray(actor.ballisticCenter).sub(origin);
      const along=Math.max(0,Math.min(distance,offset.dot(direction)));
      if(offset.addScaledVector(direction,-along).lengthSq()<=9)return true;
    }
    return false;
  }
  relocate(spawn) {
    const p={x:spawn.x,y:this.half+PLAYER.radius+.02,z:spawn.z};
    this.body.setTranslation(p,true);this.body.setNextKinematicTranslation(p);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.velocity.set(0,0,0);this.movementVelocity.set(0,0,0);this.grounded=false;
    this.world.step();this.sync();
  }
  // Observe only the real air segment, capped at its next body/barrier contact.
  // Sensors do not change the ballistic ray, movement, score or gameplay RNG.
  armorContacts(origin, direction, distance) {
    const ray = new RAPIER.Ray(origin, direction), contacts = [];
    for (const { collider, actor, shape, ownerId, pose, triangles } of this.armorSensors) {
      if (shape.kind === 'plate') {
        const inverse = pose.rotation.clone().invert();
        const intervals = solidMeshIntervals(triangles, origin.clone().sub(pose.position).applyQuaternion(inverse), direction.clone().applyQuaternion(inverse), distance);
        if (!intervals.length) continue;
        const first = intervals[0], last = intervals.at(-1);
        const point = origin.clone().addScaledVector(direction, first.entry), normal = first.normal.clone().applyQuaternion(pose.rotation);
        const cosine = Math.min(1, Math.abs(normal.dot(direction)));
        const pathLengthM = intervals.reduce((sum, interval) => sum + interval.exit - interval.entry, 0);
        contacts.push({ targetId: actor.id, layerId: shape.id, kind: shape.kind, slot: shape.slot, itemId: shape.itemId, ownerId,
          material: CATALOG.PLATE_REGISTRY[shape.itemId].armor.material, armorValue: CATALOG.PLATE_REGISTRY[shape.itemId].armor.hardArmor,
          shapePoint: point.clone().sub(pose.position).applyQuaternion(inverse).toArray(),
          geometry: 'curved-solid', entryDistance: first.entry, exitDistance: last.exit, point: point.toArray(),
          localPoint: point.clone().sub(new Vector3(...actor.at)).applyQuaternion(actorRotation(actor).invert()).toArray(),
          exitPoint: origin.clone().addScaledVector(direction, last.exit).toArray(), normal: normal.toArray(),
          materialIntervals: intervals.map(({ entry, exit, normal, startsInside, completeExit }) => ({ entryDistance: entry, exitDistance: exit,
            startsInside, completeExit, normal: normal.clone().applyQuaternion(pose.rotation).toArray(),
            shapePoint: origin.clone().addScaledVector(direction, entry).sub(pose.position).applyQuaternion(inverse).toArray() })),
          pathLengthM, losMm: pathLengthM * 1000, thicknessMm: shape.thickness * 1000,
          incidenceDeg: first.startsInside ? null : Math.acos(cosine) * 180 / Math.PI,
          startsInside: first.startsInside, completeExit: last.completeExit });
        continue;
      }
      const entry = collider.castRayAndGetNormal(ray, distance, true);
      if (!entry) continue;
      const point = origin.clone().addScaledVector(direction, entry.timeOfImpact);
      const normal = new Vector3(entry.normal.x, entry.normal.y, entry.normal.z);
      const localPoint = point.clone().sub(new Vector3(...actor.at)).applyQuaternion(actorRotation(actor).invert());
      const cosine = normal.lengthSq() ? Math.min(1, Math.abs(normal.clone().normalize().dot(direction))) : null;
      // Both source and authored soft triangles record a surface, not a slab.
      // Never report the torso/air chord between front and rear as armor LOS.
      const helmetRegion = shape.kind === 'helmet' && Math.abs(normal.clone().applyQuaternion(pose.rotation.clone().invert()).x) > .65 ? 'temporal' : 'skull';
      const shellSurface = shape.kind === 'helmet' ? firstMeshSurface(triangles,
        origin.clone().sub(pose.position).applyQuaternion(pose.rotation.clone().invert()),
        direction.clone().applyQuaternion(pose.rotation.clone().invert()), distance) : null;
      contacts.push({ targetId: actor.id, layerId: shape.id, kind: shape.kind, slot: shape.slot, itemId: shape.itemId, ownerId, helmetRegion,
        ...(shellSurface?.exitingSurface ? { exitingSurface: true } : {}),
        geometry: 'mesh-surface', entryDistance: entry.timeOfImpact, exitDistance: null,
        protectionModel: shape.protectionModel, material: shape.material,
        armorValue: shape.kind === 'helmet' ? CATALOG.HELMET_REGISTRY[shape.itemId].protection[helmetRegion].shellArmor : shape.armorValue,
        normalPathRatio: cosine !== null && cosine > 1e-6 ? 1 / cosine : null,
        point: point.toArray(), localPoint: localPoint.toArray(), exitPoint: null, normal: normal.toArray(),
        pathLengthM: null, losMm: null, thicknessMm: null, startsInside: null, completeExit: null,
        incidenceDeg: cosine === null ? null : Math.acos(cosine) * 180 / Math.PI });
    }
    return prioritizeArmorContacts(contacts);
  }
  muzzleBlocked(shoulder, muzzle, direction) {
    const delta = muzzle.clone().sub(shoulder);
    const length = delta.length();
    if (length > 0.01 && this.ray(shoulder, delta.divideScalar(length), length + 0.025)) return true;
    return Boolean(this.ray(muzzle, direction, 0.13));
  }
  reset() {
    this.armorCondition.reset();
    this.sprinting=false;
    this.crouched = false; this.half = PLAYER.standHalf;
    this.collider.setShape(new RAPIER.Capsule(this.half, PLAYER.radius));
    const p = { x: PLAYER.spawn.x, y: this.half + PLAYER.radius + 0.02, z: PLAYER.spawn.z };
    this.body.setTranslation(p, true); this.body.setNextKinematicTranslation(p);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.velocity.set(0, 0, 0); this.movementVelocity.set(0,0,0); this.world.step(); this.sync();
  }
  dispose() { for(const rig of this.humanRigs.values())rig.dispose();this.world.free(); }
}
