# 6B47 곡면 도탄 — v16

사용자 요청에 따라 현재 H01의 6B47에 헬멧별 도탄 프로필, 실제 메시 입사각, 도탄 후 경로와 연속 내구도 손실을 추가했다. GitHub Actions 없이 로컬에서 빌드·검증·ZIP 생성한다. H01은 계속 A 자세 고정 표적이다.

## 판정과 원본 재사용

- `apps/training/src/helmet-ricochet.js`의 `HELMET_RICOCHET_PROFILES`에서 헬멧 ID별 수치를 관리한다. 현재 장착된 `helmet_6b47_test`만 등록했다. 다른 헬멧은 명시적인 프로필을 추가해야 이 새 도탄 판정을 사용한다.
- 입사각은 실제 피격 삼각형의 법선과 탄의 방향으로 계산한다. 0°는 표면 정면, 90°는 스침이다. 6B47은 **55° 초과**에서만 도탄 후보가 되고 85°까지 smoothstep으로 효과가 증가한다. 헬멧 중앙에서의 단순 거리나 테두리 보너스는 없다. 회전된 표적에도 같은 각도 규칙을 적용한다.
- 원본 `src/combat/impact-address.js`의 `computeRicochetHint`, `getMaterialRicochetMul`, `HELMET_ZONE_CURVATURE`를 무수정 추출한다. 중립 2D 부위 입력으로 원본 탄종/재질 성향을 읽고 실제 3D 각도로 부위 근사 보너스를 대체한다.
- 확률은 `min(0.65, 0.65 × angleMul × 원본 baseAmmoRicochet/0.1 × ammoRicochetMul × materialMul × durabilityMul × overmatchMul)`이다. `overmatchMul = clamp(2 − normalThreatRatio, 0, 1)`이며 정상 위협이 크게 초과하면 도탄이 억제된다. 내구도 0이면 추가 도탄 판정을 하지 않는다.
- 곡면 도탄을 먼저 시도한다. 실패하면 기존 원본 외피 → 라이너 관통/저지 계산을 실행한다. 성공하면 라이너는 미도달이며 실제 반사 방향으로 충돌을 다시 조회한다. 표적이나 헬멧 전체를 제외하지 않아서 이후 재충돌·다른 표적·노출 인체를 처리한다.
- Rapier의 메시 법선은 안쪽 출구에서도 탄을 향할 수 있다. 원본 삼각형 winding을 별도로 조회해 **헬멧 안에서 밖으로 나가는 면**을 판정하고 추가 도탄을 막는다. 머리에서 나온 직후의 동일 헬멧도 별도로 배제한다.
- 새 도탄 확률은 shot ID를 시드로 하는 별도 Mulberry32 스트림을 사용한다. 기존 탄도/관통 난수는 유지한다. 명시적 QA `random` 옵션만 두 스트림을 함께 제어한다. 기존 LCG의 연속 shot ID 첫 값이 비슷한 현상이 도탄 확률을 특정 발사 번호에 몰리게 하지 않는다.

원본 2D 도탄은 비관통이 확정된 뒤 부위 근사 확률로 표시하는 흐름이다. 이 v16의 **관통 전 곡면 도탄 시도·55/85°·헬멧 고유 상한·침착 정도·속도 연결·난수 분리**는 새 3D 게임 규칙이다. 6B47 인증값이나 실제 관통 깊이라고 주장하지 않는다. 원본 `src/`, `CQB_Tactical.html`, 소프트/플레이트의 형상·장착 위치와 기존 방호 수치는 변경하지 않았다.

## 도탄 정도와 내구도

`normalThreatRatio = effectivePen / effectiveShellArmor × cos(incidence)^2`를 파고듦 정도의 대리지표로 사용한다. 이것은 실제 mm 깊이가 아니다. `severity = clamp(normalThreatRatio, 0, 1)`이다.

| 정도 | severity | 동작 |
|---|---:|---|
| 튕김 | <0.18 | 잔여 속도를 많이 유지하고 마모가 작음 |
| 긁힘 후 도탄 | 0.18~<0.55 | 감속·국부 마모가 증가 |
| 파고듦 후 도탄 | ≥0.55 | 원본 탄종별 도탄 감속에 가까워지고 전체·국부 마모가 큼 |

라벨만 세 구간이며 실제 감속/마모는 연속식이다. 속도 배율은 0.98에서 원본 `getRicochetDecay`의 탄종별 속도 배율까지 severity로 보간한다. 관통력/피해/안정성도 감소하며, 관통력과 피해 배율은 잔여 운동에너지 비율을 초과하지 않는다. 반사와 분산은 원본 `calcRicochetDirection`을 3D 입사면에 적용하고 성공한 반사가 해당 면의 안쪽으로 향하지 않도록 제한한다.

내구도는 원본 `computeArmorDurabilityDamage(armorResult:'ricochet')`를 한 번만 실행한 뒤 전체·국부 손상 등에 `0.2 + 1.8 × severity`를 곱한다. 같은 탄/상태에서 깔끔한 도탄보다 깊이 파고든 도탄의 손실이 크다. 국부 손상과 기존 전체 내구도 저하가 후속 도탄 확률 및 기존 방호력에 반영된다.

## 표시와 의료 연결

설정의 기존 `탄 궤적 표시`를 켜면 도탄 직후 공중 경로는 기존 **분홍색 도탄 궤적**이다. 헬멧 착탄에도 기존 피격 먼지/흔적을 표시하고 적중 카운트를 올린다. HUD에는 도탄 정도, 입사각, 도탄 직후 속도와 실제 내구도 감소량을 표시한다. 의료 탭에는 `헬멧 도탄 · 피부 미접촉`과 도탄 정도를 기록한다.

도탄만으로 인체 관통상 출혈을 만들지 않는다. 원본 `applyOutcome(BLOCK) → applyDamageEvent(deflected)`의 둔상 경로에 탄의 에너지 손실 비율을 제한된 전달 대리지표로 연결한다. 탄이 잃은 에너지가 그대로 머리에 전달된다는 실측 가정은 아니다. 원본 의료 모델은 작은 비관통 상처/둔상 기록을 생성할 수 있다. 원본 의료 상수는 변경하지 않았으며, 후속으로 노출 인체에 실제 적중하면 그 별도 인체 진입 기록을 물리 순서대로 처리한다.

## 로컬 검증과 실행

```sh
npm ci
npm run build:training
npm test
npm run verify:baseline
node scripts/check-training-helmet.mjs
node scripts/check-training-interactions.mjs
python3 scripts/package-training-local.py
```

브라우저 검사에는 `/usr/bin/chromium` 및 v15 비교 체크아웃 `/workspace/CQB-HTML-v15-baseline`이 필요하다. 생성된 HTML에는 QA 접근 코드가 없고 모델·텍스처·WASM이 내장되어 있다. 로컬 ZIP의 `dist/CQB_Training.html`을 실행한다. 브라우저에서 직접 파일 열기를 지원하지 않는 경우 `npm run dev:training`으로 실행할 수 있다.

검증 자료는 `downloads/checks-helmet/`와 `downloads/verification-helmet-ricochet-v16.json`에 기록한다. 실제 메시/명시적 QA 난수의 세 도탄 단계 수치와 별도로, 기본 난수·실제 inventory/aim/tick/fire 경로의 사격을 1280×720 및 844×390 브라우저에서 확인한다. 실물 휴대폰 검증은 포함하지 않는다. 회귀 비교의 추가 `ricochet`/`exitingHead`/`exitingSurface` 진단 필드만 제외하며, 새 도탄 성공 결과를 숨겨서 기존과 같다고 처리하지 않는다.
