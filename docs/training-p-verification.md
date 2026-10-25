# 지시서 P 누적 검증 — pre-collapse-v15

P1 `84a334d` → P2 `b3998aa` → P3 `c086d76` 순서로 독립 커밋했다. v14 조작 개선을 유지하고 계산·형상 비교는 실제 다운로드한 v13을 기준으로 했다. 최종 HTML 하나에 세 작업을 누적했다.

| 항목 | 결과 |
|---|---|
| HTML | 22793761 B / SHA-256 5aee0160f0af032fecd471029ee04d268f01fe6948e2d38dda7623a57b6fbf49 |
| v13 HTML 대비 | 21.15% 감소 |
| 병사 WebP 파생본 | 8585780 B / 9611123392eac05ab89ddcca6edfd94d2ba51e468b1184d68cb2b245801f70fd |
| M4 WebP 파생본 | 3629420 B / 02393f2d226b8e09ce4bf55dc90e897d6a0f8b6a4050d1e478abdb53f965c67c |
| 공식 npm test | 114/114 통과 |
| baseline identical | 원본 HTML 3,641,864 B, ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d |
| 원본 src/HTML/모델 | v13 기준 git diff 없음 |
| v9 native GLB | 10,579,016 B / 0ca0af733fd5c1bd6a601ce098ca7d3551442aa7605982c67819f5c71c4c6042, 바이트 비교 일치 |
| v13 스킨 GLB | 10,982,612 B / 317c81b791ebe622d059951a2fdcf26bb5b6b16a2ba3f8ce280d4f457a4b7e3a, 실제 v13 다운로드와 일치 |
| 600틱/6발 | 총구·방향·카메라·걸음·충격 스프링까지 v13 완전 일치 |
| 기존 13사격 fixture | 탄도·방호·인체·조건·탄약/카운트/의료 제외 HUD까지 완전 일치 |
| P2 원본 2D 비교 | 3건 ×61행, 관측값과 최종 seed 정확히 일치 |
| P3 300초 재현 | 5건 ×2회, 301행 및 모든 tick 전환·최종 상태 일치 |
| 오프라인 844×390/1280×720 | 실제 배포 HTML, real RAF, 터치/마우스 통과; 오류0·외부요청0 |

## 의료 변경의 정확한 범위

P2에서 누락된 원본 updateUnit 문장(suppression/pinned/downedTime, stopping/flash/impact timer와 alias)을 원문으로 추출해 tickMedical 앞뒤에 연결했다. 의료 함수·상수·임계값은 바꾸지 않았다. 실제 방호/인체 trace가 끝난 뒤 독립 의료 seed를 사용하는 기존 경계도 유지했다.

13사격의 전체 lastShot를 비교하되 파생 의료 records만 분리했고 모든 다른 필드는 동일했다. 의료 전체 snapshot의 차이는 P2 연결 복구로만 발생했다. timeline은 새 관측 열을 추가했으므로 비교에서는 기존 의료 본체의 경과와 신규 관측 schema를 구분했다.

| 고정 사격 | 의료 본체 변경 필드 수 | 대표 항목 v13 → P2 |
|---|---:|---|
| plate-stop | 0 | 동일 |
| plate-penetration-rear | 28 | heartRate: 75.222580 → 75.190166; systolicBP: 116.889037 → 116.847606; diastolicBP: 80.977874 → 80.950944; combatEffectiveness: 99.976699 → 99.990311 |
| soft-through-body-rear | 0 | 동일 |
| body-retained | 29 | heartRate: 75.797996 → 75.190184; systolicBP: 117.816761 → 117.367529; diastolicBP: 81.580895 → 81.288894; combatEffectiveness: 99.768777 → 99.990311 |
| front-neck | 0 | 동일 |
| bare-forearm | 0 | 동일 |
| exposed-eyes | 0 | 동일 |
| 6b47-crown | 0 | 동일 |
| 6b47-side | 0 | 동일 |
| fixed-boot | 0 | 동일 |
| arm-first-body | 0 | 동일 |
| crouch-plate-stop | 0 | 동일 |
| crouch-boot | 0 | 동일 |

전체 필드별 원문 값/수치: downloads/checks-p-regression/report.json 및 fixture별 v13/current JSON. 별도의 60초 경과 비교: [P2 보고서](training-p2-pain.md), v13-deltas.json. 통증은 원본 초당1.5 감소를 유지해 60초에0; 연결 수정으로 원본 혈액·심박·혈압과도 일치시켰다.

## 변경 파일과 함수

- 배포: build-training.mjs → generateWebP 파생 파일 삽입/출처 metadata; medical.js → medicalObservation 읽기 전용 기록과 tick의 원본 context 호출; training-medical.mjs → 원본 AST before/after 추출; generated/legacy-medical.js → 기존 선언 무수정 + context metadata/wrappers.
- 텍스처: training-webp.mjs의 imageMetrics/assertTextureOnly/compressGLB/generateWebP; sharp 0.34.5를 devDependency로 고정. 모델 크기·화질·재생성 해시·KTX2 시험은 [P1](training-p1-textures.md).
- 기록/외부 검사: check-training-p1/p2/p3/p-regression/p-offline.mjs, training-p-browser/session/reference.mjs, check-training-ktx.mjs, render-training-p-medical.py. QA globals/event capture/카메라/진입점은 HTML에 넣지 않았다.
- 공식 회귀: training-textures.test.mjs 2건, training-medical-context.test.mjs 1건, actual damage argument fixture와 additive upper-thigh fixture. 기존 M 사격 좌표는 그대로.
- 배송: training-download.yml에서 HTML hash/bytes·보호 프로필·immutable skin/rig·WebP 파생 SHA·원본 의료 출처/context를 일치시켜야 업로드한다.

## 공식 테스트와 외부 하네스

공식 저장소 `npm test`는 총114개, baseline 검사는 원본 조립의 바이트 일치를 검사한다. 외부 브라우저/원본 VM/품질/부팅/KTX/장시간 기록은 빌드에 포함하지 않는 작업 검증이다. 위 외부 통과를 게임 내부 임상 인증으로 표현하지 않는다. 각 원시 결과와 실행 환경은 checks-p1/p2/p3/p-regression/p-offline에 보존했다. 브라우저는 Linux Chromium software GPU, 실제 S24 측정은 없다.

## 출처와 한계

원본: CQB 의료 선언/원본 유닛 문장·피격 인자/출혈·생리·flag·reason 및 판정값. 공식 교육 기준: ATLS10 Table3-1을 ACS 허가 재인쇄 논문에서 확인; 현재 ACS11 안내와 구분한다. 비공식 신규 방호/의학 수치 없음. 튜닝: 사용자 P1의 q/SSIM/10% 기준과 외부 검사 좌표·프레임·카메라·압축 effort/KTX 시험 설정; 실제 의료나 방호 보정값으로 사용하지 않았다.

- WebP는 파일만 줄이고 GPU RGBA8 저장은 유지한다. KTX2는 시험/이론 GPU 추정만, 디코더 배포/해상도 축소 없음.
- 원본 전역 통증 자연 감소는 상처의 부위 통증과 별개다.
- 원본의 reason null/다른 부위에서도 neck_destroyed/의식80에서 사망/사망 후 생리 동결을 [P3](training-p3-medical.md)에 기록했다. 값을 임상 표에 맞추지 않았다.
- 표적 쓰러짐·치료·탄두 눕힘/파편 보정·의료 패널 한글화·몸통 UV 수정은 추가하지 않았다.
- S24 실기기 미검증.

로컬 file:// 직접 열기는 관리형 Chromium이 ERR_BLOCKED_BY_ADMINISTRATOR로 차단했다. 브라우저 정책은 변경하지 않았고, 동일 HTML 바이트를 메모리에서 전달해 네트워크 차단 상태의 실제 런타임을 검사했다. file URL 직접 실행이나 S24 실측을 완료했다고 주장하지 않는다. 추가 오프라인 smoke도 2화면 통과; 기존 v14 검사로 동시 터치·우클릭 조준 토글/유지·F 상자·근접 의료 진입/정지/복귀를 회귀 확인했다.

[최종 빌드 정보](../downloads/training-build-info-pre-collapse-v15.json) · [전체 검증 JSON](../downloads/verification-pre-collapse-v15.json). Actions 배송과 실제 ZIP 대조는 별도 delivery-pre-collapse-v15.json으로 기록한다.
