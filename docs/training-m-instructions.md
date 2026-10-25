# CQB Training 지시서 M — 인체 출구 속도·의료 기록 연결·뼈 대응표

Oct 10, 2026 · @다고쿠

## 개요

armor-body-v10(sourceCommit 520d6d72) 위에 작업 4개를 적용한다. M1은 인체 출구 속도를 경로 길이에 맞추고, M2는 그 결과를 2D 의료 모델에 상처 기록으로 넘긴다. M3은 H01을 A자 자세 고정 확인용 표적으로 유지하는 조건을 정하고, M4는 다음 단계(쓰러짐·새 캐릭터)를 위한 뼈 대응표를 만든다. 이번 단계는 **기록과 표시까지**이며, 의료 상태가 표적의 동작을 바꾸지 않는다.

M1→M2→M3→M4 순서로 독립 커밋하고, 최종 빌드 하나로 제출한다.

공통 원칙:

1. **원본 무수정.** `src/**`, `CQB_Tactical.html`, 모델 원본, v9 리깅 GLB는 바꾸지 않는다. baseline identical과 기존 99개 테스트를 유지한다.
2. **원본 재사용 방식 유지.** v10의 `scripts/training-protection.mjs`처럼 검토한 선언만 추출하고, 출처 파일과 SHA를 빌드 정보에 기록한다.
3. **방호 결과 불변.** 방호구 단계(판·소프트·헬멧)의 판정과 내구도는 v10과 같아야 한다. 바뀌는 것은 인체 통과 후 잔여탄과 그 이후 단계뿐이다.
4. **결정성.** 새 코드에서 `Math.random` 금지. 탄도·방호 RNG 소비 순서를 바꾸지 않는다. 의료가 난수를 쓰면 별도 stream을 두고 탄도 처리가 끝난 뒤에 소비한다.
5. **출처 분리.** 수치마다 원본 값 / 공식 자료 / 비공식 자료 / 3D 연결 튜닝값을 구분해 기록한다.

## M1. 인체 출구 속도와 몸에 남은 에너지

인체를 완전 관통한 탄의 출구 속도를 실제 경로에서 소모한 관통력 비율로 정한다. 현재는 경로와 무관하게 항상 속도 ×0.5, damage ×0.4(2D continuation packet 규칙)다.

### 현재 문제 (v10 검증 기록)

| 사례 | 인체 경로 | 진입 → 출구 |
| --- | --- | --- |
| fixed-bare-forearm | 팔뚝 약 9 cm | 879 → 439.5 m/s |
| fixed-front-neck | 목 | 534 → 267 m/s |
| fixed-soft-through-body-rear | 몸통 약 24 cm | 547 → 273 m/s |

체내 정지 여부는 실제 길이로 계산하는데(부위 cost × terminal × 길이 ÷ 기준 길이) 출구 속도는 길이를 보지 않는다. 그래서 몸에 남는 에너지가 항상 진입 에너지의 75%가 된다.

### 새 규칙 (3D 연결 튜닝값, id `body-exit-sqrt-pen-ratio-v1`)

완전 관통(`body_through_and_through`)일 때만 적용한다. pen\_in은 인체 진입 시 관통력, pen\_after는 기존 깊이 판정이 내는 `penAfterBody`(= pen\_in − 경로 cost)다.

```latex
v_{out} = v_{in}\sqrt{\frac{pen_{after}}{pen_{in}}},\qquad dmg_{out} = dmg_{in}\cdot\frac{pen_{after}}{pen_{in}}
```

- 방호구 출구 속도 규칙(잔여 관통력 비율의 제곱근)과 같은 형태다. 한 발의 탄이 방호구와 인체에서 같은 방식으로 감속한다.
- 상한·하한: 0 ≤ v\_out ≤ v\_in, 0 ≤ dmg\_out ≤ dmg\_in. 관통력·안정성은 기존 규칙을 유지한다.
- 다음 표적으로 이어가는 조건(잔여 관통력 6 이상)은 그대로다.
- 체내 정지(shallow/deep/near-exit)는 v\_out = 0이다.
- 한 사람의 여러 부위를 연속으로 지나면 사람 단위 최종 pen\_after로 한 번 계산한다.
- 2D 원본의 ×0.5/×0.4 상수는 원본 파일에서 지우지 않는다. 3D 어댑터가 사용하지 않을 뿐이다.

### 몸에 남은 에너지

탄자 질량은 기존 canonical projectile 프로필(kinetics의 massKg)을 쓴다.

- E\_in = ½·m·v\_in², E\_out = ½·m·v\_out², E\_dep = E\_in − E\_out (항상 0 이상).
- 여러 부위를 지나면 E\_dep를 각 부위의 cost 비율로 나눈다(3D 연결 튜닝값).

### 기록 필드 (`trace.bodyHits`에 추가)

`penIn`, `penAfterBody`, `velocityInMps`, `velocityOutMps`, `energyInJ`, `energyOutJ`, `energyDepositedJ`, 부위별 `energyShareJ`, 적용 규칙 id. 기존 필드(주소, 경로 길이, 깊이 분류)는 그대로 둔다.

HUD 2행에 “출구 {v} m/s · 체내 {E\_dep} J”를 추가한다. 기존 “인체 진입 {v} m/s · {E} J”는 유지한다.

## M2. 2D 의료 기록 연결

피부에 닿은 피격마다 2D 의료 모델의 정식 피해 입구로 상처를 기록하고, H01의 의료 상태를 훈련 시간에 맞춰 진행시킨다. 이번 단계는 기록과 표시만 하며, H01의 자세·동작은 바꾸지 않는다.

### 다리 구조

1. **입구는 `applyDamageEvent`.** 2D에서 파편·스폴이 쓰는 canonical 피해 진입점이다. 원본 src에서 역할과 인자를 먼저 확인하고 보고한다. `resolveImpact` 전체는 부위·방호를 다시 굴리므로 호출하지 않는다. 부위와 방호 결과는 3D 교차가 이미 결정했다.
2. **H01 의료 주체는 원본 초기화 함수로 만든다.** 의료 필드를 손으로 만들지 않는다. 원본 검증 함수(`validatePartDestructionFoundation` 등)를 통과해야 한다.
3. **추출 범위는 검토 후 보고한다.** 의료는 상처 군집, 부위 파괴, 혈관 증거 등 의존성이 크다. v10 방식대로 선언 단위 추출이 가능한지, 모듈 단위가 필요한지 판단 근거와 함께 적는다.

### 사건 내용

- 한 발이 여러 부위를 지나면 부위마다 사건 1개. 같은 shotId로 묶고 관통 순서를 기록한다.
- 넘길 값: 탄종 id, 부위 진입 속도, 부위별 체내 에너지(M1), 경로 길이, 깊이 분류, 출구 상처 여부, 지나온 방호구와 잔여 상태.
- 원본 사건 구조에 없는 값은 메타데이터로만 붙이고, 원본 계산 입력으로 강제 주입하지 않는다.

### 주소 매핑

3D 피격 주소(면 · 부위 · 세부 구역)를 2D `hitPart` + `impactAddress`로 바꾸는 대응표를 만든다. 21개 인체 메시의 모든 세부 구역을 빠짐없이 담고, 대응이 없는 구역은 목록으로 보고한다.

이미 알려진 2D 특성(0.40.1 기록):

- 사격 경로의 location `neck`은 `locationToBodyPart`에서 head로 귀속되고, `neck_soft`는 chest로 바뀜다. 목 피격은 `hitPart:'neck'`과 `front.neck.neck.neck_base` 형식 주소를 `applyDamageEvent`에 직접 넘겨야 medical partKey neck에 도달한다.
- head의 유효 location은 `head_skull`/`head_face`/`head_temporal`이다. `head`는 무효다.

### 방호구 저지 (피부 미접촉)

원본에 방호구 저지 시 둔상(후면 변형) 경로가 있으면 그 함수로 연결한다. 없으면 만들지 말고 ‘피부 미접촉’으로만 기록하고 보고서에 적는다.

### 시간 진행

- 출혈·쇼크·의식 등 원본 의료 tick을 훈련 고정 스텝 시간으로 진행한다. 일시정지 중에는 멈춘다.
- 훈련 초기화·새 훈련이면 의료 상태도 초기화한다(방호구 내구도와 동일).
- 의료 상태는 탄도·방호·피격 메시에 영향을 주지 않는다.

### 확인 화면 (H01 의료 기록)

기존 메뉴 안에 패널 하나를 추가한다. 표시 항목:

- 상처 목록: 시각, 부위 주소, 깊이, 진입 속도, 체내 에너지, 출구 여부, 출혈 등급.
- 부위별 상태: 원본 partDestruction 상태와 기능 비율.
- 전신 상태: 혈액량, 의식, 원본이 정의한 상태 이름 그대로. 새 상태 이름을 만들지 않는다.

### 금지 사항

- 부위·방호 재추첨, `resolveImpact` 전체 호출.
- 원본 의료 상수·임계값 수정.
- 의료 상태에 따른 자세 변화·쓰러짐(다음 단계).

## M3. H01은 A자 자세 고정 유지

H01의 기본 자세는 바꾸지 않는다. H01은 피격·방호·의료를 확인하는 기준 표적이므로 A자 자세에 고정한다. 서 있는 자세와 쓰러짐은 이후 새 캐릭터 모델에서 다룬다.

- v9 리그의 `standing`·`aim`·`crouch`·`walk` 클립과 자세 시험 기능은 그대로 두되, 기본값은 A자 자세다.
- 기존 고정 사격 fixture의 조준점은 바꾸지 않는다.
- M1·M2의 다중 부위 처리를 확인하기 위해, A자 자세에서 팔을 먼저 지나 몸통에 맞는 사선 fixture를 1건 추가한다.
- M4 리타깃 검증은 디버그 경로에서만 H01에 재생하고, 끝나면 A자 자세로 복귀한다.

## M4. 뼈 대응표와 리타깃 검증

v9 리그의 뼈 이름은 바꾸지 않고, Mixamo 이름을 기준 키로 하는 대응표와 리타깃 함수를 만든다. 이름만 바꾸면 되지 않는 이유는 기본 자세(rest pose)가 다르기 때문이다. v9는 A자 자세, Mixamo는 T자 자세라 같은 회전값이 다른 동작이 된다.

### 대응표 (v9 → Mixamo)

| v9 | Mixamo | 비고 |
| --- | --- | --- |
| root | — | 배치용 루트 |
| pelvis | mixamorig:Hips |  |
| spine | mixamorig:Spine |  |
| chest | mixamorig:Spine2 | Spine1 없음 |
| neck / head | mixamorig:Neck / Head |  |
| left/rightClavicle | mixamorig:Left/RightShoulder |  |
| left/rightUpperArm | mixamorig:Left/RightArm |  |
| left/rightForearm | mixamorig:Left/RightForeArm |  |
| left/rightHand | mixamorig:Left/RightHand | 손가락 뼈 없음 |
| left/rightUpperLeg | mixamorig:Left/RightUpLeg |  |
| left/rightLowerLeg | mixamorig:Left/RightLeg |  |
| left/rightFoot / Toes | mixamorig:Left/RightFoot / ToeBase |  |
| left/rightKneeCover | — | 무릎 보호대 보조 뼈, 부모를 따라감 |

이 표는 초안이다. 실제 계층 구조를 확인해 수정하고 최종본을 보고한다.

### 리타깃 검증

1. three.js `SkeletonUtils.retargetClip`을 우선 사용한다. 부족하면 rest pose 보정을 포함한 자체 함수를 만들고 이유를 적는다.
2. 시험 입력: 사용자가 제공하는 `military_tactical_suit_lowpolygameready.glb`(CC BY 4.0, DanlyVostok)의 Mixamo 리그 `Idle_Animation`. **시험에만 쓰고 배포 HTML에는 넣지 않는다.**
3. 통과 기준: 리타깃한 대기 동작을 v9 H01에 재생했을 때 NaN 0, 양발 바닥 높이가 지면에서 ±2 cm 이내, 피격 메시와 방호구 표면이 몸을 따라감. 정면·측면 스크린샷 제출.
4. 리타깃 동작은 게임 기본 동작으로 쓰지 않는다. 검증용 디버그 경로에서만 호출한다.

### 다음 캐릭터용 초안 (문서만)

`soldier_full_tactical_gear.glb`는 Character Creator 뼈대(CC\_Base\_\*)다. 이 모델의 Mixamo 대응표 초안만 보고서에 넣는다. 런타임에는 추가하지 않는다.

## 검증 및 제출 조건

### 공통

- `npm test` 전부 통과, baseline identical, 원본 src·v9 GLB 바이트 동일.
- 페이지·콘솔 오류 0, 오프라인 외부 요청 0. 844×390 터치 / 1280×720 마우스 스모크.
- v10 대비 600틱·6발의 총구·방향·카메라·걸음 동일.

### M1

1. v10의 방호구 전용 fixture(plate-stop, crouch-plate-stop, body-retained 등)는 방호 단계 수치가 v10과 동일.
2. 단조성: 같은 탄·같은 진입 속도에서 경로가 길수록 v\_out은 작거나 같다. 팔뚝 관통의 v\_out은 몸통 관통보다 커야 한다.
3. 모든 인체 기록에서 0 ≤ v\_out ≤ v\_in, E\_dep ≥ 0, 부위별 energyShareJ 합 = E\_dep.
4. bare-forearm·front-neck·soft-through-body-rear fixture의 새 출구 속도와 뒤따르는 방호구·벽 결과를 v10과 나란히 표로 보고한다.

### M2

1. 피부 접촉 fixture마다 의료 사건 수 = 관통 부위 수. 방호구 저지 fixture는 상처 0.
2. 목 피격이 medical partKey neck에, 머리 피격이 head에 기록됨.
3. 연속 타이머: 피격 후 60초간 출혈·의식 변화가 기록되고, 일시정지 중에는 멈춤.
4. 초기화 후 의료 상태가 초기값과 동일.
5. 원본 의료 검증 함수 오류 0, AED/CPR 0.
6. 같은 입력 재실행 시 의료 기록 동일(결정성).
7. 의료 패널 스크린샷(팔뚝, 목, 몸통 관통 각 1건).

### M3·M4

1. H01 기본 자세가 A자로 유지되고 기존 fixture 조준점이 그대로 유효함을 확인.
2. 팔을 먼저 지나 몸통에 맞는 fixture 1건 추가(다중 부위 기록 확인).
3. M4 리타깃 통과 기준 결과와 스크린샷.

### 보고 형식

- 변경 파일·함수 목록, 추출한 원본 선언과 SHA.
- 빌드 내부 공식 테스트와 외부 검증 스크립트 결과 분리.
- 수치 출처 구분: 원본 / 공식 / 비공식 / 튜닝값.
- 알려진 한계: 미보정 레인, 인체 기준 길이는 튜닝값, 장기·뼈 메시 없음, S24 실기기 미검증.

## 이번 범위 밖

다음 지시서에서 다룬다.

- **의료 상태에 따른 쓰러짐.** 원본 상태(행동불능·의식불명·사망 등)가 바뀌는 시점에 서 있기에서 쓰러짐으로 전환한다(새 캐릭터 대상, H01은 A자 고정 유지). 중추신경 피격이 아니면 즉시 쓰러지지 않는다는 원칙을 따른다. 처음에는 동작 재생, 래그돌은 그 다음.
- 피격 반응(움첔하기), NPC 전투, 새 캐릭터 모델 투입.
- 장기·뼈·혈관 메시, 치료 행위.
- 장애물 통과 후 잔여 속도 모델과 레인 보정.
