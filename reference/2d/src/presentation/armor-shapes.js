// 2A-2: plateShape별 시각화 polygon (normalized 0~1, bbox에 맞춰 스케일)
//   실제 판정 변경 없음 — UI 시각화 전용. plateId→shape는 getPlateShape() 재사용.
// =============================================================
const PLATE_SHAPE_POLYGONS = {
  // 세로형 torso plate (front/rear) — 상단 양측 컷 중심, 하단은 사각형에 가깝게
  sapi:                 [[0.13,0.00],[0.87,0.00],[1.00,0.16],[1.00,1.00],[0.00,1.00],[0.00,0.16]],
  shooter_cut:          [[0.22,0.00],[0.78,0.00],[1.00,0.30],[1.00,1.00],[0.00,1.00],[0.00,0.30]],
  swimmer_like:         [[0.30,0.00],[0.70,0.00],[1.00,0.42],[1.00,1.00],[0.00,1.00],[0.00,0.42]],
  rounded_swimmer_like: [[0.32,0.00],[0.68,0.00],[0.90,0.12],[1.00,0.40],[1.00,1.00],[0.00,1.00],[0.00,0.40],[0.10,0.12]],
  rectangular:          [[0.00,0.00],[1.00,0.00],[1.00,1.00],[0.00,1.00]],
  fullcut:              [[0.05,0.00],[0.95,0.00],[1.00,0.05],[1.00,1.00],[0.00,1.00],[0.00,0.05]],
  small_fullcut:        [[0.06,0.00],[0.94,0.00],[1.00,0.09],[1.00,1.00],[0.00,1.00],[0.00,0.09]],
  // 측면판 — 세로 직사각형, 상하 모서리만 아주 약하게
  side_plate_small:     [[0.12,0.06],[0.88,0.06],[1.00,0.16],[1.00,0.84],[0.88,0.94],[0.12,0.94],[0.00,0.84],[0.00,0.16]],
  side_plate_large:     [[0.04,0.02],[0.96,0.02],[1.00,0.07],[1.00,0.93],[0.96,0.98],[0.04,0.98],[0.00,0.93],[0.00,0.07]],
  soft_insert:          [[0.07,0.02],[0.93,0.02],[1.00,0.10],[1.00,1.00],[0.00,1.00],[0.00,0.10]],
  // 6B12 가슴판 — 비대칭 (좌측 어깨 넓고 우측 단차). PSD 기반.
  asym_6b12_chest:      [[0.23,0.00],[0.00,0.56],[0.03,0.86],[0.18,1.00],[0.86,1.00],[1.00,0.86],[0.98,0.60],[0.80,0.42],[0.72,0.04]],
};
function _bboxOfPoints(pointsStr) {
  const pts = String(pointsStr).trim().split(/\s+/).map(p => p.split(',').map(Number));
  let minX=1e9, minY=1e9, maxX=-1e9, maxY=-1e9;
  for (const pt of pts) { minX=Math.min(minX,pt[0]); minY=Math.min(minY,pt[1]); maxX=Math.max(maxX,pt[0]); maxY=Math.max(maxY,pt[1]); }
  return { minX, minY, w: maxX-minX, h: maxY-minY };
}
// plateShape를 bbox에 맞춰 points 문자열로. inset(0~0.5)은 core 영역 축소용.
function plateShapeToPoints(shape, bbox, inset) {
  const poly = PLATE_SHAPE_POLYGONS[shape] || PLATE_SHAPE_POLYGONS.sapi;
  const ins = inset || 0;
  return poly.map(p => {
    const nx = ins + p[0]*(1-2*ins);
    const ny = ins + p[1]*(1-2*ins);
    return (bbox.minX + nx*bbox.w).toFixed(1) + ',' + (bbox.minY + ny*bbox.h).toFixed(1);
  }).join(' ');
}
function _slotHitPart(slot) { return (slot && slot.indexOf('abdomen') === 0) ? 'abdomen' : 'chest'; }

// 2A-3: 사이드 플레이트 — 정면/후면 view에서 좌우 옆구리 가장자리 세로 패널
const SIDE_PLATE_EDGE_POLYGONS = {
  small: ['20,43 26,41 26,61 20,63', '80,43 74,41 74,61 80,63'],   // [좌, 우] — 팔 겹침 방지 위해 아래로
  large: ['19,39 26,37 26,66 19,68', '81,39 74,37 74,66 81,68'],
};

// 2A-2/2A-3: 주요 gap 시각화 polygon (정면 기준, 약한 overlay). 좌우 쌍은 배열.
const GAP_VISUAL_POLYGONS = {
  front: {
    axillaGap:           ['21,28 31,27 31,39 23,41', '79,28 69,27 69,39 77,41'],
    upperLateralGap:     ['22,23 32,22 32,29 23,31', '78,23 68,22 68,29 77,31'],
    armShoulderGap:      ['21,28 31,27 31,39 23,41', '79,28 69,27 69,39 77,41'],
    lowerGap:            ['35,53 65,53 63,66 37,66'],
    lowerAbdomenExposed: ['36,66 64,66 62,78 38,78'],
    flankGap:            ['22,53 30,52 30,70 24,72', '78,53 70,52 70,70 76,72'],
    pelvisGroinAdjacent: ['40,78 60,78 58,88 42,88'],
    neckAdjacent:        ['43,16 57,16 56,21 44,21'],
  },
};

// =============================================================
// ARMOR_COVERAGE_SHAPES — 방호 정보 탭 시각화용 데이터
// =============================================================
//   사람 상체 실루엣 위에 polygon으로 그려지는 방호 영역.
//   각 방향마다:
//     softShape:  캐리어/소프트아머 외곽 (방탄복 본체 형태)
//     hardShape:  그 위에 겹치는 하드 플레이트 영역 (있을 경우)
//     extras:     보조 panel (어깨 패드 등)
//   좌표는 SVG 비율 (0~100). 정면/후면은 같은 폭, 측면은 더 좁다.
//   points는 'x,y x,y ...' 형식.
const ARMOR_COVERAGE_SHAPES = {
  iotv_test: {
    front: {
      // PSD 기준 — 어깨/겨드랑이 컷이 있는 IOTV soft armor 외곽
      softShape: { id:'iotv_carrier_f', label:'IOTV 캐리어 (전면)', slot:'chest_front',
        points:'81,21 66,16 58,25 42,25 34,16 19,21 27,44 18,52 19,64 81,64 82,52 73,44' },
      hardShape: { id:'iotv_plate_f', label:'전면 플레이트', slot:'chest_front',
        points:'28.4,28.5 71.8,28.5 71.8,58.8 28.4,58.8' },
    },
    side: {
      softShape: { id:'iotv_carrier_s', label:'IOTV 캐리어 (측면)', slot:'chest_side',
        points:'62.2,16.0 46.1,18.3 31.9,25.9 28.0,50.8 33.1,64.6 41.8,67.0 67.1,63.6 74.0,38.8 70.5,20.7' },
      hardShape: { id:'iotv_side_plate', label:'측면 플레이트', slot:'chest_side',
        points:'44,48 60,48 60,66 44,66' },
    },
    rear: {
      softShape: { id:'iotv_carrier_r', label:'IOTV 캐리어 (후면)', slot:'chest_rear',
        points:'81,21 66,16 58,21 42,21 34,16 19,21 27,44 18,52 19,64 81,64 82,52 73,44' },
      hardShape: { id:'iotv_plate_r', label:'후면 플레이트', slot:'chest_rear',
        points:'27.9,27.4 71.4,27.4 71.4,57.7 27.9,57.7' },
    },
  },

  jpc_test: {
    front: {
      softShape: { id:'jpc_carrier_f', label:'JPC 캐리어 (전면)', slot:'chest_front',
        // PSD 기준 — 어깨 스트랩 + 커머번드 프레임 (좌우 대칭)
        points:'78,20 65,16 62,23 38,23 35,16 22,20 27,43 17,45 20,53 80,53 83,45 73,43' },
      hardShape: { id:'jpc_plate_f', label:'전면 ESAPI 플레이트', slot:'chest_front',
        points:'27,23 73,23 73,52 27,52' },
    },
    side: {
      softShape: { id:'jpc_carrier_s', label:'JPC 측면 (커머번드)', slot:'chest_side',
        // 커머번드 밴드만 — 측면 플레이트 없음
        points:'23,41 77,41 70,55 34,57 25,55' },
      // 측면 플레이트 없음 — hardShape 생략
    },
    rear: {
      softShape: { id:'jpc_carrier_r', label:'JPC 캐리어 (후면)', slot:'chest_rear',
        points:'78,19 65,15 62,22 38,22 35,15 22,19 27,42 17,44 20,53 80,53 83,44 73,42' },
      hardShape: { id:'jpc_plate_r', label:'후면 ESAPI 플레이트', slot:'chest_rear',
        points:'27,22 73,22 73,51 27,51' },
    },
  },

  armor_6b23_test: {
    front: {
      softShape: { id:'6b23_carrier_f', label:'6B23 캐리어 (전면)', slot:'chest_front',
        points:'84,20 66,15 59,22 41,22 34,15 16,20 22,40 17,63 36,74 64,74 83,63 78,40' },
      // 6B23 frontSet은 가슴/복부 2개 — frontPlateId가 frontSet일 때만 표시
      //   가슴판: 아래로 확장 / 복부판: 좌우 축소 + 더 아래로 (PSD 기반)
      hardShapeSet: [
        { id:'6b23_plate_f_chest',   label:'전면 가슴 플레이트', slot:'chest_front',
          points:'30,24 70,24 70,55 30,55', requiresPlateSlot:'frontSet' },
        { id:'6b23_plate_f_abdomen', label:'전면 복부 플레이트', slot:'abdomen_front',
          points:'41,57 59,57 59,74 41,74', requiresPlateSlot:'frontSet' },
      ],
      extras: [
        { id:'6b23_collar_f', label:'목 보호 (전면)', type:'soft', slot:'neck',
          points:'31,11 42,16 58,16 69,11 66,19 59,25 41,25 34,19' },
        // SIDE-ARMOR-ADDRESS-COVERAGE: 6B23 기본 하부 패널 (built-in lower apron) — 본체 아래로 내려오는 soft 패널 (골반상부→낭심)
        { id:'6b23_lower_apron_f', label:'6B23 기본 하부 패널 (전면)', type:'soft', slot:'abdomen_front',
          points:'41,72 59,72 58,80 56,89 44,89 42,80' },
      ],
    },
    side: {
      softShape: { id:'6b23_carrier_s', label:'6B23 측면 (소프트만)', slot:'chest_side',
        points:'62,15 42,19 27,33 29,60 33,74 61,73 72,65 66,50 74,25' },
      extras: [
        { id:'6b23_collar_s', label:'목 보호 (측면)', type:'soft', slot:'neck',
          points:'35,18 58,9 69,10 65,20 55,22 44,22' },
        { id:'6b23_lower_apron_s', label:'6B23 기본 하부 패널 (측면)', type:'soft', slot:'abdomen_side',
          points:'33,72 50,72 49,80 47,88 36,86 34,79' },
      ],
      // 측면 하드 영구 없음
    },
    rear: {
      softShape: { id:'6b23_carrier_r', label:'6B23 캐리어 (후면)', slot:'chest_rear',
        points:'84,20 66,15 59,18 41,18 34,15 16,20 22,40 17,63 36,74 64,74 83,63 78,40' },
      extras: [
        { id:'6b23_collar_r', label:'목 보호 (후면)', type:'soft', slot:'neck',
          points:'31,11 42,16 58,16 69,11 66,19 59,25 41,25 34,19' },
        { id:'6b23_lower_apron_r', label:'6B23 기본 하부 패널 (후면)', type:'soft', slot:'abdomen_rear',
          points:'41,72 59,72 58,80 56,87 44,87 42,80' },
      ],
      // 후면 — back plate 장착 시에만 chest 부분만 표시
      hardShape: { id:'6b23_plate_r', label:'후면 가슴 플레이트', slot:'chest_rear',
        points:'30,22 70,22 70,50 30,50', requiresPlateSlot:'back' },
    },
  },

  armor_6b45_basic_test: {
    front: {
      softShape: { id:'6b45_carrier_f', label:'6B45 캐리어 (전면)', slot:'chest_front',
        // PSD 기준 — 풀커버 (어깨~복부), 좌우 대칭
        points:'35,16 15,20 21,33 15,52 21,67 79,67 85,52 79,33 85,20 65,16 61,23 39,23' },
      hardShape: { id:'6b45_plate_f', label:'전면 세라믹 플레이트', slot:'chest_front',
        points:'25,26 75,26 75,57 25,57' },
    },
    side: {
      softShape: { id:'6b45_carrier_s', label:'6B45 측면 캐리어', slot:'chest_side',
        points:'54,15 32,22 17,42 22,66 31,71 48,71 70,66 81,31 71,15' },
      hardShape: { id:'6b45_side_plate', label:'측면 소형 플레이트 (부분)', slot:'chest_side',
        points:'40,42 60,42 60,62 40,62' },
    },
    rear: {
      softShape: { id:'6b45_carrier_r', label:'6B45 캐리어 (후면)', slot:'chest_rear',
        points:'35,16 15,20 21,33 15,52 21,67 79,67 85,52 79,33 85,20 65,16 60,19 40,19' },
      hardShape: { id:'6b45_plate_r', label:'후면 세라믹 플레이트', slot:'chest_rear',
        points:'25,23 75,23 75,54 25,54' },
    },
  },

  // MSV — IOTV와 JPC 사이 균형형
  msv: {
    front: {
      softShape: { id:'msv_carrier_f', label:'MSV 캐리어 (전면)', slot:'chest_front',
        // PSD 기준 — 어깨~허리 커버, 좌우 대칭
        points:'35,15 21,19 25,43 16,47 18,58 82,58 84,47 75,43 79,19 65,15 60,24 40,24' },
      hardShape: { id:'msv_plate_f', label:'전면 플레이트', slot:'chest_front',
        points:'27,25 73,25 73,54 27,54' },
    },
    side: {
      softShape: { id:'msv_carrier_s', label:'MSV 측면', slot:'chest_side',
        points:'52,15 30,24 18,42 24,61 35,64 57,64 71,60 82,35 74,18' },
      hardShape: { id:'msv_side_plate', label:'측면 플레이트', slot:'chest_side',
        points:'40,42 60,42 60,62 40,62' },
    },
    rear: {
      softShape: { id:'msv_carrier_r', label:'MSV 캐리어 (후면)', slot:'chest_rear',
        points:'35,15 21,19 25,43 16,47 18,58 82,58 84,47 75,43 79,19 65,15 60,24 40,24' },
      hardShape: { id:'msv_plate_r', label:'후면 플레이트', slot:'chest_rear',
        points:'27,24 73,24 73,53 27,53' },
    },
  },

  // Police Vest — soft + 고정 알루미늄 hard
  police_vest: {
    front: {
      softShape: { id:'pv_carrier_f', label:'경찰 베스트 (전면)', slot:'chest_front',
        // MSV와 동일 형상
        points:'35,15 21,19 25,43 16,47 18,58 82,58 84,47 75,43 79,19 65,15 60,24 40,24' },
      hardShape: { id:'pv_plate_f', label:'알루미늄 삽입 (가슴, 고정)', slot:'chest_front',
        fixedPlate:true, fixedMaterial:'aluminum',
        // 가슴에만 — 복부 미포함
        points:'30,26 70,26 70,48 30,48' },
    },
    side: {
      softShape: { id:'pv_carrier_s', label:'경찰 베스트 (측면)', slot:'chest_side',
        points:'52,15 30,24 18,42 24,61 35,64 57,64 71,60 82,35 74,18' },
    },
    rear: {
      softShape: { id:'pv_carrier_r', label:'경찰 베스트 (후면)', slot:'chest_rear',
        points:'35,15 21,19 25,43 16,47 18,58 82,58 84,47 75,43 79,19 65,15 60,24 40,24' },
      hardShape: { id:'pv_plate_r', label:'알루미늄 삽입 (가슴, 후면 고정)', slot:'chest_rear',
        fixedPlate:true, fixedMaterial:'aluminum',
        points:'30,26 70,26 70,48 30,48' },
    },
  },

  // Airsoft Plate Carrier — JPC 비슷한 모양 (가벼움), 플레이트 슬롯 있음
  airsoft_plate_carrier: {
    front: {
      softShape: { id:'air_carrier_f', label:'Airsoft PC 캐리어 (전면)', slot:'chest_front',
        // JPC와 동일 폴리곤 — 어깨 스트랩 + 커머번드
        points:'78,20 65,16 62,23 38,23 35,16 22,20 27,43 17,45 20,53 80,53 83,45 73,43' },
      hardShape: { id:'air_plate_f', label:'전면 플레이트 (장착)', slot:'chest_front',
        points:'27,23 73,23 73,52 27,52' },
    },
    side: {
      softShape: { id:'air_carrier_s', label:'Airsoft PC (측면)', slot:'chest_side',
        points:'23,41 77,41 70,55 34,57 25,55' },
    },
    rear: {
      softShape: { id:'air_carrier_r', label:'Airsoft PC (후면)', slot:'chest_rear',
        points:'78,19 65,15 62,22 38,22 35,15 22,19 27,42 17,44 20,53 80,53 83,44 73,42' },
      hardShape: { id:'air_plate_r', label:'후면 플레이트 (장착)', slot:'chest_rear',
        points:'27,22 73,22 73,51 27,51' },
    },
  },

  // Replica Tactical Vest — 캐리어만, replica plate만 호환
  replica_tactical_vest: {
    front: {
      softShape: { id:'rep_carrier_f', label:'Replica Vest (전면)', slot:'chest_front',
        // JPC와 동일 폴리곤 — 어깨 스트랩 + 커머번드
        points:'78,20 65,16 62,23 38,23 35,16 22,20 27,43 17,45 20,53 80,53 83,45 73,43' },
      hardShape: { id:'rep_plate_f', label:'레플리카 삽입 (전면)', slot:'chest_front',
        points:'27,23 73,23 73,52 27,52' },
    },
    side: {
      softShape: { id:'rep_carrier_s', label:'Replica Vest (측면)', slot:'chest_side',
        points:'23,41 77,41 70,55 34,57 25,55' },
    },
    rear: {
      softShape: { id:'rep_carrier_r', label:'Replica Vest (후면)', slot:'chest_rear',
        points:'78,19 65,15 62,22 38,22 35,15 22,19 27,42 17,44 20,53 80,53 83,44 73,42' },
      hardShape: { id:'rep_plate_r', label:'레플리카 삽입 (후면)', slot:'chest_rear',
        points:'27,22 73,22 73,51 27,51' },
    },
  },

  // 경찰용 방탄복 — 고정형 내장 알루미늄 플레이트 (탈착 불가). fixedPlate로 항상 표시.
  // 경찰용 방탄복 — coverage는 위 police_vest 정의(MSV 형상 + 가슴 고정판) 사용
};

// =============================================================
// ACCESSORY_SHAPES — 추가 보호구 시각화 좌표
// =============================================================
//   accessory 종류별 SVG polygon. body accessory는 torso SVG (100×100),
//   helmet accessory는 head SVG (100×60)에 그려진다.
//   aspect별로 분기 — side/rear에는 일부만 표시.
const ACCESSORY_SHAPES = {
  // ----- BODY accessory (torso SVG, 100×100) -----
  //   IOTV PSD 기준으로 다듬은 대칭 형태. 장착 시에만 표시, 클릭 시 방호정보.
  groin: {
    // 낭심보호대 — 복부 하단에서 사타구니로 내려오는 대칭 사다리꼴
    front: { id:'acc_groin_f', points:'27,65 50,68 73,65 70,82 63,94 37,94 30,82' },
    side:  { id:'acc_groin_s', points:'43,66 57,66 55,86 45,86' },
    rear:  { id:'acc_groin_r', points:'30,66 50,69 70,66 67,84 33,84' },
  },
  shoulder: {
    // 팔(어깨)보호대 — 어깨~상완 근위부, 좌우 대칭
    front: { ids:[
      { id:'acc_shoulder_f_l', points:'21,21 10,23 5,26 2,45 4,51 18,53 22,44' },
      { id:'acc_shoulder_f_r', points:'79,21 90,23 95,26 98,45 96,51 82,53 78,44' },
    ]},
    side: { ids:[
      { id:'acc_shoulder_s',   points:'30,20 45,19 47,31 32,33' },
    ]},
    rear: { ids:[
      { id:'acc_shoulder_r_l', points:'21,21 10,23 5,26 2,45 4,51 18,53 22,44' },
      { id:'acc_shoulder_r_r', points:'79,21 90,23 95,26 98,45 96,51 82,53 78,44' },
    ]},
  },
  neck: {
    // 목보호대 — 목 둘레 collar, 대칭
    front: { id:'acc_neck_f', points:'31,11 42,16 58,16 69,11 66,19 59,25 41,25 34,19' },
    side:  { id:'acc_neck_s', points:'35,18 58,9 69,10 65,20 55,22 44,22' },
    rear:  { id:'acc_neck_r', points:'31,11 42,16 58,16 69,11 66,19 59,25 41,25 34,19' },
  },
  // ----- HELMET accessory (head SVG, 100×60) — FAST MT PSD 기준 -----
  visor: {
    // 얼굴 바이저 — 대칭 (PSD)
    front: { id:'acc_visor_f', points:'30,23 24,28 25,52 75,52 76,28 70,23' },
    side:  { id:'acc_visor_s', points:'5,16 2,45 36,47 41,18' },   // 왼쪽 방향
    rear:  null,
  },
  // K6-3 visor — 노랑=티타늄(프레임), 분홍=유리(가운데). PSD 기준.
  visorK63: {
    front: {
      glass: { id:'acc_k63_glass_f',   points:'29,26 71,26 71,40 29,40' },
      frame: { id:'acc_k63_frame_f',   points:'50,21 24,23 23,53 77,53 76,23' },
    },
    side: {
      glass: { id:'acc_k63_glass_s',   points:'3,23 1,34 20,36 23,24' },
      frame: { id:'acc_k63_frame_s',   points:'10,17 5,45 39,46 47,19' },
    },
    rear: null,
  },
  slaap: {
    // 전면 두개부 보강판 — 이마 위 (대칭, PSD)
    front: { id:'acc_slaap_f', points:'41,3 31,10 28,20 30,28 40,27 50,26 60,27 70,28 72,20 69,10 59,3' },
    side:  { id:'acc_slaap_s', points:'44,1 32,3 20,10 18,20 26,22 48,22 48,11 42,9' },   // 왼쪽 방향
    rear:  null,
  },
};

// 헬멧 시각화 — 머리 실루엣 위 shell 영역 (polygon)
//   shellShape:  헬멧 외곽 (하드)
//   linerShape:  내부 라이너 (soft, 시각적으로 안쪽)
//   얼굴은 별도 panel 없음 — 비방호로 자연스럽게 보임
const HELMET_COVERAGE_SHAPES = {
  mich_test: {
    front: {
      shellShape: { id:'mich_shell_f', label:'MICH 쉘 (전면)', slot:'head_skull',
        // 이마와 귀 윗부분까지만 — 얼굴은 노출
        points:'50,1 34,5 27,14 23,40 30,39 33,29 50,27 67,29 70,39 77,40 73,14 66,5' },
    },
    side: {
      shellShape: { id:'mich_shell_s', label:'MICH 쉘 (측면)', slot:'head_skull',
        // 측면 — 미드컷 (귀 살짝 위까지)
        points:'20,15 18,23 40,26 47,30 77,32 82,29 82,17 73,6 58,3 41,3 28,6' },
    },
    rear: {
      shellShape: { id:'mich_shell_r', label:'MICH 쉘 (후면)', slot:'head_skull',
        // 후두부 — 미드컷이라 후면이 잘 덮음
        points:'50,2 35,4 26,11 23,27 38,32 62,32 77,27 74,11 65,4' },
    },
  },
  helmet_6b47_test: {
    front: {
      shellShape: { id:'6b47_shell_f', label:'6B47 쉘 (전면)', slot:'head_skull',
        points:'50,1 34,5 27,14 23,40 30,39 33,29 50,27 67,29 70,39 77,40 73,14 66,5' },
    },
    side: {
      shellShape: { id:'6b47_shell_s', label:'6B47 쉘 (측면)', slot:'head_skull',
        points:'20,15 18,23 40,26 47,30 77,32 82,29 82,17 73,6 58,3 41,3 28,6' },
    },
    rear: {
      shellShape: { id:'6b47_shell_r', label:'6B47 쉘 (후면)', slot:'head_skull',
        points:'50,2 35,4 26,11 23,27 38,32 62,32 77,27 74,11 65,4' },
    },
  },

  // FAST MT — 고컷, 측면 노출 큼
  fast_mt: {
    front: {
      shellShape: { id:'fast_shell_f', label:'FAST MT 쉘 (전면, 고컷)', slot:'head_skull',
        points:'50,2 42,3 31,9 26,20 30,34 38,27 50,26 62,27 70,34 74,20 69,9 58,3' },
    },
    side: {
      shellShape: { id:'fast_shell_s', label:'FAST MT 쉘 (측면, 귀 노출)', slot:'head_skull',
        points:'63,3 75,8 81,13 84,25 73,40 60,38 65,25 62,23 20,21 23,11 31,5' },
    },
    rear: {
      shellShape: { id:'fast_shell_r', label:'FAST MT 쉘 (후면)', slot:'head_skull',
        points:'50,1 40,2 30,7 26,13 29,31 35,36 65,36 71,31 74,13 70,7 60,2' },
    },
  },

  // ECH — MICH보다 살짝 더 두꺼움
  ech: {
    front: {
      shellShape: { id:'ech_shell_f', label:'ECH 쉘 (전면)', slot:'head_skull',
        points:'50,1 34,5 27,14 23,40 30,39 33,29 50,27 67,29 70,39 77,40 73,14 66,5' },
    },
    side: {
      shellShape: { id:'ech_shell_s', label:'ECH 쉘 (측면)', slot:'head_skull',
        points:'20,15 18,23 40,26 47,30 77,32 82,29 82,17 73,6 58,3 41,3 28,6' },
    },
    rear: {
      shellShape: { id:'ech_shell_r', label:'ECH 쉘 (후면)', slot:'head_skull',
        points:'50,2 35,4 26,11 23,27 38,32 62,32 77,27 74,11 65,4' },
    },
  },

  // K6-3 — 무거운 풀페이스 헬멧
  k6_3: {
    front: {
      shellShape: { id:'k63_shell_f', label:'K6-3 쉘 (전면, 풀페이스)', slot:'head_skull',
        points:'50,0 34,2 25,11 23,20 26,45 36,44 35,30 50,26 65,30 64,44 74,45 77,20 75,11 66,2' },
    },
    side: {
      // 측면 — 귀/측두부/후두부까지 매우 넓게
      shellShape: { id:'k63_shell_s', label:'K6-3 쉘 (측면, 귀/측두부 풀커버)', slot:'head_skull',
        points:'29,4 20,13 18,22 36,25 49,39 64,40 75,37 83,31 85,21 83,13 75,6 59,1' },
    },
    rear: {
      shellShape: { id:'k63_shell_r', label:'K6-3 쉘 (후면, 후두부 풀커버)', slot:'head_skull',
        points:'50,0 37,3 28,8 24,21 30,32 70,32 76,21 72,8 63,3' },
    },
  },

  // 6B47M — 6B47 강화형, 비슷한 형태
  helmet_6b47m: {
    front: {
      shellShape: { id:'6b47m_shell_f', label:'6B47M 쉘 (전면)', slot:'head_skull',
        points:'50,1 34,5 27,14 23,40 30,39 33,29 50,27 67,29 70,39 77,40 73,14 66,5' },
    },
    side: {
      shellShape: { id:'6b47m_shell_s', label:'6B47M 쉘 (측면)', slot:'head_skull',
        points:'20,15 18,23 40,26 47,30 77,32 82,29 82,17 73,6 58,3 41,3 28,6' },
    },
    rear: {
      shellShape: { id:'6b47m_shell_r', label:'6B47M 쉘 (후면)', slot:'head_skull',
        points:'50,2 35,4 26,11 23,27 38,32 62,32 77,27 74,11 65,4' },
    },
  },

  // LShZ — FAST MT와 유사한 고컷
  lshz_light: {
    front: {
      shellShape: { id:'lshz_shell_f', label:'LShZ 쉘 (전면, 고컷)', slot:'head_skull',
        points:'50,2 42,3 31,9 26,20 30,34 38,27 50,26 62,27 70,34 74,20 69,9 58,3' },
    },
    side: {
      shellShape: { id:'lshz_shell_s', label:'LShZ 쉘 (측면, 귀 노출)', slot:'head_skull',
        points:'63,3 75,8 81,13 84,25 73,40 60,38 65,25 62,23 20,21 23,11 31,5' },
    },
    rear: {
      shellShape: { id:'lshz_shell_r', label:'LShZ 쉘 (후면)', slot:'head_skull',
        points:'50,1 40,2 30,7 26,13 29,31 35,36 65,36 71,31 74,13 70,7 60,2' },
    },
  },

  // FAST Bump — 외형은 FAST MT와 유사 (고컷)
  helmet_fast_bump: {
    front: {
      shellShape: { id:'fast_bump_shell_f', label:'FAST Bump (전면, 고컷)', slot:'head_skull',
        points:'50,2 42,3 31,9 26,20 30,34 38,27 50,26 62,27 70,34 74,20 69,9 58,3' },
    },
    side: {
      shellShape: { id:'fast_bump_shell_s', label:'FAST Bump (측면, 귀 노출)', slot:'head_skull',
        points:'63,3 75,8 81,13 84,25 73,40 60,38 65,25 62,23 20,21 23,11 31,5' },
    },
    rear: {
      shellShape: { id:'fast_bump_shell_r', label:'FAST Bump (후면)', slot:'head_skull',
        points:'50,1 40,2 30,7 26,13 29,31 35,36 65,36 71,31 74,13 70,7 60,2' },
    },
  },

  // FAST Carbon Bump — FAST Bump와 동일 외형
  helmet_fast_carbon_bump: {
    front: {
      shellShape: { id:'fast_carbon_shell_f', label:'FAST Carbon Bump (전면)', slot:'head_skull',
        points:'50,2 42,3 31,9 26,20 30,34 38,27 50,26 62,27 70,34 74,20 69,9 58,3' },
    },
    side: {
      shellShape: { id:'fast_carbon_shell_s', label:'FAST Carbon Bump (측면)', slot:'head_skull',
        points:'63,3 75,8 81,13 84,25 73,40 60,38 65,25 62,23 20,21 23,11 31,5' },
    },
    rear: {
      shellShape: { id:'fast_carbon_shell_r', label:'FAST Carbon Bump (후면)', slot:'head_skull',
        points:'50,1 40,2 30,7 26,13 29,31 35,36 65,36 71,31 74,13 70,7 60,2' },
    },
  },

  // ULACH — MICH/ECH보다 귀/측면 약간 더 덮음
  helmet_ulach: {
    front: {
      shellShape: { id:'ulach_shell_f', label:'ULACH 쉘 (전면)', slot:'head_skull',
        points:'50,1 35,4 26,11 22,30 27,42 35,31 50,28 65,31 73,42 78,30 74,11 65,4' },
    },
    side: {
      // 측면 — 귀 일부 덮음 (K6-3보다는 작게, MICH보다는 크게)
      shellShape: { id:'ulach_shell_s', label:'ULACH 쉘 (측면, 귀/후두부 넓음)', slot:'head_skull',
        points:'24,10 18,22 40,27 55,35 76,36 81,31 83,22 70,6 58,3 43,3' },
    },
    rear: {
      shellShape: { id:'ulach_shell_r', label:'ULACH 쉘 (후면, 후두부 넓음)', slot:'head_skull',
        points:'50,1 35,5 25,12 23,30 77,30 75,12 65,5' },
    },
  },
};
// =============================================================
