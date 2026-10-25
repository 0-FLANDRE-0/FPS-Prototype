# A2 — 벽 단위 레인·소진 표시 검증

기준은 step-impact-v6 기능 커밋 `829599a80b3f10150630a9f88d516d2f54363a21`이며, 개발 브랜치의 최신 문서 커밋 `25a4a3d`에서 이어서 작업했다. 요청 원문은 [A2 지시서](training-a2-instructions.md)다. 제출 버전은 `lane-wall-units-v7`, A/B/C 기능을 포함한 누적 빌드 하나다.

## 변경 파일·함수

실행 코드 변경은 두 파일뿐이다. [범위 확인 기록](../downloads/checks-A2/scope.json)은 나머지 Training 파일·원본 `src/**`·원본 HTML이 v6와 같음을 확인한다.

|파일·위치|변경|
|---|---|
|`apps/training/src/config.js` / `RANGE_LANES`의 04·11 데이터|04는 25 mm 한 벽, 11은 25 mm 벽 세 개와 벽 사이 공기 1.0 m. 재질 drywall·armor null 유지. `lane.label`에 지정된 표지 문구를 넣었다.|
|`apps/training/src/main.js` / `fire()`의 `barrierResult` 블록|패널 ID의 마지막 숫자 접미사를 제거해 레인 표지 이름을 찾는다. `spent`이며 마지막 패널을 관통한 경우에만 정지·소진 문구와 소진 판정 시점 속도를 표시한다. 이때 에너지 J는 표시하지 않는다.|
|`tests/training-ballistics.test.mjs` / 기존 다층 벽 테스트|3개 물리적 벽의 두께·간격·null armor 및 살아서 표적에 도달하는 기대값으로 갱신했다. 기존 테스트 수를 유지했다.|
|`scripts/check-training-lanes.mjs` / 외부 재질 하네스|소스·출력 경로 선택, 잔여 안정성 통계, v6의 여섯 레인과 모든 행의 정확한 비교를 추가했다. 기본 A 출력 경로는 유지한다.|
|`scripts/check-training-a2.mjs` / 외부 브라우저 하네스|v6 회귀·실제 HUD 경로·메시/충돌체 두께·화면 캡처 및 생산 HTML 오프라인 조작 검증. QA 번들은 제출 HTML에 포함하지 않는다.|
|`docs/training-a2-*`, `downloads/checks-A2/*`, 버전별 검증/빌드 정보, 워크플로·인계서|요청·증거·재현 방법·단일 빌드 배송 기록. 기존 A/B/C 빌드와 기록은 보존한다.|

`main.js`의 HUD 블록을 제외한 바이트와 `config.js`의 두 레인 행을 제외한 바이트도 v6와 동일하다. 따라서 발사·적중 카운트, 관통/소진 계산, A5 하한, 카메라 충격, aim/lens, 궤적 색과 방호 형상은 이번에 바뀌지 않았다. 메시와 충돌체는 기존 공통 `BOXES` 데이터를 읽으므로 25 mm를 똑같이 사용한다. 표지의 주 문구는 요청과 동일하며, 기존 보조 규격 행도 그대로 생성된다. 11번의 보조 행은 1 m를 기존 형식인 1000 mm로 표시한다.

## 빌드 내부 공식 테스트

여기서 ‘공식 테스트’는 저장소·GitHub Actions의 공식 검사이며, 실제 탄도 실험이나 군/제조사의 공식 자료를 뜻하지 않는다.

- `npm test`: **72/72 통과**. 원본 VM 대조, 실제 Rapier 경로, 탄도·형상·의료 주소·인벤토리·조준/반동·궤적 회귀 포함.
- `npm run verify:baseline`: **identical**, 3,641,864 bytes. SHA-256 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d`.
- `npm run build:training`: 생성된 독립 HTML을 외부 브라우저 검증에 사용한다. GitHub Actions는 다시 빌드한 HTML의 크기·SHA-256을 검증본과 비교한다.

## 외부 하네스 — 모델 계산값

### 레인 결과

새 빌드와 v6 각각 **12 탄종 × 8 레인 × 3각도(0/30/60°) × 2 seed(1234/20260722) × 200발 = 115,200발**, 576행이다. v6 소스는 별도의 읽기용 worktree에서 직접 불러왔다. 새 빌드의 변경하지 않은 여섯 레인은 **432개 행의 관통/도달 수, 속도, 안정성, RNG 사용 수까지 정확히 같다**. 08번은 콘크리트 경로 32 mm 두 개와 공기 126 mm를 유지했다.

|M855 0°, 두 seed 각각 200발|새 모델의 관통 후 속도|새 모델의 안정성|모든 패널 관통·표적 도달|지시서 예상값과 비교|
|---|---:|---:|---:|---|
|04 / 25 mm 한 벽|850.548880 m/s|0.853531|각 seed 200/200|반올림하면 851 m/s·0.85, 일치|
|11 / 25 mm 벽 세 개|770.640346 m/s|0.418090|각 seed 200/200|반올림하면 771 m/s·0.42, 일치|

예상값과의 차이는 반올림뿐이다. 속도/안정성 값과 이 seed에서의 100% 결과는 **레거시 함수에 따른 모델 계산값**이며 실측 방호 성능이나 일반적인 100% 관통 확률을 의미하지 않는다. 양쪽의 전체 통계는 [새 결과](../downloads/checks-A2/lanes.json), [v6 결과](../downloads/checks-A2/v6-lanes.json), [CSV](../downloads/checks-A2/lanes.csv)에 있다.

재질 하네스는 실제 `traceShot`과 유한 크기의 판/표적에 대한 production `boxInterval`을 사용한다. 비스듬한 시험에서는 각 판을 초기 광선 위에 놓고 법선 간격을 유지하며 관통 후 불안정성은 살아 있다. 실제 맵에서 플레이어가 옆으로 쏘는 시험과 구분한다. 외부 하네스는 Rapier 대신 유한 상자 접촉 어댑터를 사용하며, 별도의 공식 테스트와 브라우저 고정 사격은 실제 Rapier를 사용한다.

### 브라우저·HUD

Linux Chromium / 소프트웨어 GPU에서 확인했다.

- **844×390 터치, 1280×720 마우스/키보드**: 제출용 생산 HTML로 부팅·이동·사격·장전·인벤토리·탄약 보존·설정 저장 통과. 렌즈 70%, 가로화각 120°, 발걸음 충격 100% 기본값 유지.
- 브라우저 네트워크를 끄고 **정확한 생산 HTML 바이트만 메모리로 공급**했다. 내장 모델·텍스처·WASM을 사용하며 외부 요청 **0**, 페이지/콘솔 오류 **0**이다. `file://` 직접 실행은 환경 정책 때문에 이전 단계부터 미검증이다.
- 레인 밖 고정 입력 **600틱·실제 발사 경로 6발**: 렌즈 70%·발걸음 100% 상태에서 총구·탄 방향·시선 yaw/pitch·렌더 카메라와 충격 상태까지 v6와 완전히 같다. 각 버전은 새 물리 월드에서 시작한다. QA 반복 중 GPU 그리기만 생략하며 실제 AimState·Rapier·tick/fire·탄약 소비·반동을 실행한다. [600틱 기록](../downloads/checks-A2/deterministic.json).
- 04의 한 판 및 11의 세 판은 각각 **렌더 스케일 0.025 m, nominal thickness 0.025 m, 실제 Rapier cuboid 두께 0.025 m**를 대조했다. float32 충돌체 값은 1e−8 m 허용 오차 이내다. [04 표지·판](../downloads/checks-A2/sign-panel-drywall.png), [11 표지·판](../downloads/checks-A2/sign-panel-layers.png).

HUD 고정 사격은 QA에서 출발 위치만 고정하고 생산 AimState·Rapier·전체 `tick()`/`fire()`·인벤토리·HUD 코드를 실행했다. 문구나 사건을 테스트에서 대입하지 않았다. 매 경우 새 월드에서 M855 1발을 소비한다.

|시험|관측한 HUD|판정|
|---|---|---|
|[09 장갑 강판](../downloads/checks-A2/hud-steel.png)|`장갑 강판 · 정지 (1겹 관통 후 탄자 소진)` / `소진 판정 시점 570 m/s`|spent, 적중 0. ‘관통 후’ 속도 행과 J 표시 없음.|
|[05 합판](../downloads/checks-A2/hud-wood.png)|`합판 · 관통 1겹 · 표적 적중` / `관통 후 822 m/s · 1358 J`|T-wood 적중 1.|
|[레인 밖 벽](../downloads/checks-A2/hud-outside.png)|결과 패널이 숨겨지고 문구는 빈 문자열|v6도 같은 빈 문자열·hidden 상태. 실제 왼쪽 벽 사건/탄도 기록 전체도 동일. 기존 동작을 유지했다.|

초기 외부 QA는 기본 장전량을 31발로 잘못 가정하여 발사 후 30발을 기대했고, 실제 29발에서 실패했다. 발사 전 관측값에서 1발 감소를 확인하도록 하네스만 수정한 뒤 전체 QA를 다시 통과했다. 생산 코드 실패는 아니었다.

570/822 m/s와 1358 J 역시 **모델 계산값**이다. 벽에서 정지·도탄·파쇄 시의 판정 문구/속도 형식은 기존 조건을 유지하며, 레인 패널의 이름만 표지 이름으로 바뀐다. 레인 조회에 실패하면 기존 재질 이름을 쓴다.

## 출처 분리·알려진 한계

|구분|이번에 사용한 근거|
|---|---|
|공식 물성/방호 실측 자료|이번 변경에는 새로운 자료를 적용하지 않았다. 8개 레인은 정량 M855 방호 자료가 없어 계속 미보정이다.|
|비공식 자료|이번 변경에는 새로운 비공식 방호 수치를 적용하지 않았다.|
|지시서 규격/설계값|25 mm 벽 하나/세 개, 공기 1.0 m, 표지 문구는 사용자 A2 지시서의 구조물 단위다. 현실 방호 등급으로 해석하지 않는다.|
|튜닝값|새 손실/방호 튜닝값은 없음. 기존 A5 하한·불안정성·카메라/렌즈 기본 설정 유지.|
|모델 계산값|관통 후 속도·안정성·관통/도달 빈도·HUD 에너지는 원본 레거시 함수를 실행한 결과다. 실험 결과와 구분한다.|

- 8개 레인의 armor는 **null/미보정**이며, 08 중공 블록은 기존 두 벽 모델을 유지한다.
- 레거시는 **5 mm 이하에서 명시 armor를 무시**한다. 이번에도 바꾸지 않았다.
- 잔여 속도가 관통 난이도를 충분히 반영하지 못한다. 속도는 안정성으로 인한 소진 뒤에도 높게 남을 수 있다. 이번 HUD는 이 잔여값을 ‘소진 판정 시점’으로 정직하게 표시할 뿐, 탄도를 보정하지 않는다.
- **S24 실기기 미검증**. 실제 단말 성능·file URL 호환성은 이번 환경의 결과로 주장하지 않는다.
- 6B45는 원본 소프트 8구역 + 별도 저작 전면 목 1구역과 곡면 판 2장인 관측 형상만 있다. 이번에 방호 저지·소프트 손실·플레이트 내구도·부상/국부 손상은 추가하지 않았다.

## 재현

v6의 읽기용 checkout과 동일한 의존성을 준비한 뒤 저장소 루트에서 실행한다. 바뀌지 않은 이전 버전의 검증 파일을 덮어쓰지 않는다.

```sh
npm test
npm run verify:baseline
npm run build:training
CQB_SOURCE_ROOT=/workspace/CQB-HTML-v6-baseline CQB_LANES_OUT=artifacts/training-a2/v6 node scripts/check-training-lanes.mjs
CQB_LANES_OUT=artifacts/training-a2/current CQB_LANES_BASELINE=artifacts/training-a2/v6/lanes.json node scripts/check-training-lanes.mjs
CQB_QA_ONLY=1 node scripts/check-training-a2.mjs
CQB_SMOKE_ONLY=1 CQB_OFFLINE=1 node scripts/check-training-a2.mjs
```

외부 검증 파일은 ZIP의 `downloads/checks-A2/`에, 실행 HTML은 `dist/CQB_Training.html`에 있다. QA HTML과 QA 가변 API는 배송하지 않는다. 빌드/Actions 배송 확인은 버전별 build-info와 delivery 기록 및 `HANDOFF_KO.md`를 따른다.
