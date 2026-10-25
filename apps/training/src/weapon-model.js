import * as T from 'three';
import {LEAN} from './lean.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MARKERS } from './config.js';
import { createFPSArms } from './fps-arms.js';
import { weaponMarkers, STOCK_CONTACTS } from './weapon-data.js';
import {loadVudu} from './optic-model.js';

export async function loadWeapon(scene) {
  const encoded = document.getElementById('weapon-data').textContent.trim();
  const binary = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(binary.buffer, '');
  const original = gltf.scene.getObjectByName('M4A1');
  const casing = gltf.scene.getObjectByName('SpentCasing');
  if (!original || !casing) throw new Error('M4A1 / spent casing missing from the embedded model');
  const rig = new T.Group(); rig.name = 'WeaponRig';
  original.removeFromParent(); rig.add(original); scene.add(rig);
  original.updateMatrix();const m4RootRest=original.matrix.clone();original.matrixAutoUpdate=false;
  original.traverse(node => { if (node.isMesh) node.frustumCulled = false; });
  const bolt = original.getObjectByName('bolt');
  const magazine = original.getObjectByName('magazine');
  const chargingHandle = original.getObjectByName('charging_handle');
  const selector=original.getObjectByName('selector'),selectorStart=selector?.quaternion.clone();
  const startBolt = bolt?.position.clone(); const startMagazine = magazine?.position.clone(); const startHandle = chargingHandle?.position.clone();
  const previous = { position: new T.Vector3(), quaternion: new T.Quaternion(), scale: 1 };
  const current = { position: new T.Vector3(), quaternion: new T.Quaternion(), scale: 1 };
  const muzzle = new T.Object3D(); muzzle.position.fromArray(MARKERS.muzzle); rig.add(muzzle);
  const rearSight = new T.Object3D(); rearSight.position.fromArray(MARKERS.sight); rig.add(rearSight);
  const frontSight = new T.Object3D(); frontSight.position.fromArray(MARKERS.frontSight); rig.add(frontSight);
  const brassMesh = (() => { let first; casing.traverse(node => { if (node.isMesh && !first) first = node; }); return first; })();
  if (!brassMesh) throw new Error('Spent casing mesh missing');
  const brass = { geometry: brassMesh.geometry, material: brassMesh.material };
  const [fps,optic]=await Promise.all([createFPSArms(rig),loadVudu(original,m4RootRest)]);
  const spareMagazine=magazine?.clone();if(spareMagazine){original.add(spareMagazine);spareMagazine.visible=false;}
  function capture(state) {
    previous.position.copy(current.position); previous.quaternion.copy(current.quaternion); previous.scale = current.scale;
    current.position.copy(state.position); current.quaternion.copy(state.quaternion); current.scale = state.scale;
  }
  return { rig, brass, fps, optic, capture,m4Spare:spareMagazine, reset:()=>fps.reset(), snap: state => { capture(state); previous.position.copy(current.position); previous.quaternion.copy(current.quaternion); previous.scale = current.scale; },
    render: (alpha, shotAge, inventory,pose={}) => {
      rig.visible = Boolean(inventory.weapon);
      const ak=inventory.weapon?.definitionId==='ak74m';original.visible=inventory.weapon?.definitionId==='m4a1';
      optic.sync(inventory,fps.scar);
      original.matrix.copy(m4RootRest);
      const markers=weaponMarkers(inventory.weapon?.definitionId);muzzle.position.fromArray(markers.muzzle);rearSight.position.fromArray(markers.sight);frontSight.position.fromArray(markers.frontSight);
      const action = inventory.action;
      const reloadProgress = action && ['reload', 'insert', 'remove', 'rack'].includes(action.kind) ? action.elapsed / action.duration : 0;
      rig.position.lerpVectors(previous.position, current.position, alpha); rig.quaternion.slerpQuaternions(previous.quaternion, current.quaternion, alpha);
      rig.scale.setScalar(T.MathUtils.lerp(previous.scale, current.scale, alpha));
      if(pose.leaning&&pose.physics){
        const start=pose.camera.position.clone().add(new T.Vector3(0,-.07,0).applyQuaternion(pose.leanRotation));
        const end=muzzle.getWorldPosition(new T.Vector3()),delta=end.clone().sub(start),length=delta.length();
        const hit=pose.physics.sweepSphere(start,end,LEAN.muzzleRadiusM);
        if(hit){const allowed=Math.max(0,hit.distance-LEAN.clearanceM);rig.position.add(delta.normalize().multiplyScalar(Math.min(0,allowed-length)));rig.updateMatrixWorld(true);}
      }
      if(selector&&selectorStart){selector.quaternion.copy(selectorStart);const angle={safe:-Math.PI/2,full:0,semi:Math.PI/2}[inventory.weapon?.fireMode]||0;if(angle)selector.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle));}
      if (bolt && startBolt) { bolt.position.copy(startBolt); bolt.position.y -= inventory.weapon?.boltLocked ? 0.045 : Math.max(0, 1 - shotAge / 0.085) * 0.045; }
      if (chargingHandle && startHandle) {
        chargingHandle.position.copy(startHandle);
        const pulling = action?.mode === 'charging';
        const start = action?.kind === 'rack' ? 0.15 : 0.66, end = action?.kind === 'rack' ? 0.8 : 0.94;
        if (pulling && reloadProgress > start && reloadProgress < end) chargingHandle.position.y -= Math.sin((reloadProgress - start) / (end - start) * Math.PI) * 0.055;
      }
      if (magazine && startMagazine) {
        magazine.position.copy(startMagazine);
        magazine.visible = Boolean(inventory.magazine);
        let withdrawal = 0;
        if (action?.kind === 'reload' && !action.removed) withdrawal = Math.min(1, reloadProgress / (action.mode === 'tactical' ? 0.28 : 0.22));
        if (action?.kind === 'remove' && !action.removed) withdrawal = Math.min(1, reloadProgress / 0.6);
        if (action?.inserted) withdrawal = Math.max(0, 1 - (reloadProgress - (action.kind === 'insert' ? 0.5 : action.mode === 'tactical' ? 0.62 : 0.58)) / 0.12);
        magazine.position.z -= withdrawal * 0.25; magazine.rotation.x = withdrawal * 0.12;
      }
      fps.render({...pose,inventory,shotAge,m4Root:original,m4RootRest,m4Magazine:magazine,m4MagazineRest:startMagazine,m4Spare:spareMagazine});
    },
    snapshot: () => { rig.updateMatrixWorld(true); return { muzzle: muzzle.getWorldPosition(new T.Vector3()).toArray(), direction: new T.Vector3(0, 0, -1).applyQuaternion(rig.quaternion).toArray(),
      rearSight: rearSight.getWorldPosition(new T.Vector3()).toArray(), frontSight: frontSight.getWorldPosition(new T.Vector3()).toArray(), scale: rig.scale.x,
      visible: rig.visible, optic:optic.snapshot(), magazineVisible: magazine?.visible, chargingHandleTravel: startHandle && chargingHandle ? startHandle.y - chargingHandle.position.y : 0,
      boltTravel: startBolt && bolt ? startBolt.y - bolt.position.y : 0, arms:fps.snapshot(),
      stockContact:rig.localToWorld(new T.Vector3(...STOCK_CONTACTS[fps.snapshot().weaponId||'m4a1'])).toArray() }; },
  };
}
