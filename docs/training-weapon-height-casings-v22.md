# v22 AK 표시 높이·탄피 이동 속도 상속

2026-10-11 KST. 사용자가 AK가 M4보다 낮게 보이는 위치와 원본 팔 배치를 조정하고, 탄피에 자신의 이동 속도를 더하도록 요청한 작업이다. v21의 반동 복구·총구 선행·몸 프레임 어깨 연결 위에 적용했다.

## 변경

AK의 비조준 기준 높이를 두 모델의 가늠쇠 높이 차이 77.4506mm로 보정한다. 기본 표시 크기115%에서는89.06819mm 올라간다. 총구·약실·손 접점에도 같은 위치 보정과 보간을 적용하고, 원본 팔의 손은 기존 IK로 새 접점을 따라간다. 어깨는 몸 프레임에 유지하며 스킨 파일·팔 길이 배율·손 크기·클립은 변경하지 않는다. 조준으로 들어갈 때 이 보정이 사라져 기존 AK ADS 정렬을 유지한다. 설정의 높이/크기 조절도 계속 적용된다.

탄피 초기 월드 속도는 **배출 순간의 실제 플레이어 이동 속도 + 총기 회전으로 변환한 로컬 배출 속도(오른쪽1.9m/s, 위1.6m/s)**다. 이동 입력의 희망 속도가 아니라 Rapier 충돌 해결 후 이동량/고정틱 시간을 사용한다. 벽에 막힌 입력과 접지용 -0.8m/s는 상속하지 않으며 실제 낙하는 상속한다. 앉기/서기로 캡슐 중심이 바뀌는 것은 계산에서 제외한다. 자세 변경의3mm 접촉 여유 재접지와 바닥의 작은 수치 진동은 실제 해결 이동에 포함된다.

사격이 실제로 성립할 때 속도를 복사한다. 배출 후에는 플레이어와 독립적으로 기존 중력·회전·바닥 반사·수명 처리를 따른다. 총기/카메라 회전 자체의 접선 속도는 이번 범위에 없다. 탄피용 속도는 발사 탄도의 입력으로 쓰지 않는다.

## 검증

- `npm test`:146/146. AK 표시 크기100/115/155의 비조준 높이와 ADS 정렬, 실제 충돌/자세/낙하 속도, 회전한 총기의 탄피 속도 합산과 독립 운동을 검사한다.
- `npm run verify:baseline`: 원본3,641,864B와 SHA 동일. 의료·방호·해부 코드/생성 원문 선언·병사/M4/FPS 자산의 메타데이터와 파일 바이트는 v21 그대로다.
- `node scripts/check-training-weapon-height-casings.mjs`: v21 실제 소스와 M4 이동/회전/6발 사격600틱의 카메라·총구·방향·반동·스프링 기록을 전체 대조한다. PC1280×720/모바일844×390에서 AK의 비조준 높이 차이 감소와 기존 ADS 위치/방향/정렬 동일을 확인한다. 두 총기 각각 정지/전진/옆걸음/달리기/앉기/벽/낙하 총14건은 production fire가 배출한 실제 pool의 속도·위치·탄약 보존을 검사한다.
- `CQB_VIEWMODEL_OUT=downloads/checks-weapon-height-v22-arms node scripts/check-training-viewmodel.mjs --skip-physical`:48상태에서 화면 안 열린 어깨0·near-plane 교차0·손목 간격≤1cm·ADS 렌즈0/70 중심±1px. 각 총기 empty 장전240프레임의 손목 연결도 검사한다. 기존 v19 물리 검증을 이번에 재실행했다고 주장하지 않는다.
- `CQB_OFFLINE_OUT=downloads/checks-weapon-height-v22-offline node scripts/check-training-w-offline.mjs`: QA 접근이 없는 최종 HTML을 네트워크 OFF로 실제 RAF·키보드·휠·CDP 멀티터치 조작한다. 두 해상도에서 전환·조정간·동시 이동/ADS/사격·장전 취소와 탄약2400발 보존을 검사한다.

PC의 가늠쇠 높이 차이는55.8897→3.4431px, 모바일은36.8523→2.2703px다.14건의 탄피 속도/배출 위치 오차는0이며48상태의 최대 손목 간격은0.000323mm다. 상세 수치와 화면은 위 세 폴더의 report/screenshot을 따른다. 브라우저 오류와 외부 요청은0이다. AK의 비조준 총구 원점은 요청에 따라 올라갔으므로 같은 입력의 기존 AK 비조준 탄 경로까지 같다고 주장하지 않는다. 반동 계산·총구 선행 수치는 유지했다.

## 배송 및 한계

로컬에서 빌드·검증·포장하고 모든 커밋에 `[skip ci]`를 넣어 GitHub Actions 없이 전달한다. `downloads/training-build-info-weapon-height-casings-v22.json`과 `downloads/verification-weapon-height-casings-v22.json`을 정확한 HTML에 묶는다. `python3 scripts/package-training-local.py --version weapon-height-casings-v22`로 동일 파일을 포장한다. 압축을 풀고 `dist/CQB_Training.html`을 실행한다.

실제 Android/S24·iOS 성능/조작은 미검증이다. 직접 file://는 이 환경 Chromium 관리 정책에 의해 차단되어 최종 HTML의 오프라인 메모리 경로로 검사했다. 기존 AK 손가락 포즈/M4 장전 클립 적용 및 긴 AK 장전 회복의 표현 한계는 남아 있다. 1024 WebP·무손실 노멀·동일 accessor 공유 최적화와10,410,992B FPS GLB, 원본15,131,564B GLB와 CC BY4 크레딧은 유지한다.

## 실제 GitHub 배송 확인

게임 소스 `1240f232696d764185dd426698f13a293cf8938c`, 파일 업로드 `16e890d1590b6a2d7153733b0f64ac9191641343`. [v22 GitHub ZIP](https://github.com/0-FLANDRE-0/CQB-HTML/raw/16e890d1590b6a2d7153733b0f64ac9191641343/downloads/CQB-Training.zip)을 실제 HTTP200으로 다시 받아 ZIP SHA/CRC와40파일 전체 바이트를 대조했다. HTML36,790,511B/SHA `e1943f6c53b81a1f47e71cf57d88a8920b54a123ed1f52c70732af960fbcaf89`, ZIP31,268,515B/SHA `4f33239d21c3f6353965490a0f3fa472efb70952370086b26273e617393917f9`. artifact commit의 Actions 실행은0이다. [배송 영수증](../downloads/delivery-weapon-height-casings-v22.json).
