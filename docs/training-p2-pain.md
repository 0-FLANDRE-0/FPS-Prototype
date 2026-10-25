# P2 — 통증 0 원인과 원본 의료 루프 연결

통증 0은 원본의 자연 감소다. 동시에 원본 updateUnit이 소유한 제압도/급성 타이머 처리가 3D 연결부에서 누락된 것을 발견해 보완했다. 의료 상수·임계값·피해 함수는 변경하지 않았다. 변경은 지시서 P2의 연결 누락 예외에 해당한다.

## 통증의 원인

`src/medical/damage-physiology.js:1321 updatePainShockConsciousness`의 원본 주석은 “Pain 자연 감소”. `m.pain = Math.max(0, m.pain - 1.5 * dt)`가 살아 있는 유닛의 전역 pain을 초당 1.5 줄인다. applyDamageEvent는 부위 pain과 전역 pain에 피격 시 값을 더하지만, 총상이 남았다는 이유로 전역 pain을 매 tick 재주입하지 않는다. 부위 pain은 별도로 남는다. 치료/진통제 없이 2D에서도 전역 pain이 0으로 간다. 현실성 판단과 감소율 변경은 이번 작업 밖이다.

## dt와 호출 순서

원본 `src/runtime/main-loop.js`는 `(now-lastFrameTime)/1000` 후 `Math.min(0.05,dt0)`로 **초** 단위 dt를 updateUnit에 전달한다. 비교에서는 양쪽에 고정 1/60초를 사용하며 절대 gameTime도 `tick*(1/60)`으로 일치시켰다. 3D는 main.js tick이 medical.tick을 먼저 실행한 뒤 사격한다. 같은 tick의 의료 처리 후 피격, 다음 tick부터 경과를 적용한다.

| 순서 | 원본 2D updateUnit | v13 3D | P2 3D |
|---|---|---|---|
| 시작 | 사망/비생존 guard | tickMedical 내부 사망 guard | 같은 유닛 guard |
| 의료 전 | suppression −9dt, pinned, downedTime | 누락 | 원문 추출 tickUnitMedicalBefore |
| 의료 전 | tickPendingMedic, tickStanceTransition | 없음 | 없음 (치료·자세 전환 없는 고정 표적) |
| 핵심 | tickMedical | tickMedical | 동일 tickMedical |
| 의료 후 | 진통제·처치 처리 | 없음 | 없음 (치료 없음) |
| 의료 후 | stopping/flash/impactKnockdownTimer 감소·alias | 누락 | 원문 추출 tickUnitMedicalAfter |
| 이후 | AI·시선·이동·자세·발소리 | 별도 3D 루프 | 기존 3D 루프, 표적 A자 고정 |

핵심 tickMedical 내부의 같은 순서:

- ensureMedicalExtensions / transientNeurologicDisruption / _acuteResponseLoad 감소 (2D/P2 공통 원본 선언)
- updateMedicalBleeding (2D/P2 공통 원본 선언)
- updateChestTrauma (2D/P2 공통 원본 선언)
- updateSystemicHypoxiaDamage (2D/P2 공통 원본 선언)
- updateStressResponse (2D/P2 공통 원본 선언)
- updateHormonalCompensation (2D/P2 공통 원본 선언)
- updateHemodynamics (2D/P2 공통 원본 선언)
- updateVitalsFromHemodynamics (2D/P2 공통 원본 선언)
- updatePainShockConsciousness (2D/P2 공통 원본 선언)
- updateMedicalPerformanceMultipliers (2D/P2 공통 원본 선언)
- buildTcccAssessment (2D/P2 공통 원본 선언)
- buildPreCardiacRisk (2D/P2 공통 원본 선언)
- buildCardiacRhythmModel (2D/P2 공통 원본 선언)
- updateFieldStabilization (2D/P2 공통 원본 선언)
- buildEvacuationModel (2D/P2 공통 원본 선언)
- recalcMedicalSummary (2D/P2 공통 원본 선언)
- syncLegacyCombatState (2D/P2 공통 원본 선언)

누락된 suppression 감소 때문에 updateStressResponse가 제압을 지속 입력으로 읽었고, 호르몬·혈압·상처 출혈 modifier에 영향을 줬다. stopping/impact 타이머의 소유권은 원본 주석에도 updateUnit으로 명시돼 있다. 원본 해당 AST 문장을 그대로 복사해 before/after 함수를 생성하며 문장 SHA를 기록한다. 3D 사격·몸통 피격·방호 조건·표적 자세는 그대로다.

## 60초 재현

원본 makeUnit으로 만든 주체에 production 사격이 만든 applyDamageEvent 인자를 재생했다. 내부 applyOutcome(BLOCK)의 둔상 호출도 함수 본체에서 포착했다. 피격 전 동일 틱, shotId 기반 seed, 호출 사이 RNG 진행과 마지막 seed까지 검사했다. 원본 updateUnit 함수 전체를 VM에서 실행하며 의료·타이머 선언은 원문이다. 고정 표적의 AI/맵/무기/적 선택만 명시적인 환경 no-op/빈 선택으로 격리했다(report.json의 referenceBoundaries). **원본 게임의 모든 AI·렌더 루프를 실행했다고 주장하지 않는다.** 치료·이동·투척·자세 전환이 활성화되면 하네스는 실패한다.

각 경우 0…60초 61개 행의 모든 관측값이 2D와 P2 3D에서 정확히 일치, 허용 오차 없이 deepEqual 통과. pain·혈액·의식 그래프는 2D와 P2 선을 겹쳐 표시하고 v13도 함께 표시했다.

| 시나리오 | 피격 직후 pain | 60초 pain | 첫 0 초 샘플 | 60초 혈액 ml | 의식 |
|---|---:|---:|---:|---:|---:|
| bare-forearm | 62.400000 | 0 | 42 | 4517.395533 | 100.000000000 |
| front-neck | 27.793043 | 0 | 19 | 3715.463450 | 99.999999709 |
| soft-through-body-rear | 28.946087 | 0 | 20 | 4480.525400 | 100.000000000 |

## 허용된 연결 수정의 v13 대비 변화 (60초)

| 시나리오 | 항목 | v13 | P2/원본2D |
|---|---|---:|---:|
| bare-forearm | bloodMl | 4503.273700 | 4517.395533 |
| bare-forearm | bloodPercent | 90.065474 | 90.347911 |
| bare-forearm | externalBleedRate | 3.309000 | 3.175000 |
| bare-forearm | heartRate | 98.450074 | 82.971552 |
| bare-forearm | systolicBP | 132.712088 | 121.047420 |
| bare-forearm | diastolicBP | 91.262857 | 83.680823 |
| bare-forearm | lifeStatus | 94.536011 | 94.691351 |
| bare-forearm | combatEffectiveness | 83.696647 | 87.862000 |
| front-neck | bloodMl | 3679.429750 | 3715.463450 |
| front-neck | bloodPercent | 73.588595 | 74.309269 |
| front-neck | externalBleedRate | 22.544000 | 22.080000 |
| front-neck | heartRate | 119.731490 | 112.805907 |
| front-neck | systolicBP | 120.545323 | 119.440267 |
| front-neck | diastolicBP | 83.354460 | 82.636174 |
| front-neck | lifeStatus | 79.047727 | 79.444098 |
| front-neck | combatEffectiveness | 86.806765 | 88.570129 |
| soft-through-body-rear | bloodMl | 4472.307183 | 4480.525400 |
| soft-through-body-rear | bloodPercent | 89.446144 | 89.610508 |
| soft-through-body-rear | externalBleedRate | 1.229000 | 1.189000 |
| soft-through-body-rear | internalBleedRate | 6.149000 | 6.063000 |
| soft-through-body-rear | heartRate | 95.792230 | 89.220250 |
| soft-through-body-rear | systolicBP | 129.683992 | 124.705907 |
| soft-through-body-rear | diastolicBP | 89.294595 | 86.058840 |
| soft-through-body-rear | lifeStatus | 90.901379 | 90.991779 |
| soft-through-body-rear | combatEffectiveness | 95.420806 | 97.438000 |

전체 변경 필드는 v13-deltas.json. pain/의식은 이 세 경우에서 그대로이고, 혈액/심박/혈압/전투·기동 상태 수치는 누락된 원본 유닛 입력 복구로 달라졌다. 신규 수치 튜닝 없음. 초 단위 timeline은 pain/shock/HR/SBP/부위 pain 및 P3에 필요한 읽기 전용 항목으로 확장했다.

### bare-forearm

![pain](../downloads/checks-p2/bare-forearm-pain.png)

![bloodMl](../downloads/checks-p2/bare-forearm-bloodMl.png)

![consciousness](../downloads/checks-p2/bare-forearm-consciousness.png)

### front-neck

![pain](../downloads/checks-p2/front-neck-pain.png)

![bloodMl](../downloads/checks-p2/front-neck-bloodMl.png)

![consciousness](../downloads/checks-p2/front-neck-consciousness.png)

### soft-through-body-rear

![pain](../downloads/checks-p2/soft-through-body-rear-pain.png)

![bloodMl](../downloads/checks-p2/soft-through-body-rear-bloodMl.png)

![consciousness](../downloads/checks-p2/soft-through-body-rear-consciousness.png)

## 구현·검증 구분

배포 변경: medical.js의 medicalObservation/tick, training-medical.mjs의 원문 context 추출, generated/legacy-medical.js의 context 선언, build-training.mjs의 출처 metadata. 외부 검증: training-p-browser/session/reference.mjs, check-training-p2.mjs, render-training-p-medical.py. 공식 회귀 테스트: training-medical-context.test.mjs (실제 포착 입력 3건을 독립 원본 updateUnit과 비교). 수치는 모두 원본 게임 출력이며 의료 현실의 기준값이 아니다. S24 실기기 미검증.

P2 단계 공식 `npm test`: 114/114 통과. 외부 3건 의료 비교: 61행/건 완전 일치, 의료 seed 일치, 브라우저 오류·외부 요청 0.
