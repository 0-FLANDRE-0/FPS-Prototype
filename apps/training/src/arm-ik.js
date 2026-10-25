import * as T from 'three';
import {STOCK_CONTACTS} from './weapon-data.js';
export const worldPosition=node=>node.getWorldPosition(new T.Vector3());
export function setWorldPosition(node,point){node.position.copy(node.parent.worldToLocal(point.clone()));node.updateMatrixWorld(true);}
export function rotateWorld(node,rotation){const parent=node.parent.getWorldQuaternion(new T.Quaternion()),q=node.getWorldQuaternion(new T.Quaternion()).premultiply(rotation);node.quaternion.copy(parent.invert().multiply(q));node.updateMatrixWorld(true);}
// Joint centers sit behind the shoulder surface that touches the butt pad.
// A slight bladed stance brings the support shoulder forward. Rifle animation
// can leave this contact during reload/draw without moving the body with it.
export function weaponShoulders(rig,bodyFrame,id){
 const q=new T.Quaternion().setFromRotationMatrix(bodyFrame),offset=(x,y,z)=>new T.Vector3(x,y,z).applyQuaternion(q),surface=rig.localToWorld(new T.Vector3(...STOCK_CONTACTS[id]));
 const R=surface.clone().add(offset(0,0,.06)),L=R.clone().add(offset(-.34,0,-.13));
 return{surface,R,L,poles:{R:R.clone().add(offset(.15,-.33,-.03)),L:L.clone().add(offset(-.12,-.30,-.04))}};
}
// Retarget a supplied display gesture to the fixed anatomical reach. Keep the
// upper/forearm lengths intact and leave a small bend at maximum extension.
export function reachableHandGoal(upper,forearm,wrist,goal){
 const start=worldPosition(upper),length=start.distanceTo(worldPosition(forearm))+worldPosition(forearm).distanceTo(worldPosition(wrist)),delta=goal.clone().sub(start),distance=delta.length(),limit=length*.985;
 return distance>limit?start.addScaledVector(delta,limit/distance):goal.clone();
}
// Analytic two-joint IK with a body elbow hint (or native pole) and fixed lengths.
export function solveArm(upper,forearm,wrist,goal,polePoint){
 const a=worldPosition(upper),b=worldPosition(forearm),c=worldPosition(wrist),ab=a.distanceTo(b),bc=b.distanceTo(c),axis=goal.clone().sub(a),distance=axis.length();axis.normalize();
 const d=T.MathUtils.clamp(distance,Math.abs(ab-bc)+1e-6,ab+bc-1e-6),x=(ab*ab-bc*bc+d*d)/(2*d),height=Math.sqrt(Math.max(0,ab*ab-x*x));
 let pole=(polePoint||b).clone().sub(a);pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-10)pole.set(1,0,0).cross(axis);pole.normalize();
 const elbow=a.clone().addScaledVector(axis,x).addScaledVector(pole,height),end=a.clone().addScaledVector(axis,d);
 rotateWorld(upper,new T.Quaternion().setFromUnitVectors(b.clone().sub(a).normalize(),elbow.clone().sub(a).normalize()));
 const nowB=worldPosition(forearm),nowC=worldPosition(wrist);rotateWorld(forearm,new T.Quaternion().setFromUnitVectors(nowC.sub(nowB).normalize(),end.clone().sub(nowB).normalize()));
 return {unreachableM:Math.max(0,Math.abs(ab-bc)-distance,distance-ab-bc)};
}
