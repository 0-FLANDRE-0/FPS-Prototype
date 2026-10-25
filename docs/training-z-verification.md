# v26 — Vudu 인벤토리 장착·분리 첫 단계

최신 렌즈/배율 단계는 [v27 변경·검증](training-z-optics-v27.md)을 따른다. 아래는 v26 장착 첫 단계의 역사적 검증이다.

사용자 요청에 따라 탄약상자의 **1칸 가로×2칸 세로 Vudu**를 M4A1에 장착하거나 분리할 수 있게 했다. Z 지시서의 영점·PiP·1–6배 조절·SR3 레티클은 다음 단계다. 현재 렌즈는 업로드 모델의 유리 재질이며 확대 영상을 제공하지 않는다. 기존 ADS의 FOV 변화는 유지하며 장착 때문에 추가로 화면 전체를 확대하지 않는다.

## 사용과 소유권

탄약상자 근처에서 PC F 또는 터치 상자 버튼을 누른다. 조준경을 M4/조준경 슬롯으로 드래그하거나, 선택 후 슬롯을 누르거나, 아이템 메뉴의 **조준경 장착**을 누른다. 기본 상태는 미장착이다. 장착은1초, 분리는0.8초의 게임 시간이며 취소할 수 있다. 이 시간은 저작 조정값이고 손으로 부착하는 별도 애니메이션은 없다.

부착물 슬롯/총기 메뉴의 **조준경 분리**는 가방의 빈1×2칸을 찾는다. 장착된 조준경을 가방 또는 열린 상자의 빈칸으로 드래그하면 해당 칸으로 분리한다. 자리가 부족하면 안내하고 조준경을 총기에 유지한다. AK에 장착을 시도하면 전용 마운트가 필요하다는 안내를 표시한다. M4에 달린 조준경은 AK 전환이나 M4 가방 보관 후에도 같은 M4 인스턴스에 남는다.

완료 전에는 기존 소유자/칸을 유지하며 분리 목적지1×2칸 전체를 예약한다. 완료 때 한 번 소유권을 옮긴다. 장착·분리 중 사격/장전/격자 이동은 기존 busy 경로로 막고, 무기 전환 또는 외부 상자 접근 해제는 미완료 작업을 취소한다. 취소·닫기·공간 부족으로 아이템이 복제되거나 사라지지 않는다.

## 외형과 계산

업로드 원본을 보존하고 균일 스케일270mm의 파생 WebP 모델을 M4 레일에 붙였다. 실제 마운트 안쪽 접촉면을 레일에 맞추고 클램프는 아래로 감싼다. 자세별 루트/광학 마커 추종 오차는1µm 미만이며 원본 팔/총기 클립을 수정하지 않는다. 후방 조준기 조립체는 장착 시 숨김/분리 시 복원, 전방 가늠쇠는 유지한다. 접힘 애니메이션은 구현하지 않았다.

제조사570g을 기존 반동의 총기 질량 항에 더한다. 현재 M43.07→3.64kg, 같은 탄의 기존 후방 반동 속도는3.07/3.64배다. 각도 관성·탄자 운동량·발사 에너지·탄도/방호/의료 계산은 그대로다. 무기 표시 무게에도 반영한다. 출처·치수·기존 ADS 마커 비평행과 후속 영점 주의점은 [부분 Z0 조사](training-z0-survey.md)를 따른다.

공통 팔/AK 드라이버·M4A1·병사 자산은 v25와 바이트 동일하다. 새 GLB는4,680,704→3,094,328B(약33.9% 감소), 원본 해상도·메시 유지다. HTML은34,274,487→38,408,275B(약12.1% 증가)이며 필요한 자산을 모두 내장한다. 실행 ZIP에는 중복 GLB/전체 화면 증거를 넣지 않고 원본과 증거는 저장소에 보존한다.

## 확인 범위

- 공식167/167 테스트, 원본 baseline3,641,864B/SHA256 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d` 동일.
- 새7테스트: 유일한1×2상자 아이템, 장착 원자적 완료/취소/busy, 상자 접근 해제, AK 거절/M4 보관·전환 유지, 목적지 공간/예약/분리, 전환 취소, 기존 질량 항만 반영.
- 미장착 v25 비교:600틱/6발 카메라·총구·방향·반동·gait·스프링 동일, 방호/인체/6B47 세 사례의 탄도·전체 의료 결과 동일.
- 1280×720/844×390에서 M4·AK72상태: 공통 팔 인스턴스 유지, 비신장, 보이는 어깨 단면/near 교차0, 손 접점1mm 이내, 반복 뼈 행렬 동일. 일반/빈약실 장전4×240프레임 시간·탄약 보존.
- 같은 두 화면에서 실제 마우스 드래그/CDP 터치 선택·슬롯/메뉴, 장착 취소/재장착/분리/AK 안내/가방 공간 부족/570g 반동 질량을 확인했다.
- 장착된16정지 샘플: hip/ADS/장전 시작·삽입·빈약실 노리쇠/넣기/꺼내기/회전. 루트 추종과 손 접점 검사 및 스크린샷 확인. 모든 프레임의 메시 충돌 검사나 부착물 설치 손동작 검증은 아니다.
- 테스트 API가 없는 최종 HTML을 오프라인 메모리 경로로 실행: 두 화면에서 실제 상자 접근·F/터치·아이템 메뉴 장착/분리·무기 전환 유지/후방 조준기 복원·같은 ADS FOV·탄약 보존. 기존 멀티터치 이동/전환/조준/사격/장전 취소·장거리/곡선 궤적도 확인. 브라우저 오류/외부요청0.
- 원본18geometry accessor 바이트, 원본 노드·재질 수치,9이미지 해상도/해시,6normal/ORM RGBA 무손실,3색상SSIM≥.97/알파 동일 대조.

최종 해시·기능 커밋과 상세 결과는 `downloads/training-build-info-optic-attachment-v26.json`, `downloads/verification-optic-attachment-v26.json`이다. ZIP 크기·실제 GitHub HTTP/CRC/전체 파일 대조는 `downloads/delivery-optic-attachment-v26.json`을 따른다. 세 증거 폴더는 `downloads/checks-optic-attachment-v26/`, `downloads/checks-optic-ui-v26/`, `downloads/checks-optic-offline-v26/`다.

재현: `npm test`, `npm run verify:baseline`, `npm run build:training`, `node scripts/check-training-vudu-assets.mjs`, `node scripts/check-training-optics.mjs`, `node scripts/check-training-optic-mount.mjs`, `node scripts/check-training-optic-regression.mjs`, `CQB_OFFLINE_OUT=downloads/checks-optic-offline-v26 node scripts/check-training-w-offline.mjs --flight --optic`, `node scripts/verify-training-optic-release.mjs`, `python3 scripts/package-training-local.py --version optic-attachment-v26`. v25 비교 검사는 인접한 `CQB-HTML-v25-baseline` 작업폴더가 필요하다.

Linux Chromium/SwiftShader 검증이다. S24/Android/iOS 실기기·직접 `file://`는 미검증이며 실기기 FPS 개선을 주장하지 않는다. 기본 크기/ADS의 아이릴리프는 확인했지만 배율·아이박스/출사동공·설정별 광학 정렬은 후속 PiP 범위다. 새 의료·방호·원본 영점/레티클의 구현으로 해석하지 않는다. 모든 빌드/검증/포장은 로컬에서 수행하고 같은 개발 브랜치에 `[skip ci]`로 올린다.
