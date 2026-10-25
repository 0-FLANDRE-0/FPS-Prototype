# Q0 — 수정 전 원인 조사

앱 코드를 바꾸지 않고 실제 v15 production 사격을 캡처했다. 원문 의료 tick에 읽기 전용 계측을 붙인 1/60초 재생에서 **5건 × 301행이 P3/v15 저장 결과와 완전히 일치**했다. 전체 tick HP/life 항목별 기여도/의식 목표·항목/쇼크 증가 항목/혈역학/리듬은 `downloads/checks-q0/*-ticks.ndjson.gz`, 입력은 inputs.json, 요약은 report.json.

## 실제 사망 조건

|시나리오|사망 초|직전→사망 life|마지막 조건|deathReason|
|---|---:|---|---|---|
|bare-forearm|없음|—|300초 내 없음|—|
|front-neck|108.26666666666667|5→0|전신 허혈: 머리 HP=0|neck_destroyed|
|soft-through-body-rear|266.03333333333336|5→0|전신 허혈: 복부 HP≤5, −20|neck_destroyed|
|bare-upper-thigh|없음|—|300초 내 없음|—|
|arm-first-body|207.03333333333333|5→0|전신 허혈: 복부 HP≤5, −20|neck_destroyed|

추정과 다른 점: 목 시나리오의 마지막 조건은 **머리 HP=0**이다. 몸통은 가슴, 팔→복부는 복부 HP 조건이다. 모두 먼저 목 HP=0으로 life가 최대5가 되고 살아 있는 동안 `neck_destroyed`가 선점된다. 허혈을 외상 HP에서 분리해야 한다.

## 의식·쇼크·통증

|시나리오|의식 목표 전환 초:목표|30% 손실 shock 증가 항목(/s)|300초 전역/부위 pain|
|---|---|---|---|
|bare-forearm|없음|미도달|0/{"head": 0, "neck": 0, "chest": 0, "abdomen": 0, "leftArm": 37.44, "rightArm": 0, "leftLeg": 0, "rightLeg": 0}|
|front-neck|86.783:80; 98.933:60; 101.417:50; 104.183:20; 105.450:0|{"bloodOrDecompensation": 0, "lowPerfusion": 0, "internal": 0.357}|0/{"head": 0, "neck": 16.67582608695652, "chest": 0, "abdomen": 0, "leftArm": 0, "rightArm": 0, "leftLeg": 0, "rightLeg": 0}|
|soft-through-body-rear|242.617:80|{"bloodOrDecompensation": 0, "lowPerfusion": 0, "internal": 0.183}|0/{"head": 0, "neck": 0, "chest": 0, "abdomen": 17.367652173913044, "leftArm": 0, "rightArm": 0, "leftLeg": 0, "rightLeg": 0}|
|bare-upper-thigh|없음|미도달|0/{"head": 0, "neck": 0, "chest": 0, "abdomen": 0, "leftArm": 0, "rightArm": 0, "leftLeg": 37.44, "rightLeg": 0}|
|arm-first-body|177.267:80|{"bloodOrDecompensation": 0, "lowPerfusion": 0, "internal": 0}|0/{"head": 0, "neck": 0, "chest": 0, "abdomen": 10.087166456842391, "leftArm": 26.64, "rightArm": 0, "leftLeg": 0, "rightLeg": 0}|

의식 목표는 SBP/쇼크/혈량/호흡/O₂/비보상 계단 합이다. 팔→복부는 30% 손실에도 +2/s 문턱을 넘지 않고 내부 shockBoost가 없어 shock=0이다. 몸통/목은 내부 shockBoost가 먼저 작동한다. 전역 pain −1.5/s와 부위 pain 비연결은 P2 원본2D 비교와 일치한다.

## 원본 입력 정의

`src/medical/damage-physiology.js:1135` updateHemodynamics, `:1257` getHeartRateState, `:717` buildCardiacRhythmModel.

|필드|원본 정의/범위|
|---|---|
|map|clamp(93×(CO×0.6+SVR×0.4),20,200), mmHg 대리값|
|tissuePerfusion|clamp((MAP/93+CO)/2,0,1.2)|
|oxygenDelivery|clamp(perfusion×breathing/100×0.9+0.1,0,1.2), 원본 상처·보조 보정 포함|
|volumeRatio|clamp(bloodMl/bloodMax,0,1.05)|
|compensatedShock|blood<3500 & SBP≥90 & compensationLoad>0.4, boolean|
|decompensatingShock|(blood<2800 & SBP<90 & load>0.5) OR (exhaustion>0.6 & SBP<95), boolean|
|compensationExhaustion|load>0.5 & blood<3500일 때 누적, 0…1|
|preArrestRisk|critical 저혈량 OR O₂<0.4 OR (비보상 & 피로>0.7), 위험 힌트 boolean|
|_heartRateState|preArrestRisk & (HR<50 OR >170)일 때 peri_arrest, 그 외 서맥/빈맥/각성 분류|
|cardiacRhythmModel|후보 rhythm/class/riskScore 0…1/perfusingRhythmFactor; 실제 심정지 아님|

## 주요 시점의 입력

|시나리오/시점|초|MAP|관류|O₂|volume|보상/비보상|피로|preArrest|HR 상태|리듬/class|
|---|---:|---:|---:|---:|---:|---|---:|---|---|---|
|bare-forearm/loss15|143.783|98.279|1.0539|1.0485|0.8500|False/False|0.0000|False|alert|normal_sinus/normal|
|front-neck/loss15|35.383|101.739|1.0941|1.0847|0.8500|False/False|0.0000|False|alert|normal_sinus/normal|
|front-neck/loss30|69.717|96.405|0.9867|0.9881|0.6999|False/False|0.0000|False|combat_aroused|sinus_tachycardia/compensatory|
|front-neck/loss40|92.483|71.270|0.5837|0.6253|0.6000|False/False|0.0203|False|unstable_tachycardia|sinus_tachycardia/compensatory|
|front-neck/beforeDeath|108.250|60.062|0.3974|0.4577|0.5296|False/True|0.1792|False|unstable_tachycardia|unstable_tachycardia/unstable|
|soft-through-body-rear/loss15|91.550|102.985|1.1089|1.0980|0.8500|False/False|0.0000|False|alert|normal_sinus/normal|
|soft-through-body-rear/loss30|194.400|97.418|0.9933|0.9939|0.7000|True/False|0.0000|False|combat_aroused|sinus_tachycardia/compensatory|
|soft-through-body-rear/beforeDeath|266.017|67.434|0.5276|0.5749|0.6002|False/False|0.1068|False|unstable_tachycardia|sinus_tachycardia/compensatory|
|bare-upper-thigh/loss15|143.783|98.279|1.0539|1.0485|0.8500|False/False|0.0000|False|alert|normal_sinus/normal|
|arm-first-body/loss15|55.483|98.257|1.0536|1.0483|0.8500|False/False|0.0000|False|alert|normal_sinus/normal|
|arm-first-body/loss30|141.883|92.404|0.9480|0.9532|0.7000|False/False|0.0000|False|combat_aroused|sinus_tachycardia/compensatory|
|arm-first-body/loss40|202.267|71.896|0.6169|0.6552|0.6000|False/False|0.0000|False|combat_aroused|sinus_tachycardia/compensatory|
|arm-first-body/beforeDeath|207.017|71.515|0.5979|0.6381|0.5923|False/False|0.0043|False|panic_tachycardia|sinus_tachycardia/compensatory|

미도달 시점은 생략했다. 원본 수치이며 임상 척도로 해석하지 않는다. Q0 보고 후 Q1–Q5를 별도 medical-v2 슬롯으로 구현한다. S24 실기기 미검증.
