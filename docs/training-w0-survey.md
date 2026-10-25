# W0 사전 조사 — 2026-10-11 KST

조사 시점 게임 코드 무수정. 기준 `fff9ac7a3a4b867131cc599f4218b399e439e294`(v19), 원격과 동일. `/workspace/CQB-HTML-v19-baseline`에 소스와 검증 HTML/파생 자산을 보존했다. HTML 22,870,896 B / SHA256 `4cb52ec9c244ad60bc8d88c80acda79ca8cc5d3fc9c1edf2dcbc56f7e435b5e0`.

## 현재 M4 경로

- `aim.js`의 AimState가 총 position/quaternion/scale, muzzle/breech, barrelDirection을 고정 60 Hz로 계산한다. `weapon-model.js`는 capture한 두 상태를 보간해서 표시만 한다. 발사 입력은 `aim.shotPose()`, 모델/클립은 탄도 입력이 아니다.
- `config.js`의 rear sight와 front post 측정 마커를 잇는 축을 -Z에 맞추는 sightCorrection, rear를 중심으로 한 mount lag, eyeRelief 75 mm를 사용한다. 정착 ADS에서는 마커선이 눈을 지난다. 현재 별도의 중력/탄약별 원거리 영점 보정은 없다. 따라서 새 AK의 П 자료값과 실제 적용 조준 규칙은 구분해야 한다.
- 조준·반동·흔들림·gaitPhase/bob은 AimState, 발걸음 충격은 main의 camera-only spring, 렌즈는 main+scene의 같은 world 렌더 패스. M4는 별도 HUD scene이 아니다. camera near 15 mm.
- shoulder 앞 0.78 m ray로 blocked 상태를 만들고 AimState가 총을 내린다. 발사 직전 shoulder→muzzle sweep/ray도 검사하여 총구가 벽에 있으면 발사를 막는다. 뷰모델 자체는 벽 관통 방지용 별도 물리/깊이 패스가 없다.

## 인벤토리·장전·교체

- 장전 구분은 **약실 탄 유무**다. 약실 탄이 있으면 tactical, 없고 boltLocked면 bolt-release, 아니면 charging. 남은 탄창은 가방에 보관한다. 1 인스턴스/1 owner, 예약 칸을 선확보한다.
- 기존 이벤트는 tactical remove .28/insert .62, empty remove .22/insert .58, feed .83(진행도). 제거 취소 전에는 기존 탄창 유지, 제거 후에는 가방 복귀 상태 유지, 삽입 전 incoming은 예약 원위치로 돌아간다. 이미 삽입/급탄한 상태는 취소해도 되돌리지 않는다.
- 현재 장착 슬롯은 주무기 하나뿐이며 `Inventory.primaryId`와 equipment:primary를 쓴다. 1/2·휠·터치 무기 교체는 없다. 가방에서 장착/해제는 있다. W5에서 두 슬롯과 전환 입력이 필요하다.

## 업로드 팩 실제 조사

원본 15,131,564 B / SHA256 `8eeb18cbe047e8cbbe24084828f39ba625a6f3c1a1062a37d7a978e8cd7d0533`. 메타데이터에 Cransh·Sketchfab 링크·CC-BY-4.0가 들어 있다.

3 메시, 40,023 삼각형(팔 14,852 / AK 23,385 / 예비 탄창 1,786), 1 skin/85 joints, 7 PNG. PNG 합계 6,808,230 B. `KHR_materials_specular` 사용. 카메라 표시 노드 5/6과 빈 arms/Ak/Mag_2 객체가 있으며 제거 가능하다. Head_Cam은 skin에 포함된 뼈이므로 유지하되 카메라에는 연결하지 않는다.

|클립|실제 길이(s)|AK 원본 상태 시간과 차이|
|---|---:|---:|
|Idle|1.981667|반복|
|Draw|.648333|전환 표시|
|Walk|.981667|gaitPhase 연결|
|Run|.398333|gaitPhase 연결|
|Shot|.315000|손가락/Trigger만 사용|
|Reload|2.648333|tactical 2.1 대비 +26.11%|
|Reload_var2|2.815000|tactical 2.1 대비 +34.05%|
|Reload_full|3.498333|empty 2.7 대비 +29.57%|

샘플은 60 Hz 격자에 exporter의 15 ms/1.667 ms 분할과 감소된 채널 키가 섞였다. 모든 채널을 일정 FPS라고 단정하지 않는다. 121 samples/clip에서 Head_Cam world translation/rotation 변화는 모두 0이다. 움직임 상쇄 경로는 미래 클립에도 적용한다. 노리쇠·장전 손잡이 뼈/ADS 클립 없음은 확인했다.

원본 로컬 AK 길이 +Z 방향 1.384379834 m, export wrapper가 1.991950631배를 더해 bind 화면 길이가 약2.758 m다. 따라서 게임 m 단위에서 0.943 m로 재보정해야 하며 팔도 같은 비율을 받는다. 최종 정확한 총 축 측정/배율은 파생 자산 보고서에 기록한다. 원본 팔 색/재질·토폴로지는 유지한다.

**W3-a 예외 보고:** AK 장전 클립 3개 모두 기존 시간 대비 ±15% 한도를 넘는다. 원본 인벤토리 시간을 늘리거나 과도하게 time-scale하지 않는다. 원속도 클립의 삽입 이벤트가 2.1/2.7 안에 가능한지 프레임을 측정하고, 장전 완료 후 남은 회복 동작은 표시만 이어갈 수 있게 한다. 실제 이벤트/회복·중단 한계는 화면과 W 검증서에 기록한다. M4의 기존 이벤트/시간은 v19 회귀를 위해 보존하고 표시 클립을 이벤트에 맞춘다.

## AK74 → AK74M 제원과 출처 경계

원본 `ak74`: 13탄종, 30발, 650 rpm, 3.3 kg, semi/burst/full, tactical2.1/empty2.7. 별도 `ak74m` 파생 정의를 만들며 원본 레지스트리는 그대로 보존한다.

- [Azersilah 제조사 AK74M](https://azersilah.com/en/mehsul/8): 개머리판 펼침943 mm/접힘705 mm, 빈 탄창 포함3.6 kg, 650 rpm. 사이트는 Safe/Full Auto만 표기하는 불완전한 모드 칸이 있으므로 단발을 삭제하는 근거로 쓰지 않는다.
- [전시업체 AK74M brochure](https://docs.tuyap.online/FDOCS/39725.pdf): 동일 제원, fire control semi/full 명시. 배포 호스트만으로 Kalashnikov Group 공식 게시물이라고 단정하지 않는다. 1차 제조사 페이지를 우선하고 교차 확인으로 사용한다.
- [소련 국방부 AK74/RPK74 교범, Voenizdat 1984, 공개 사본](https://ru.djvu.online/file/VdNjJdWnyUBdn): §117/인쇄116쪽, selector를 아래로 첫 딸깍 АВ(연발), 두 번째 ОД(단발). 상단 안전→연발→단발로 구현하고 burst는 제외한다. AK74M 전용 교범은 확보하지 못했으며 같은 계열 동작에 대한 교범 적용이다.
- 위 교범 §13/인쇄40쪽: П는 sight4와 대략 대응하는 440 m 거리 표기. **v19 M4에는 원거리 영점 탄도 보정이 없으므로**, W는 같은 마커 정렬 규칙을 쓰고 자료상 П/440m와 적용 미보정 상태를 명시한다. 원본 탄약 속도/관통/의료나 반동·확산 값은 바꾸지 않는다.

[팩 페이지](https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14)는 제작자 Cransh 외 AK 메시 creationwasteland, FP-ARMS DJMaesen/bumstrum도 명시한다. 빌드/게임 크레딧에 세 제작자를 모두 표시한다. 직접 페이지403은 검색 서비스의 공개 페이지 본문과 GLB 내장 메타데이터로 교차 확인했다.
