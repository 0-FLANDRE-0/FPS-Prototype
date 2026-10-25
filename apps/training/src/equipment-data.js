import{combatMassLedger}from'./combat-mass.js';
const kit=combatMassLedger();
export const EQUIPMENT=Object.freeze({ruleId:'equipment-m6-v63',pickupRangeM:2,
 backpackSeconds:{game:1,realistic:2,reality:3.5},gearSeconds:{game:.6,realistic:1.2,reality:2},
 gear:{helmet:{id:'gear-helmet',name:'6B47 헬멧',weightKg:kit.entries.find(e=>e.slot==='helmet').weightKg,size:{w:2,h:2}},rig:{id:'gear-rig',name:'6B45 방호 리그',weightKg:kit.entries.filter(e=>!['helmet','left','right'].includes(e.slot)).reduce((n,e)=>n+e.weightKg,0),size:{w:3,h:3}},belt:{id:'gear-belt',name:'전술 벨트',weightKg:.5,size:{w:2,h:1}},backpack:{id:'gear-backpack',name:'배낭',weightKg:.8,size:{w:3,h:3}}},
 pockets:{rig:[{w:1,h:1},{w:1,h:1},{w:1,h:1},{w:1,h:2},{w:1,h:2},{w:1,h:2},{w:1,h:2},{w:2,h:2}],belt:[{w:1,h:1},{w:1,h:2},{w:1,h:2},{w:1,h:1}]},
 emptyMagazineKg:{scar_762_20:.25,stanag_556_30:.11,ak_545_30:.23},cartridgeToProjectileMass:3,
 loadNoiseAnchors:[[0,.85],[8,1],[13,1.15],[18,1.30]],
 classification:'장비·플레이트 원본 레지스트리 / 벨트·배낭·빈 탄창 질량과 완성탄 질량=탄두×3 튜닝 / 격자·동작 사용자 설계·게임 허용',reversePortCandidate:true,automatic2DPort:false});
export const gearDefinition=item=>item?.kind==='gear'?EQUIPMENT.gear[item.definitionId]:null;
export const pocketInfo=owner=>{const m=/^(rig|belt)(?::(.+))?:pouch-(\d+)$/.exec(owner);if(!m)return null;const index=+m[3]-1,size=EQUIPMENT.pockets[m[1]][index];return size?{slot:m[1],gearId:m[2]||EQUIPMENT.gear[m[1]].id,index,...size}:null;};
export const pocketOwners=(slot,id=EQUIPMENT.gear[slot].id)=>EQUIPMENT.pockets[slot].map((_,i)=>slot+(id===EQUIPMENT.gear[slot].id?'':':'+id)+':pouch-'+(i+1));
export function loadNoiseAtMass(kg){const x=Math.max(0,kg),a=EQUIPMENT.loadNoiseAnchors;for(let i=1;i<a.length;i++)if(x<=a[i][0])return a[i-1][1]+(a[i][1]-a[i-1][1])*(x-a[i-1][0])/(a[i][0]-a[i-1][0]);return a.at(-1)[1]+(x-a.at(-1)[0])*.03;}
