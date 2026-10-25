# medical-v2 변경 장부

## B1c/v45 현재 항목

장기마다 출혈원 하나와 lesion 합집합 근사, 사용자 설계 관류 2/3 상한을 적용한다. 간정맥·문맥 2개 도형과 같은 ID의 기존 하대정맥 상단 연장을 추가했다. 원본 2D·상처 통로·HP·심장 펌프 수식은 보존한다. 새 도형에 따른 16조건의 HP 출력 변화는 별도 표에 기록했다. [대장](medical-b1c-ledger.json) · [출처](medical-b1c-sources.json) · [검증](training-b1c-v45.md). 모든 변경은 명시적인 2D 역이식 후보이며 자동 역이식은 없다.

## B1b/v44 현재 항목

간·비장·신장은 현재CO×장기비율×손상계수를 쓰고 작은 손상만 자연 지혈한다. 동맥의 지역정상혈류×1.7 상한을 제거하고 전체CO상한만 남긴다. 정맥·기타장기bed는 v43을 유지한다. 심정지 조건·타이머는 같고 원인표시만 기여인자로 분류한다. [대장](medical-b1b-ledger.json), [출처](medical-b1b-sources.json), [검증](training-b1b-v44.md). 모두 명시적2D역이식 후보이며 자동역이식은없다.

<!-- B1b end -->

## S1 현재 항목 — 런타임 고정

S1은 상처 통로의 부위별 유효 부피와 0.1–1 피해 배율을 3D 의료에 연결한다. 탄약 데미지·부위 HP, 실제 탄도·관통·방호와 기존 인체 출구속도는 보존한다. 각 부위의 새 계산은 자기 구간만 적분하고, 다음 부위 입사속도는 원래 인체 저항의 `part.velocityInMps`를 읽는다. 방호 뒤에는 실제 잔여속도를 쓰며 방호 변형·초기 yaw는 적용하지 않는다.

[출처](medical-s1-sources.json), [도판 보정 입력](medical-s1-calibration-inputs.json), [S1 변경 대장](medical-s1-ledger.json), [S1 결과](training-s1-v39.md)에 원본/출처/튜닝과 각 `2D 역이식 후보`를 구분했다. **런타임은 `4e4f6bc326fe350ce18f1ba9f1ec777d0c58bbee`에 고정했으며 최종 임상·성능·회귀 검증을 기록했다. 전체270테스트·baseline·600틱·두 화면 오프라인은 통과했지만, 전체 도판 형상·얼굴 별도 경로·일부 성능 목표는 미달인 시험판이다.** 아래 Q/R/R2/S0 수치는 당시 기록으로 보존한다.


**S0부터 3D 의료는 독립 모듈이다.** 현재 [브리프2–4항](training-brief.md)을 적용한다. 2D 원본과 legacy는 보존하며 역이식은 별도 사용자 지시에 따른다. 새 뇌/뇌간·심장 펌프·대퇴골 지지 항목과 각 `2D 역이식 후보: 예/아니오`는 [S0 대장](medical-s0-ledger.json)에 있다. 아래 Q/R/R2 항목은 당시 기록이다.

JSON과 같은 항목이다. 원본 선언은 바꾸지 않고 Q tickMedical319의7개 슬롯과 R 상처 입력 슬롯을 installMedicalSlots로 교체한다. applyDamageEvent 안의 summary/sync도 동일한 교체 함수로 간다. R의 정확한 대응표·비율·추가 필드는 JSON의 rIdentifierMapping/rValues에도 기록한다. legacy는 설치하지 않는다. 선언 해시가 원본과 일치하며 원본 src/**는 무수정이다. 2D 이식 시 이 모듈과 아래 의존 필드를 옮기고 원본 tick 순서/문턱을 유지한다.

## Q1-a

- 원본: updateSystemicHypoxiaDamage (src/medical/damage-physiology.js:1021)
- 이전: blood<3350: hp=max(0,hp-rate×partMul×dt); recompute function from HP
- 이후: same original rate/partMul accumulate ischemicLoad; trauma HP invariant. original functionRatio × clamp(1-load/maxHp,0.05,1).
- 이유: Q0: hypoxia zeroes neck then head/chest/abdomen; incorrect traumatic fatality.
- 근거 구분: rate/multipliers: original; performance floor0.05 and load coupling: tuning.
- 2D 의존 필드: bodyParts.hp/maxHp/functionRatio/ischemicLoad; recomputeBodyPartFunctionRatio

## Q1-b

- 원본: syncLegacyCombatState (src/medical/damage-physiology.js:1514)
- 이전: blood<1200 OR (SBP<30 & blood<1800) -> immediate dead
- 이후: first condition -> arrest exsanguination; second -> arrest hemorrhagic_shock; sustained peri_arrest15s OR O2<0.25 for20s -> arrest (hemorrhage/respiratory/hypoxia). Holds reset when condition stops.
- 이유: Q0 original stops medical tick before circulation failure; no arrest state.
- 근거 구분: blood/SBP thresholds: original;15s/.25/20s and reason priority: tuning.
- 2D 의존 필드: bloodMl/bloodMax/SBP; hemodynamics; _heartRateState; wounds.chestTraumaModel; cardiacArrest,arrestReason,arrestDetails,periArrestElapsedS,lowOxygenElapsedS

## Q1-c

- 원본: updateVitalsFromHemodynamics / updateHemodynamics / updateMedicalBleeding (src/medical/damage-physiology.js:1268)
- 이전: positive HR/BP/perfusion even near legacy death; guarded freeze after death
- 이후: arrest HR/SBP/DBP/MAP/perfusion/O2/CO/SV/pulsePressure=0; effective external/internal bleed ×0.05 (wound source intact); blood=max(0,before-effectiveRate×dt). immediate unconscious score cap19 then linear to0 in10s. Recorded target continues to0 at10 points/s.
- 이유: Arrest must show no circulation and low bleeding, without changing wound-source rates.
- 근거 구분: 0: arrest model;19 cap,10s,0.05: tuning. Rossen original inaccessible, Q fallback10s explicitly tuning.
- 2D 의존 필드: hemodynamics.*,heartRate,SBP,DBP,consciousness,stressResponse.perceivedPain; bodyParts bleed; wounds._effExternal/_effInternal/bleedingPulseModel effective fields; arrestElapsedS,_arrestConsciousness

## Q1-d

- 원본: syncLegacyCombatState (src/medical/damage-physiology.js:1514)
- 이전: immediate dead from summary/blood conditions
- 이후: non-direct death only at continuous cardiacArrest elapsed>=300s; still downed and unconscious. No CPR/recovery action.
- 이유: Q1 requested potentially reversible arrest interval.
- 근거 구분: 300s: user-specified tuning; 1e-9 numeric tolerance only.
- 2D 의존 필드: cardiacArrest/arrestElapsedS,isDead/isAlive/isDowned/isUnconscious; actor legacy flags/stance/hp/pain/bodyHp/fracture/bleeding aliases

## Q1-e

- 원본: recalcMedicalSummary / syncLegacyCombatState (src/medical/damage-physiology.js:1456)
- 이전: headHP<=0 immediate death; neckHP<=0 life cap5
- 이후: same head immediate death, neck cap5, now exclusively traumatic HP. Fixed displayed H01 A pose does not read legacy prone stance.
- 이유: Direct trauma retained separately from ischemia.
- 근거 구분: original head/neck thresholds and neck cap5.
- 2D 의존 필드: bodyParts.head.hp/bodyParts.neck.hp; traumaticCriticalParts (new, living injury status only)

## Q1-f

- 원본: syncLegacyCombatState (src/medical/damage-physiology.js:1514)
- 이전: lifeStatus<=0 -> dead; isAlive=(lifeStatus>0 & !isDead)
- 이후: lifeStatus formula retained, summary only; isAlive=!isDead. Score still drives original down<25, HR and display. can*/isCombatEffective off during arrest/death.
- 이유: Q0 life zero bypasses consciousness/arrest.
- 근거 구분: original formula; role separation: Q rule.
- 2D 의존 필드: lifeStatus,isAlive,isDead; canMove/canWalk/canCrawl/canShoot/isCombatEffective

## Q2-a

- 원본: updatePainShockConsciousness (src/medical/damage-physiology.js:1321)
- 이전: step terms SBP(-20/-50),shock>70(-30),blood<2000(-40),breathing<35(-25),O2<0.5(-20),decomp(-10)
- 이후: S(x)=smoothstep(clamp01(x)); MAP factor=1-0.08×clamp((93-MAP)/33) above60, else0.92×S((MAP-20)/40); oxygen factor=S((O2-0.15)/0.80); raw target=clamp(100×min(factors)-15×S((100-breath)/100)-10×decompContinuous,0,100). Target slew≤60points/s.
- 이유: P3 III-range continuous decline; original HR>170 SV×0.7 and original preload seams can jump input in one tick, so recorded target slew is necessary for Q invariant6.
- 근거 구분: MAP60: OpenAnesthesia 2023 review describes historical healthy-adult60–160 with individual/dynamic caveats; choosing fixed60 in game: tuning informed by literature.93: original MAP reference;20 and all shape weights/oxygen limits/slew: tuning.
- 2D 의존 필드: hemodynamics.map/oxygenDelivery/volumeRatio/compensationLoad/compensationExhaustion; SBP/breathingEfficiency; consciousnessTarget/consciousnessComponents

## Q2-b

- 원본: updatePainShockConsciousness (src/medical/damage-physiology.js:1321)
- 이전: original descending dt×1.2, recovery dt×0.3; transient neurologic spike in damage path
- 이후: same tracking gains and original transientNeurologicDisruption/damage response; remove duplicate blood/SBP/shock steps; continuous respiratory and decompensation terms.
- 이유: Avoid summing duplicate blood and MAP penalties.
- 근거 구분: tracking gains/transient80/decay30/s: original; respiratory15/decomp10 shapes: tuning.
- 2D 의존 필드: consciousness,consciousnessTarget,transientNeurologicDisruption; original tick order/timers

## Q2-d

- 원본: recalcMedicalSummary / syncLegacyCombatState / updateMedicalPerformanceMultipliers (src/medical/damage-physiology.js:1456)
- 이전: unconscious<20; down-consciousness<30; original can* thresholds
- 이후: thresholds unchanged; arrest/dead override flags and perceivedPain=0.
- 이유: Change the path to thresholds, not original ability thresholds.
- 근거 구분: original thresholds.
- 2D 의존 필드: consciousness/isUnconscious; bodyParts functionRatio/disabled,can*

## Q3-a

- 원본: recalcMedicalSummary / syncLegacyCombatState (src/medical/damage-physiology.js:1456)
- 이전: head/neck set deathReason in living summary; prior reason retained
- 이후: summary clears living deathReason and stores traumaticCriticalParts separately; only dead transition sets head_destroyed then trauma neck_destroyed then arrestReason.
- 이유: Q0 reason preemption confirmed in all fatal P3 cases.
- 근거 구분: priority: Q rule.
- 2D 의존 필드: deathReason,isDead,traumaticCriticalParts; arrestReason

## Q3-b

- 원본: syncLegacyCombatState (arrest detector at vitals slot) (src/medical/damage-physiology.js:1514)
- 이전: no arrestReason/detail
- 이후: arrest entry captures primary reason and blood loss%,bloodMl,SBP,MAP,O2,breathing,hold timers,HR state,original rhythm candidate. No later overwrite. Priority: exsanguination; original cardiac failure -> hemorrhagic_shock; sustained criteria -> active chest trauma+breathing<35 respiratory_failure, else volumeRatio<0.7 hemorrhagic_shock, else hypoxia.
- 이유: State-transition cause with actual values, not injury-site inference.
- 근거 구분: classification priority/rules: tuning; 35/0.7 reuse original thresholds; English identifiers per Q.
- 2D 의존 필드: arrestReason:string|null; arrestDetails:object|null; original chest open/lung/pneumo flags; cardiacRhythmModel stays an original CANDIDATE, not actual rhythm

## Q3-c

- 원본: syncLegacyCombatState (src/medical/damage-physiology.js:1514)
- 이전: downReason stays null
- 이후: at rising downed transition capture all enabled down conditions and primary in order low_consciousness > hypotension > shock > critical_status > incapacitated > blood_loss; no relabel each tick.
- 이유: P3 downed lacked reasons.
- 근거 구분: conditions: original; fixed reason priority: tuning.
- 2D 의존 필드: downReason:string|null unchanged type; downReasonDetails: primary/conditions/reasons/values; actor.isDowned

## Q4-a

- 원본: updatePainShockConsciousness (src/medical/damage-physiology.js:1321)
- 이전: +2/s only blood<3000 OR decomp; perf<0.55 adds1/s
- 이후: target=clamp(45S((1-volume)/0.6)+35S((1-perf)/0.7)+20×exhaustion+15×compContinuous+25×decompContinuous,0,100). Rise=min(2,0.6×(target-shock))/s. compContinuous=S((0.85-volume)/0.15)S((SBP-70)/20)S(load/0.4). decompContinuous=max(S((0.7-volume)/0.2)S((95-SBP)/25)S(load/0.5),S(exhaustion/0.7)S((100-SBP)/30)). Original boolean flags remain recorded; their continuous underlying inputs avoid flag edges.
- 이유: P3 arm/abdomen zero despite30% loss; same hemodynamics now gives same target independent of impact address.
- 근거 구분: weights45/35/20/15/25,follow0.6,all ramp widths: tuning; original blood/MAP thresholds motivate ramp anchors.
- 2D 의존 필드: hemodynamics.volumeRatio/tissuePerfusion/compensationLoad/compensationExhaustion/compensatedShock/decompensatingShock; SBP,shockTarget/shockComponents

## Q4-b

- 원본: updatePainShockConsciousness (src/medical/damage-physiology.js:1321)
- 이전: internal boost=min(0.3,agg.shockBoost)×3/s; recovery0.8/s when blood>3500 & bleed<5
- 이후: same additive boost/recovery eligibility and rate; base target rise capped2/s (boost may add on top, as original). Recovery stops at target. No independent +1/s perfusion boost; perfusion enters target.
- 이유: Preserve nonhemorrhage input and conservative base rate.
- 근거 구분: +2/boost0.3×3/recovery0.8/blood3500/bleed5: original.
- 2D 의존 필드: wounds.physiologicEffectProfile; aggregatePhysiologicEffectProfile; bleed rates,shockBoostRate

## Q5-a

- 원본: updatePainShockConsciousness (src/medical/damage-physiology.js:1321)
- 이전: global pain=max(0,pain-1.5dt); part pain unchanged/unconnected
- 이후: acutePain receives positive increments made by original damage code then decays1.5/s; painFloor=clamp(max live-part pain+0.15×sum(other live-part pains),0,100); pain=max(acutePain,painFloor). Summary refresh atdt0 guarantees floor immediately after original hit.
- 이유: P2 global pain0 with persistent part pain; maintain a wound-related floor.
- 근거 구분: 1.5/s and original damage increments: original; floor formula/coefficient0.15: tuning.
- 2D 의존 필드: bodyParts.hp/pain,acutePain,painFloor,_v2PainWritten; original damage pipeline unchanged

## Q5-b

- 원본: updateStressResponse (src/medical/damage-physiology.js:1041)
- 이전: painMasking from adrenaline/arousal/analgesia cap0.85; perceivedPain=pain×(1-mask)
- 이후: original stress declaration unchanged, perceivedPain refresh in v2 slots; unconsc/arrest -> perceivedPain0 while pain persists. HR/BP/performance downstream feedback left unretuned.
- 이유: Keep modeled pain masking distinct from eliminating injury pain.
- 근거 구분: original mask formula and cap; unconscious perception override: Q rule. Beecher1946 metadata verified, original scan access failed: no qualitative claim asserted as original-confirmed evidence.
- 2D 의존 필드: stressResponse.*,pain,shock,lifeStatus; original hormonal/hemodynamic/vital/performance downstream fields

## Q6-a

- 원본: external check-training-p1.mjs screen (scripts/check-training-p1.mjs:28)
- 이전: M4 screenshot with bag.open=true suppresses world render despite ADS/lens settings
- 이후: Q6 bag.open=false before production render; assert worldFrames+1, raw AimState.ads≈0/1, renderer lens parameters,4 unique pixel hashes/version; P1 sentence corrected.
- 이유: P1 all4 M4 states identical.
- 근거 구분: QA procedure; no runtime aim/lens change.
- 2D 의존 필드: AimState.ads/view.lens.snapshot/view.render/state.worldFrames

## Q6-b

- 원본: compressGLB (scripts/training-webp.mjs:63)
- 이전: SSIM0.97 gate baseColor only; weaponORM1 q85/.915432,ORM4 q85/.956092
- 이후: apply same gate to m4 image1/4 only. image1 q100 lossy fails -> lossless1.0; image4 q100/.973328. Other13 image bytes unchanged.
- 이유: Requested same ORM quality threshold.
- 근거 구분: 0.97 gate and encoder q: user tuning, not physiology.
- 2D 의존 필드: sharp/imageMetrics; textureUses roles; original GLB image/nonimage identity

## 값 분류

|값|수치|근거|
|---|---:|---|
|ARREST_TO_DEATH_S|300|tuning|
|PERI_ARREST_HOLD_S|15|tuning|
|OXYGEN_ARREST_THRESHOLD|0.25|tuning|
|OXYGEN_ARREST_HOLD_S|20|tuning|
|ARREST_CONSCIOUSNESS_ZERO_S|10|tuning|
|ARREST_BLEED_MUL|0.05|tuning|
|MAP_AUTOREG_LOWER|60|literature-informed fixed game tuning, MAP-review|
|MAP_ZERO|20|tuning|
|MAP_REFERENCE|93|original reference|
|MAP_ABOVE_LOWER_PENALTY|0.08|tuning|
|CONSCIOUSNESS_TARGET_SLEW_PER_S|60|tuning|
|OXYGEN_ZERO|0.15|tuning|
|OXYGEN_FULL|0.95|tuning|
|BREATHING_PENALTY|15|tuning|
|DECOMPENSATION_PENALTY|10|tuning|
|SHOCK_VOLUME_WEIGHT|45|tuning|
|SHOCK_PERFUSION_WEIGHT|35|tuning|
|SHOCK_EXHAUSTION_WEIGHT|20|tuning|
|SHOCK_COMPENSATED_WEIGHT|15|tuning|
|SHOCK_DECOMPENSATED_WEIGHT|25|tuning|
|SHOCK_FOLLOW|0.6|tuning|
|PAIN_OTHER_PART_WEIGHT|0.15|tuning|
|ISCHEMIC_FUNCTION_MIN|0.05|tuning|

## 기존 필드의 의미 변화

- bodyParts.hp: traumatic damage only in v2
- bodyParts.functionRatio: original traumatic/fracture function×separate ischemia penalty
- lifeStatus: same formula; summary/ability input, not a death gate
- isAlive: !isDead; lifeStatus0 may be alive/arrested
- deathReason: null while living; transition label only
- downReason: same string|null type; now transition primary
- _heartRateState: new cardiac_arrest enum while arrest; original states outside arrest
- cardiacRhythmModel: unchanged original candidate output; cardiacArrest separately marks actual modeled arrest
- pain: max(acutePain,painFloor), raw injury score; perceivedPain may be0
- wounds.bleedingProfile: original source rates unchanged; effective flow adapted in arrest

## 직접 연 출처와 확인 한계

- MAP-review (literature), Lami-Pereira & Gruenbaum; updated01/03/2023, 확인 2026-10-10 UTC / 2026-10-11 KST · [페이지](https://www.openanesthesia.org/keywords/cerebral-autoregulation/): Introduction reports traditional healthy-adult MAP60–160, CPP50–150 atICP10; warns individual/dynamic limits cannot confidently be predicted.
- autoregulation-variability (literature), The utility of therapeutic hypothermia on cerebral autoregulation,2023, 확인 2026-10-10 UTC · [페이지](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9924009/fullTextXML): Review: plateau/lower/upper limits depend on age,disease,CO2 and other factors; no piglet limits used as human values.
- Beecher1946 (unverified-original), Ann Surg123:96–105 (1946), PMC1803463, 확인 2026-10-10 UTC · [페이지](https://doi.org/10.1097/00000658-194601000-00008): EuropePMC DOI metadata + NLM ID converter only. LWW denies access, PMC challenges, EuropePMC scan unavailable. Original text not read; cannot claim original-confirmed qualitative support.
- Rossen1943 (unverified-original), Acute arrest of cerebral circulation in man (requested example), 확인 2026-10-10 UTC: Original not obtained.10s explicitly tuning per Q1-c fallback; no clinical recovery/death-time claim.

MAP60은 교육 리뷰의 전통적 범위에서 선택한 고정 게임 기준이며 개인 임상 하한을 보장하지 않는다. 게임 의식은 GCS가 아니며 shock0–100도 임상 분류가 아니다. Beecher/Rossen 원문은 확인하지 못했다. 통증 둔화는 검증된 원본 함수 그대로이며 새 문헌 수치를 만들지 않았다. 심정지10초/사망300초는 튜닝값이다. S24 실기기 미검증.

### Q5-c 인지 통증의 소비 순서

원본 stress refresh가 perceivedPain을 갱신한 뒤 HR이 읽는다. v2는 의식불명일 때 vitals 슬롯에서 원본 HR 함수를 호출하기 **전에** perceivedPain을0으로 만든다. pain/summary/sync에서도0을 보장한다. raw pain → injuryDrive → 아드레날린/마스킹 경로는 막지 않는다.

### 추가 필드

medicalModel, cardiacArrest, arrestReason, arrestDetails, arrestElapsedS, periArrestElapsedS, lowOxygenElapsedS, acutePain, painFloor, _v2PainWritten, downReasonDetails, traumaticCriticalParts, bodyParts.*.ischemicLoad, _arrestConsciousness, shockTarget, shockComponents, shockBoostRate, consciousnessTarget, consciousnessComponents, wounds.*.bleedingPulseModel.arrestFlowMul

MAP-review HTML SHA256: 7b02657fc0946325137f940c48e78b0b3b9b44807fcd8346fb1223f4bec7ca45

## R1

- 원본: new measured internal anatomy
- 위치: apps/training/src/internal-anatomy.js:16
- 이전: No internal geometry;21 outer meshes and24rig bones
- 이후: 69 ratio-authored capsule chains/ellipsoids; cross-section measurements from body meshes, fitted via exact boundary clearance; world transform by owner bone. All shapes inside their closed owner.
- 이유: Replace regional guesses with actual occupied path intersections.
- 근거 구분: ALL placement/radius/axes ratios are game tuning. Literature reference dimensions are separate in training-r-verification; no clinical atlas claim.
- 2D 의존 필드: internal-profile.json; character body region vertices/indices/bone, bind inverse, child bone length; measured longitudinal span and sampled cross-section rx/rz/center. No H01 coordinates.

## R2-a

- 원본: traceShot / resolveBodyPath observation
- 위치: apps/training/src/ballistics.js:217
- 이전: Existing body cells, occupied parts and stopDistance only
- 이후: Observer only, caliber from original getProjectileDiameterMm /2000; true sphere-swept finite segments, capsule chain interval union / ellipsoid Euclidean distance. Clip to real body stop and per-part occupied intervals. ≤20mm near misses record only.
- 이유: Internal observation must not change projectile state or physical RNG.
- 근거 구분: Caliber: original. Near20mm and ratio profile: tuning. Distance bisection eps: numeric tolerance.
- 2D 의존 필드: body.point/incomingDirection/entryDistance/exitDistance/bodyEntered/cells/parts; internalHits/nearMisses; trainingMetadata.internalGeometry.

## R2-b

- 원본: buildBodyTrajectoryContext / buildConfirmedInjuryModel / buildVascularEvidence / reinforceVascularEvidenceWithPartDestruction
- 위치: src/medical/body-trauma.js:830;src/medical/physiologic-injury.js:184,385;src/medical/part-destruction.js:80
- 이전: Address candidate map, depth/gate promotion, vascular risk-percent fallback and part-destruction reinforcement
- 이후: Candidate map from actual intersected shapes; confirmed identifiers from actual vessels/organs; probable/candidates=[]; original named/major regexes select class; no intersection → original vascularEvidence with risk=0 and no hints. v2 disables non-geometric reinforcement.
- 이유: Deterministic actual contact, no risk-only vascular wound if not intersected.
- 근거 구분: Original regex classes; geometric certainty is R authoring contract. Geometry→input mapping stored per wound.
- 2D 의존 필드: w.bodyTrajectory.internalGeometry/internalInputMapping; confirmedInjuries; vascularEvidence.vesselKinds; no RNG added.

## R2-c

- 원본: buildOrganInjuryModel / buildChestTraumaModel / buildPhysiologicInjuryModel (unchanged severity math)
- 위치: src/medical/body-trauma.js:642,575;src/medical/physiologic-injury.js:5
- 이전: Address-generated candidates may feed organ/physiology/lung models
- 이후: Actual geometry candidates fed to original models; certainty=confirmed_limited except original monitor-only heart; original severity, effect profiles, depth/energy gates unchanged. No actual lung → lung flags/pneumo/hemo risk0; chest-wall open wound remains. Brain/spinal unknown effects record only, no invented injury math.
- 이유: Connect actual organs to original solid_organ_injury/lung/major vessel inputs.
- 근거 구분: Original severity/effect formulas; geometric certainty and lung presence gate are new R inputs. No traversed-length severity multiplier.
- 2D 의존 필드: candidateMap id/type/confidence/severityHint; organInjuryModel; chestTraumaModel; original physiologic effect aggregation.

## R2-d

- 원본: buildFractureEvidence
- 위치: src/medical/physiologic-injury.js:444
- 이전: Zone map/fallback humerus/femur creates eligible RNG roll
- 이후: Only first actual intersected bone eligible; actual bone identifier replaces zone strings. No bone → same original computation with riskMul0, no RNG consumed. Original chance, multiplier and medical LCG retained.
- 이유: Geometric roll eligibility; forearm cannot fallback humerus.
- 근거 구분: Original chance/RNG; first entry bone selection is deterministic R adapter policy.
- 2D 의존 필드: internalGeometry.internalHits kind=bone/id/identifier; fractureEvidence.geometryBoneId; original ammo/depth/energy fields.

## R3-a-c

- 원본: finalizeBleedingProfileWithEvidence
- 위치: src/medical/part-destruction.js:477
- 이전: Nonlocked ext floor sustained×.55/.6/.7, internal×.6; linear reduction .25 with original modifiers
- 이후: Original initial/sustained/seed/fracture bonus/clot coefficients unchanged. Muscle no-organ floor×.001; fractured floor×.20; named artery×.35, vein×.15; rate capped .08ml/s per second, preserves original slower rate; major lock remains. Organ-only injury retains original organ floor.
- 이유: Let muscle bleeding nearly cease; preserve vascular/organ bleed and original fracture math.
- 근거 구분: Floor multipliers and .08 cap: game tuning. Clinical untreated survival sentence is design expectation only.
- 2D 의존 필드: bleedingProfile.sustained*,naturalReductionTarget*,selfReductionRate,majorVesselLocked,rNaturalReduction; vascularEvidence.vesselKinds; fractureEvidence; geometry organs.

## R3-d

- 원본: buildBleedingPulseModel
- 위치: src/medical/wound-pipeline.js:326
- 이전: Pressure clamp(1+(MAP−75)/75×.25,.6,1.25), external/internal pulse clamps retain floor
- 이후: Call original to retain HR/pulse/tone/treatment terms; recompute effective pulse with pressure once: artery MAP/93, vein/muscle .65+.35×MAP/93; vein-only flow×.55, mixed follows artery. Q arrest×.05 preserved. Remove old positive pulse clamp floors. Automatically emitted verbatim-source helper returns original unrounded factors; display rounding is not an input.
- 이유: Proportional artery low-pressure flow without duplicate pressure factors.
- 근거 구분: MAP93 original reference; vein .35 sensitivity/.55flow tuning. Old pressure recorded for diagnosis.
- 2D 의존 필드: MAP,pulseModifier,pulsePressureInfluence,vascularToneModifier; vesselKinds; pressureRule/vesselFlowModifier; Q effective-flow wrapper.

## R4-b

- 원본: updateHemodynamics → derived updateHemodynamicsR
- 위치: src/medical/damage-physiology.js:1135 (fatigue block1227)
- 이전: load>.5 &blood<3500: E+=.015×(load−.5)×2×dt; else decay60s
- 이후: E = clamp((1−volumeRatio−.40)/.60)^4 × compensationLoad; independent of dwell time, decreases as deficit/load recover. Derivative copied automatically; only this block replaced, original declaration byte/hash untouched.
- 이유: R0 fixed-rate inversion and E1 with moderate loss. Convex reserve depletion avoids time-driven exhaustion.
- 근거 구분: All .40/.60/exponent4: uniform game tuning, no rate-specific or survival-time fit. All other HD math unchanged.
- 2D 의존 필드: bloodMl/bloodMax/volumeRatio/compensationLoad. Generator emits derivative beside original; legacy installs no slots.

## R4-c-minimum

- 원본: updateVitalsFromHemodynamics v2 hold adapter
- 위치: apps/training/src/medical-v2.js:120;original getHeartRateState src/medical/damage-physiology.js:1255
- 이전: Q counts peri_arrest when original preArrestRisk && HR>170, even if adequate circulation; critical volume threshold2500 triggers hold then extra loss rate×15s
- 이후: Retain original heart-rate state and 15s hold, qualify hold by O2<.4 OR SBP<60. Original O2<.25×20s, blood<1200, SBP<30&blood<1800, arrest/death rules unchanged.
- 이유: Fatigue alone did not pass sweep: volume-only risk + compensatory tachycardia falsely starts arrest timer, causing rates1..32 to arrest50.3..59.6% loss. Minimum hold-eligibility gate fixes this without changing HR/BP/HD formulas.
- 근거 구분: O2.4 aligns original preArrest risk; SBP60 is tuning. Final sweep2..32≈76% loss, 1ml/s censored3600s at72%. Not clinical calibration.
- 2D 의존 필드: hemodynamics.oxygenDelivery,systolicBP,_heartRateState,periArrestElapsedS. Preserve Q holds and forced-arrest circulation invariants.

## R5

- 원본: compressGLB M4 ORM selection
- 위치: scripts/training-webp.mjs:67
- 이전: Q weapon/1 lossless1060274B, weapon/4q10058732B based texture SSIM≥.97
- 이후: Restore exact P1q85 image bytes:173292B/14524B. Other13images and soldier unchanged. Judge weapon ROI renderer SSIM≥.97, no ORM texture SSIM escalation.
- 이유: Packed ORM texture-level SSIM produced size overhead without required render benefit.
- 근거 구분: User R correction; four actual settled world-render states ≥.993; max pixel difference19..35.
- 2D 의존 필드: WEBP_POLICY.m4ORMRenderSSIMMinimum; selective quality overrides only if renderer comparison fails.


## R2 변경 (v19)

R 항목은 당시 기록이며 아래 R2 항목이 해당 부분을 대체한다. 근거 원문 확인 범위와 원본/튜닝 구분은 [R2 검증](training-r2-verification.md) 및 `downloads/checks-r2/source-evidence.json`을 따른다.

### R2-1-curve

- 원본: updateHemodynamics → derived updateHemodynamicsR2
- 위치: src/medical/damage-physiology.js:1135; preload1142,CO1187,MAP1191,PP1192
- 이전: R retains absolute-mL preload tiers and MAP=93×(.6CO+.4SVR); independent SVR term keeps MAP≈65 even at50–75%loss. PP clamp minimum15.
- 이후: One volume-driven filling/collapse rule: piecewise preload target at loss0/.20/.35/.45/.46/1 →1/.90/.35/.35/.05/.05, original preload follow1.2 retained. Reserve=clamp((.46−loss)/.01); scales CO and stroke volume, and couples resistance contribution to available flow: MAP=clamp(93×(.6CO+.4SVR×reserve),20,200). PP floor0 lets loss of stroke volume reduce pulse pressure. Derived declaration only; R fatigue remains exact.
- 이유: SVR cannot support a pressure floor with vanishing flow. Preload/CO changes implement filling decline rather than elapsed-time fatigue.
- 근거 구분: Pulse dog validation trends for20/35/45 anchors; curve heights,end46%,clamps/weights/pressure coupling all game tuning. No human threshold claim.
- 2D 의존: bloodMl/bloodMax,preload,strokeVolumeMul,cardiacOutputMul,systemicVascularResistance,map,pulsePressure; helper preloadTargetR2/circulatingReserveR2; source substitutions guarded.

### R2-1-minimum-arrest-adjustment

- 원본: v2 updateVitalsFromHemodynamics
- 위치: apps/training/src/medical-v2.js;original src/medical/damage-physiology.js:1530
- 이전: R severe pressure branch SBP<30 ANDblood<1800; 15s peri hold adds rate×15s losses.
- 이후: Severely collapsed circulation branch SBP<35 ANDvolumeRatio<.60 enters hemorrhagic_shock; original blood<1200 retained. R failedCirculation(O2<.4 ORSBP<60),15s peri hold,20s lowO2 hold and Q300s death unchanged.
- 이유: Curve-only ablation retains original R arrest gate and arrests45.62..56.30%:10.68pp rate inversion. Pressure threshold plus relative-volume guard avoids fixed-hold rate bias; final max pairwise inversion.857pp within permitted1pp.
- 근거 구분: 35/.60 tuning; ablation downloads/checks-r2/sweep-curve-only.json. Not a literature arrest threshold.
- 2D 의존: cardiacArrest/arrestDetails with actual pre-arrest blood/pressure; no artificial blood input in production.

### R2-2

- 원본: finalizeBleedingProfileWithEvidence + derived updateMedicalBleedingWoundBasedR2
- 위치: src/medical/part-destruction.js:477;src/medical/wound-pipeline.js:377,390–411
- 이전: R excludes any organ shape (including cord) from muscle floor; all fractures retain.20; fixed ml/s-per-second natural approach can lose most blood before a large spike closes.
- 이후: Only actual bleeding organs/vessels retain source-specific rules. Walls/muscle without source: ext/int same .001×sustained target. Pelvis/femur fracture .20; other actual fractures target0, rate capped.04 vs R.08. All non-null R/R2 natural targets use one exponential follow target+(current−target)×exp(−rate×dt), internal rate×.6 original, movement×.35/shock×.5 original. Organ/locked major rules and every initial/sustained/fracture equation untouched.
- 이유: Cord/airway/esophagus are not persistent cavity hemorrhage sources. Single rule handles both external and internal natural closure; fractional follow avoids high initial spike never closing before freeze at death.
- 근거 구분: Femur/pelvis hemorrhage rationale from Cochrane/WSES; targets and fractional rates entirely tuning. Supplemental8original RNG fracture events all minor bones close at1800s.
- 2D 의존: actual internalHits,fractureEvidence.geometryBoneId/occurred,vesselClass,majorVesselLocked;R naturalReduction.floor; new derived bleeding slot,one finalization,original blood accounting/treatment terms unchanged.

### R2-3

- 원본: buildInternalAnatomy/buildBodyTrajectoryContext/buildConfirmedInjuryModel
- 위치: apps/training/src/medical-r2.js; scripts/generate-internal-profile.mjs; original normalizeMedicalImpactAddress/body-trauma.js and buildTcccAssessment/damage-physiology.js:952
- 이전: R69shapes have no airway/esophagus. Original airwayRisk is address hint; no airway-specific breathingDrain production type.
- 이후: Neck larynx/trachea + thoracic trachea, neck/thoracic/short abdominal esophagus:5capsule chains,measured owner mesh ratios. Actual airway → normalizedMedicalAddress.airwayRisk=true + airway_candidate(typeairway),original organ/assessment/category path only. Esophagus excluded from injury input/confirmed lists,record only.
- 이유: Complete missing tubes without inventing a separate airway physiology engine.
- 근거 구분: All coordinates/radii/owner splits tuning. Original breathingDrain only emitted by lung_injury and consumed by chestTrauma; airway alone has no new respiratory constants/effects.
- 2D 의존: candidateMap,airwayRisk,airwayModel,tcccAssessment; clip actual occupied body to each medical part; esophagus no candidate.

### R2-4

- 원본: applySpinalFunctionR2 + v2 HD/performance/summary/combat sync
- 위치: apps/training/src/medical-r2.js; apps/training/src/medical-v2.js; original canShoot/canCrawl src/medical/damage-physiology.js:1444
- 이전: Actual cord geometry only; original down logic allows active while canCrawl. Original oxygenDelivery immediately multiplies breathingEfficiency.
- 이후: Split cervical cord at normalized neck span.46 (approximate C5 game boundary): A.46.. .93, B.15.. .46;thoracic/lumbarB. Actual A→alllimbfunctions0,breathing0;B→legs0,lowercervicalarmcap.35. Persistent caps reapplied after recompute and before original performance. A oxygen follows original target with exp(−dt/45s); no direct consciousness change. Add bothlegs0+actualcord down reasonspinal_cord_injury at highest priority; A lowO2 arrestreasonrespiratory_failure. canShoot/canCrawl original formulas retained.
- 이유: Standing loss must down a unit despite intact crawl/shoot ability. Oxygen reserve proxy delays apnea consequence instead of instant unconsciousness.
- 근거 구분: Human review C3–5/6 phrenic motor neurons;C5 two-region split,all-or-none damage,cap.35,45s delay tuning. Human apnea desaturation abstract only supports delay plausibility,not LOC/arrest times.
- 2D 의존: actual cordRegion A|B,spinalCordInjury,bodyParts.functionRatio,breathingEfficiency,oxygenDelivery/apneaOxygenTarget,isDowned/downReason;Q6invariants preserved;noH01animation/AI.

## S2(v40): 몸속 상태 통일·구조 HP

[독립 S2 대장](medical-s2-ledger.json)과 [출처·제약](medical-s2-sources.json)을 참조한다. 2D 원본과 생성 선언은 보존하고 자동 역이식하지 않는다. S1의 그림자 상태였던 몸속 탄 상태를 독립3D에서만 실제 상태로 채택한다. 기존 S1 검증 기록은 당시 결과로 남기며 새 검증과 혼동하지 않는다.

### S2-body-authoritative

- 원본: 3D traceShot body terminal integration
- 위치: apps/training/src/ballistics.js; body-channel.js; wound-channel.js
- 이전: S1 상처 모델은 의료용 그림자 상태. 실제 몸속 속도는 기존 인체 저항으로 별도 계산.
- 이후: 몸 안의 속도·질량·yaw·파편·정지/출구 상태를 S2 한 번의 적분으로 산출하고 같은 채널을 의료에 전달. 몸 밖의 기존 비행/벽/방호 경로로 잔여 상태를 반환. 기존 인체 저항은 legacy/비교 경로로 보존.
- 이유: 두 모델이 같은 운동 에너지를 각기 소비하던 불일치 제거
- 근거 구분: 사용자 지정 + 원본 경로 보존; docs/training-s2-instructions.md#1
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-part-state

- 원본: Per-part occupied body segments
- 위치: apps/training/src/body-channel.js; medical.js; wound-channel.js
- 이전: 각 부위는 자기 구간을 적분하지만 입사속도는 매번 기존 인체 저항의 값으로 재주입.
- 이후: 다음 부위는 앞 부위의 새 출구 속도·질량·yaw·변형·파편 상태에서 시작. m은 각 부위 자기 구간으로만 계산. 부위 사이 공기 틈은 조직 깊이에서 제외.
- 이유: 팔을 지나며 누운 탄을 몸통 앞에서 초기화하지 않음
- 근거 구분: 사용자 지정 + 모델 설계; docs/medical-s2-sources.json#yawCarryPolicy
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-body-residual-packet

- 원본: Residual projectile packet after body exit
- 위치: apps/training/src/body-channel.js; ballistics.js
- 이전: 원본 인체 저항의 잔여속도·관통/피해 패킷으로 후속 장벽 판정. S1파편은그림자상태.
- 이후: 새 주탄의 에너지비 ratio=clamp((mOut·vOut²)/(mIn·vIn²),0,1)로 잔여 관통력과 잔여 피해를 각각 곱한다. shot-local ammo 복제본의 projectileMassG를 현재 주탄질량으로 갱신하여 기존 방호 kinetic/wear함수에 넘기며 레지스트리는 불변. 파편구름에너지는 같은 표적의 이어지는 부위에서만 전달하며 벽/방호/다른표적/trace끝에 untracedFragmentEnergyJ로 기록하고 주탄속도에 재주입하지 않음.
- 이유: 새몸속정지/출구상태를후속실제경로에연결하면서주탄/미추적파편에너지를중복소비하지않음
- 근거 구분: 튜닝(3D 연결 어댑터); 원본 벽/방호 수식 보존; apps/training/src/body-channel.js:resolveBodyChannel; ballistics.js:traceShot; 동일 채널을 medical.js가 재사용
- 2D 역이식 후보: 예. 2D잔여패킷에주탄질량·속도와파편에너지장부를명시해별도검증필요

### S2-density

- 원본: Tissue resistance and equivalent depth
- 위치: apps/training/src/internal-anatomy.js; wound-channel.js
- 이전: 균질 S1 연조직 항력. 내부 깊이 구간 캐시는 공동용.
- 이후: 기존 1회 내부 판정에서 폐/뼈 구간 캐시를 추가해 밀도비로 등가 깊이를 조회. 연조직 기준은 S1과 동일. 폐340, 피질골1920, 해면골1170kg/m³; 같은 G4표에 해면골 없음. 칸마다 3D 조회 없음.
- 이유: 조직별 저항을 구분하면서 기존 젤라틴 보정 유지
- 근거 구분: 출처(폐·피질골 밀도) + 튜닝(해면골·항력 환산); docs/medical-s2-sources.json#selectedDensityPolicy
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-bone-geometry

- 원본: Bone envelope interpretation
- 위치: apps/training/src/internal-anatomy.js
- 이전: 기존 뼈 콜라이더는 실체의 외곽 진단 형상.
- 이후: 외곽 뼈 구간에서 직접 교차한 내부 신경조직 구간을 빼 저항 캐시를 만든다. 실제 피질층/골수층을 새로 모델링하지 않고 기존 뼈 외곽을 피질골로 근사. 해면골/공기 값은 명시 종류가 있는 입력만 적용.
- 이유: 두개골/척추 외곽 전체를 뇌/척수까지 꽉 찬 뼈로 세는 과도한 저항 방지
- 근거 구분: 튜닝(콜라이더 기반 균질 근사); apps/training/src/internal-anatomy.js:tissueIntervalsFromGeometry
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-bone-extra

- 원본: Bone-triggered yaw/deformation/local debris
- 위치: apps/training/src/wound-channel.js
- 이전: S1은 직접 뼈 골절만 기존 판정에 전달.
- 이후: 뼈 통과 시 추가 yaw 등가깊이1.2m/m, 변형 면적 증가4/m·상한1.8배. 뼈 국소 추가 영구손상은 전달에너지/(2×10^7J/m³), 최대 반경.025m 및 해당 TC반경 이내.
- 이유: 뼈가 탄 거동과 국소 조각 손상에 주는 영향. 독립 원거리 파편탄을 생성하지 않음
- 근거 구분: 출처(정성 가능성) + 튜닝(모든 수치); docs/medical-s2-sources.json#boneEffectPolicy
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-cns-enclosure

- 원본: Temporary cavity near enclosed CNS
- 위치: apps/training/src/wound-channel.js; medical-s1-effects.js; medical-s0.js
- 이전: 뼈 바깥 얼굴/턱 경로의 큰 TC가 직접 뇌·뇌간 교차 없이도 생리적 의식 상실을 일으킬 수 있음.
- 이후: 직접 두개골/척추 교차와 깊이 순서로 내부 신경구조 TC허용. 뼈 밖 TC/비직접 파편 전달계수0. 직접 CNS 교차 무력화는 유지. 차단한TC/장기체적×.25를 concussionRisk0–1로 기록하며 생리 효과 없음.
- 이유: v39 실제 얼굴 경로의0.5833s 조기 쓰러짐 재발 방지
- 근거 구분: 사용자 지정 + 튜닝; docs/training-s2-instructions.md#2
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-head-HP

- 원본: Head HP zero interpretation
- 위치: apps/training/src/medical-v2.js; medical-s0.js; medical-s2-effects.js
- 이전: 총 머리HP0을 생명상태0으로 바꾸는 경로가 있을 수 있음.
- 이후: head_structure_destroyed 기록. 뇌/뇌간 직접 손상과 기존 생리가 생사를 결정하며 머리HP0만으로 사망하지 않음.
- 이유: 구조 내구도와 CNS생리 손상 분리
- 근거 구분: 사용자 지정 게임 의미; docs/training-s2-instructions.md#3
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-torso-HP

- 원본: Chest/abdomen HP zero interpretation
- 위치: apps/training/src/medical-v2.js; medical-s2-effects.js
- 이전: 부위 파괴·전신 손상이 여러 기존 경로에 흩어져 있음.
- 이후: 가슴 또는 복부HP0이면 기존 심정지 진입 경로에 원인torso_destroyed를 전달하고 기존300s ARREST_TO_DEATH_S 경로 유지.
- 이유: 몸통 구조 파괴의 의미 명확화
- 근거 구분: 사용자 지정 + 기존 심정지 경로 사용; docs/training-s2-instructions.md#3
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-limb-neck-HP

- 원본: Limb and neck HP zero interpretation
- 위치: apps/training/src/medical-v2.js; medical-s2-effects.js
- 이전: 기존 부위 기능/파괴 상태. 목HP0은lifeStatus를5이하로 제한.
- 이후: 팔/다리HP0은 해당 기능0. 그 자체로 의식/생명을 직접 끊지 않음. 목의 기존lifeStatus≤5규칙 보존; 새 자동 심정지/사망 지름길 없음.
- 이유: 부위별 구조 내구도 의미 구분; 목은 변경 요청 없음
- 근거 구분: 사용자 지정 + 원본(목) 유지; docs/training-s2-instructions.md#3
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-comminution

- 원본: Single-hit comminution
- 위치: apps/training/src/medical-s2-effects.js
- 이전: 기존 직접 뼈 교차 기반 골절.
- 이후: 같은발사이벤트·표적·부위의boneEnergyLostJ prefix≥250J를첫교차하고현재실제뼈교차자격이있을때comminuted. 해당부위기능0·치료없이회복불가 기록. 머리분쇄도자동CNS손상/사망아님. 기존분쇄골절출혈경로사용. TC근접만으로골절을만들지않음.
- 이유: 분쇄 단계 추가. 기존 직접 뼈 교차 자격 유지
- 근거 구분: 튜닝(250J; 임상 문턱 아님) + 원본 골절 경로; docs/training-s2-instructions.md#4
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-amputation

- 원본: Single-hit structural limb loss
- 위치: apps/training/src/medical-s2-effects.js
- 이전: 원본 누적 파괴점수는 반복 피격에서partial_traumatic_loss/traumatic_amputation표시 가능.
- 이후: 같은발사이벤트·표적ID·canonical부위의분리된채널에너지를순서대로합산한다. 팔다리단발prefix전달에너지≥8000J의첫교차때만amputated/혈관절단을발생시킨다. 다른발에걸친누적은금지. 원본누적파괴점수의절단명칭은destroyed로억제하고비교증거보존. 메시분리없음.
- 이유: 지정 소총/권총 및 모든 비12.7레지스트리탄이 기준속도에서 단발절단에 도달하지 않도록 상한 에너지와 비교
- 근거 구분: 튜닝(8000J; 임상 문턱 아님); docs/training-s2-instructions.md#4
- 2D 역이식 후보: 예. 2D의 기하 구간 캐시와 상태 패킷을 별도로 설계·검증한 뒤 명시 승인으로 역이식

### S2-base-HP-damage

- 원본: Registry HP and ammunition damage
- 위치: src/**; apps/training/src/generated/**
- 이전: 원본 탄 데미지와 부위HP값.
- 이후: 값 보존. 실제 통일 모델로 탄·부위·거리별 HP감소/0까지발수 및 HP경로를 끈 생리경로 시간을 별도 비교 표로 보고.
- 이유: 이번 작업은 수치 보정의 근거를 마련하고 사용자가 추후 값을 결정
- 근거 구분: 원본 보존 + 진단 비교; docs/training-s2-instructions.md#5
- 2D 역이식 후보: 아니오. 원본 수치 변경을 하지 않으므로 역이식할 수치 없음

### S2-debug-slot

- 원본: AK debug instrument in reserved slot3
- 위치: apps/training/src/debug-weapon.js; inventory.js; main.js; input.js; debug-ammo-ui.js
- 이전: 일반 무기1/2슬롯. AK는 등록총기와 호환탄만 사용.
- 이후: 3번칸은일반인벤토리와분리된디버그전용AK인스턴스. 좌상단탄약탭·전체레지스트리표·무한탄창·수동속도·선택탄자동영점토글. 모델/소리/반동은AK그대로. PC3키와모바일전용선택버튼.
- 이유: 같은traceShot/의료경로에서모든탄을시험. 일반장비슬롯으로사용하지않음
- 근거 구분: 사용자 지정 디버그용, 현실값 아님; docs/training-s2-instructions.md#사용자-추가-요청--디버그-총기
- 2D 역이식 후보: 아니오. 3D모바일HUD/인벤토리의시험도구이며의료수식역이식후보아님

### S2-debug-table

- 원본: Original2D ammunition table fields
- 위치: apps/training/src/debug-ammo-ui.js; generated/catalog.js; src/** originalammoUI
- 이전: 원본2D탄약표의명칭·구경·질량·기준속도·관통스펙.
- 이후: 레지스트리114탄·17열. 원본2D표의정렬·8재질·Class1–7대표방호값15/25/35/45/55/65/72·0–6관통등급경계를동일생성방호함수로읽는다. 탄명/구경/질량/초속/기준·유효관통/피해/제압/반동/정확도배율/방호피해와등급을표시. 844×390독립양방향스크롤·44px행·터치선택.
- 이유: 새탄약수치나가상방호등급을만들지않음
- 근거 구분: 원본값 표시 + 디버그UI튜닝; 사용자 추가 요청
- 2D 역이식 후보: 아니오. 원본2D표의값은이미2D에존재

### S2-EWS2018-source-correction

- 원본: Documentation source provenance
- 위치: docs/medical-s1-sources.json; docs/training-s1-v39.md
- 이전: 2018공식Chapter1에개별소총도판이없다고보고.
- 이후: 동일원문PDF12–13쪽의AK47/M16/M80도판존재를시각확인해S2에서정정. 기존2004/Fackler1987보정입력/런타임은불변.
- 이유: 출처의실제내용과서술일치
- 근거 구분: 출처 조사 오류 정정; docs/medical-s2-sources.json#sourceCorrections
- 2D 역이식 후보: 예. 연구출처를이용할때정정내용참조;수치자동역이식없음

### S2-debug-AK-magazine-visibility

- 원본: FPS AK magazine hide guard during animated reload
- 위치: apps/training/src/fps-arms.js; scripts/build-training.mjs
- 이전: animatedAK의탄창표시여부가일반인벤토리탄창존재를따름.파생손그립은원본fps-arms전체파일해시로검증.
- 이후: 원래조건에정확히!inventory.isDebugWeapon한개만추가하여무한탄창디버그AK의탄창외형을유지. 빌드는정확히그한조건만제거한전체파일이기존SOLDIER_AK_GRIP소스해시와같은지검증.실제파일해시와debugMagazineVisibilityOnly도빌드정보에기록.
- 이유: 일반탄창인스턴스가없는시험총도AK탄창메시를표시하고기존손그립/자세코드무변경을검증
- 근거 구분: 디버그표시튜닝 + 원본파생자산가드유지; final source fefede27; handling.gripSourceValidation metadata; derived finger GLB/grip bytes unchanged
- 2D 역이식 후보: 아니오. 1인칭렌더표시조건만의변경으로2D의료역이식후보아님

### S2-existing-play-QA-timing

- 원본: Existing player-down overlay regression fixture
- 위치: scripts/check-training-ai1-play.mjs
- 이전: 장벽뒤다리피격후아직쓰러지지않았으면머리를쏘는QA루프에서만다음전투틱을진행. S1fixture는다리후downfalse라해당루프를탔음.
- 이후: S2분쇄로다리피격직후의료down이true가되므로재료fixture뒤실제combat1틱을소비해기존오버레이/래그돌전이를관측. fixtureTrigger기록. 런타임은그대로.
- 이유: 기존보조루프가생략되면서생긴관측시점차이를고치고생산전투틱의결과를검증
- 근거 구분: QA fixture timing adaptation; intentional S2 medical consequence; downloads/checks-s2-v40/play.json; final source hashes unchanged
- 2D 역이식 후보: 아니오. 테스트관측시점만바뀌므로2D역이식대상아님

## S3(v41) 물리 피해 통일·부위 HP·5.56/5.45

기준v40 c4e608df, 앱 소스 a4fe65bf3217db63ffd0aa174bbbd3db8a7bbd60에 고정했다. 최종 기록이며 전체 목표 합격은 아니다(acceptancePassed:false). C=0.10996950326980938HP/cm³,21보정12목표충족/복부·팔미달이다. 전체323/323·2D baseline3641864B동일.240조건은43PASS/176기록/16미도달/5엄격창미달,채널213→214다.777임상/777장기전용대조·270HP그룹·1554의도부위행·Q17시나리오1101785검사위반0을기록했다. 장기전용은모든HP를유지하면서ischemicLoad/기능저하를보존했다. 두화면실제38발씩·추가의료6발새HP8셀·기존6브라우저·정확한HTML오프라인2화면도통과했다. 성능은전체피격p95 .127543/.141203ms로 .1ms목표미달,CPU프레임비율1.04565/.96285로1.5배기준통과다. 상속된전체도판형상한계도유지한다. [배포 영수증](../downloads/delivery-physical-damage-s3-v41.json)·[독립 대장](medical-s3-ledger.json)·[출처](medical-s3-sources.json)를 참조한다. 기존S2항목은과거버전기록으로보존하며,S3가명시적으로변경한HP/25탄동작은아래항목이최신이다. 자동2D역이식은없다.

### S3-body-HP

- 원본: 3D medical v2 max HP
- 위치: apps/training/src/medical-s3-effects.js
- 이전: 원본HP head35/chest85/abdomen70/arms60/legs65/neck25.
- 이후: 3Dv2초기화만head85/neck60/chest240/abdomen180/arms각100/legs각120. 총1005. 원본src및generated정의/legacy465는보존. 의료탭같은현재상태필드표시.
- 이유: 구조HP규모변경;S2HP0의미유지
- 근거 구분: 사용자 설계값
- 근거: 첨부1절
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-physical-HP

- 원본: bullet HP decrement for25
- 위치: apps/training/src/medical-s3-effects.js; medical.js; medical-v2.js
- 이전: registrydamage × tissueDamageMul × m이HP에들어가탄효과를중복반영.
- 이후: 5.56/5.45대상25종은자기부위effectiveM3×1e6×공통C만HP감소에사용. m/registrydamage/tissueDamageMul는이HP식에곱하지않음. 부위마다자기구간의동일cached채널을사용. 실제감소는남은HP로clamp. 방호정지/유효채널없음은0과진단상태를기록하나기존둔상통증/생리는유지. bullet 및 bullet-derived frag에 같은 규칙. 추가상처채널없는방호스폴/파편은물리HP0진단으로이미포함된파편부피를재가산하지않으며기존상처/출혈/통증은보존.
- 이유: 공동모델의손상을HP의단일크기로사용
- 근거 구분: 사용자 설계식 + 환산C튜닝
- 근거: 첨부2절
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-common-C

- 원본: One global effective-volume toHP conversion
- 위치: apps/training/src/medical-s3-effects.js
- 이전: 탄레지스트리damage와0.1–1 m에의한기존HP조정.
- 이후: C=0.10996950326980938 HP/cm³. M8555m무방호대표경로범위의chest/abdomen4–6발,arm/leg근육2–3발,head1–2발목표에공통C한개를수치보정. 최종12/21목표충족. 복부2–3발/팔5–6발미달,모든경로의C허용구간교집합없음. 부위별계수없음.
- 이유: 단일환산의한계도사용자가검토
- 근거 구분: 튜닝(HP/cm3;임상단위아님)
- 근거: downloads/checks-s3-v41/calibration.json; docs/training-s3-calibration-investigation.md
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-unadjusted-calibers

- 원본: Non5.56/non5.45 HP compatibility
- 위치: apps/training/src/medical-s3-effects.js; debug-ammo-ui.js
- 이전: 114탄이v40식을사용.
- 이후: 대상25외89탄은v40HP식유지. 새공통부위HP는공통으로적용되므로HP0산술발수는달라질수있음. 탄약표지수는공란/미보정,기존데미지는유지.
- 이유: 다른구경설정은이번에변경하지않음
- 근거 구분: 원본식유지 + 사용자범위
- 근거: 첨부2/5/6절
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-original-classification

- 원본: Original terminal type/threshold
- 위치: src/data/ammunition-legacy.js; apps/training/src/generated/catalog.js; wound-s3-types.js
- 이전: 원본25탄의type/threshold. S1/S2 live mapping은donor위주.
- 이후: 원본type/threshold를읽어25typedsettings생성. 지시표와25/25일치·차이0. estimatedThreshold:true11종메타데이터도보존. 원본파일무수정.
- 이유: 개별탄추가조사대신원본분류사용
- 근거 구분: 원본(유형·문턱) + 사용자매핑
- 근거: docs/medical-s3-sources.json#originalTypeAudit
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-type-defaults

- 원본: Shared typed tissue behavior
- 위치: apps/training/src/wound-s3-types.js; wound-channel.js
- 이전: 일반donor곡선과M855파편차용등S1/S2매핑.
- 이후: yaw는동일구경도판·파편0,fragment는M193도판파편,controlled/barrier는고정onset튜닝,AP는늦은yaw/작은공동,expand는문턱위단면확대,frangible은얕은분해,subsonic은동일구경yaw/파편0. 유형공통길이비,심재비율/피갑두께없음.
- 이유: 25탄의동작을유형기본값으로구분
- 근거 구분: 출처도판차용 + 사용자동작설계 + 유형공통튜닝
- 근거: 첨부3-b; WOUND_S3_VALUES
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-source-grades

- 원본: Perammo source traceability
- 위치: apps/training/src/wound-s3-types.js
- 이전: 도판donor매핑은있지만이번25탄자료등급별도표시없음.
- 이후: plate=7N6/M193, family=동일구경yaw/fragment/subsonicdonor, estimate=타구경차용/AP/controlled/barrier/expand/frangible튜닝. 근거종류를표시하며성능합격등급아님.
- 이유: 탄별실측이있는것처럼표시하지않음
- 근거 구분: 출처추적분류 + 튜닝
- 근거: 첨부3-b; S3_TERMINAL_SETTINGS
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-M855-research-only

- 원본: M855 projectile fragmentation decision
- 위치: apps/training/src/wound-s3-types.js; docs/medical-s3-sources.json
- 이전: S1/S2는M193차용파편동작. 원본type는yaw/760.
- 이후: S3는원본yaw/760대로주탄파편0. 기존국소뼈조각은별개보존. EWS2004가M193유사파편화패턴을설명하지만이번엔보고만.유형변경은사용자결정대상.
- 이유: 원본분류보존과자료괴리공개
- 근거 구분: 원본 + 사용자명시 + 문헌정성보고
- 근거: EWS2004p1.8/PDF39; EWS2018p6/12–13; Penn-Barwell2015
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-damage-retained-uses

- 원본: NonHP consumers of registry damage
- 위치: apps/training/src/ballistics.js; body-channel.js; medical.js; generated/legacy-medical.js; generated/legacy-protection.js
- 이전: 원본데미지가잔여패킷·방호마모·생리/상처입력·표시에쓰임.
- 이후: HP만물리손상식으로바꾸고그외용도는그대로. 방호마모getAmmoArmorWearBase=(ammo.damage||30)×armorDamagePct/100,잔여damage패킷,stoppedblunt/출혈/통증/급성반응/스트레스/상처메타데이터·누적구조점수등을읽기전용감사에기록.
- 이유: 방호·출혈·장기생리수식변경금지
- 근거 구분: 원본보존 + 사용처감사
- 근거: docs/training-s3-v41.md#레지스트리-데미지의-남은-사용처
- 2D 역이식 후보: 예. 2D의유효손상량/부위구간/의료어댑터를별도설계·회귀검증하고명시승인후역이식;자동반영없음

### S3-debug-damage-index

- 원본: Debug ammunition terminal indexes
- 위치: apps/training/src/debug-ammo-ui.js; wound-s3-types.js; wound-channel.js
- 이전: 원본데미지/관통17열표.
- 이후: 로드시같은모델로대상25탄10/300m입사속도·처음30cm유효손상량의M855=100지수·yaw시작·분해/확대·정지깊이·자료등급계산. 원본데미지는회색참고이며대상25HP에는미사용. 89탄공란/미보정. 공유분모M85510m856.6207445036866cm³. 총23열,25종50조건정지모두관측,나머지89공란. Node import loadTime은브라우저startup측정아님.
- 이유: 원본데미지와새HP위력의차이표시
- 근거 구분: 사용자디버그설계 + 게임모델계산
- 근거: downloads/checks-s3-v41/damage-indices.json; debug-ui/report.json; debug-browser/report.json
- 2D 역이식 후보: 아니오. 3D디버그표시/검사전용으로의료역이식대상아님

### S3-gelatin-regression

- 원본: Literal reference gelatin calibration
- 위치: apps/training/src/wound-channel.js; tests
- 이전: S1/S2도판보정및전체형상한계.
- 이후: 7N6/M193보정helper와출력의동일성을검사. 새typed개별파라미터와literal도판함수를분리. 기존둘째봉우리등미달을새로합격처리하지않음.
- 이유: 유형변경이원도판자체를바꾸지않게함
- 근거 구분: 원본보정유지 + QA
- 근거: 첨부7.5; docs/medical-s1-sources.json
- 2D 역이식 후보: 아니오. 3D디버그표시/검사전용으로의료역이식대상아님

### S3-7N6-abdomen-audit

- 원본: Longitudinal liver fixture and no-arm frontal control
- 위치: scripts/check-training-s3-calibration.mjs; downloads/checks-s3-v41/7n6-abdomen-v40-investigation.json
- 이전: v40 7N6복부HP3.456946 vs M85528.064608, 약1/8.
- 이후: 기존간fixture는왼팔→복부→오른팔. 복부입구7N6는512.696m/s/초기yaw1.199646rad, M855751.640m/s/yaw0. 복부m0.222497/0.729766로바닥0.1은원인아님. 잔여damage에공동m를다시곱한중복과이전팔상태/파편차이. 팔없는정면대조는HP19.534796/47.324623. 올바른잔여상태를초기화하지않고25탄HP의중복만새식으로제거. 최종S3복부HP감소:팔선행7N624.467918/M85581.568202,정면7N646.148910/M85594.942277. 실제S3유효부피×C와정확히일치.
- 이유: 표적경로의앞부위효과와HP중복을분리해설명
- 근거 구분: 원본실행감사 + 사용자설계식수정
- 근거: downloads/checks-s3-v41/7n6-abdomen-v40-investigation.json;7n6-abdomen-s3-comparison.json
- 2D 역이식 후보: 예. 2D도동일한부위순서/잔여상태를기록하는검사가필요. 이3Dfixture자체를자동포팅하지않음.

### S3-literal-and-live-plate-proof

- 원본: Reference gelatin helpers and live muscle-block physical output
- 위치: apps/training/src/wound-channel.js; wound-s3-types.js; S3 focused tests
- 이전: S1/S2 literal gelatin helpers and live base profiles.
- 이후: All5referencehelperJSONexactv40. M193live943m/sactualmass allphysicalfieldsbitexact;7N6live935m/sactualmass stop.4468001046243593m/energy1499.2958750000003J/effectiveV.0005062489519640263m3exact.7N6local117floatfieldsmax5.0022e-12J/mroundoff fromcaliber×lengthratioorder;notwholeJSONbitexact.
- 이유: literal보정재현과실제typed모형을구별하고수치차이를숨기지않음
- 근거 구분: 원본 보정 유지 + 검증 오차 공개
- 근거: S3 core focused plate proof; docs/medical-s3-sources.json#referencePreservation
- 2D 역이식 후보: 아니오. 3D회귀증거이며2D수식변경대상아님.

### S3-aorta-test-window

- 원본: S1 unit-test approximate aorta timing expectation
- 위치: tests/training-medical-s1.test.mjs; S0 matrix expectations
- 이전: OldS1unit expects strict<=30s. S0strictmatrix rowalso<=30.
- 이후: S1unit tests approximately30s as27–33s(±10% QAinterpretation). S0matrix originalstrict<=30unchanged, M85530.45sremainsreportedoutside. No medicalformula/timerchange.
- 이유: 단위근사창과엄격S0회귀값을분리하고엄격기대미달을공개
- 근거 구분: QA 허용창 해석(튜닝값 아님; 사용자의 약30초 요구)
- 근거: 첨부7.6 약30초; originalS0strictreports retained
- 2D 역이식 후보: 아니오. 의료수식역이식이아닌QA기대해석. 엄격기록은삭제하지않음.

### S3-organ-only-counterfactual

- 원본: QA-only structural-HP-disabled control
- 위치: scripts/check-training-s3-range-hp.mjs; organ-only-integrity.json
- 이전: ActualproductionHPandorganphysiologyinteract;partHPcantriggerstructuralarrest.
- 이후: 777matchedQAcontrolsuseidenticalphysicalchannels;onlystructuralHPsubtractandtorsoHPgatewaydisabled. CompatibilitybodyDmg,pain,bleeding,acuteandischemicLoad/functionimpairmentuntouched.5595177snapshots/44761416partchecksall8HPheldexactlymax,deviation0;417casesischemicLoadpositive,max285.08933333337217. Notproductsetting.
- 이유: HP0산술과장기/출혈생리시간을분리하고대조오염검사
- 근거 구분: 반사실 QA 대조
- 근거: downloads/checks-s3-v41/organ-only-integrity.json; report-summary.json
- 2D 역이식 후보: 아니오. 비교시험설계참고만. 치료/게임설정으로역이식하지않음.

### S3-final-performance

- 원본: Core per-hit and1200RPM CPU measurement
- 위치: scripts/check-training-s3-performance.mjs; downloads/checks-s3-v41/performance/performance.json
- 이전: v40authoritativeS2wholemodel.
- 이후: Twoorder-balancedrepeatseachversion600ticks/2000shots/2000entries/alive2000/post0. S3core-per-hitmedian .051217/.053510ms,p95 .127543/.141203ms => .1msbudgetMISS. MedianCPUframeratio1.045654530882638/.96285<1.5PASS. Individualpartmicro1000eachp95 .031517/.033030msPASS,butmax.1440/.2645ms> .1. CPUonly,no60Hzrenderclaim.
- 이유: 한부위micro와실제한발모든부위합산예산을구분
- 근거 구분: 측정 결과 + 미달 공개
- 근거: downloads/checks-s3-v41/performance/performance-summary.md
- 2D 역이식 후보: 아니오. 3D실행측정이며2D수식변경대상아님.

## S3b/v42 — 팔75·복부HP0지속통증·3D M855 fragment

기준v41 `3614b8100c8c41df7de009bacef643f08f5e6b90`, 런타임`8f4a25c0596b9083e20e19e112e2fb44c813c9e9`. 양팔75/총955는사용자설계, 복부HP0직접arrest제거/상태abdomen_destroyed는사용자설계, Q5-a바닥95는튜닝이다. 기존masking0.85·아드레날린/심박/쇼크/쓰러짐식은그대로읽고간접결과를막지않는다. 공통C `0.09174725695886135`로21/21목표경로를만족한다. M855는EWS2004인쇄1.8/PDF39의정성근거로3D만fragment760/family로덮어쓰며원본yaw760은보존한다. 첫10cm열도M85510m첫30cm=100기준이다.

[각항목분류/2D역이식후보](medical-s3b-ledger.json) · [출처](medical-s3b-sources.json) · [검증/간접쇼크/한계](training-s3b-v42.md). 자동2D반영없음.327테스트/baseline불변·678물리보존·1101785불변검사. 엄격대동맥30.1초1건미달을남긴시험판이며이전도판/성능한계를해소했다고주장하지않는다.

## B1 / v43 추가

3D 출혈은 [B1 대장](medical-b1-ledger.json)으로 이행한다. 이전 R3/S1/Q 출혈 항목의 대체 범위와 역이식 의존성을 따로 표시했다. 2D 자동 반영 없음.
