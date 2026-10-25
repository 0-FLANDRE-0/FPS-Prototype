import{readFile}from'node:fs/promises';import{createContext,runInContext}from'node:vm';import assert from'node:assert/strict';
import{CATALOG,shotBallistics,compatibleAmmo}from'../apps/training/src/catalog.js';import{createLegacyProtection}from'../apps/training/src/generated/legacy-protection.js';
const plain=v=>JSON.parse(JSON.stringify(v));
export async function verifyAKReference(){
 const root=new URL('../reference/2d/',import.meta.url),c=createContext({console:{log(){},warn(){}}}),manifest=JSON.parse(await readFile(new URL('src/manifest.json',root),'utf8'));
 for(const {path}of manifest.scripts){runInContext(await readFile(new URL(path,root),'utf8'),c,{timeout:5000,filename:path});if(path==='src/data/ammunition-registry.js')break;}
 for(const path of ['src/medical/wound-metadata.js','src/medical/body-trauma.js','src/combat/damage-outcomes.js'])runInContext(await readFile(new URL(path,root),'utf8'),c,{filename:path});runInContext('Math.random=()=>.5',c);
 const legacy=createLegacyProtection(()=>.5,{resolvedScale:false}),rows=[];
 for(const id of compatibleAmmo('ak74m')){
  c.ammo=CATALOG.AMMO_PRESETS[id];const b=shotBallistics(id,'ak74m');assert.equal(b.muzzleVelocityMps,CATALOG.AMMO_VELOCITY[id]*CATALOG.WEAPON_VELOCITY_MUL.ak74);assert.equal(b.weaponMassKg,3.6);
  for(const material of ['ceramic','aramid','pe'])for(const armor of [0,18,32,51]){
   c.material=material;c.armor=armor;const pen=legacy.effectivePenetration(c.ammo,null,material);assert.equal(pen,runInContext('effectivePenetration(ammo,null,material)',c));
   const residual=plain(legacy.buildResidualThreatAfterHard(c.ammo,pen,armor,{},{})),expected=plain(runInContext('buildResidualThreatAfterHard(ammo,effectivePenetration(ammo,null,material),armor,{},{})',c));assert.deepEqual(residual,expected);
   c.wearContext={ammo:c.ammo,material,layerType:material==='aramid'?'soft':'hard',baseArmor:armor,effectiveArmor:armor,shotPenOverride:pen,impactVelocity:b.muzzleVelocityMps,initialVelocity:b.muzzleVelocityMps,armorResult:pen>armor?'penetrated':'stopped',penetrated:pen>armor,localZone:'center',capMaxDurability:48};
   const wear=plain(legacy.computeArmorDurabilityDamage(c.wearContext)),wearExpected=plain(runInContext('computeArmorDurabilityDamage(wearContext)',c));assert.deepEqual(wear,wearExpected);
   rows.push({id,material,armor,pen,residual,expected,wear,wearExpected,exact:true});
  }
 }
 assert.equal(rows.length,156);return{originalVM:true,rows,passed:true};
}
