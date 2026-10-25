# CQB Training 지시서 Q — 의료 생리 엔진 수리 (3D 우선)

Oct 10, 2026 · @다고쿠

## 개요와 구조 원칙

Q는 P3에서 드러난 2D 원본 의료 생리 엔진의 결함 5개(사망 경로, 의식 곡선, 원인 라벨, 쇼크, 통증)를 **3D에서 먼저** 고친다. 원본 코드는 덮어쓰지 않으며, 나중에 2D로 그대로 옮길 수 있는 형태로 만든다. 형상·탄도·방호·피격 판정은 건드리지 않는다.

1. **별도 모듈 `medical-v2`.** 고친 함수는 원본과 같은 시그니처 `(unit, dt)`와 같은 `medical` 객체 필드를 쓰는 새 함수로 만든다. tickMedical 순서표의 해당 슬롯만 교체한다. 새 필드는 추가만 하고, 기존 필드의 의미를 바꿔야 하면 장부에 명시한다. 원본 `src/**`와 `generated/legacy-medical.js`의 원문 선언은 무수정.
2. **모드 스위치 `medicalModel: 'legacy' | 'v2'`.** 훈련장 기본값은 v2. legacy 모드에서는 v15 결과가 그대로 재현돼야 한다(검증 절 참고).
3. **변경 장부** `docs/medical-v2-ledger.md` + 같은 내용의 JSON. 항목마다 번호(Q1-a 등), 원본 함수명과 원본 소스 파일:줄, 변경 전/후 수식, 이유(P3의 어느 행·현상), 근거 구분, 2D 이식 시 의존 필드를 적는다. 나중에 2D 이식은 이 장부만 보고 한다.
4. **근거 구분.** 모든 새 값은 셋 중 하나로 표시한다: 공식·문헌 출처(링크와 판본, 직접 연 페이지만), 원본 값, 튜닝값. 게임 척도를 임상 척도와 동일시하지 않는다(의식 0–100은 GCS가 아니고, shock 0–100은 임상 분류가 아니다).
5. H01은 계속 A자 고정 표적이다. 쓰러지는 동작은 이번에 넣지 않는다.

## Q0 사전 조사 (코드 변경 없이 먼저 보고)

검수 쪽에서 v15 번들을 읽고 아래 원인을 추정했다. Q1\~Q5를 고치기 전에 P3 5개 시나리오에서 실제로 맞는지 확인하고 `docs/training-q0-diagnosis.md`에 기록한다. 다르면 실제 원인을 적고, 같은 원칙을 실제 원인에 적용한다.

| 현상 (P3) | 추정 원인 | 확인 방법 |
| --- | --- | --- |
| 목·몸통·팔→복부 모두 `neck_destroyed`로 사망, 손실 약 40% 부근에서 급사 | `updateSystemicHypoxiaDamage`가 bloodMl < 3350에서 **모든 부위 HP**를 깎는다(혈량 구간별 0.6/2/4.5/8 × 부위 계수). 목 HP가 먼저 0이 되면 `recalcMedicalSummary`가 살아 있는 동안에도 deathReason을 `neck_destroyed`로 선점하고 lifeStatus를 5로 누른다. 가슴/복부 HP ≤ 5의 −30/−20이 더해져 lifeStatus 0 → `syncLegacyCombatState`가 즉시 isDead. | 틱별 부위 HP, lifeStatus 항목별 기여도, 사망 직전 0을 넘긴 항목을 시나리오별로 표로 |
| 의식이 100→80 계단, 의식 80에서 사망 | `updatePainShockConsciousness`의 의식 목표값이 계단식 합: SBP<90 −20, SBP<70 −50, shock>70 −30, blood<2000 −40, 호흡<35 −25, O₂ 전달<0.5 −20, 비보상 −10. isUnconscious는 의식 < 20. | 의식 목표값과 켜진 항목을 틱별 기록 |
| 팔→복부는 26% 손실에도 shock 0, 몸통은 초반부터 상승 | shock는 blood<3000 또는 비보상일 때만 +2/s, 조직관류<0.55일 때 +1/s, 그 외에는 내부 손상의 shockBoost뿐이다. 몸통 케이스는 shockBoost 때문에 초반부터 오른다. | shock 증가 항목별 기여 기록 |
| 전역 pain 20\~40초에 0, 부위 pain은 그대로 | 전역 pain은 −1.5/s로 0까지 감소하고 partPain과 연결이 없다(P2 확인). | P2 결과 인용 |

추가로 v2가 입력으로 쓸 기존 혈역학 필드를 목록화한다: `hemodynamics.map`, `tissuePerfusion`, `oxygenDelivery`, `volumeRatio`, `compensatedShock`, `decompensatingShock`, `compensationExhaustion`, `preArrestRisk`, `_heartRateState`(`peri_arrest` 포함), `buildCardiacRhythmModel` 출력. 각 필드의 원본 정의·범위와 P3 주요 시점(손실 15/30/40%, 사망 직전) 값을 표로 남긴다.

## Q1 사망 경로: 의식 저하 → 의식불명 → 심정지 → 사망

출혈사는 부위 HP 장부가 아니라 혈역학으로 죽게 한다. 사망 직전에는 반드시 의식불명과 심정지 상태를 거친다.

- **Q1-a 허혈성 부위 손상 분리.** `updateSystemicHypoxiaDamage`가 깎는 양을 외상 HP에서 분리해 부위별 `ischemicLoad`(새 필드)에 쌓는다. 부위 파괴 판정, `head_destroyed`/`neck_destroyed`, lifeStatus의 부위 HP 조건은 외상 HP만 본다. ischemicLoad는 기록하고 성능 계수에만 쓰며, 사망 판정에는 쓰지 않는다.
- **Q1-b 심정지 상태 `cardiacArrest`.** 원본의 즉사 조건 중 혈역학 조건(exsanguination: blood<1200, cardiac\_failure: SBP<30 & blood<1800)을 즉사가 아니라 심정지 진입으로 바꾼다. 원본 심박 상태가 `peri_arrest`로 일정 시간 유지되거나 산소 전달이 임계 아래로 유지되면 역시 심정지로 간다. 유지 시간과 임계값은 튜닝값으로 표시한다.
- **Q1-c 심정지 중 생리.** HR·SBP·DBP는 0, 조직관류·산소 전달은 0이 된다. 혈압이 없으므로 외부/내부 출혈 속도도 크게 줄여야 한다(감소 방식은 튜닝값). 의식은 수 초 안에 0으로 간다. 뇌 순환이 멈춘 뒤 의식을 잃는 시간은 문헌을 찾아 출처를 적는다(예: Rossen·Kabat·Anderson 1943의 급성 뇌혈류 차단 실험을 원문으로 확인). 확인하지 못하면 10초를 튜닝값으로 표시한다.
- **Q1-d isDead.** 심정지가 `ARREST_TO_DEATH_S` 동안 연속되면 isDead로 바꾼다. 기본 300초(튜닝값)이다. 훈련장에는 소생술이 없어 결과는 같지만, 나중에 치료를 넣을 때 이 구간이 소생 가능 시간이 된다. 심정지 상태에서도 isDowned·isUnconscious는 true다.
- **Q1-e 직접 치명상은 유지.** 외상 HP 기준 `head_destroyed`는 원본처럼 즉사다. 외상 HP 기준 `neck_destroyed`는 원본 효과(lifeStatus 상한 5)를 유지한다.
- **Q1-f lifeStatus는 요약 점수로만.** v2에서 `lifeStatus ≤ 0`은 더 이상 사망 조건이 아니다. 계산식과 다른 용도(다운 조건 <25, HR 계산, 표시)는 유지한다. 목 상한 5는 외상 HP에만 걸린다(Q1-a).

## Q2 의식 곡선: 관류에 따른 연속 저하

의식 목표값을 계단식 합에서 뇌 관류 대리값의 연속 함수로 바꾼다. 목표는 100→80 같은 계단과 절벽을 없애는 것이다.

- **Q2-a 입력.** 기존 `hemodynamics.map`(평균동맥압)과 `oxygenDelivery`를 주 입력으로 쓴다. 뇌혈류 자동조절의 하한 MAP은 생리학 교과서나 리뷰 출처를 찾아 적는다. 그 위에서는 의식 감소가 거의 없고, 그 아래로 내려갈수록 연속으로 낮아지게 한다. 하한 아래 곡선 모양과 의식 0이 되는 MAP은 튜닝값이다.
- **Q2-b 나머지 항목.** 호흡 효율, 비보상 쇼크는 계단 대신 연속 항으로 바꾼다. SBP·bloodMl 계단은 MAP 항과 중복되므로 v2에서 뺀다. 원본 `transientNeurologicDisruption`(목 피격 직후 80)과 내려갈 때 dt×1.2, 올라갈 때 dt×0.3의 추종 속도는 유지한다.
- **Q2-c 임상 경향과의 관계.** ATLS10 표는 III등급(31–40%)부터 의식 저하 경향을 보인다. v2에서도 출혈만 있는 시나리오는 III 구간에서 의식이 눈에 띄게 내려가기 시작해야 한다. 게임 의식을 GCS로 환산하거나 표에 수치를 맞추지는 않는다.
- **Q2-d 임계값 유지.** isUnconscious(의식 < 20)와 의식 기반 다운 조건(< 30), canShoot/canWalk/canCrawl 임계는 원본 값 그대로다. 바뀌는 것은 의식이 거기에 도달하는 경로뿐이다.

## Q3 사망·쓰러짐 원인 라벨

원인 라벨은 상태가 바뀌는 순간에만, 그 순간의 실제 조건으로 정한다. 살아 있는 동안 deathReason을 선점하지 않는다.

- **Q3-a deathReason.** isDead로 바뀔 때 정한다. 우선순위는 직접 치명상(`head_destroyed`, 외상 HP 기준 `neck_destroyed`) 다음에 심정지 원인이다. 살아 있는 동안 부위 상태는 별도 필드에만 기록한다.
- **Q3-b arrestReason(새 필드).** 심정지 진입 시 정한다. 코드 후보는 `hemorrhagic_shock`, `exsanguination`, `respiratory_failure`(긴장성 기흉 등 흉부 외상 모델 기반), `hypoxia`다. 주 원인 1개와 기여 요인 목록(혈액 손실%, SBP, MAP, O₂ 전달, 호흡 효율)을 값과 함께 남긴다. 심정지로 죽으면 deathReason은 arrestReason을 따른다.
- **Q3-c downReason.** isDowned로 바뀔 때 `syncLegacyCombatState`의 다운 조건 중 켜진 것을 기록한다: `low_consciousness`(<30), `hypotension`(SBP<70), `shock`(>85), `critical_status`(lifeStatus<25), `incapacitated`(이동·사격 불가), `blood_loss`(<2000 ml). 켜진 것 전부와 고정 우선순위로 고른 주 원인 1개를 남긴다. 우선순위는 장부에 적는다.
- **Q3-d 표기.** 코드는 영문 식별자로 두고, 한글 표시는 이번에 하지 않는다. 기존 필드의 이름과 타입은 유지한다.

## Q4 쇼크 불일치

쇼크 점수는 같은 혈역학 상태에서 같은 값으로 가게 한다. 지금은 혈량 3000 ml라는 문턱 하나에 걸려 있어서 팔→복부는 26% 손실에도 0이다.

- **Q4-a 목표값 방식.** shock도 의식처럼 목표값을 향해 추종하게 바꾼다. 목표값은 원본이 이미 계산하는 `volumeRatio`, `tissuePerfusion`, `compensatedShock`, `decompensatingShock`, `compensationExhaustion`의 연속 함수다. 보상성 쇼크부터 오르기 시작하고, 비보상에서 크게 오른다. 가중치는 튜닝값이다.
- **Q4-b 원본 요소 유지.** 상승 속도 상한(+2/s), 내부 손상의 shockBoost, 회복 규칙(blood>3500이고 출혈<5일 때 −0.8/s)은 유지한다.
- **Q4-c 확인.** 같은 손실%에서 시나리오끼리의 shock 차이는 shockBoost·호흡 등 출혈 외 입력으로만 설명돼야 한다. 손실 30% 시점에 손실이 있는 모든 시나리오에서 shock > 0이어야 한다.
- shock 0–100은 게임 점수다. ATLS 등급이나 쇼크 지수 같은 임상 척도로 표현하지 않는다.

## Q5 통증: 상처가 있으면 바닥 통증 유지

상처가 그대로인데 전역 pain이 0이 되는 것을 막는다. 맞은 직후에 덜 느끼는 현상은 pain을 지우는 방식이 아니라, 원본에 이미 있는 인지 통증 둔화(painMasking)로 표현한다.

- **Q5-a 두 성분.** 전역 pain = max(급성 성분, 바닥 성분). 급성 성분은 피격 시 원본대로 오르고 원본 속도 1.5/s로 줄어들지만, 바닥 성분 아래로는 내려가지 않는다. 바닥 성분은 살아 있는 부위 pain(partPain)의 함수다. 예: 가장 큰 부위 pain + 나머지 합의 일부, 상한 100. 식과 계수는 튜닝값이다.
- **Q5-b 인지 통증.** 원본 `perceivedPain = pain × (1 − painMasking)`과 아드레날린·전투흥분·진통제 기반 painMasking(상한 0.85)은 그대로 둔다. 전장 부상자가 급성기에 통증을 적게 호소한다는 관찰(Beecher 1946, *Pain in men wounded in battle*, Annals of Surgery)을 원문으로 확인해 출처로 달고, 정성적 근거로만 쓴다. 수치 근거로 쓰지 않는다.
- **Q5-c 의식과 인지.** isUnconscious 또는 심정지이면 perceivedPain은 0이다. pain 자체는 유지해서 기록에 남긴다.
- **Q5-d 연쇄 변화 기록.** pain은 injuryDrive → 아드레날린 → painMasking·HR에 이어진다. pain이 유지되면 HR·BP·전투효율도 바뀐다. legacy 대비 달라진 값을 표로 남기고 어떤 연쇄로 바뀌었는지 적는다. 그 연쇄를 막기 위한 추가 튜닝은 하지 않는다.

## Q6 P1 후속 정정: M4 스크린샷과 ORM 품질 기준

P1 스크린샷 중 M4 4장(비조준/조준 × 렌즈 0/70)이 v13·P1 각각에서 픽셀까지 같은 이미지다. 조준도 렌즈 값도 적용되지 않은 채 찍혔는데, 보고서는 “실제 ADS 정착 위치”라고 적었다.

- **Q6-a 재촬영.** v13 텍스처와 현재 텍스처로 4상태를 다시 찍는다. 각 장마다 AimState 조준 진행도(조준 = 1, 비조준 = 0)와 렌더러에서 다시 읽은 렌즈 값을 JSON에 기록한다. 같은 버전 안의 4장이 서로 다르다는 것을 자동 검사해 실패하면 중단한다. P1 문서의 해당 문장을 정정하고 정정 사실을 남긴다.
- **Q6-b ORM 품질 기준.** P1의 SSIM ≥ 0.97 기준이 baseColor에만 적용됐다. M4 metallicRoughness/occlusion 2장(weapon/1 0.915, weapon/4 0.956)도 같은 기준을 맞추도록 q를 올린다. q100으로도 못 맞추면 무손실로 둔다. 용량 변화를 표에 추가한다. 다른 텍스처는 건드리지 않는다.

## 공통 검증

legacy 모드는 v15와 완전히 같아야 하고, v2 모드는 아래 불변 조건을 어기면 실패다.

**회귀 (바뀌면 안 됨)**

- 공식 `npm test` 전체 통과, 원본 baseline 바이트 동일.
- legacy 모드: P2 2D 비교 3건 × 61행 완전 일치, P3 5건 × 301행이 v15 결과와 완전 일치.
- 두 모드 모두: 600틱/6발의 총구·방향·카메라·걸음 동일. 기존 13사격 + 대퇴 fixture의 탄도·방호·인체 기록 동일. v2에서 달라지는 것은 의료 기록뿐이며, 바뀐 필드를 전부 목록화한다.
- 오프라인 844×390 / 1280×720 스모크, 오류 0·외부 요청 0.

**v2 경과 기록**

- P3 5개 시나리오를 v2로 **900초** 실행한다(심정지→사망 구간을 보려면 300초로는 부족). 1/60초, 같은 seed로 2회 실행해 일치를 확인한다.
- CSV에 새 필드(ischemicLoad, cardiacArrest, arrestReason, downReason 상세, 바닥/급성 pain)를 추가한다. 그래프는 legacy와 v2를 겹쳐 그린다.
- 전환 표: 손실 15/30/40%, 의식 <80/<50/<20, isDowned, isUnconscious, cardiacArrest, isDead의 첫 시각과 각 reason. ATLS10 비교표는 P3 형식으로 다시 만들되 보고만 한다.

**v2 불변 조건 (어기면 실패)**

1. 직접 치명상(외상 HP 기준 head/neck)이 아닌 사망은 모두 cardiacArrest를 거친다. 그 시점에 isUnconscious는 true다.
2. 살아 있는 동안 deathReason은 비어 있다. isDowned가 켜질 때 downReason은 비어 있지 않다.
3. 모든 사망에서 `neck_destroyed`는 목에 외상 HP 0이 있을 때만 나온다.
4. 치료·진통제가 없고 살아 있는 동안 전역 pain은 바닥 성분 아래로 내려가지 않는다.
5. 손실 30%에 도달한 모든 시나리오에서 그 시점 shock > 0이다.
6. 출혈만 있는 구간(transientNeurologicDisruption 없음)에서 의식 목표값이 한 틱에 5 이상 튀지 않는다.

**문서**

- `docs/training-q0-diagnosis.md`, `docs/medical-v2-ledger.md`(+JSON), `docs/training-q-verification.md`.
- 모든 새 값에 출처 / 원본 / 튜닝값 구분을 붙인다. 출처는 직접 연 페이지만, 확인일과 함께 적는다.
- S24 실기기는 미검증이라고 적는다.

## 범위 밖

- 쓰러지는 동작. 나중에 새 캐릭터에 isDowned / isUnconscious / cardiacArrest / isDead 중 하나로 작동한다.
- 몸속 장기·혈관·뼈 레이어와 부위별 출혈량·응고(팔뚝 = 허벅지, 팔뚝 3.2 ml/s 지속 문제). 다음 지시서 R에서 다룬다.
- 탄종별 창상 프로파일(yaw, 파편화, 일시공동)과 몸통 출구 보정. 지시서 S에서 다룬다.
- 치료·지혈·소생술, 의료 패널 한글화.
- 2D 원본 `src/**` 수정. 2D 이식은 변경 장부를 기준으로 별도 지시서에서 한다.
- 게임 수치를 ATLS 표에 맞추는 튜닝, 본문에 없는 의료 상수 변경.
