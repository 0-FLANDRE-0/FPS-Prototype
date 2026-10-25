// AI-1 room, route and behavior values are game tuning, not original CQB AI.
export const COMBAT=Object.freeze({sector:'04',spawn:{x:73.2,z:5},panel:{id:'combat-panel',at:[71.78,1.2,4],size:[.10,.5,.4],range:1.8},
 enemySpawn:[79,0,-7.4],route:[[80.1,0,-7.4],[80.1,0,-4.2],[75.8,0,-4.2],[74.5,0,-3]],roomSizeM:[6,8],walkSpeedMps:1.4,
 visionFovDeg:120,reactionS:[.25,.45],shotIntervalS:[.25,.5],aimStartDeg:8,aimFloorDeg:.35,aimConvergencePerS:4.5,
 bodyMassKg:80,rounds:30,ammoId:'545_ps_gs',maximumEnemies:1});
export const COMBAT_BOXES=Object.freeze([
 {id:'combat-floor',at:[75.5,-.15,-.2],size:[11,.3,18],kind:'floor',material:'concrete',penetrable:false},
 {id:'combat-west',at:[70.85,1.6,-3],size:[.3,3.2,8.3],material:'concrete',penetrable:false},
 {id:'combat-back',at:[74,1.6,-7.15],size:[6.3,3.2,.3],material:'concrete',penetrable:false},
 {id:'combat-spawn-divider-back',at:[77.15,1.6,-6.15],size:[.3,3.2,2.3],material:'concrete',penetrable:false},
 {id:'combat-spawn-divider-front',at:[77.15,1.6,-.85],size:[.3,3.2,5.1],material:'concrete',penetrable:false},
 {id:'combat-entry-baffle',at:[78.9,1.6,-2.85],size:[3.6,3.2,.3],material:'concrete',penetrable:false},
 {id:'combat-hidden-spawn-baffle',at:[78.45,1.6,-5.7],size:[2.5,3.2,.3],material:'concrete',penetrable:false},
 {id:'combat-spawn-east',at:[80.65,1.6,-5.55],size:[.3,3.2,7.3],material:'concrete',penetrable:false},
 {id:'combat-spawn-back',at:[79,1.6,-9.15],size:[3.6,3.2,.3],material:'concrete',penetrable:false},
 {id:'combat-front-drywall',at:[72.05,1.6,1.05],size:[2.1,3.2,.025],material:'drywall',penetrable:true},
 {id:'combat-front-plywood',at:[75.95,1.6,1.05],size:[2.1,3.2,.018],material:'wood',penetrable:true},
 {id:'combat-hall-west',at:[71.6,1.6,4.95],size:[.25,3.2,7.8],material:'concrete',penetrable:false},
 {id:'combat-hall-east',at:[76.4,1.6,4.95],size:[.25,3.2,7.8],material:'concrete',penetrable:false},
 {id:'combat-hall-end',at:[74,1.6,8.85],size:[5,3.2,.3],material:'concrete',penetrable:false},
 {id:'combat-low-cover',at:[74,.48,-.6],size:[1.3,.96,.45],material:'concrete',penetrable:false},
].map(b=>Object.freeze({kind:'barrier',nominalThicknessM:Math.min(...b.size),...b})));
