# CQB TACTICAL 구조 감사

기존 탄약·방호·의료 계산과 AI의 기억·판단 모델은 3D 싱글플레이 PvE에서도 재사용할 가치가 높다. 다만 현재 실행 코드 전체가 브라우저 전역 상태와 2D 기하에 결합되어 있으므로, HTML을 Three.js로 바꾸는 것만으로 FPS 전환이 성립하지 않는다. 원본을 회귀 검증 기준으로 보존하고, 새 앱에서 계산 계층을 단계적으로 추출하는 방향을 채택한다.

이 문서는 최초 정적 감사 기록이다. 이후 구현 단계에서는 원본을 유지한 채 시스템별 소스와 빌드를 추가했고 모바일 가로화면을 주 플랫폼으로 확정했다. 변경된 개발 구조와 동적 검증 결과는 [개발 안내](development-guide.md)에 기록한다. 아래 기준과 줄 번호는 최초 감사 시점 그대로 유지한다.

## 감사 기준

- 저장소: [0-FLANDRE-0/CQB-HTML](https://github.com/0-FLANDRE-0/CQB-HTML)
- 기준 브랜치: `claude/cqb-simulator-review-c4o35v`
- 기준 커밋: [cef2ff00b3a3eb68719b4127003b8c90ef62629a](https://github.com/0-FLANDRE-0/CQB-HTML/commit/cef2ff00b3a3eb68719b4127003b8c90ef62629a)
- 감사일: 2026-10-09
- 본편 버전 배지: `0.40.4-CCHK2-WIP1-R2`
- 범위: 전체 본편 텍스트와 README, 저장소 파일 트리의 정적 감사. 구조와 대표 실행 경로를 조사했으며 전체 함수의 동적 동작을 검증한 것은 아니다. 기존 브라우저 스위트, 플레이 성능, 3D 라이브러리 통합은 이번 단계에서 실행 검증하지 않았다.
- 최초 감사 변경: 설계 문서만 추가했다. 실행 HTML, README, reference, 데이터, 밸런스와 의존성은 그 단계에서 변경하지 않았다.

아래 본편 링크는 모두 기준 커밋에 고정한다. 줄 번호는 이 커밋의 HTML을 기준으로 하며 향후 변경 시 달라질 수 있다.

## 저장소 구조

| 경로 | 확인한 역할 | 전환 시 처리 |
| --- | --- | --- |
| `CQB_Tactical.html` | 약 3.64MB, 약 6.05만 줄. CSS, DOM, 데이터 레지스트리, 전투·의료·AI, Canvas 렌더링, 자체 검증이 한 파일에 공존 | 원본을 그대로 유지하고 새 앱과 나란히 실행 |
| `README.md` | 실행 방법, 계산·AI 기능, 스위치, 실험과 실패 기록 | 감사의 보조 설명. 현재 코드와 대조해 해석 |
| `reference/tactical_prototype_0.8.0.html` | README가 설명하는 공간 인지 원형 | 설계 참고용. 본편 대신 계산 정본으로 사용하지 않음 |
| `.gitignore` | 기존 제외 규칙 | 이번 단계에서 변경 없음 |

기준 트리에는 `package.json`, 외부 모듈 구조, CI 워크플로, LICENSE, AGENTS.md가 없다. README의 “약 54,000줄”과 JS 끝 위치는 현재 본편보다 오래된 설명이다. 구현 시 구획의 줄 범위를 고정 복사하기보다 심볼과 의존 관계를 기준으로 추출해야 한다. 본편의 버전 배지는 [L1803](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L1803)에 있다.

## 현재 실행 흐름

`init`가 DOM과 로드아웃을 초기화하고 RAF 루프를 시작한다. `setupGame`이 맵과 유닛을 구성한다. `frame`은 브라우저 프레임 간격을 0.05초로 제한한 가변 dt를 사용하며, 문 갱신→시야 갱신→유닛별 갱신→소음→효과→먼지→승패 판정을 실행한다. 같은 함수 안에서 명부·카드·미션 UI와 Canvas도 갱신한다.

`updateUnit`에는 생리 진행, 자세, 인지, AI 선택, 개인 공간 보정, 투척, 치료, 이동과 사격이 함께 들어 있다. FPS 플레이어를 기존 아군으로 생성하면 플레이어에게도 AI와 자동 이동·사격 경로가 적용될 위험이 있다. 유닛 생리·전투 갱신과 컨트롤러별 의사결정을 분리해야 한다.

근거: [frame L58708](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L58708), [init L58745](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L58745), [updateUnit L49947](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L49947).

## 재사용 판단

“높음”은 계산과 데이터 보존 가능성이 높다는 뜻이며 현재 함수를 수정 없이 모듈로 import할 수 있다는 뜻은 아니다. 코드 재사용률의 수치 추정은 하지 않는다.

| 시스템 | 기존 심볼과 근거 줄 | 보존할 내용 | 분리 또는 교체할 내용 | 판단 |
| --- | --- | --- | --- | --- |
| 장비 데이터 | `BODY_ARMOR_REGISTRY` 2765, `HELMET_REGISTRY` 3191, `PLATE_REGISTRY` 4518, `WEAPON_REGISTRY` 8327, `AMMO_REGISTRY` 15484 | ID, 수치, 호환성, 정본과 legacy 비교, builder | DOM 옵션 생성, 초기화 순서와 후속 profile 주입 | 높음 |
| 운동량·에너지·감쇠 | `computeProjectileKinetics` 5581, `getDistanceVelocityRetention` 7427 | 스칼라 계산과 보정 규칙 | 거리·속도 단위와 계산 소유권 명시 | 높음 |
| 장벽 방호 | `computeBarrierEffectiveArmor` 25567, `_applyBarrierLoss` 18713, `calcRicochetChance` 18497 | 재질, 통과 길이 기반 저항, 잔여 위협 감쇠 | entry/exit의 px 계약, 2D 법선, 세계 조회 | 높음에서 중간 |
| 탄도 탐색 | `raycastShot` 18661, `raycastSegment` 18809 | ShotState와 관통·도탄 이벤트 흐름, 예산 | AABB·원형 hitbox 탐색, XY 방향과 continuation origin | 교체 필요 |
| 피격과 방호 주소 | `resolveImpact` 22300, `rollProtectionAddressCoverage` 20218 | 주소별 장비 층 선택, soft backer, 내구도 소유자, 결과와 AAR 계약 | 부위·세부주소 확률 추첨, 사수 위치 기반 방위 | 높음이나 진입 경계 필수 |
| 인체·상처 | `applyOutcome` 17618, `buildBodyTrajectoryContext` 27477, `processWoundEvent` 29574, `applyDamageEvent` 30415 | 피격→상처→생리 연결과 급성 반응 | 효과·로그 부수효과, 2D continuation, 실제 3D 인체 궤적으로 오해할 명칭 | 높음 |
| 생리 | `createMedical` 25800, `tickMedical` 30659 | 출혈→흉부외상→저산소→스트레스→보상→혈역학→활력→의식→성능→요약 순서 | 전역 시간, legacy 상태 동기화 경계 | 높음 |
| 치료 | `startTreatment` 48319, `MEDICAL_RESOURCE_DEFAULTS` 48497, `tickPendingMedic` 49534 | 치료 자원, 처치 시간과 효과, 취소 규칙 | 클릭 대상·접근 이동·DOM 오버레이, updateUnit 내부 치료 tick | 중간 |
| AI 인지와 기억 | `checkVisibility` 33789, `SpatialPerception` 35426, `tickSpatialPerception` 호출 50060 | 관측·기억·신뢰도·감쇠·반증, 눈멂과 청각 제한 | 2D 감각 ray, 실제 높이 LOS, 세계 접근 | 중간 |
| AI 판단 | `buildAIContext` 41251, `tickUtilityAI` 43124 | 의료·제압·탄약·기억 기반 점수, 행동 유지와 재평가 | UNITS와 MAP_DATA 직접 접근, 이동·사격 실행 | 중간 |
| 경로와 엄폐 | `findPath` 25163, `buildTacticalSpatialGraph` 38892, `findBestObservedCover` 44013 | 단층 A*와 믿음 기반 계획, 관측 엄폐 후보의 의미 | 실제 충돌, 3D 자세별 엄폐 검증, 다층 topology | 단층에 한해 중간 |
| 문 | `tickDoors` 22976 | 접근·시간·상태 전이, geometry revision | 닫힘/열림 AABB와 시각적 스윙의 불일치 | 중간 |
| 소음·섬광·먼지 | `emitNoise` 45344, `USE_FLASHBANG` 44461, `sampleDustAlongLOS` 24669 | 감각 차단과 게임플레이 사건 | 화면 알파 의존, 2D 구름·법선·전파 모델 | 후속 이식 |
| AAR | `aarInit` 21370, `aarRecordImpact` 21552 | 전투 사건과 장비·의료 snapshot | 전역 수집·DOM 보고서 | 높음에서 중간 |
| 승패·인벤토리 | `checkWinLoss` 51284, `makeUnit` 32439 | 상태 어휘와 장비 정의 | 전멸 승리, 팀 로드아웃, 레이드·stash·일반 루팅 부재 | 신규 개발 |
| 화면과 조작 | `canvas` 33334, `ctx` 51314, `render` 51348 | 디버그 정보의 의미 | Canvas 화면, 포인터 명령, 화면 좌표 변환 | 신규 3D 표현 |

## 주요 전환 위험

### 3D 접촉과 기존 피격 추첨

현재 ray는 유닛의 원형 hitbox를 찾고, `resolveImpact`가 `rollHitLocation`으로 신체 부위를 선택한다. `buildCoverageImpactAddress`도 세부 zone을 확률로 만든다. 주소가 정해진 뒤의 방호 층 선택은 결정형이지만, 주소 생성 자체가 결정형인 것은 아니다.

이미 `forcedLocation`, `forcedAspect`, `forcedIsLeft`, `forcedImpactAddress` 검증 훅이 있다([L22385](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L22385)). 따라서 이식 실험의 발판은 존재한다. 그러나 훅 적용 전에 부위 추첨이 실행되어 RNG를 소비한다. 장기 계약은 3D Contact를 받는 별도 진입점에서 이 추첨을 우회하는 것이다. 본편의 일반 플레이 경로는 보존한다.

신체 좌우, 진입 면, 부위, zone, subZone, 내구도 슬롯을 하나의 주소로 확정해 방호·의료·AAR에 공유한다. 3D에서는 도탄 후 탄의 진행 방향과 접촉 법선으로 방위를 계산해야 한다. 원래 사수 위치만 보면 도탄·관통 후 방향을 잘못 판단할 수 있다.

### 거리와 감쇠

`PX_PER_M = 32`가 본편 단위 경계다([L2470](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L2470)). 장벽 계산은 entry/exit 차이를 px로 받아 m로 환산한다. 3D ray의 m 값을 그대로 넣으면 길이와 방호가 32배 어긋난다.

`resolveImpact`는 입력 `shotVelocity`에 거리 retention을 적용한다([L22408](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L22408)). 3D 탄도 계층이 이미 거리 감쇠를 적용한 속도를 넘기면 중복 적용 가능성이 있다. 새 계약에서 muzzle velocity, 장벽 후 velocity, 최종 impact velocity를 분리하고, 기존 동작과 대조한 뒤 감쇠 소유권을 한 곳으로 정한다. 실제 결함이 재현되기 전 기존 공식을 수정하지 않는다.

### 전역 상태와 화면 부수효과

`GAME`은 시뮬레이션 시간·결과·전투 사건과 선택 ID·편집·디버그·화면 상태를 함께 저장한다. `UNITS`, `MAP_DATA`, 전역 RNG도 계산에 직접 사용된다. `log`는 메시지를 저장한 직후 `renderLog`를 호출한다([L33320](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L33320)).

단순 DOM stub으로 실행되게 만드는 것은 최종 분리가 아니다. headless core에서 문서·Canvas·Three.js import 없이 계산이 가능하고, 표현을 꺼도 전투 결과가 같아야 분리가 완료된다.

### 화면 갱신에 의존하는 감각

`renderDustClouds`가 `updateDustClipProfileIfNeeded`를 호출한다([L24702](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L24702)). `sampleDustAtPoint`는 clipRadii와 `visualAlpha`를 읽고, `checkVisibility`의 wrapper는 그 결과를 판단에 반영한다. GAME의 “순수 시각 레이어” 주석은 현재 소비 경로 전체를 설명하지 않는다.

3D 이식 전 구름의 감각 밀도·가림 프로필을 simulation tick에서 갱신해야 한다. headless 실험에서 render를 생략하면 AI가 다르게 보게 되는 문제를 먼저 검증한다. 첫 레이드에서는 이 분리를 완료할 때까지 연막·섬광·수류탄을 제외한다.

### 의료 상태와 타이머의 소유권

`medical.wounds`는 상처 기반 출혈의 정본이며 bodyParts 값은 다음 tick에서 파생값으로 갱신된다([L30456](https://github.com/0-FLANDRE-0/CQB-HTML/blob/cef2ff00b3a3eb68719b4127003b8c90ef62629a/CQB_Tactical.html#L30456)). 레거시 hp·pain·combatState는 동기화 산물로 유지한다.

`tickMedical`만 추출하면 완성되지 않는다. knockdown timer는 updateUnit이, 치료와 약물 지연·지속도 updateUnit 내부가 소유한다. 같은 타이머를 새 ActionSystem과 의료 tick이 동시에 감소시키거나 누락하지 않도록 필드별 소유권 표가 필요하다.

### AI의 믿음과 실제 세계

시야의 실제 장애물 질의와 AI의 기억 기반 계획은 서로 다른 계약이다. 실제 이동은 참 기하로 막고, 믿음 기반 계획은 틀릴 수 있어야 한다. 단층 맵에서는 기존 XY 기억·A*를 XZ 바닥면에 투영할 수 있지만, 수직 시야와 자세별 엄폐는 3D 질의로 보완해야 한다.

`USE_BELIEF_TOPOLOGY`, `USE_FUNNEL_COST`, `USE_OBJECTIVE`는 기준 코드에서 false다. 미완료·비활성 기능을 기존 검증된 기능으로 취급하지 않는다. README의 “재질 믿음은 판단 미연결” 설명도 현재 `USE_BELIEF_BARRIER = true`와 함께 재확인이 필요하다. 구현 시작 시 각 스위치의 선언, 실행 게이트와 실제 소비자를 기록한다. 특히 기존 team === 'enemy' 조건에 맞게 PvE NPC를 매핑해야 한다.

### 레이드 종료

기존 승리는 모든 반응형 적이 제거되면 즉시 발생한다. 익스트랙션에서는 적 전멸이 탈출을 대신할 수 없다. 레이드 종료와 stash 반영을 신규 RaidSession이 소유해야 한다. 의식 있는 downed 상태는 기존 의료 계약을 유지하며, 싱글플레이 실패 정책은 별도로 정의한다.

## 원본 안정성 보존

1. 기준 커밋과 HTML blob `ff20dc25c9835698c7a90653014d0fe0d51eda30`을 회귀 기준으로 고정한다.
2. 원본 파일 경로와 실행 방법을 유지한다. 3D 앱은 별도 엔트리와 빌드 디렉터리를 사용한다.
3. 정본 데이터와 builder를 보존하고, UI용 필드 정리는 별도 변경으로 한다. terminalProfile 후속 주입 같은 초기화 의존성을 먼저 재현한다.
4. 추출·기하 변경·FPS 밸런스 변경을 각각 다른 구현 PR로 진행한다.
5. 외부 RNG를 주입하되 기존 seeded sandbox가 Math.random을 교체하는 동작과 복원 보장도 검증한다. 재생은 같은 runtime·버전·순서 조건으로 한정한다.
6. 기존 스위트의 ON/OFF·sandbox 범위를 보존한다. 일부 AI 하네스는 spatial 스위치를 강제로 끄므로 그것만 통과했다고 최신 믿음 경로까지 검증했다고 말하지 않는다.

## 구현 전에 실행할 기존 검증

| 기존 진입점 | 검증 목적 |
| --- | --- |
| `validateAllPresets` 및 registry 대 legacy 비교 | 정본 전환·장비 호환성. validator error 0, warning은 기준 목록과 비교 |
| `runImpactWoundClosureSuite` 및 필요 시 mutation tests | 피격 주소·방호·상처 계약과 검증 자체의 유효성 |
| `runPartDestructionClosureSuite` | 부위 파괴와 생리·전투 상태 |
| `runAI0ACommandClosureSuite` | 명령 우선순위와 실행 |
| `runAI0BSpatialClosureSuite` | 공간 인지의 기존 계약 |
| `runAI0C1CoverSlotCheckpointSuite` / `runAI0C2PortalRiskCheckpointSuite` | 엄폐 슬롯과 문간 위험 |
| `SpatialPerception.runSelfTests` | 공간 인지와 추가 행동. README에는 152종으로 기록되지만 실제 pass 수는 실행 결과로 확정 |

최초 정적 감사에는 위 검증의 통과 결과가 포함되지 않았다. 후속 소스 분리 단계에서 브라우저 비교를 실행했으며 [개발 안내의 검증 결과](development-guide.md#현재-검증-결과)에 seed·pass/fail·경고와 범위를 기록했다.

후속 설계: [3D 전환 아키텍처](3d-extraction-architecture.md), [첫 레이드 프로토타입 개발 계획](raid-prototype-plan.md).
