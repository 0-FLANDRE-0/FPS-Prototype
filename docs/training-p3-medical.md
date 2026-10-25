# P3 — 치료 없는 300초 의료 경과

P2 연결 보완을 적용한 production tick을 1/60초로 18,000회 실행했다. 각 시나리오 0…300초의 301개 기록을 CSV로 저장했고, 각 tick(1/60초)에서 상태의 첫 발생을 확인했다. 시각은 최종 피격 직후를 0초로 하며, 게임의 절대 tick/time은 원본대로 유지한다. 같은 seed로 2회 실행한 사격·301행·전환·전체 최종 의료 상태가 byte-equivalent JSON/deepEqual로 일치했다. 치료 없음. 표적은 계속 A자 고정이며 이 기록으로 쓰러지는 동작을 추가하지 않았다.

## 첫 상태 전환 (초)

| 시나리오 | 손실15% | 손실30% | 손실40% | isDowned | isUnconscious | isDead |
|---|---:|---:|---:|---:|---:|---:|
| bare-forearm | 143.783 | 없음 | 없음 | 없음 | 없음 | 없음 |
| front-neck | 35.383 | 69.717 | 92.483 | 85.867 | 105.683 | 108.267 |
| soft-through-body-rear | 91.550 | 194.400 | 없음 | 261.633 | 없음 | 266.033 |
| bare-upper-thigh | 143.783 | 없음 | 없음 | 없음 | 없음 | 없음 |
| arm-first-body | 55.483 | 141.883 | 202.267 | 203.350 | 없음 | 207.033 |

없음은 300초 안에 해당 **원본 medical flag**가 true가 되지 않았다는 뜻이다. 사망 후 isUnconscious를 추론해 true로 덮어쓰지 않는다. downReason은 모든 최초 downed 기록에서 원본 null(없음); neck/몸통/팔→복부는 당시 deathReason이 이미 `neck_destroyed`이며 사망 시도 같은 값을 유지한다. reason 원문은 JSON/CSV에 그대로 기록했다.

| 시나리오 | 300초 혈액 ml (%) | 의식 | HR | SBP/DBP | pain/shock | lifeStatus |
|---|---:|---:|---:|---|---|---:|
| bare-forearm | 3752.263 (75.045) | 100.000 | 101.387 | 118.195/81.827 | 0.000/0.000 | 86.275 |
| front-neck | 2647.872 (52.957) | 0.856 | 189.989 | 69.367/50.089 | 0.000/83.718 | 0.000 |
| soft-through-body-rear | 3000.963 (60.019) | 80.000 | 167.304 | 77.097/55.113 | 0.000/51.967 | 0.000 |
| bare-upper-thigh | 3752.263 (75.045) | 100.000 | 101.387 | 118.195/81.827 | 0.000/0.000 | 86.275 |
| arm-first-body | 2961.208 (59.224) | 80.000 | 144.384 | 80.842/57.547 | 0.000/9.567 | 0.000 |

사망 시 원본 tickMedical/updateUnit guard가 생리 갱신을 멈추므로 그 이후 CSV와 그래프는 마지막 상태를 유지한다. 사망 후 남은 높은 HR/BP/의식을 살아 있는 상태로 해석하면 안 된다.

## 새 상부 대퇴 fixture

A자 정면, 발 위치 `[16.845,0]`, 목표 `[17.17,0.805,-4]` m. 실제 피격은 `front.limb.left_leg.upper_thigh`, `left-thigh/leftUpperLeg`, 방호 접촉 0, 피부 상처 1, through-and-through였다. 기존 13개 M fixture는 바꾸지 않았고 P fixture만 추가했다. 목표 좌표는 저작 검사 위치이며 의학 상수가 아니다. 같은 seed의 이 한 피격에서 대퇴·팔뚝 경과가 같았다. 대퇴동맥 손상을 강제로 넣지 않았고 모든 대퇴 총상의 예후가 같다는 의미도 아니다.

![실제 production 사격](../downloads/checks-p3/bare-upper-thigh-shot.png)

![검사 카메라, 붉은 점은 실제 진입 위치](../downloads/checks-p3/bare-upper-thigh-inspection.png)

전체 사격 기록/원본 의료 주소/상처/잔여탄: bare-upper-thigh.json. 검사 카메라와 붉은 점은 외부 QA에만 존재한다.

## ATLS 비교 기준과 출처

비교 판본은 **ACS ATLS 10판(2018), Table 3-1**이다. Hall & Drobatz(2021) Table2가 ACS 허가를 받고 이 표를 재인쇄했다고 명시한 원문 PDF에서 판본과 표현을 확인했다. 수의학 리뷰 안에 실린 **인간 ATLS 표**만 비교에 사용한다. ACS 공식 사이트는 현재 ATLS11을 안내한다. 11판 표라고 표현하지 않고 구판에서 흔한 고정 맥박 수치도 끼워 넣지 않았다.

- [ATLS10 표의 허가 재인쇄 논문](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2021.638104/full) · [원문 PDF](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2021.638104/pdf)
- [ACS 현재 ATLS11 안내](https://www.facs.org/quality-programs/trauma/education/advanced-trauma-life-support/atls-11/)
- 확인일 UTC 2026-10-10, PDF 해시/분류 표현은 atls-source.json. 공식 교육 기준을 허가 재인쇄 학술 자료로 확인한 간접 출처이며 게임 튜닝에 사용하지 않았다.

| ATLS10 분류 | 손실 | HR 경향 | BP 경향 | GCS 경향 |
|---|---|---|---|---|
| I | <15% | 거의 변화 없음 | 거의 변화 없음 | 거의 변화 없음 |
| II | 15–30% | 유지 또는 증가 | 거의 변화 없음 | 거의 변화 없음 |
| III | 31–40% | 증가 | 유지 또는 감소 | 감소 |
| IV | >40% | 증가 또는 큰 증가 | 감소 | 감소 |

게임 의식 0–100은 GCS가 아니며 임상 점수로 환산하지 않는다. III의 표기 31%는 원문 정수 경계이고 지시서의 첫 손실30% 기록을 연속 경계의 비교 샘플로 사용했다. 게임에는 이 분류를 새로 적용하지 않았다.

| 시나리오 | 비교 구간 진입 | 시각 | 실제 손실% | 게임 HR | 게임 SBP | 게임 의식 (GCS 아님) |
|---|---|---:|---:|---:|---:|---:|
| bare-forearm | I | 0.000 | 0.000000 | 75.000 | 117.000 | 100.000000 |
| bare-forearm | II | 143.783 | 15.000249 | 89.391 | 123.750 | 100.000000 |
| bare-forearm | III (30% 샘플) | 없음 | — | — | — | — |
| bare-forearm | IV | 없음 | — | — | — | — |
| front-neck | I | 0.000 | 0.000000 | 75.000 | 117.001 | 80.000000 |
| front-neck | II | 35.383 | 15.000828 | 95.429 | 127.260 | 99.999522 |
| front-neck | III (30% 샘플) | 69.717 | 30.007196 | 119.674 | 116.427 | 100.000000 |
| front-neck | IV | 92.483 | 40.004913 | 154.366 | 81.841 | 80.019569 |
| soft-through-body-rear | I | 0.000 | 0.000000 | 75.000 | 117.001 | 100.000000 |
| soft-through-body-rear | II | 91.550 | 15.001016 | 97.851 | 128.952 | 100.000000 |
| soft-through-body-rear | III (30% 샘플) | 194.400 | 30.001705 | 125.463 | 116.528 | 100.000000 |
| soft-through-body-rear | IV | 없음 | — | — | — | — |
| bare-upper-thigh | I | 0.000 | 0.000000 | 75.000 | 117.000 | 100.000000 |
| bare-upper-thigh | II | 143.783 | 15.000249 | 89.391 | 123.750 | 100.000000 |
| bare-upper-thigh | III (30% 샘플) | 없음 | — | — | — | — |
| bare-upper-thigh | IV | 없음 | — | — | — | — |
| arm-first-body | I | 0.000 | 0.000000 | 75.000 | 117.000 | 100.000000 |
| arm-first-body | II | 55.483 | 15.000033 | 89.295 | 123.647 | 100.000000 |
| arm-first-body | III (30% 샘플) | 141.883 | 30.002505 | 107.252 | 112.042 | 100.000000 |
| arm-first-body | IV | 202.267 | 40.002085 | 129.080 | 81.405 | 80.000000 |

확인한 차이/한계 (수치 수정 없음):

- III 경계에서 목·몸통·팔→복부의 게임 의식은 약 100을 유지한다. ATLS10의 GCS 저하 경향을 이 게임 의식 값으로는 표현하지 못한다. 두 척도 사이 임상 대응표는 없다.
- 최초 downReason은 null이며 다른 부위 피격에서도 deathReason이 neck_destroyed로 남는다. 원본 updateSystemicHypoxiaDamage의 전신 부위 HP 감소와 recalcMedicalSummary의 목 HP 조건/첫 reason 보존이 관여한다. 죽은 시점에 partDestruction의 목 상태는 intact일 수도 있어 HP와 부위 파괴 상태를 동일시하면 안 된다.
- 몸통·팔→복부는 의식 약80/isUnconscious false인 상태에서 isDead로 전환한다. 원본 lifeStatus·생존 판정과 의식 flag가 별도이므로 이번 기록에 그대로 남겼다.
- 사망 후 HR/BP가 고정되는 것은 원본 guard이며 사후 생리 모델이 아니다.
- 이 표는 특정 seed의 게임 사례다. ATLS 분류는 대략적 임상 경향이고 정확한 생존 시각/개별 혈관 손상을 보장하지 않는다.

## 파일과 그래프

CSV는 원본 출력의 blood ml/%(bloodMax 기준), ext/int bleed rate, 의식/pain/shock/HR/SBP/DBP/호흡/lifeStatus/전투효율/기동/flags/reasons/부위 pain/부위별 파괴 state를 기록한다. null reason은 CSV 빈 셀, 부위 딕셔너리는 인용 JSON이다. 전체 부위 파괴 세부 증거는 최종 JSON에 보존했다.

### bare-forearm

[CSV](../downloads/checks-p3/bare-forearm.csv) · [사격/전체 기록](../downloads/checks-p3/bare-forearm.json)

![bloodMl](../downloads/checks-p3/bare-forearm-bloodMl.png)

![consciousness](../downloads/checks-p3/bare-forearm-consciousness.png)

![heartRate](../downloads/checks-p3/bare-forearm-heartRate.png)

![systolicBP](../downloads/checks-p3/bare-forearm-systolicBP.png)

### front-neck

[CSV](../downloads/checks-p3/front-neck.csv) · [사격/전체 기록](../downloads/checks-p3/front-neck.json)

![bloodMl](../downloads/checks-p3/front-neck-bloodMl.png)

![consciousness](../downloads/checks-p3/front-neck-consciousness.png)

![heartRate](../downloads/checks-p3/front-neck-heartRate.png)

![systolicBP](../downloads/checks-p3/front-neck-systolicBP.png)

### soft-through-body-rear

[CSV](../downloads/checks-p3/soft-through-body-rear.csv) · [사격/전체 기록](../downloads/checks-p3/soft-through-body-rear.json)

![bloodMl](../downloads/checks-p3/soft-through-body-rear-bloodMl.png)

![consciousness](../downloads/checks-p3/soft-through-body-rear-consciousness.png)

![heartRate](../downloads/checks-p3/soft-through-body-rear-heartRate.png)

![systolicBP](../downloads/checks-p3/soft-through-body-rear-systolicBP.png)

### bare-upper-thigh

[CSV](../downloads/checks-p3/bare-upper-thigh.csv) · [사격/전체 기록](../downloads/checks-p3/bare-upper-thigh.json)

![bloodMl](../downloads/checks-p3/bare-upper-thigh-bloodMl.png)

![consciousness](../downloads/checks-p3/bare-upper-thigh-consciousness.png)

![heartRate](../downloads/checks-p3/bare-upper-thigh-heartRate.png)

![systolicBP](../downloads/checks-p3/bare-upper-thigh-systolicBP.png)

### arm-first-body

[CSV](../downloads/checks-p3/arm-first-body.csv) · [사격/전체 기록](../downloads/checks-p3/arm-first-body.json)

![bloodMl](../downloads/checks-p3/arm-first-body-bloodMl.png)

![consciousness](../downloads/checks-p3/arm-first-body-consciousness.png)

![heartRate](../downloads/checks-p3/arm-first-body-heartRate.png)

![systolicBP](../downloads/checks-p3/arm-first-body-systolicBP.png)

## 구현과 검증

P3는 런타임 의료 계산 변경 없이 외부 check-training-p3.mjs와 추가 fixtures/training-p-shots.mjs, 그래프 스크립트로 구현한다. 외부 QA helper의 observe는 production medicalObservation을 읽는다. 5×2 production 사격/300초 실행 결과 완전 일치, 오류/외부 요청0. 최종 공식 테스트·v13 회귀·오프라인 스모크는 최종 검증 문서에 분리한다. 원본 게임 출력 / ATLS 공식 교육 기준(허가 재인쇄로 확인) / 비공식 신규 의학 수치 없음 / 저작 fixture 좌표·P1 품질 기준은 튜닝값으로 구분한다. S24 실기기 미검증.
