# R0 — v17 원본 입력·출혈·골절·보상 피로 조사

앱 코드 변경 전에 v17 `e2192f9`의 production 사격 입력과 medical-v2 tick을 그대로 재생했다. 지시서의 추정과 다른 실제 결과를 아래에 구분한다. 원본 src/**는 무변경이다. [원자료](../downloads/checks-r0/report.json), 각 사례 900초 JSON과 [수정 전 고정 출혈 스윕](../downloads/checks-r0/fixed-loss-q-before.json).

## 손상 결정 경로

TrainingMedical.record는 탄도 계산이 끝난 후 샷 ID로 별도 의료 LCG를 초기화한다. 생성 closure의 Math.random은 이 의료 LCG이며 탄도 RNG를 소비하지 않는다. 원본 applyDamageEvent(src/medical/damage-physiology.js:75) → processWoundEvent(src/medical/wound-pipeline.js:19) → buildWoundDescriptor(src/medical/wound-clusters.js:130) → buildBodyTrajectoryContext → buildOrganVesselCandidateMap(src/medical/body-trauma.js:220) → buildInternalBleedingModel:497 / buildChestTraumaModel:575 / buildOrganInjuryModel:642 → buildPhysiologicInjuryModel(src/medical/physiologic-injury.js:5) → buildConfirmedInjuryModel:184 → buildVascularEvidence:385 순서다.

혈관/장기 candidate·probable·confirmed 승격은 **난수 없이** 구역·깊이·잔여 에너지·상처 크기의 조건식으로 정한다. vascularEvidence는 confirmed/probable 목록, 후보와 vesselRisk를 읽는다. R에서 이 입력을 실제 교차로 바꾸며 원본 초기 상처 크기/지속 출혈 계산을 재사용한다.

의료 LCG는 기존 deep_penetration의 탄자 잔류 보정에서도 소비될 수 있다(buildBodyTrajectoryContext). 혈관 확정 자체에는 난수가 없고, 의료 스트림의 실제 seed를 사례별로 보존했다.

골절은 buildFractureEvidence(src/medical/physiologic-injury.js:444)에서 의료 Math.random을 1회 굴린다. 확률은 clamp(baseChance × boneRiskMul × energyMul × penMul × crossMul × backfaceMul,0,.9)이다. `_BONE_ZONE_MAP`이 forearm을 인식하므로 **기존 bare-forearm은 radius_ulna이며 humerus가 아니다**. zone이 없을 때만 팔다리에 humerus/femur fallback이 있다. 기존 arm-first-body의 첫 상처는 상완이므로 humerus다. 다섯 기준 사례에서 실제 골절은 없다.

## 초기 프로파일·vascularEvidence

|사례/부위|level/class|initial ext|sustained ext|natural target ext|rate|clot factor|뼈 종류/골절|
|---|---|---:|---:|---:|---:|---:|---|
|soft-through-body-rear/abdomen|candidate/named_branch|2.12|1.76|1.06|0.125|0.3|None/False|
|front-neck/neck|confirmed/named_branch|10.42|10.13|10.13|0|0|None/False|
|bare-forearm/leftArm|none/none|14.39|5.38|2.96|0.25|0.6|radius_ulna/False|
|arm-first-body/leftArm|none/none|12.23|5.18|2.85|0.25|0.6|humerus/False|
|arm-first-body/abdomen|candidate/named_branch|1.77|1.58|0.95|0.125|0.3|None/False|
|bare-upper-thigh/leftLeg|none/none|14.39|5.38|2.96|0.25|0.6|femur/False|

front-neck의 confirmedVessels가 생리 타입 major_vessel_injury뿐이면 주요 명명 혈관 정규식에 매칭되지 않아 named_branch로 표시되지만, physiologic major_vessel_injury 때문에 majorVesselLocked는 true다. R은 실제 혈관 이름도 confirmed 목록에 넣어 이 둘을 구분한다.

자연 감소는 finalizeBleedingProfileWithEvidence(src/medical/part-destruction.js:477)의 sustained×0.55(체강 .6/접합 .7)에서 멈춘다. updateMedicalBleedingWoundBased(src/medical/wound-pipeline.js:377)는 current−selfReductionRate×dt로 target에 접근한다. clottingFactor(.6/.3/0)는 생성되어 기록되지만 이 자연 감소 루프가 그 값을 직접 소비하지 않는다. 초기 출혈 spike가 2.96ml/s 바닥으로 내려간 뒤 혈역학 pulse가 곱해져 팔뚝/대퇴 모두 약3.2ml/s가 유지된다.

혈압 연결은 buildBleedingPulseModel(src/medical/wound-pipeline.js:326): pressure=clamp(1+(MAP−75)/75×.25,.6,1.25), ext=clamp(pressure×(1+HR influence+PP influence)×tone,.5,1.6); 체강 int=clamp(pressure,.7,1.2), 다른 int=clamp(pressure×(1+PP influence×.5),.7,1.3). MAP 기준93과 다르며 낮은 MAP에서도 바닥이 있어 유량 감소가 약하다. Q 심정지×.05는 별도 유효 유량 감소다.

|사례|60초 ext/int ml/s|심정지 초|그때 손실%|피로/load|심정지 전 pressure 범위|
|---|---|---:|---:|---|---|
|soft-through-body-rear|1.229/6.155|314.083|46.114|1.000/1.000|0.888–1.127|
|front-neck|22.804/0|148.233|63.507|0.973/1.000|0.880–1.132|
|bare-forearm|3.286/0|518.750|38.923|1.000/1.000|0.895–1.157|
|arm-first-body|4.239/4.674|244.217|46.864|1.000/1.000|0.888–1.161|
|bare-upper-thigh|3.286/0|518.750|38.923|1.000/1.000|0.895–1.157|

## 보상 피로와 역전

updateHemodynamics(src/medical/damage-physiology.js:1135)의1227–1233행: load>.5 & blood<3500이면 E+=.015×(load−.5)×2×dt, 그 외 exp(−dt/60) 회복. E는 혈관 tone(×(1−E×.5)), contractility(×(1−E×.4)), vitals BP target(1308행 이후 ×(1−(E−.5)×.8)), decompensatingShock/preArrestRisk/agonal 입력으로 되먹임한다.

팔뚝은 낮은 혈량에서 오래 머물러 E=1에 이르고 손실38.923%에서 심정지한다. 목은 더 빨리 잃어 손실63.507%에서 심정지한다. 통증·내부 손상 없는 고정 출혈 스윕에서도 같은 역전이 재현된다.

|고정 ext ml/s|심정지 초|손실%|
|---:|---:|---:|
|1|1903.300|38.066|
|2|1010.900|40.436|
|4|557.717|44.617|
|8|314.367|50.299|
|16|189.033|60.491|
|32|118.750|76.000|

1ml/s가 손실38.066%,32ml/s가76%에서 심정지하여 R4 조건을 위반한다. 하네스는 fixed effective loss를 입력 슬롯에만 공급하며 치료/통증/내부 손상을 추가하지 않는다. 상세 SBP/MAP/E/load 1Hz 시계열은 JSON에 있다.

## 2D 식별자 대응 기준

|분류|원본 식별자/규칙|R에서 쓸 대응|
|---|---|---|
|명명 혈관|_VESSEL_NAMED_RE: femoral,brachial,axillary,subclavian,iliac,carotid,aorta,popliteal,jugular|실제 이름 + _vessel_injury; 요골/척골/cava도 vessel 포함으로 원본 confirmed 목록에 인식|
|주요 혈관|_VESSEL_MAJOR_RE: femoral,brachial,axillary,subclavian,iliac,carotid,aorta|동/정맥 종류는 새 vesselKind; popliteal/jugular/radial/ulnar/cava는 원본 class가 named_branch|
|장기 후보|lung_candidate,heart_candidate,liver_candidate,spleen_candidate,kidney_candidate,bowel_candidate,cervical_spine_candidate|교차한 것만 candidateMap에 넣고 confirmed/probable 목록에 실제 도형 대응 기록|
|physiologicInjuries type|lung_injury,solid_organ_injury,major_vessel_injury,cardiac_rhythm_risk|원본 severity/effects 식 재사용. brain/spinal_cord의 기하 교차는 추가 필드로 기록하고 새 생리 상수는 넣지 않음|
|뼈|skull,spine,clavicle,pelvis,humerus,radius_ulna,femur,tibia_fibula; rib 원본 흉벽 구역|교차한 뼈 식별자를 fracture 확률 함수 입력으로 제공. 갈비 개별 형상 없음|

근접 피해·조직별 저항·탄종 창상은 S 범위로 남긴다. R 구현 전에 본 조사 결과를 사용자에게 보고한다.
