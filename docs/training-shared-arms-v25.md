# v25 — M4·AK 공통 팔과 실행 파일 경량화

M4 전용으로 추가했던 팔을 M4A1과 AK-74M이 함께 사용한다. 보이는 팔 메시 네 개·113관절 스킨·팔 텍스처는 한 인스턴스다. 무기를 바꿀 때 팔 모델을 다시 만들지 않는다. 기존 M4A1 총기 외형과 AK 총기 메시·텍스처는 유지했다.

AK의 원본 팔 메시와 팔용 텍스처 세 장은 실행 자산에서 제거했다. 원본 AK의 85관절과 사용 중인 일곱 클립은 총기/손 동작을 샘플링하는 비표시 드라이버로 남는다. 따라서 모든 뼈대를 하나로 합친 것은 아니다. AK 손바닥의 손가락 기준축과 중지 접점을 공통 손에 맞추고 양손 각각 19개의 손가락 뼈 회전 변화를 옮긴다. 연결된 공통 상완→전완→손을 IK로 맞추며 팔 길이를 늘리지 않는다. M4는 기존 전용 클립을 그대로 사용한다. AK의 옛 팔 정점 위치를 그대로 재현한다고 주장하지 않는다.

## 용량

| 항목 | v24 | v25 |
| --- | ---: | ---: |
| AK 총기·애니메이션 실행 자산 | 10,410,992 B | 4,044,756 B |
| M4/공통 팔 실행 자산 | 4,622,376 B | 4,466,732 B |
| 두 실행 자산 합계 | 15,033,368 B | 8,511,488 B |
| 모든 모델을 내장한 HTML | 42,970,605 B | 34,274,487 B |

FPS 실행 자산 합계는 약43.4%, HTML은 약20.2% 감소했다. 텍스처 해상도·이미지 바이트, 남는 메시의 정점·UV·스키닝과 총기 외형을 추가로 낮추지 않았다. 원본 업로드와 v24의 전체 파생 자산은 보존한다.

실행용 ZIP에는 HTML·빌드/검증 정보·실행 안내·이 문서·모델 출처 네 개만 넣는다. HTML 안에 이미 들어 있는 GLB를 ZIP에 또 넣지 않고 전체 검증 스크린샷/상세 프레임 기록도 제외한다. ZIP의 정확한 크기·해시와 GitHub 다운로드 대조는 `downloads/delivery-shared-arms-v25.json`을 따른다. 원본 자산과 상세 증거는 [같은 개발 브랜치](https://github.com/0-FLANDRE-0/CQB-HTML/tree/codex/mobile-3d-training-prototype)에 보관한다.

## 애니메이션 경량화와 유지 범위

쓰지 않는 AK `Reload_var2`를 제거하고 선형 보간의 중복 키를 줄였다. 유지하는 키 값과 시작/끝 시간은 원본 바이트다. 허용되는 원본 로컬 키 오차는 위치0.01mm·회전0.0001rad·스케일0.00001이다. AK 211,072→26,082키, 공통 팔16,039→5,246키로 줄었다. 전체 애니메이션 스트림의 무손실 압축은 아니다.

원본 전체 파생 GLB와 새 실행 GLB를 Three.js로 비교했다. 사용 중인 11클립의 원본 키 시간·키 사이 중간 시간·60Hz 시간에서 관절 월드 변환을 검사했고 최대 위치 차이는 약0.0461mm, 회전 차이는 약0.0189°였다. 남는 메시 accessor46개와 이미지10장은 바이트가 같다. 정상적인 장전에서 손가락 굽힘 변화가 공통 손으로 전달되는 것도 양손19관절·세 동작 각33샘플로 확인했다. 원본 AK Shot과 M4 Shoot의 손가락 포즈는 거의 고정되어 있어 별도 방아쇠 굽힘을 새로 만들지는 않았다.

네이티브 장전·탄창 소유/약실 이벤트·무기 전환 시간은 v24와 같다. M4 Reload2.083333초/Hide·Take각0.625초, AK Reload2.648333초/Reload_full3.498333초/Draw0.648333초다. 원본 CQB 레지스트리 수치는 변경하지 않고 3D 실행의 명시적 네이티브 프로필을 유지한다. 기존 카메라 반동·총구 선행·탄피 이동 속도 상속·탄도/관통·방호/의료 계산도 그대로다.

## 검증

- 공식160/160 테스트와 원본 baseline 바이트 동일.
- v24 대비 카메라·총구·방향·반동·gait·스프링600틱/6발 동일. 근거리 방호/인체/6B47 세 사례의 탄도와 전체 의료 결과 동일.
- 1280×720/844×390에서 두 총기의72상태: 공통 팔 인스턴스 동일, 옛 AK 팔 메시0, 연결된 팔 길이 비신장, 화면에 보이는 어깨 열린 단면/near-plane 교차0, 반복 샘플 뼈 행렬 일치, 손 접점 오차1mm 이내.
- M4/AK 일반·빈약실 장전각240프레임: 시간·탄약 보존, 잔여 도달 부족0. 최대 연속 손 이동 M4약6.64cm, AK일반5.00cm/빈약실8.19cm/60Hz.
- 최종 비계측 HTML을 오프라인에서 PC 키·휠/터치 버튼/CDP 멀티터치로 검사: 이동/전환/조준/사격/장전 취소·장거리 이동/복귀·곡선 궤적·탄약 보존, 두 화면 모두 오류/외부요청0.

소스 기능 커밋과 HTML SHA256은 `downloads/training-build-info-shared-arms-v25.json`, 검증 범위와 증거 해시는 `downloads/verification-shared-arms-v25.json`에 기록한다. 상세 자산/손가락/화면·장전 증거는 `downloads/checks-shared-arms-v25/`, 최종 오프라인 증거는 `downloads/checks-shared-arms-v25-offline/`다. 생성 HTML에는 테스트 API가 없다.

재현 명령: `npm test`, `npm run verify:baseline`, `npm run build:training`, `node scripts/check-training-shared-assets.mjs`, `node scripts/check-training-shared-arms.mjs`, `node scripts/check-training-shared-fingers.mjs`, `CQB_OFFLINE_OUT=downloads/checks-shared-arms-v25-offline node scripts/check-training-w-offline.mjs --flight`, `node scripts/verify-training-shared-arms-release.mjs`, `python3 scripts/package-training-local.py --version shared-arms-v25`. v24 비교 작업폴더는 화면 검사 스크립트의 `sourceRoot`를 따른다. Actions 없이 로컬에서 검증하고 같은 브랜치에 `[skip ci]`로 올린다.

어깨는 중립 개머리판 자세에서 추정한 기준이며 별도1인칭 몸통/충돌체는 없다. 고정 팔 길이를 벗어나는 원본 주머니 동작은 도달 범위로 제한한다. M4의 이동 전용 클립 부재, 일반/빈약실 공통 Reload, AK Hide의 역Draw도 v24와 같다. Linux Chromium/SwiftShader 검증이며 S24/Android/iOS 실제 기기나 직접 `file://`는 미검증이다. 파일 용량 감소로 실기기 FPS 향상을 보장하지 않는다.

## 실행과 출처

ZIP을 풀고 `dist/CQB_Training.html`을 브라우저에서 실행한다. PC 1/2·마우스 휠 또는 터치 M4↔AK 버튼으로 전환한다. 모델·텍스처·WASM은 HTML에 내장되어 있다. 비공개 GitHub 저장소의 다운로드에는 접근 가능한 로그인 세션이 필요하다.

기존 M4A1은 Firewarden3D, 병사 H01은 Muhamad Mirza Arrafi의 CC BY4 모델이다. 공통 팔은 JUST의 첨부 M4A4 FPS 모델에서 총기를 제외해 가져왔다. AK 총기·드라이버는 Cransh/creationwasteland의 모델·DJMaesen의 애니메이션에 기반한다. CC BY4 출처 링크와 변경 내용은 실행 HTML의 크레딧 및 ZIP의 `apps/training/assets/*credits.json`에 유지했다.
