# CQB 개발 소스와 단일 HTML 빌드

주 플랫폼은 **모바일 브라우저, 가로화면, 터치 조작**이다. 기존 게임은 시스템별 파일로 분리하고 원본 보존을 검증했다. 별도 `apps/training/`에는 Three.js·Rapier와 M4A1 모델의 3D 훈련장, 원본 장애물 관통·도탄을 연결한 확장 시험장이 있다. 본편 계산·데이터·UI와 원본 HTML은 변경하지 않았다. [훈련장 안내](../apps/training/README.md)와 [장애물 관통 경계](obstacle-penetration.md)를 따른다.

## 현재 구조

```text
CQB_Tactical.html          보존 원본 / 회귀 비교 기준
reference/                기존 공간 인지 프로토타입
apps/training/            별도 3D 훈련장: ES modules·스타일·내장 GLB
src/
  index.template.html     기존 HTML, CSS·JS 조립 위치 표시
  manifest.json           JS 조립 순서·역할·원본 줄 범위·기준 해시
  styles/application.css  기존 CSS
  data/                   장비·방호구·탄약·총기 registry
  combat/                 탄도·방호·피격·사격·재장전
  medical/                상처·생리·부위 파괴·치료
  ai/                     시야·공간 인지·기억·utility·엄폐
  world/                  맵·문·장애물·2D 기하·경로
  runtime/                단위·전역 상태·unit 생성·루프·초기화
  simulation/             위협·소음·효과·유닛 갱신
  presentation/           Canvas·HUD·의료 표시·장비 UI·디버그
  input/                  포인터·버튼·overlay 이벤트
  game/                   로드아웃 설정·편집·기존 승패
  reports/                전투 기록
  validation/             기존 preset·closure 검증
scripts/                  빌드·로컬 서버·검증
tests/                    빌드·서버 검증과 기존 실패 기준
dist/                     생성 HTML·빌드 정보, Git 제외
artifacts/                브라우저 결과 JSON·스크린샷, Git 제외
```

JS는 최상위 구문이 끝나는 경계에서 67개로 나눴다. 파일별 역할과 원본 위치는 `src/manifest.json`이 정본이다. 폴더는 관리 경계이며 아직 독립적인 ES module이나 순수 계산 Core의 경계가 아니다. 예를 들어 combat에서도 전역 상태·보고·UI helper를 읽는 기존 경로가 남아 있다.

조립 순서를 바꾸거나 각 파일을 별도 `<script>`·`type="module"`·함수 wrapper로 실행하면 전역 lexical binding, 선언 호이스팅, registry 후속 주입과 초기화 순서가 달라질 수 있다. 지금은 manifest 순서로 원문을 연결해 **한 개의 classic script**로 실행한다. 새 파일도 완전한 최상위 구문 단위로 나누고 manifest에 순서를 명시한다. builder는 각 파일과 연결 결과의 JavaScript 구문을 검증한다.

## 실행과 빌드

Node.js 22 이상을 사용한다. 기존 2D 빌드·서버는 Node 내장 모듈만 사용한다. 3D 빌드와 전체 테스트에는 `npm ci`가 필요하다. Three.js `0.180.0`, Rapier compat `0.21.0`, esbuild `0.25.10`, Playwright `1.62.1`을 lockfile로 고정했다.

```sh
npm run dev
npm run build
npm run verify:baseline
npm ci
npm test
npm run dev:training
npm run build:training
```

개발 서버 기본 주소는 `http://127.0.0.1:5173`이다. `/`는 요청마다 현재 `src/`를 조립하며 수정 후 브라우저를 새로고침한다. `/CQB_Tactical.html`은 보존 원본을 제공한다. 자동 새로고침 코드를 게임에 삽입하지 않는다.

동일한 로컬 네트워크의 실제 휴대폰에서 확인하려면 접근 가능한 개발 PC에서 다음과 같이 실행하고 휴대폰으로 `http://<개발-PC-IP>:5173`을 연다. 클라우드 작업 환경은 별도 접근 경로가 필요할 수 있다.

```sh
npm run dev -- --host 0.0.0.0 --port 5173
```

`npm run build` 결과는 `dist/CQB_Tactical.html` 한 파일이다. JS·CSS가 내장돼 별도 런타임 패키지·CDN·에셋 파일을 요청하지 않는다. `dist/build-info.json`에는 생성 HTML의 해시·바이트 수와 JS 파일별 생성 줄 범위를 기록한다. 원본 `CQB_Tactical.html`을 읽어 복사하는 빌드가 아니라 `src/`에서 HTML을 생성한다.

개발 수정은 `src/`에서 한다. 루트 `CQB_Tactical.html`은 회귀 기준으로 보존하고 `dist/`는 재생성한다. `node_modules/`, `dist/`, `artifacts/`는 Git에서 제외한다.

## 검증 명령

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

OS에 브라우저 의존성이 없으면 Playwright 설치 안내에 따라 준비한다. 이미 설치된 Chromium을 사용할 수도 있다.

```sh
CQB_BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser
```

`npm test`는 기존 빌드·HTTP 개발 서버 8개와 훈련장 물리·조준·에셋·설정 12개, 전체 레지스트리·격자 아이템·탄창/약실·운동량 반동 23개, 원본 관통 계산·3D 어댑터 7개, 궤적 표시·수명·자원 관리 2개, 정적 인체 판정·방향·기록·탄도 연결 9개를 더해 총 61개를 실행한다. 원본 manifest 초기화 결과와 전체 카탈로그의 동등성, 단계별 취소·탄약 보존·혼합 공급 순서·장착 소유권, 공간 점유·스택 60발 상한·상자 접근·공간 예약·취소, 탄약 있는 탄창 우선·좌상단 장전 순서·직접 선택 유지, 단발/연발 강한 복귀·수동 반동 보정·잔류 상승·자세별 지지·계산 간격 차이도 확인한다. 기존 검증은 출력의 결정성, 원본 동일성, 원본 없이 빌드 가능 여부, 템플릿 오류·중복 경로·구문 오류·inline 종료 태그의 실패 처리, 서버 제공 경로를 확인한다. 훈련장 검증은 벽·엄폐 충돌, 앉기·기립, 가장 가까운 탄착·총구 차폐, 총기 선행·카메라 추종·감도·반동, ADS 가늠쇠 선행·보행 중 정렬 변화·정지 회복, 확대 총기와 사격 기준점의 일치, 내장 모델·설정 복구를 확인한다. HTTP 테스트에는 로컬 포트를 열 수 있는 환경이 필요하다.

브라우저 검증은 보존 원본과 생성본을 각각 부팅해 아래 7개 기존 suite와 preset validator를 대조한다. seed는 `1234`, suite 실행 순서는 `scripts/browser-check.mjs`에 고정했다. suite의 기존 sandbox·스위치 강제 OFF 동작을 그대로 사용하며 모든 런타임 ON/OFF 조합을 검증한 것은 아니다.

## 현재 검증 결과

기준 커밋은 `cef2ff00b3a3eb68719b4127003b8c90ef62629a`, 본편 Git blob은 `ff20dc25c9835698c7a90653014d0fe0d51eda30`이다. 빌드 HTML은 원본의 **3,641,864바이트와 완전히 동일**하다. SHA-256은 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d`다.

| 검증 | 원본과 생성본의 동일 결과 |
| --- | --- |
| Impact / wound closure | 38 / 38 통과 |
| Part destruction closure | 27 / 27 통과 |
| AI0A command closure | 13 / 13 통과 |
| AI0B spatial closure | 20 / 20 통과 |
| AI0C1 cover slot checkpoint | 14 / 14 통과 |
| AI0C2 portal risk checkpoint | 7 / 8 통과, 기존 실패 1개 |
| SpatialPerception self tests | 152 / 152 통과 |
| 합계 | 272개 중 271개 통과, 기존 실패 1개 |
| Preset validator | error 0, 기존 warning 1 |
| Node 빌드·서버 테스트 | 8 / 8 통과 |
| 별도 3D 훈련장 Node 테스트 | 42 / 42 통과 |

기존 실패는 `C2-03_danger_freshness`다. 원본에서 danger 값은 age 0/10/20/30에 `0.72/0.36/0/0`, 원본 record 유지 `true`, 최종 record 존재 `false`로 관측했다. 이는 실패 원인을 수정하거나 재해석한 기록이 아니다. 기존 경고는 `armorCoverage: side hard 선택인데 soft backer armor 미연결`이다. `tests/known-baseline-failures.json`에 두 기준을 저장하고 브라우저 테스트는 새 실패·경고 또는 기존 실패 목록의 변동을 오류로 처리한다. 기존 실패를 통과로 바꾸지 않았고 게임 로직을 수정해 숨기지도 않았다.

브라우저 검증에서는 Chromium `151.0.7922.173`, 모바일 터치 에뮬레이션, DPR 2, CSS viewport 844×390과 640×360을 사용했다. 각 가로화면에서 로드아웃→임무 시작→유닛 선택→화면 터치 이동 명령→경로 삭제→팬·두 손가락 핀치→실행·일시정지→세로 안내→가로 복귀를 확인했다. page error와 실패한 파일 요청은 없었다. 이는 기존 2D 조작의 회귀 확인이며 실제 Android·iPhone의 멀티터치·발열·WebGL2 성능을 검증한 것은 아니다.

생성 HTML은 네트워크를 끈 브라우저에 문서 내용을 직접 넣어 부팅과 임무 시작을 확인했고 외부 요청은 0이었다. 이 작업 환경의 Chromium 정책은 `file://` 탐색을 차단하므로 실제 파일 URL 실행은 여기서 검증하지 못했다. HTTP 비교와 오프라인 문서 검증을 대신 수행했다. 결과·브라우저 버전은 `artifacts/browser-check.json`, 가로·세로 스크린샷은 같은 폴더에 저장된다.

## 다음 단계의 경계

현재 `verify:baseline`과 원본 바이트 동일성 테스트는 **이번 기계적 분리 단계**의 통과 기준이다. 이후 기능·UI·3D를 추가하면 생성 파일이 원본과 달라지는 것이 정상이다. 그때는 보존 원본의 해시 검사를 유지하되 생성본의 영구적인 바이트 동일성 요구를 계산 fixture·독립 Core 테스트와 2D/3D 엔트리별 검증으로 바꾼다. 기준 해시를 덮어쓰거나 테스트를 무조건 통과시키지 않는다.

다음 작업은 전역 `GAME`·`UNITS`·`MAP_DATA`, RNG·시간, `log`와 DOM 부수효과를 좁은 context·event·공간 질의 경계로 분리하는 것이다. 먼저 data builder와 주소가 주어진 피격→방호→상처→생리 경로를 DOM 없이 검증한 다음 현재 훈련장의 총구 발사·Rapier 접촉에 연결한다. 모든 파일에 export를 붙이는 일괄 변환은 하지 않는다.

3D 배포에는 별도 `scripts/build-training.mjs`를 사용한다. Three.js·Rapier JS/WASM·모델·텍스처·CSS를 한 HTML에 내장한다. 오디오는 임시 WebAudio 합성이다. 기존 `scripts/build.mjs`는 2D 전용으로 유지한다. 실제 Android·iPhone의 파일 실행·성능 검증은 아직 필요하다. 자세한 계약과 모바일 실기기 기준은 [3D 전환 설계](3d-extraction-architecture.md), [첫 레이드 개발 계획](raid-prototype-plan.md)을 따른다.

정적 병사 표적 H01과 17개 근사 피격 영역, 원본 8개 의료 저장 부위에 대응하는 결정형 주소는 [인체 표적 계약](human-targets.md)을 따른다. `npm run test:training:humans`는 PC·모바일 실제 입력 사격 흐름을 검증한다. 상처·출혈·방호·장기/혈관 형상은 아직 연결하지 않았다.
