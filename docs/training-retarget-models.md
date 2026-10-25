# M4 뼈 대응·시험 모델 감사

[M 지시서](training-m-instructions.md)의 시험 입력 두 개는 사용자가 올린 원본 그대로 보존한다. 전체 수치·이미지 크기·뼈 부모는 [기계 판독 감사](training-model-audit.json), CC 114개 뼈의 문서 초안은 [CC 대응 JSON](training-cc-mixamo-draft.json)에 있다. 새 모델은 게임과 배포 HTML/ZIP에 넣지 않는다.

## 실제 입력과 최적화 우선순위

| 입력 | 파일 | 삼각형 | 메시/primitive | 텍스처 | 이미지 바이트 | RGBA+mipmap 추정 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| military_tactical_suit_lowpolygameready | 17,938,144 B | 31,771 | 15/15 | 19×1024² | 13,205,721 B | 101.33 MiB |
| soldier_full_tactical_gear | 25,472,068 B | 84,154 | 23/23 | 24×1024² | 18,201,621 B | 128 MiB |

실제 렌더러 측정값이 아닌 모든 이미지를 RGBA8로 디코딩하고 전체 mipmap을 둔 보수적 추정이다. 압축 파일 크기와 GPU 사용량은 다르며 채널 수·텍스처 재사용·GPU 압축에 따라 달라진다. 이미지가 각각 파일의 73.6%/71.5%라 먼저 텍스처를 다루는 편이 효과적이다.

이번 시험은 GLB의 렌더 메시·이미지 참조를 메모리에서 제거한 뒤 원래 뼈와 클립만 GLTFLoader로 읽는다. 텍스처 디코딩 0, 원본 파일 수정 0이다. 바이너리 전체 입력은 읽으므로 GLB 파일 자체의 다운로드 크기를 줄였다는 의미는 아니다.

실제 캐릭터를 넣을 때에는 파생 파일에서 (1) 작은 장비의 normal/roughness를 512²로 줄이고 투명/피부의 색 품질을 보존, (2) 채널 패킹과 가능한 재질 묶기로 draw call 감소, (3) 멀리서 쓰는 LOD와 스킨 가중치를 보존한 meshopt 압축, (4) 런타임 decoder를 함께 지원할 경우 KTX2/Basis GPU 압축 순서로 검토한다. 84,154삼각형 모델은 근거리 LOD0로도 실기기 측정이 필요하다. 방호/인체 피격 형상은 시각 LOD에서 매 프레임 재생성하지 않는다. 현재 독립 HTML에 decoder 없이 압축 포맷만 넣으면 로딩이 깨지므로 이번에 임의 교체하지 않았다. 파일 축소·품질·S24 성능 효과는 아직 측정하지 않았다.

military 모델의 저작자/라이선스는 사용자 지시서의 **DanlyVostok / CC BY 4.0**를 따른다. 새 출시 자산으로 사용하기 전 원본 배포 URL과 attribution을 함께 확인한다. soldier_full 모델의 저작자/라이선스는 이번 전달에 없으므로 추정하지 않는다.

## v9 → Mixamo 실제 최종 대응

v9 24개 이름/부모는 그대로다. 실제 입력은 88개 skin joint이고 콜론과 숫자 접미사가 붙어 있다. Three가 콜론을 제거하므로 아래 실제 이름은 로드 결과이며 원본 이름은 감사 JSON에 있다. 매칭은 콜론/접미사 정규화 후 유일성을 검사한다.

| v9 | v9 부모 | Mixamo 기준 키 | 실제 입력 뼈 / 부모 |
| --- | --- | --- | --- |
| root | — | — | placement-only / — |
| pelvis | root | mixamorig:Hips | mixamorigHips_01 / _rootJoint |
| spine | pelvis | mixamorig:Spine | mixamorigSpine_02 / mixamorigHips_01 |
| chest | spine | mixamorig:Spine2 | mixamorigSpine2_04 / mixamorigSpine1_03 |
| neck | chest | mixamorig:Neck | mixamorigNeck_05 / mixamorigSpine2_04 |
| head | neck | mixamorig:Head | mixamorigHead_06 / mixamorigNeck_05 |
| leftClavicle | chest | mixamorig:LeftShoulder | mixamorigLeftShoulder_032 / mixamorigSpine2_04 |
| leftUpperArm | leftClavicle | mixamorig:LeftArm | mixamorigLeftArm_033 / mixamorigLeftShoulder_032 |
| leftForearm | leftUpperArm | mixamorig:LeftForeArm | mixamorigLeftForeArm_034 / mixamorigLeftArm_033 |
| leftHand | leftForearm | mixamorig:LeftHand | mixamorigLeftHand_035 / mixamorigLeftForeArm_034 |
| leftUpperLeg | pelvis | mixamorig:LeftUpLeg | mixamorigLeftUpLeg_063 / mixamorigHips_01 |
| leftLowerLeg | leftUpperLeg | mixamorig:LeftLeg | mixamorigLeftLeg_064 / mixamorigLeftUpLeg_063 |
| leftKneeCover | leftLowerLeg | — | parent-following helper / — |
| leftFoot | leftLowerLeg | mixamorig:LeftFoot | mixamorigLeftFoot_065 / mixamorigLeftLeg_064 |
| leftToes | leftFoot | mixamorig:LeftToeBase | mixamorigLeftToeBase_066 / mixamorigLeftFoot_065 |
| rightClavicle | chest | mixamorig:RightShoulder | mixamorigRightShoulder_08 / mixamorigSpine2_04 |
| rightUpperArm | rightClavicle | mixamorig:RightArm | mixamorigRightArm_09 / mixamorigRightShoulder_08 |
| rightForearm | rightUpperArm | mixamorig:RightForeArm | mixamorigRightForeArm_010 / mixamorigRightArm_09 |
| rightHand | rightForearm | mixamorig:RightHand | mixamorigRightHand_011 / mixamorigRightForeArm_010 |
| rightUpperLeg | pelvis | mixamorig:RightUpLeg | mixamorigRightUpLeg_057 / mixamorigHips_01 |
| rightLowerLeg | rightUpperLeg | mixamorig:RightLeg | mixamorigRightLeg_058 / mixamorigRightUpLeg_057 |
| rightKneeCover | rightLowerLeg | — | parent-following helper / — |
| rightFoot | rightLowerLeg | mixamorig:RightFoot | mixamorigRightFoot_059 / mixamorigRightLeg_058 |
| rightToes | rightFoot | mixamorig:RightToeBase | mixamorigRightToeBase_060 / mixamorigRightFoot_059 |

`root`는 배치용이고 두 `KneeCover`는 부모를 따라가는 helper다. v9에 Spine1은 없지만 입력 chest의 전역 회전은 Spine1 부모까지 포함한다. 입력 손가락·pouch·보호대 뼈를 v9에 임의 추가하지 않는다.

## Rest 보정과 Idle 검증

`debug/retarget.js`에서 Three `SkeletonUtils.retargetClip`을 사용하고 `localOffsets`에 실제 뼈의 자식 방향/축 보정을 제공한다. v9는 A 자세이고 업로드 GLB의 초기 노드 자세는 순수 T 자세로 가정할 수 없다. FBX 스케일/축이 inverse-bind 행렬에 포함돼 `Skeleton.pose()`를 단순 호출하면 비정상적인 큰 좌표가 생긴다. 따라서 노드의 실제 자식 방향을 source bone local 축으로 바꾸고 대상 A 축과 연결한다. 손/발 끝은 입력 첫 프레임과 v9 기준 회전으로 보정한다. 이름만 바꾸거나 원본 inverse-bind 값을 고치지 않는다.

`Idle_Animation` 23.333334초/265채널 중 5개 morph 채널을 제외한 260개 joint track이 입력이다. 골반 스케일 0.8709134391은 v9 골반 0.92m와 실제 입력 높이의 비율이며 **3D 어댑터 튜닝**이다. 루트의 업로드 배치 오프셋을 제거한다. 체형별 다리 길이 차이 때문에 정지 Idle 전용 양발 고정과 기존 two-bone IK를 추가한다. 발목 높이 0.17m는 v9 리그 기준값이다. 일반 걷기·terrain IK로 쓸 수 있다는 의미는 아니다.

원본 길이 전체를 30Hz로 701회 검사했다. NaN 0, 실제 시각 밑창 정점 Y 범위 −0.000000032~0.011991274m(±2cm 이내), 21개 인체+12개 방호 collider의 뼈 변환 대비 최대 오차 0.000000980m, 종료 후 A 복귀 정확 일치. 공식 Node 시험은 fitted 발 표면과 모든 collider, 외부 Chromium 시험은 실제 skinned 밑창과 스크린샷을 별도로 검사한다. 기본 게임 bundle에는 debug 모듈/입력 모델이 없고 자동 재생하지 않는다.

[정면](../downloads/checks-medical/retarget-idle-front.jpg) · [측면](../downloads/checks-medical/retarget-idle-side.jpg) · [정면 피격/방호](../downloads/checks-medical/retarget-idle-front-colliders.jpg) · [측면 피격/방호](../downloads/checks-medical/retarget-idle-side-colliders.jpg) · [수치 기록](../downloads/checks-medical/retarget.json)

M4 최초 v9 시각 시험에서는 어깨 끈·무릎보호대·숨은 몸통 문제가 남았다. 이후 사용자 요청으로 별도 v13 시각 스킨에서 잘못된 부착물 연결과 없는 몸통 표면을 수리했다. 최신 정면/측면 증거는 이 수리본이다. 원본/v9 GLB와 피격/방호 표면의 같은 뼈 변환은 보존하며 고정 H01 선택도 유지한다. [후속 수리와 제한](training-skin-verification.md)을 따른다.

## Character Creator → Mixamo 다음 캐릭터 초안

실제 `CC_Base_*` skin joint 114개, 클립은 `Mark_Idle_Pose` 321채널이다. CC_Base_Hip 아래에는 다리용 Pelvis와 몸통용 Waist가 갈라져 있어 **Pelvis를 무조건 Hips로 개명하면 몸통 루트가 빠진다.**

| 실제 CC 뼈(숫자 접미사 생략) | Mixamo 초안 | 처리 |
| --- | --- | --- |
| _rootJoint / RL_BoneRoot | — | 배치·export helper 유지 |
| CC_Base_Hip | Hips | 몸통·다리 공통 루트 |
| CC_Base_Pelvis | — | 다리 분기 helper 유지, 합성 시 자식 전역 변환 보존 |
| CC_Base_Waist / Spine01 / Spine02 | Spine / Spine1 / Spine2 | 세 단계 실제 계층 유지 |
| CC_Base_NeckTwist01 / NeckTwist02 | Neck / — | 중간 twist의 전역 회전 합성 필요 |
| CC_Base_Head | Head | facial 별도 |
| L/R_Clavicle / Upperarm / Forearm / Hand | Left/RightShoulder / Arm / ForeArm / Hand | 축·rest·길이 보정 필수 |
| L/R_Thigh / Calf / Foot / ToeBase | Left/RightUpLeg / Leg / Foot / ToeBase | Pelvis helper 포함해 변환 |
| L/R_Mid1–3 / Index1–3 / Ring1–3 / Pinky1–3 | Left/RightHandMiddle / Index / Ring / Pinky 1–3 | 실제 손가락 유지 |
| twist / share / ribs / breast / facial / pouch / 작은 발가락 | — | 별도 역할, 자동 삭제·병합하지 않음 |

실제 목록에 Thumb1–3 뼈가 없어 Mixamo 엄지 대응은 미정이다. 위 표와 114개 JSON은 문서 초안이며 이 모델의 리타깃·스킨·피격·게임 투입은 구현하지 않았다.
