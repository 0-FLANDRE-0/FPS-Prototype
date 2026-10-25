# W 검증 — AK-74M·공통 1인칭 팔·어깨 회전축

> 이후 사용자의 반동/팔/총구 선행 지적은 [v21 수정·검증](training-viewmodel-v21.md)에서 처리했다. 아래는 v20 배송 당시 결과다. v20의 개머리판 절대 고정 계약과 `check-training-w-shoulder.mjs`/W 회귀 스크립트의 해당 기대값은 최신 v21에 적용하지 않는다. 현재 회귀는 `check-training-viewmodel.mjs`를 사용한다.

기준 v19 `fff9ac7a3a4b867131cc599f4218b399e439e294`. [W 지시서](training-w-instructions.md), 코드 변경 전에 작성한 [W0 조사](training-w0-survey.md)를 따른다. 첨부 문서는 작업 규격으로 사용했다. 이후 사용자가 요청한 **개머리판을 어깨에 고정하는 회전**과 추가 용량 최적화를 함께 적용했다. GitHub Actions 없이 로컬 빌드·검증한다.

## 적용한 동작과 데이터

- 순정 AK-74M과 M4 두 주무기 슬롯. 훈련 시작은 M4. PC 1/2·휠, 터치 M4↔AK, 가방의 보조 슬롯에서 전환한다. 전환 .2초 내리기 + 원속도 Draw .648333초. 전환 중 사격/ADS 차단, 조이스틱 owner 유지, 장전 중 전환은 기존 예약·소유권 취소 규칙을 따른다.
- `ak74m`은 원본 `ak74`를 복사한 별도 정의다. 13탄종·30발·650rpm·장전2.1/2.7초·핸들링 필드는 원본 그대로다. 제조사 자료에 따라 무게3.6kg/펼친 길이943mm를 적용하고 점사는 제외했다. 원본 `ak74`와 모든 탄약 선언은 그대로다. 3D의 기존 운동량 반동 어댑터를 공유하며 원본 2D 산포 엔진 전체를 새로 이식했다고 주장하지 않는다.
- 자료 우선순위와 한계: [Azersilah 제조사](https://azersilah.com/en/mehsul/8), [전시 배포 brochure](https://docs.tuyap.online/FDOCS/39725.pdf), [소련 국방부 AK74/RPK74 교범1984 §117](https://ru.djvu.online/file/VdNjJdWnyUBdn). Kalashnikov Group의 AK74M 전용 교범은 확보하지 못했다. 상단 안전→첫 클릭 연발→두 번째 단발은 같은 계열 교범 적용이다. 현재 full에서 버튼을 누르면 semi→safe→full 순환한다.
- 교범 §13의 П/약440m는 **자료값**이다. v19 M4에 원거리 탄도 영점 보정이 없으므로 AK도 같은 실제 rear/front 마커선·75mm eye relief 규칙을 쓴다. 440m에 낙차를 보정하는 기능이나 가늠자 조절 UI는 구현하지 않았다.
- 팔은 두 총기에 항상 표시한다. Idle/Walk/Run의 위상은 기존 gaitPhase, 속도에 따른 블렌드다. Shot은 오른손 손가락과 Trigger 채널만 사용한다. Rif/Head_Cam은 반동·카메라를 구동하지 않는다. 같은 world 렌더와 바디캠 렌즈를 통과한다. AK 노리쇠/장전 손잡이 뼈가 없어 가상의 움직임을 만들지 않았다.
- M4 손목 목표는 실제 grip/handguard/magazine-well/bolt-catch 마커, AK는 native 잡는 지점을 사용하고 길이를 유지한 2관절 IK로 맞춘다. M4 탄창의 회전은 제거하고 직선 삽입으로 바꾼다. M4 빈 장전은 normal Reload + 끝의 왼손 bolt-catch IK다.
- 탄도·방호·인체·의료 수식은 v19 그대로다. 의료 어댑터의 3곳에서 M4로 고정됐던 무기 식별자만 실제 탄종/무기 식별자로 전달한다. 원본 applyOutcome에는 기존 `ak74` ID를 전달한다. R2 해부·생리·의료 장부·상수는 변경하지 않았다.

## 추가 요청: 어깨 접점

총의 quaternion/반동/카메라 추종 계산을 유지하고, position을 **어깨 접점 − 회전된 개머리판 마커**로 계산한다. hip에서는 몸 기준 접점, ADS에서는 정렬된 견착 자세의 지연 접점을 쓴다. 이동의 bob은 어깨와 총에 함께 적용한다. 표시 보간도 shoulder를 보간한 뒤 새 quaternion/scale에서 position을 다시 계산하므로 중간 프레임에서 개머리판이 미끄러지지 않는다.

M4 접점 `[0,.015,.4592226148]`, AK `[0,-.0154850296,.4771586635]`는 모델에 저작한 마커다. 실제 인체 어깨 치수나 새 반동 계수가 아니다. ADS로 자세를 바꿀 때 접점은 기존 견착 배치로 이동하며, 장전·꺼내기·벽 앞 내리기는 기존 작업 공간으로 견착을 푼다. 기존 벽 검사/발사 차단과 near15mm는 유지한다.

**W의 M4 바이트 동일 요구와 최신 요청의 관계:** 어깨 요청 전에는 팔이 있는 상태에서도 v19의600틱/6발과14fixture×2모드가 완전 일치했다. 그 결과는 `checks-w-regression/before-shoulder-browser-report.json`에 보존했다. 어깨 요청 후에는 총구의 위치가 바뀌므로 동일한 입력에서 경로·입사각·관통 길이·의료 기록의 일부가 달라진다. 최종 빌드가 이 항목까지 v19와 동일하다고 주장하지 않는다. 최종600틱 검사는 카메라·방향·회전·반동·gait·발걸음 스프링의 완전 일치와 접점 오차를 따로 검증한다. 최종14fixture의 전후 전체 기록과 차이 경로는 `fixtures.json`/`browser-report.json`에 남겼다.

## 장전 시간 불일치와 시각 한계

|클립|native(s)|AK 상태(s)|차이|
|---|---:|---:|---:|
|Reload|2.648333|2.1|+26.11%|
|Reload_var2|2.815000|2.1|+34.05%|
|Reload_full|3.498333|2.7|+29.57%|

±15%를 넘기므로 시간 압축이나 원본 장전 시간 변경을 하지 않았다. normal Reload는 full과 초반 탄창 조작이 같은 명확한 기본 경로여서 선택했다. 60Hz로 측정한 AK 탄창 분리1.15초/안착1.9초에 실제 소유권·탄수를 갱신한다. 탄창 없이 수동 삽입은 클립1.15초부터 시작하고 .75초 뒤 안착한다. 약실 급탄은 기존 진행도 .83이다. AK는 자동 bolt hold-open을 만들지 않는다. M4 기존2.0/2.6초와 remove/insert/feed 이벤트는 보존했다.

장전 상태 완료 후 남은 native 팔 회복은 표시만 이어갈 수 있다. 완료 뒤 총은 AimState 자세에 고정되며 조준/사격을 시작하면 회복을 중단한다. 특히 AK full의 손잡이를 당기는 **보이는 손동작과 논리 급탄 시점은 완전히 동기화되지 않는다**. 이를 해결하려면 이후 별도 클립 저작이 필요하다.

M4 빈 장전은181연속 샘플과13장 화면으로 남겼다. [130프레임](../downloads/checks-w-visuals/m4-empty-130.png)→[145프레임](../downloads/checks-w-visuals/m4-empty-145.png)→[160프레임](../downloads/checks-w-visuals/m4-empty-160.png)을 직접 확인했다. bolt-catch로 손이 이동하지만 source 팔의 열린 상완 단면이 보이고, native 잡는 손가락 모양을 유지해 실제 M4 버튼 누름 자세처럼 완전히 자연스럽지는 않다. 팔 복장/토폴로지를 바꾸거나 이 구간을 숨기지 않았다. 손 목표는 **손목 기준점**이며 모든 손가락 피부가 grip에 닿는다는 보장은 아니다.

## 용량·형상·라이선스

원본 FPS GLB는 `apps/training/assets/source/fps_ak-74m_animations.glb`에 바이트 그대로 보존했다. SHA256 `8eeb18cbe047e8cbbe24084828f39ba625a6f3c1a1062a37d7a978e8cd7d0533`.

|항목|바이트|
|---|---:|
|업로드 원본|15,131,564|
|단위/축·노드 정리 + 무손실 데이터 공유 PNG 파생본|14,009,540|
|최종 WebP 파생본|10,410,992|
|중복 accessor 바이너리 절약|1,157,628|
|v19 HTML|22,870,896|
|최종 HTML|36,789,951|

8개 display/empty 노드를 제거하고3메시·40,023삼각형·85joint·8클립을 유지했다. 축 측정 길이1.3843800596에 .6811713254배를 적용하고 export wrapper를 제거해 canonical 길이943mm로 맞췄다. 팔도 동일 similarity 변환을 받는다. 기존 hip 크기115%/ADS100% 표시는 별도 기존 설정이다.

7이미지는 전부1024×1024 유지한다. base color는 q85부터 SSIM 기준에 맞춰 팔q95/AKq85, ORM q85, 두 노멀은 **디코딩 RGB 완전 동일**인 lossless WebP다. 형상·skin·UV·클립·재질을 손실 없이 유지하고 반복된 clip time/constant accessor bytes만 공유했다. 2,782 accessor 전체 바이트를 원본에서 추출해 packed 출력과 비교했다. prepared→WebP도 image 외 buffer bytes/JSON 구조를 대조한다. `fpsDerivative.losslessPacking`/`texture.proof`가 증거다.

렌더 비교는 texture 파생 전 PNG와 최종 WebP를 **동일한 실제 상태**로 띄워 총/팔 영역 ROI에서22화면 SSIM≥.97을 검사한다. 최솟값은 0.995615. 재질 roughness/metalness/색 상수는 바꾸지 않았다. 렌더 SSIM은 이 화면 조건의 외관 검증이며 모든 광원/재질 각도에 대한 보장은 아니다.

CC BY4.0: [Cransh](https://sketchfab.com/ccransh), [원본 팩](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14). 팩 페이지에 적힌 AK creationwasteland, 팔 DJMaesen/bumstrum도 크레딧에 포함했다. [크레딧 JSON](../apps/training/assets/fps-credits.json), 게임 내 크레딧, 빌드 정보에 제작자·출처·라이선스·변경 내용이 있다.

## 검증 결과와 재현

- 공식 `npm test`:142/142. 원본 baseline3,641,864B/SHA256 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d` 동일. 원본 HTML/모델/`src/**`는 무수정.
- legacy P2 실제 현재 사격3사례×61행은 원본2D VM 완전 일치. P3/Q는5사례×301/901행을 원본 실제 입력에서 재생하여 완전 일치.
- M4 최종600틱/6발×2모드: 카메라·방향·회전·반동·걸음·스프링 동일, 총구 원점은 최신 어깨 요청으로 변경.14fixture×2모드 전후 전체 기록과 변경 경로 보존.
- AK13탄종×3재질×4방호값=156건의 유효 관통/잔여/탄자 상태/내구도는 원본AK VM과 일치. 실제 production4fixture(맨살 팔뚝·Br4저지·소프트 통과 몸통·대퇴동맥)×2회 동일 seed의 초기 사격과600초 의료 최종/전환 완전 일치. 최초 사격은 production pack/reload/rack/tick/fire, 이후 경과는 production 의료 엔진을 고정1/60초로 호출한다. 이후600초에 전체 물리/화면을 돌린 테스트라고 주장하지 않는다.
- 두 총기의 ADS0/70 rear/front는1280×720 중심±1px. idle/walk/ADS의 실제 손 뼈→저작 마커 거리≤1cm.22상태의 **화면 안으로 들어오는** 팔 삼각형 near-plane 교차0. 화면 밖 상완의 교차는 이 검사에서 제외한다.
- 무기별11상태의 픽셀 해시는 서로 다르다. idle/walk/run/ADS/reload/draw는 실제 게임 카메라, selector3상태는 가려지는 조정간을 보기 위한 **측면 inspection camera**다. 해당 JSON의 `selectorInspection:true`와 실제 camera 값을 명시했다. selector 사진을 일반 바디캠 화면이라고 주장하지 않는다.
- 추가 어깨 검사는 두 총기120틱×alpha0/.5/1에서 actual stock marker→보간 접점, alpha1 actual muzzle/direction→논리 탄도 일치를 검사한다. 정지 몸의 순수 AimState 접점은1e−12m 이내, production body-frame 허용10µm는 Rapier idle settling의 미세 gait를 포함한다.
- 최종 무수정 HTML:844×390/1280×720에서 PC1/2·휠·실제CDP 멀티터치 전환/이동·전환 중 사격/ADS 차단·장전 취소와 탄약 보존, 오류0/외부요청0. QA 객체는 실행 HTML에 없다.
- 3회 부팅 평균 v19 4283.0ms → v20 5768.8ms. 60회 렌더 평균 v19 M4 1.52ms → v20 M4 3.12ms / AK 1.23ms. 추가 자산으로 부팅 시간과 M4 렌더 비용이 증가했다.

Linux Chromium/SwiftShader 검증이다. **S24 실기기와 직접file://는 미검증**이며 offline memory route의 exact HTML을 확인했다. 부팅은 fresh browser context3회, OS cache는 공유하고 네트워크 다운로드를 제외한다. 프레임은1280×720, lens70, 렌더60회(gl.finish 포함) 평균이며 실제 휴대폰 FPS나 전체 gameplay tick 비용을 보장하지 않는다.

재현 명령: `npm test`, `npm run verify:baseline`, `npm run build:training`, `node scripts/check-training-w-regression.mjs`, `node scripts/check-training-w-legacy.mjs`, `node scripts/check-training-w-ak.mjs`, `node scripts/check-training-w-visuals.mjs`, `node scripts/check-training-w-shoulder.mjs`, `node scripts/check-training-w-offline.mjs`, `node scripts/check-training-w-performance.mjs`. v19 비교에는 해당 소스/검증 HTML을 보존한 adjacent baseline worktree가 필요하다.

검증된 HTML/별도 FPS WebP GLB/크레딧/증거/문서는 로컬 deterministic ZIP으로 묶는다. 안정 파일 `downloads/CQB-Training.zip`, 빌드/검증/배송 JSON의 버전은 `ak74m-arms-v20`이다. 푸시는 `[skip ci]`, Actions를 실행하지 않는다. 최종 GitHub 파일을 다시 다운로드해 전체 바이트와 ZIP 모든 entry를 확인한다.
