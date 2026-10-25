# M 단계 작업·검증 기록

기준은 실제 최신 v11 `f0f465c`이며 v10 계산·v9 GLB를 유지한다. [지시서](training-m-instructions.md).

## M1

`resolveBodyPath`는 `body-exit-sqrt-pen-ratio-v1`로 출구 속도·damage를 연결한다. 연속한 같은 사람의 부위는 최초 진입 상태를 기준으로 최종 잔여 관통력을 적용한다. 중간에 실제 방호구/장애물이 있으면 그 결과 뒤의 진입 상태로 새 구간을 시작한다. 관통력·안정성·정지 깊이·잔여 6 조건과 방호 RNG는 그대로다.

canonical `computeProjectileKinetics.massKg`로 에너지를 계산하고 실제 도달한 부위 cost 비율로 분배한다. 관절 중복 길이는 기존 합집합을 따른다. 범위가 몸 안에서 끝나면 완전 출구/정지로 단정하지 않고 `energyAccountingComplete:false`를 기록한다.

기존 99개 시험 사례는 유지한다. 그중 인체 출구의 ×0.5/×0.4를 요구한 단일 assertion만 M1의 명시적 새 계약으로 변경했다. 원본 깊이 입력과 기대 분류는 바꾸지 않았다. 새 단조성/에너지/다중 부위 시험을 더해 101/101 통과. 원본 2D continuation 상수는 무수정이다.

M1 변경: `protection.js/resolveBodyPath`, `physics.js/bodyPaths`(부위별 주소), `ballistics.js/traceShot`(사람 진입 기준), `main.js`(출구·체내 HUD), 빌드 정보, 시험. 새 수치는 공식 탄도 자료가 아닌 **3D 연결 튜닝**이다.

## M2

`applyDamageEvent(unit, ev)`는 HP·급성 반응·canonical wound orchestrator의 입구다. `tickMedical(unit, dt)`는 wound 기반 출혈, 혈역학, 의식, 심장 후보 상태, 원본 요약·legacy 동기화를 진행한다. H01 의료 주체는 **원본 `makeUnit` → `createMedical` → `initMedicalResources`**로 만든다. 원본 주체의 `stance`가 의료상 prone로 바뀌어도 3D 리그에 전달하지 않는다.

검토한 28개 원본 파일의 237개 선언을 AST 의존성 closure로 추출했다. 큰 의료 모듈 전체나 전체 게임을 실행하면 DOM·AI·방호 재실행까지 가져오므로 선언 단위가 적합하다. `makeUnit`의 원본 무기/로드아웃 초기화 helper, `applyOutcome(BLOCK)`의 severity·stopping helper도 필요한 의존성이다. 원본 `rebuildArmorDurability`는 의료 주체 초기화에만 포함되고 실제 3D 방호 owner 상태와 분리된다. 데이터 registry는 기존 canonical catalog 초기화 결과를 쓴다. `resolveImpact`, `rollPenetration`, `applyArmorDurabilityDamage`, 치료 실행/AED/CPR은 추출하지 않는다. 각 파일·선언 SHA는 `legacyMedicalSources`에 기록한다. 옵션인 DOM/AAR 로그 hook은 원본의 `typeof` 경계 밖으로 유지한다.

원본 `buildBodyTrajectoryContext`가 읽는 `resolveRearArmorInteraction`은 새 **읽기 전용 projection**으로 공급한다. 완료된 3D trace의 실제 후면 방호 결과를 돌려줄 뿐 방호 판정·마모·RNG를 재실행하지 않는다. 원본 bodyTrajectory의 기준 길이 없는 깊이/후보 계산은 원본대로 유지한다. M1의 실제 경로 길이·깊이·사출구·침착 에너지는 원본 사건 schema에 없으므로 `trainingMetadata`에 보관한다. 따라서 패널의 3D 깊이와 `medicalDepth`는 다를 수 있다. 침착 J를 HP·출혈에 임의 환산하지 않았다. 원본이 지원하는 `rawDamage`, `_shotVelocity`, canonical `impactPacket`에는 부위 진입 잔여 상태와 진입 kinetics를 전달한다.

피부에 도달한 각 통과 부위에 사건 1개, 같은 shotId와 순서를 기록한다. 겹친 관절 cover는 같은 의료 부위로 합친다. 원본 `dead` guard가 추가 상처를 중단한 경우에도 3D 사건은 보관하고 `skippedAfterDeath`를 명시한다. 방호 저지는 원본 `applyOutcome(BLOCK)` → `applyDamageEvent`의 둔상 경로를 쓴다. 기존 저지 사례는 피부 상처 0이며 작은 pain/급성 반응만 기록된다. 매우 큰 원본 둔상이 원본 기준을 넘으면 원본 abrasion/bruise wound가 생길 가능성은 그대로다.

`medical-address.js`는 모든21메시·6면·세부 구역을 열거한다. 관절 경계에는 보수적으로 부위별 가능한 구역의 상위집합을 둔다. 미대응 목록은 없음이며 알 수 없는 주소는 오류로 중단한다. 하부 전방 목은 직접 `hitPart:neck` + `front.neck.neck.neck_base`, 머리 location은 `head_skull/head_face/head_temporal`을 쓴다. 얼굴의 impactAddress는 face로 유지하되 저장 partKey는 head다.

의료 RNG는 trace 완료 뒤의 별도 shot stream이며 렌더 프레임·탄도 RNG와 공유하지 않는다. 고정 STEP만 진행하고 메뉴 일시정지에는 호출하지 않는다. 초 단위 blood/consciousness timeline도 기록한다. 가벼운 팔 피격의 의식이 100으로 유지되는 것은 원본 결과이며 강제로 변화시키지 않는다. 초기화는 factory와 원본 주체까지 새로 만들어 id·wound sequence·자원·생리 상태가 초기값과 같아진다.

공식 Node 시험 106/106: 기존99 + M1의2 + 의료5. 피부 부위별 사건/상처, 목/head 저장, 방호 저지 상처0/둔상, 60초·pause·reset·결정성, 원본 part destruction/wound pipeline/UI 검증 오류0. 의료 panel은 메뉴에 하나만 추가했고 의료 결과로 이동·방호·자세를 바꾸지 않는다.

## M3 완료

기본 H01은 v11처럼 `rest` A 자세 고정이다. 네이티브 v9 standing/aim/crouch/walk와 24개 이름·부모는 무수정이다. 기존 고정 조준점은 `tests/fixtures/training-m-shots.mjs`에 그대로 옮겼고 새로운 `arm-first-body`만 더했다. 새 사선은 `[19,-4.205]` 위치에서 `[17,1.15,-3.9]`로 조준한다. production inventory/aim/tick/fire와 실제 shot RNG로 **1발, 왼팔 → 복부, 사건2/상처2**를 확인했다. 후면 소프트 저지는 원본 둔상 경로로 별도 기록한다.

`debug/soldier.js/withDebugSoldier`는 외부 QA 전용이며 실패해도 finally에서 A 자세로 되돌리고 피격/방호 표면을 동기화한다. `physics.syncHumanTransforms`는 별도 동기화 함수로 분리했으며 기본 pose 결과는 그대로다. 새 공식 시험2개 통과. v10 대비 600틱·6발의 총구/방향/카메라/걸음은 정확히 같았다.


## M4 완료

사용자가 올린 두 GLB를 변경 없이 감사하고 실제 군용 모델의 `Idle_Animation`을 debug 경로에서 시험했다. 24개 stable 이름/부모, 실제 Mixamo 계층, CC 초안, rest 축/발 고정 보정의 근거·한계와 모델 최적화 우선순위는 [모델·대응표 기록](training-retarget-models.md)을 따른다. `SkeletonUtils.retargetClip` + 실제 local 축 보정 + 정지 Idle 발 IK, 전체23.333초 701sample, NaN0, 실제 밑창 최대11.991mm, collider 최대0.980µm, 종료 후 A 정확 복귀. 새 모델과 debug 코드는 배포 HTML에 포함되지 않는다. 원본 모델·v9 파생 GLB 무수정이며 시각 스킨의 기존 끈/숨은 몸통 문제는 남는다.

M4 변경: `debug/retarget.js`(rig-only load, 실제 매핑, clip 변환/grounding/debug mixer), `soldier-rig.js`(기존 solveChain 제공·debug 잔여 scale 복원), `debug/soldier.js`(cached pose도 강제 복원), test 입력/원본 crouch fixture 복원, build-info의 debug 입력 SHA, 실제 Node 시험1·외부 Chromium harness·주소/모델/CC JSON·문서. 기존 clip/뼈 계층/모델은 그대로다.


## 최종 검증·출처

공식 `npm test`: **111/111, fail0**(기존99 사례 + M1의2 + M2의5 + M3의2 + M4의1 + 후속 시각 스킨의2). baseline는3,641,864B / `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d`로 identical이다. 기존99 사례 중 출구 ×0.5/×0.4 단일 assertion 변경의 이유는 M1에 명시했다. 원본 `src/**`, 원본 HTML, 원본 병사 GLB의 git diff0. v9 파생 GLB10,579,016B / `0ca0af733fd5c1bd6a601ce098ca7d3551442aa7605982c67819f5c71c4c6042`가 v10/v11과 동일하다.

외부 검증은 공식 테스트 수에 더하지 않는다. `scripts/check-training-medical.mjs`의 production 조작/고정 사격/의료 타이머, `scripts/check-training-retarget.mjs`의 실제 Idle 전체 재생, `scripts/compare-training-m.mjs`의 보존한 v10 사격 결과 대조를 따로 보관한다. v10의 기존11조건15발에서 인체 이전 방호18판정의 **전체 결과와 마모가 deepEqual**이며 총구/방향/첫 인체 진입도 같다. 기존 v11 A 자세10조건, 새 arm-first1조건, 이전 v10 crouch2조건은 모두 조준점을 유지한다. crouch는 debug 전용이며 기본 게임은 A 고정이다.

600틱·6발 총구/방향/시선/렌더 카메라/걸음은 실제 v10 빌드와 정확히 같았다. 메뉴를 연 실제 frame60회에도 의료 snapshot이 변하지 않았고 3개 조건은 production tick3600회(60초)를 연속 진행했다. 피격 메시·방호 변환에는 의료 상태를 적용하지 않는다. 초기화 exact/의료 결정성/원본 검증 오류0은 공식 의료 시험에서도 확인한다. 추출 대상에 AED/CPR 실행 함수가 없다.

| 같은 production 사격 | 진입 m/s(동일) | v10 출구 m/s | M 출구 m/s | v10 / M 체내 J | 인체 이후 v10 → M |
| --- | ---: | ---: | ---: | ---: | --- |
| bare-forearm | 879.000 | 439.500 | 846.739 | 1164.756 / 111.906 | thin_metal 통과 후 바닥 정지 → 같은 판 통과 후 바닥 도탄·최대거리 종료 |
| front-neck | 533.574 | 266.787 | 452.900 | 429.187 / 159.961 | 후면 soft-neck 저지 → 동일 저지(입력 잔여탄·마모는 달라짐) |
| soft-through-body-rear | 546.789 | 273.395 | 418.723 | 450.710 / 248.535 | 후면 soft-rear 저지 → 동일 저지(입력 잔여탄·마모는 달라짐) |

후면 방호·장애물의 결과까지 불변이라고 주장하지 않는다. 인체 이전 판/소프트/헬멧의 함수·RNG·결과는 유지하고 새 잔여탄 이후만 달라진다. 전체 before/after/마모/장애물은 [v10 수치 비교](../downloads/checks-medical/v10-comparison.json)에 있다. v10 체내 J는 당시 진입/출구 속도와 canonical 질량으로 사후 계산한 비교치다.

| 60초 연속 의료 | 혈액 ml 시작 → 끝 | 의식 시작 → 끝 | 일시정지 |
| --- | --- | --- | --- |
| 팔뚝 | 5000 → 4503.274 | 100 → 100 | exact |
| 목 | 5000 → 3679.430 | 80 → 100(급성 반응 회복) | exact |
| 소프트 뒤 몸통 | 5000 → 4472.307 | 100 → 100 | exact |

의식이 낮아지는 결과를 임의로 만들지 않았다. 원본의 급성 반응 회복과 출혈 경로를 기록한다. 의료 패널: [팔](../downloads/checks-medical/medical-bare-forearm.jpg) · [목](../downloads/checks-medical/medical-front-neck.jpg) · [몸통](../downloads/checks-medical/medical-soft-through-body-rear.jpg). 목/몸통에는 피부 사건1개와 후면 방호 둔상 기록1개가 있으며 팔→몸통에는 피부 사건2개+후면 둔상1개/상처2개다. 피부 사건 수와 관통 부위 수를 비교할 때 둔상 기록은 따로 센다.

전체21메시·6면·세부 주소와 미대응0은 [의료 대응표](training-medical-address-map.json)에 있다. 원본 출처28파일/237선언과 파일·선언별 SHA256은 최종 `training-build-info.json`의 `legacyMedicalSources`에 들어 있다. original `createMedical`/`makeUnit` 초기화 및 `applyDamageEvent`/`tickMedical` 계산을 고치지 않았다. 원본 선언의 중복 object key 때문에 esbuild가 빌드 경고를 출력하나 원본을 수정하지 않고 유지한다. 브라우저 콘솔/페이지 오류와 구별한다.

수치 출처: 탄약 질량·medical/partDestruction/wound/혈역학/방호 registry·임계값은 **원본**. 인체 출구 비율·cost 에너지 배분·인체 기준 길이·소프트 경사 증폭·리타깃 골반 스케일/발 고정은 **3D 연결 튜닝**. 새로운 현실 방호력을 공식/비공식 자료에서 만들지 않았다. 원본 Br4/6B45/6B47 모델 값이 실물 방호를 보증하지 않는다.

주요 새 파일/함수: `scripts/training-medical.mjs/generateMedical`(원본 선언 closure와 SHA), `generated/legacy-medical.js/createLegacyMedical`(재생성), `medical-address.js/toMedicalAddress,medicalAddressTable`, `medical.js/TrainingMedical`(초기화·사건·tick·snapshot·검증), `medical-panel.js/renderMedicalPanel`, `debug/soldier.js/withDebugSoldier`, `debug/retarget.js/loadRigOnlyGLB,auditBoneMap,retargetMixamoIdle,debugRetargetPlayer`. 기존 변경 함수는 M1/M3/M4 항목에 정리했다. template/styles에는 메뉴 의료 패널, main에는 기록/tick/초기화 연결, package/lock에는 원본 선언 분석용 acorn/eslint-scope를 추가했다.

한계: 8개 시험 레인의 armor는 여전히 null/미보정이다. 인체는 외피·숨은 영역 저작 근사이고 기준 길이는 튜닝이며 내부 장기·뼈·혈관 메시가 없다. 의료 metadata의 3D 깊이/침착 J를 원본 의료 2D 후보 계산에 강제 주입하지 않아 medicalDepth는 다를 수 있다. dead guard 이후 사건은 기록하지만 원본 상처 추가는 중단된다. 치료·AED/CPR·의료에 따른 동작/쓰러짐·전투 NPC는 없다. 동적인 기존 v9 시각 스킨 문제와 CC 모델 투입/최적화는 후속이다. Chromium/소프트웨어 GPU에서 검증했으며 **S24 실기기 미검증**이다.


## 사용자 후속 요청: 기존 모델의 시각 스킨 수리(v13)

M4 뒤 사용자가 기존 캐릭터의 몸통·보호대·끈 연결도 수리하도록 요청했다. 원본/v9 GLB·24개 계층·4클립·피격/방호·M 의료 계산을 보존하고 **별도 `soldier-skinned.glb` 파생본**을 배포 HTML의 시각 모델로 쓴다. M4 최초 시험에서 남았던 문제 중 없는 몸통 안쪽 표면과 잘못 붙은 무릎/어깨 부착물을 수리했다. [원인·변경·검증·제한](training-skin-verification.md)을 따른다. M1→M2→M3→M4 독립 커밋 뒤 후속 스킨을 별도 커밋했으며 최종 HTML은 하나다.
