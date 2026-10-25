import { createLens } from './lens.js';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOXES, TARGETS, LOOT_CRATE, RANGE_LANES, LONG_RANGE } from './config.js';

export function rangePlyLabel(lane) {
  const mm = value => `${Math.round(value * 10000) / 10} mm`;
  if (lane.plies.length === 1) return mm(lane.plies[0].thicknessM);
  if (lane.plies.length === 6 && lane.plies.every(p => p.thicknessM === lane.plies[0].thicknessM) &&
      [0, 2, 4].every(i => lane.plies[i].gapAfterM === lane.plies[0].gapAfterM) && lane.plies[1].gapAfterM === lane.plies[3].gapAfterM)
    return `${mm(lane.plies[0].thicknessM)} × 2 (${mm(lane.plies[0].gapAfterM)}) × 3 · 벽 간격 ${mm(lane.plies[1].gapAfterM)}`;
  if (lane.plies.every(p => p.thicknessM === lane.plies[0].thicknessM))
    return `${mm(lane.plies[0].thicknessM)} × ${lane.plies.length} (간격 ${mm(lane.plies[0].gapAfterM)})`;
  return lane.plies.map((ply, i) => `${mm(ply.thicknessM)}${i < lane.plies.length - 1 ? ` + 간격 ${mm(ply.gapAfterM)}` : ''}`).join(' + ');
}

function labelTexture(text, subtext, background = '#182426', color = '#dcddcc', fit = false) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = background; context.fillRect(0, 0, 512, 256);
  context.strokeStyle = '#b6aa68'; context.lineWidth = 5; context.strokeRect(12, 12, 488, 232);
  context.fillStyle = color; context.font = 'bold 76px sans-serif'; context.textAlign = 'center'; context.fillText(text, 256, 122, ...(fit ? [480] : []));
  context.font = '24px sans-serif'; context.fillText(subtext, 256, 182, ...(fit ? [480] : []));
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
function concreteTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const noise = ((i * 1664525 + 1013904223) >>> 16) % 20;
    pixels.data[i] = 117 + noise; pixels.data[i + 1] = 116 + noise; pixels.data[i + 2] = 108 + noise; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  context.strokeStyle = '#626662'; context.lineWidth = 2;
  context.strokeRect(1, 1, 254, 254);
  const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(8, 12); texture.colorSpace = T.SRGBColorSpace; return texture;
}
function targetTexture(number) {
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 576;
  const c = canvas.getContext('2d'); c.fillStyle = '#d4c7a7'; c.fillRect(0, 0, 384, 576);
  c.fillStyle = '#3a3b36'; c.beginPath(); c.arc(192, 104, 40, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(152, 148); c.lineTo(97, 204); c.lineTo(90, 491); c.lineTo(294, 491); c.lineTo(287, 204); c.lineTo(232, 148); c.closePath(); c.fill();
  c.strokeStyle = '#e1d6bb'; c.lineWidth = 2;
  for (const radius of [29, 62, 95]) { c.beginPath(); c.ellipse(192, 292, radius, radius * 1.36, 0, 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = '#b59866'; c.lineWidth = 2; c.beginPath(); c.moveTo(170, 292); c.lineTo(214, 292); c.moveTo(192, 270); c.lineTo(192, 314); c.stroke();
  c.fillStyle = '#3a3b36'; c.font = 'bold 25px sans-serif'; c.textAlign = 'center'; c.fillText(`RANGE / ${number}`, 192, 548);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
function surfaceTexture(material) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = { drywall: '#c6beb0', wood: '#916b43', thin_metal: '#89958e', concrete: '#8a877d', steel: '#445758' }[material];
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = material === 'wood' ? '#4b301c70' : '#242b2445'; c.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const y = i * 8;
    c.beginPath(); c.moveTo(0, y); c.lineTo(128, y + (material === 'wood' ? Math.sin(i * 5) * 5 : 0)); c.stroke();
  }
  if (material === 'wood' || material === 'drywall') { c.lineWidth = 2; c.strokeRect(1, 1, 126, 126); }
  if (material === 'thin_metal' || material === 'steel') for (const x of [8, 120]) for (const y of [8, 120]) { c.fillStyle = '#202b29'; c.fillRect(x, y, 3, 3); }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
export function createScene(canvas, quality = 'balanced') {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const lens = createLens(renderer);
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene(); scene.background = new T.Color('#8d9b9d'); scene.fog = new T.Fog('#8d9b9d', 32, 75);
  const camera = new T.PerspectiveCamera(66, innerWidth / innerHeight, 0.015, 700);
  scene.add(new T.HemisphereLight(0xd6e6e8, 0x574b34, 2.0));
  const sun = new T.DirectionalLight(0xffecd2, 3.2); sun.position.set(-6, 9, 4); scene.add(sun);
  const environment = new RoomEnvironment(); const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment).texture; scene.environmentIntensity = 0.38;
  environment.dispose(); pmrem.dispose();
  const stone = new T.MeshStandardMaterial({ color: '#737b77', roughness: 0.92 });
  const trim = new T.MeshStandardMaterial({ color: '#303d3b', roughness: 0.7, metalness: 0.3 });
  const floor = new T.MeshStandardMaterial({ color: '#9e9a87', map: concreteTexture(), roughness: 0.96 });
  const crate = new T.MeshStandardMaterial({ color: '#5e6448', roughness: 0.8, metalness: 0.15 });
  const cover = new T.MeshStandardMaterial({ color: '#a6977a', roughness: 0.9 });
  const geometry = new T.BoxGeometry(1, 1, 1);
  const materials = Object.fromEntries(['drywall', 'wood', 'thin_metal', 'concrete', 'steel'].map(id => [id,
    new T.MeshStandardMaterial({ map: surfaceTexture(id), roughness: ['steel', 'thin_metal'].includes(id) ? 0.45 : 0.94,
      metalness: ['steel', 'thin_metal'].includes(id) ? 0.7 : 0 })]));
  materials.glass = new T.MeshStandardMaterial({ color: '#b3dee0', roughness: 0.2, transparent: true, opacity: 0.36, depthWrite: false });
  function box(at, size, material) { const mesh = new T.Mesh(geometry, material); mesh.position.fromArray(at); mesh.scale.fromArray(size); scene.add(mesh); return mesh; }
  for (const definition of BOXES) {
    box(definition.at, definition.size, definition.kind === 'barrier' ? materials[definition.material] : definition.kind === 'floor' ? floor : definition.kind === 'cover' ? cover : ['crate', 'loot'].includes(definition.kind) ? crate : stone);
    if (definition.kind === 'wall') {
      const height = definition.size[1];
      box([definition.at[0], height - 0.1, definition.at[2]], [definition.size[0] + 0.02, 0.18, definition.size[2] + 0.02], trim);
      box([definition.at[0], 0.2, definition.at[2]], [definition.size[0] + 0.02, 0.28, definition.size[2] + 0.02], trim);
    }
  }
  const [cx, cy, cz] = LOOT_CRATE.at;
  box([cx, cy + 0.44, cz], [0.95, 0.08, 0.75], trim);
  for (const x of [-0.32, 0.32]) box([cx + x, cy, cz + 0.36], [0.055, 0.52, 0.025], trim);
  const ammoLabel = new T.Mesh(new T.PlaneGeometry(0.55, 0.28), new T.MeshStandardMaterial({ map: labelTexture('5.56', 'AMMUNITION', '#3a432c'), roughness: 0.8 }));
  ammoLabel.position.set(cx, cy + 0.05, cz + 0.363); scene.add(ammoLabel);
  const marking = new T.MeshBasicMaterial({ color: '#b5a66a' });
  for (const x of [-1.3, 1.3]) box([x, 0.006, 1.7], [0.04, 0.008, 11.5], marking);
  box([0, 0.008, 3.65], [2.6, 0.008, 0.07], marking);
  for (const z of [-2, -6, -10, -14]) {
    box([0, 3.32, z], [17.7, 0.12, 0.18], trim);
    box([-6.4, 3.17, z], [2.2, 0.05, 0.13], new T.MeshBasicMaterial({ color: '#eee0b3' }));
  }
  // Visual windows are emissive panels; their collision remains the wall definition.
  const windowMaterial = new T.MeshBasicMaterial({ color: '#acced3' });
  for (const z of [2, -5, -12]) {
    box([-8.755, 2.0, z], [0.012, 1.25, 2.6], windowMaterial);
    for (const y of [1.37, 2.64]) box([-8.735, y, z], [0.045, 0.055, 2.7], trim);
    box([-8.72, 2.0, z], [0.045, 1.3, 0.06], trim);
  }
  const rangeSign = new T.Mesh(new T.PlaneGeometry(2.4, 1.2), new T.MeshStandardMaterial({ map: labelTexture('SECTOR 01', 'TRAINING / LIVE FIRE'), roughness: 0.9 }));
  rangeSign.position.set(-5.2, 2.05, -2.83); scene.add(rangeSign);
  const exitSign = new T.Mesh(new T.PlaneGeometry(1.8, 0.7), new T.MeshBasicMaterial({ map: labelTexture('RANGE', '03 / END WALL', '#242d2a') }));
  exitSign.position.set(0, 2.8, -16.73); scene.add(exitSign);
  function sign(text, subtext, at, width = 1.9, height = 0.7, fit = false) {
    const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map: labelTexture(text, subtext, '#182426', '#dcddcc', fit) }));
    mesh.position.fromArray(at); scene.add(mesh); return mesh;
  }
  sign('관통 시험장 →', 'SECTOR 02 / 오른쪽 통로', [5.3, 2.6, 0.2], 3.4, 0.9);
  sign('SECTOR 02', 'MATERIAL / PENETRATION', [20, 2.85, -30.68], 5, 1.15);
  for (const lane of RANGE_LANES) {
    const thickness = rangePlyLabel(lane);
    const panelSign = sign(lane.label, thickness, [lane.x, 2.88, lane.panelZ + 0.56], 1.9, .7, true);
    panelSign.name = `sign-${lane.id}`;
    sign(lane.number, '사격선 / 표적 12 m', [lane.x, 0.35, lane.firingZ - 0.3], 1.2, 0.45);
    box([lane.x, 0.008, lane.firingZ], [1.8, 0.012, 0.07], marking);
    for (const x of [lane.x - 0.92, lane.x + 0.92]) box([x, 0.008, -14], [0.02, 0.01, 18], marking);
  }
  // A floor route leads through the existing room's new right-side passage.
  for (const x of [5, 7, 10, 13, 16, 19]) box([x, 0.009, 3.9], [0.8, 0.01, 0.16], marking);
  for (const z of [1, -2, -5]) box([20, 0.009, z], [0.16, 0.01, 0.8], marking);
  sign('장거리 사격장 →','SECTOR 03 / 100–500 m',[27,2.6,3.8],3.8,.85);
  sign('100–500 m','SECTOR 03 / 사격선 기준 거리',[44,3,7.5],7,1.1).rotation.y=Math.PI;
  for(const lane of LONG_RANGE.lanes){
    sign(`${lane.distanceM} m`,'위로 조준해 낙차를 보정하세요',[lane.x,.55,2.5],2,.6);
    box([lane.x,.008,LONG_RANGE.firingZ],[2.8,.012,.08],marking);
    for(const x of [lane.x-1.7,lane.x+1.7])box([x,.008,(LONG_RANGE.firingZ+lane.z)/2],[.025,.012,lane.distanceM],marking);
    sign(`${lane.distanceM} m`,'DISTANCE',[lane.x,2.6,lane.z],2.5,.7);
  }
  for(const distance of [50,100,200,300,400,500])box([44,.006,3-distance],[25,.008,.05],marking);
  const targets = new Map();
  for (const target of TARGETS) {
    const material = new T.MeshStandardMaterial({ map: targetTexture(target.number), roughness: 0.9, color: '#fff5dc' });
    const board = new T.Mesh(new T.BoxGeometry(0.78, 1.16, 0.11), material);
    board.position.set(target.x, 1.5, target.z); board.rotation.y = target.yaw; scene.add(board);
    targets.set(target.id, { mesh: board, pulse: 0, hits: 0 });
    box([target.x, 0.45, target.z], [0.065, 0.9, 0.08], trim);
    box([target.x, 0.05, target.z], [0.8, 0.1, 0.5], trim);
  }
  function resize(mode = quality) {
    quality = mode; lens.resize(mode);
    const cap = mode === 'low' ? 1 : 1.35;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cap)); renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  resize();
  return { renderer, scene, camera, targets, resize, lens, render: () => lens.render(scene, camera),
    setLongRange: enabled => { scene.fog.near=enabled?250:32;scene.fog.far=enabled?680:75; },
    resetTargets: () => { for (const target of targets.values()) { target.hits = target.pulse = 0; target.mesh.material.emissive.setHex(0); } },
    targetTick: dt => { for (const target of targets.values()) { target.pulse = Math.max(0, target.pulse - dt * 4); target.mesh.material.emissive.setRGB(target.pulse * 0.16, target.pulse * 0.28, target.pulse * 0.11); } } };
}
