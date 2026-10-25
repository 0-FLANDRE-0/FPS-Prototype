# 기존 병사 시각 스킨 수리 — v13

사용자가 M4 시험 뒤 기존 캐릭터의 몸·보호구가 뼈를 제대로 따라가도록 요청했다. 최종 훈련장은 계속 A 자세 표적이다. 자세 시험은 외부 QA에서 실행하고 종료 후 A로 복귀한다. M 관통·의료 기능도 같은 최종 HTML에 포함한다.

## 원인과 결과

원본 Body는 팔·손·바지·부츠로 이루어져 있고 방탄복 안쪽에 연속된 군복 몸통 표면이 없다. v9는 피격용 숨은 몸통 근사만 만들었으므로 방탄복을 숨기면 몸통이 비어 있었다. 또한 Vest의 무릎보호대가 기본 chest fallback을, 일부 어깨 버클/끈이 chest와 UpperArm의 서로 다른 연결을 사용했다. Equipment의 단단한 파우치에도 정점 Y 기준 pelvis/chest가 섞여 부품이 변형됐다. Head 재질에 있던 등쪽 방탄복 끈은 목을 따라가고 있었다.

`scripts/training-soldier-skin.mjs`는 v9를 입력으로 별도의 시각 GLB를 만든다. 위치가 같은 UV seam 정점을 용접해 연결된 부품을 분류하고 부착 위치별 뼈에 전체 부품을 붙인다. 단단한 무릎 shell은 각 KneeCover, 유연한 무릎 wrap/끈은 다리의 굽힘 가중치, 어깨 바깥 shell/버클은 각 UpperArm과 몸통 쪽 끈의 연속 chest 연결, groin shield/hanger는 pelvis, 본체는 chest, 파우치는 전체 부품당 하나의 허리/가슴 뼈, 등쪽 끈은 chest다. 연결된 부품 안에서 서로 다른 뼈로 갑자기 나뉘던 상태를 없앴다. 바지73정점이 단단한 KneeCover를 따라가며 뾰족하게 늘어나던 연결도 UpperLeg/LowerLeg으로 돌렸다.

없는 몸통에는 **저작한 안쪽 군복 표면** 297정점/512삼각형을 추가했다. 새 장기/인체 원본 메시가 아니다. 골반→척추→가슴의 넓은 3관절 가중치 구간을 사용해 허리의 좁은 구간이 접히며 눌리던 현상을 줄이고 팔 움직임으로 몸통이 찌그러지지 않게 했다. 원본 Body atlas의 군복 영역 UV `[0.10,0.15,0.10,0.19]`를 검토해 재사용했으며 이미지·재질을 추가하거나 수정하지 않았다. 형상·UV 선택·가중치는 시각 저작/튜닝이다. native 웅크리기의 안쪽 군복 면적 비율은0.9552~1.0376, 전체 Idle은0.9240~1.0909다.

원본 5개 primitive의 정점 위치·normal·UV·indices와 원본 이미지/재질은 그대로이고 skin weight만 수정한다. 군복 몸통이 여섯 번째 primitive다. 뼈24개 이름/부모/inverse bind와 native4클립은 v9와 동일하다. `generateSoldierRig`의 native 출력은 예전 SHA `0ca0af733fd5c1bd6a601ce098ca7d3551442aa7605982c67819f5c71c4c6042`를 유지한다. 새 시각 출력은 `dist/soldier-skinned.glb`이며 build-info의 `soldierSkin`에 새 해시/부품별 부착 근거를 기록한다. 원본 GLB를 덮어쓰지 않는다.

인체21피격체·방호12표면·이동 capsule·사격 RNG·총구/시선/카메라/걸음과 의료 주체는 변경하지 않았다. A 조준점과 v10의 인체 이전 방호 결과도 그대로다. 새로운 시각 표면은 추가 방호력이나 새 피격 판정을 만들지 않는다.

## 검증

공식 전체 시험111/111. 추가 시각 시험2개는 원본/v9 보존, 무릎/어깨 연결, 원본 정점/UV/이미지 보존, 모든 native5자세 및 실제 업로드 Idle23.333초 전체의 군복 삼각형 면적 보존을 확인한다. 체형/뼈/클립은 그대로며 밑창과 피격/방호 변환은 M4 시험을 다시 수행한다.

외부 Chromium 비교는 같은 뼈대/조명/카메라에서 수정 전후5자세×정면/측면20장과 내부 군복2장을 만든다. 각 자세의 안쪽 군복 면적 비율은0.90~1.10 범위를 검사한다. 이는 국소 천 표면의 자연스러운 굽힘은 허용하면서 얼굴/몸통이 점으로 무너지는 변형을 잡는 기준이다. 긴 Idle에서도 같은 기준을 적용한다. 완전히 변형0이라고 주장하지 않는다. 숫자는 최종 [skin.json](../downloads/checks-medical/skin.json)과 [retarget.json](../downloads/checks-medical/retarget.json)에 있다.

[몸통 수정 전](../downloads/checks-medical/skin-before-inner-torso.jpg) · [수정 후](../downloads/checks-medical/skin-after-inner-torso.jpg) · [웅크리기 정면](../downloads/checks-medical/skin-after-crouch-front.jpg) · [조준 측면](../downloads/checks-medical/skin-after-aim-side.jpg) · [Idle 정면](../downloads/checks-medical/retarget-idle-front.jpg)

외부 QA의 mutable pose API와 이전5/현재6primitive 비교용 loader는 배포 HTML에 들어가지 않는다. 실제 배포 HTML의 오프라인844×390터치/1280×720마우스 검사는 정식6primitive loader로 별도 수행한다. 페이지/콘솔 오류0과 외부 요청0, 의료/사격/재장전/인벤토리 검증은 최종 배송 JSON을 따른다.

## 제한

시각 스킨은 이번에 확인한 native5자세와 업로드 Idle을 기준으로 수리했다. 모든 임의 애니메이션·큰 관절 비틀림·쪼그려 앉기·새 체형에서 관통/겹침0을 보장하는 완성 리그는 아니다. 관절 주변은 기존 linear skin, 단일 뼈 피격체와 blended 시각 표면의 차이가 남고 천 시뮬레이션/개별 손가락/새 NPC 동작은 없다. 이번에 채운 표면은 단순한 안쪽 군복이며 상의를 벗은 인체 메시가 아니다. 이동 적을 넣을 때에는 해당 동작과 체형으로 추가 검증한다. S24 실기기는 미검증이다.
