export const STEP = 1 / 60;
export const PLAYER = { radius: 0.27, standHalf: 0.55, crouchHalf: 0.26, standView: 1.43, crouchView: 0.98, speed: 1.6, crouchSpeed: 0.85, spawn: { x: 0, z: 5.2 } };
export const GUN = { eyeRelief: 0.075, hipOffset: [0.155, -0.145, -0.335], hipRoll: 0.17, walkVertical: 0.75 };
// Canonical model axes: +X right, +Y up, -Z barrel direction.
// Markers were calibrated on the supplied, normalized M4A1; they are not physics proxies.
export const MARKERS = {
  muzzle: [0, 0.0585, -0.405],
  breech: [0.022, 0.052, 0.004],
  // Rear aperture center (eye-facing plane), and the actual front post tip.
  sight: [0, 0.1266834, 0.155173],
  frontSight: [0, 0.1235896, -0.2284125],
  grip: [0, -0.049, 0.105],
};
export const RANGE_LANES = Object.freeze([
  // null armor means uncalibrated legacy fallback, not an invented real-world rating.
  { id: 'drywall', x: 11.5, material: 'drywall', label: '석고벽 25 mm (12.5 mm × 2 상당)', plies: [{ thicknessM: .025, gapAfterM: 0, armor: null }] },
  { id: 'wood', x: 14, material: 'wood', label: '합판', plies: [{ thicknessM: .018, gapAfterM: 0, armor: null }] },
  { id: 'glass', x: 16.5, material: 'glass', label: '판유리', plies: [{ thicknessM: .006, gapAfterM: 0, armor: null }] },
  { id: 'metal', x: 19, material: 'thin_metal', label: '얇은 강판', plies: [{ thicknessM: .0015, gapAfterM: 0, armor: null }] },
  { id: 'concrete', x: 21.5, material: 'concrete', label: '중공 콘크리트 블록 190 mm', plies: [{ thicknessM: .032, gapAfterM: .126, armor: null }, { thicknessM: .032, gapAfterM: 0, armor: null }] },
  { id: 'steel', x: 24, material: 'steel', label: '장갑 강판', plies: [{ thicknessM: .010, gapAfterM: 0, armor: null }] },
  { id: 'thick-wood', x: 26.5, material: 'wood', label: '원목 각재', plies: [{ thicknessM: .200, gapAfterM: 0, armor: null }] },
  { id: 'layers', x: 29, material: 'drywall', label: '석고벽 25 mm × 3 (간격 1.0 m)', plies: Array.from({ length: 3 }, (_, i) => ({ thicknessM: .025, gapAfterM: i < 2 ? 1 : 0, armor: null })) },
].map((lane, index) => Object.freeze({ ...lane, number: String(index + 4).padStart(2, '0'), firingZ: -8, panelZ: -16, targetZ: -20 })));
export const LONG_RANGE = Object.freeze({spawn:{x:38,z:5.2},firingZ:3,maxShotDistance:620,
  lanes:Object.freeze([100,200,300,400,500].map((distanceM,i)=>Object.freeze({id:`LR${distanceM}`,x:38+i*4,z:3-distanceM,yaw:0,number:`${distanceM} m`,distanceM,firingZ:3}))) });
export const TARGETS = [
  { id: 'T01', x: 0, z: -6.8, yaw: 0, number: '01' },
  { id: 'T02', x: -3.8, z: -11.2, yaw: 0.17, number: '02' },
  { id: 'T03', x: 4.2, z: -13.8, yaw: -0.15, number: '03' },
  ...RANGE_LANES.map(lane => ({ id: `T-${lane.id}`, x: lane.x, z: lane.targetZ, yaw: 0, number: lane.number })),
  ...LONG_RANGE.lanes,
];
export const BARRIERS = RANGE_LANES.flatMap(lane => {
  let consumed = 0;
  return lane.plies.map((ply, i) => {
    const z = lane.panelZ + lane.plies[0].thicknessM / 2 - consumed - ply.thicknessM / 2;
    consumed += ply.thicknessM + ply.gapAfterM;
    return { id: `panel-${lane.id}-${i + 1}`, at: [lane.x, 1.4, z], size: [1.7, 2.4, ply.thicknessM],
      kind: 'barrier', material: lane.material, nominalThicknessM: ply.thicknessM, armor: ply.armor, penetrable: true };
  });
});
export const LOOT_CRATE = Object.freeze({ id: 'ammo-crate', at: [-1.7, 0.45, 2.2], size: [0.9, 0.9, 0.7], kind: 'loot', range: 2.1 });
export const BOXES = [
  LOOT_CRATE,
  { id: 'floor', at: [11, -0.15, -11], size: [40, 0.3, 40], kind: 'floor', material: 'concrete', penetrable: false },
  { id: 'back', at: [0, 1.7, -16.9], size: [18, 3.4, 0.25], kind: 'wall', penetrable: false },
  { id: 'left', at: [-8.9, 1.7, -11], size: [0.25, 3.4, 40], kind: 'wall', penetrable: false },
  { id: 'right', at: [8.9, 1.7, -8.5], size: [0.25, 3.4, 17], kind: 'wall' },
  { id: 'right-rear', at: [8.9, 1.7, 7.75], size: [0.25, 3.4, 2.2], kind: 'wall' },
  { id: 'rear', at: [11, 1.7, 8.85], size: [40, 3.4, 0.25], kind: 'wall', penetrable: false },
  { id: 'annex-right', at: [30.85, 1.7, -15.5], size: [0.3, 3.4, 31], kind: 'wall', penetrable: false },
  { id: 'annex-right-rear', at: [30.85, 1.7, 7.5], size: [0.3, 3.4, 3], kind: 'wall', penetrable: false },
  { id: 'annex-back', at: [20, 1.7, -30.85], size: [22, 3.4, 0.3], kind: 'wall', penetrable: false },
  { id: 'annex-divider', at: [8.9, 1.7, -23.9], size: [0.3, 3.4, 14], kind: 'wall', penetrable: false },
  { id: 'partition-left', at: [-5.3, 1.7, -3], size: [5.8, 3.4, 0.3], kind: 'wall' },
  { id: 'partition-right', at: [5.3, 1.7, -8.5], size: [5.8, 3.4, 0.3], kind: 'wall' },
  { id: 'low-cover', at: [0.9, 0.56, -1.8], size: [2.4, 1.12, 0.75], kind: 'cover' },
  { id: 'crate-left', at: [-4.1, 0.6, 1], size: [1.15, 1.2, 1.15], kind: 'crate' },
  { id: 'crate-right', at: [5.3, 0.44, -11], size: [1.8, 0.88, 0.9], kind: 'crate' },
  { id: 'long-floor', at: [44, -.15, -250], size: [26,.3,518], kind: 'floor', material: 'concrete', penetrable: false },
  { id: 'long-left', at: [31.05, 2.5, -254], size: [.3,5,508], kind: 'wall', penetrable: false },
  { id: 'long-right', at: [57, 2.5, -250], size: [.3,5,518], kind: 'wall', penetrable: false },
  { id: 'long-rear', at: [44, 2.5, 8.85], size: [26,5,.3], kind: 'wall', penetrable: false },
  { id: 'long-backstop', at: [44, 4, -508], size: [26,8,1], kind: 'wall', penetrable: false },
  ...BARRIERS,
].map(box => ({ material: ['crate', 'loot'].includes(box.kind) ? 'wood' : 'concrete', ...box,
  nominalThicknessM: box.nominalThicknessM ?? Math.min(...box.size) }));
