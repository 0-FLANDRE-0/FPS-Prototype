# P1 — 텍스처 경량화

지시서 P1 적용. v13 원본 스킨과 원본 M4는 입력으로 보존하고 별도 WebP 파생 GLB만 HTML에 넣는다. v14 조작은 유지한다. `src/**`와 탄도·방호·피격 형상은 수정하지 않았다.

## 변환 및 품질

`node scripts/training-webp.mjs`로 재생성한다. sharp 0.34.5 / libwebp 1.6.0 / effort 6. 초기 q85, normal q95, alpha q100은 사용자 지시의 튜닝값이다. baseColor는 RGB SSIM ≥0.97까지 q를 올린다. ORM 묶음 이미지의 선택은 텍스처 SSIM 문턱을 쓰지 않고 실제 총기 영역 렌더 SSIM ≥0.97로 판단한다(R5 정정). 텍스처 SSIM·PSNR은 참고 기록이다. SSIM은 채널 평균, 7×7 균일 창, 표본 공분산; PSNR은 8-bit RGB 기준. ∞는 RGB 바이트 동일이다. 알파 최대 오차 0, 모든 실제 텍스처는 알파 없는 RGB이며 OPAQUE 재질이다. emissive 텍스처는 없다.

q95 normal 시험본의 경계·미세 무늬 변화가 보여 모두 무손실로 선택했다. normal의 최종 RGB가 정확히 같아 벡터 변화도 없다. JPEG 전부 절감률 10% 이상; 원본 유지 조건을 구현했지만 이 입력에서는 해당 없음. PNG 대체본 없이 EXT_texture_webp를 required로 선언한다. 해상도 변경 없음. 해상도 축소 후보는 현재 제안하지 않는다.

| 모델/이미지 | 용도 (재질) | 크기 | 알파/사용 | 원본 B | 변환 B | 선택 q | PSNR dB | SSIM |
|---|---|---|---|---:|---:|---|---:|---:|
| soldier/0 | baseColor (Body) | 1024×1024 | false/false | 651044 | 261962 | 90 | 40.433 | 0.975601 |
| soldier/1 | normal (Body) | 1024×1024 | false/false | 1555241 | 1370180 | 무손실 (q95 시험 후) | ∞ | 1.000000 |
| soldier/2 | baseColor (Equipment) | 1024×1024 | false/false | 696044 | 282806 | 90 | 40.094 | 0.973870 |
| soldier/3 | normal (Equipment) | 1024×1024 | false/false | 1763042 | 1525802 | 무손실 (q95 시험 후) | ∞ | 1.000000 |
| soldier/4 | baseColor (material) | 512×512 | false/false | 102908 | 41572 | 90 | 42.034 | 0.974544 |
| soldier/5 | baseColor (Head) | 1024×1024 | false/false | 560627 | 225024 | 85 | 38.422 | 0.972665 |
| soldier/6 | normal (Head) | 1024×1024 | false/false | 1370004 | 1141024 | 무손실 (q95 시험 후) | ∞ | 1.000000 |
| soldier/7 | baseColor (Vest) | 1024×1024 | false/false | 561541 | 213196 | 90 | 41.099 | 0.978511 |
| soldier/8 | normal (Vest) | 1024×1024 | false/false | 1409388 | 1211240 | 무손실 (q95 시험 후) | ∞ | 1.000000 |
| weapon/0 | baseColor (M_M4A1) | 1024×1024 | false/false | 801775 | 99532 | 85 | 41.152 | 0.983918 |
| weapon/1 | metallicRoughness (M_M4A1), occlusion (M_M4A1) | 1024×1024 | false/false | 1185566 | 173292 | 85 | 29.924 | 0.915432 |
| weapon/2 | normal (M_M4A1) | 1024×1024 | false/false | 1111413 | 1033168 | 무손실 (q95 시험 후) | ∞ | 1.000000 |
| weapon/3 | baseColor (M_556) | 512×512 | false/false | 253951 | 49158 | 95 | 44.115 | 0.978627 |
| weapon/4 | metallicRoughness (M_556), occlusion (M_556) | 512×512 | false/false | 174531 | 14524 | 85 | 36.984 | 0.956092 |
| weapon/5 | normal (M_556) | 512×512 | false/false | 151320 | 117656 | 무손실 (q95 시험 후) | ∞ | 1.000000 |

## 용량과 무결성

| 항목 | v13 B | P1 B | 감소 |
|---|---:|---:|---:|
| soldier GLB | 10982612 | 8585780 | 21.82% |
| weapon GLB | 5821164 | 3629420 | 37.65% |
| HTML | 28906850 | 22792402 | 21.15% |

HTML 용량은 P1 단계 스냅샷이다. 최종 P2/P3 누적 빌드의 정확한 용량·해시는 최종 검증 JSON에 별도 기록한다. 원본 v13 accessor·메시·UV·노드·스킨·클립·재질·sampler 구조 및 모든 비이미지 bufferView 바이트를 비교했다. JSON 오프셋은 이미지 길이 변경으로 재배치되지만 관련 데이터 자체는 그대로다. 빌드와 별도 CLI의 두 번째 생성 해시가 일치했다.

- soldier: 9611123392eac05ab89ddcca6edfd94d2ba51e468b1184d68cb2b245801f70fd; 비이미지 2245312 B, 235 views 일치.
- weapon: 02393f2d226b8e09ce4bf55dc90e897d6a0f8b6a4050d1e478abdb53f965c67c; 비이미지 2104588 B, 125 views 일치.

## KTX2 평가 (미적용)

같은 15개 원본 텍스처로 Basis Universal v2_50 UASTC level2, Zstandard, 전체 mip chain 시험본을 만들었다. sRGB baseColor와 linear normal/packed를 구분했다. 이 고품질 UASTC 시험은 WebP보다 파일이 크다. WebP는 파일만 줄이고 GPU RGBA8 저장 크기는 그대로다. 다음은 mip chain을 포함한 이론 추정이며 실제 드라이버 할당 측정이 아니다.

| 모델/이미지 | 원본 B | WebP B | KTX2 시험 B | RGBA8 GPU B | ASTC4×4/BC7 GPU B |
|---|---:|---:|---:|---:|---:|
| soldier/0 | 651044 | 261962 | 1128195 | 5592404 | 1398128 |
| soldier/1 | 1555241 | 1370180 | 1171187 | 5592404 | 1398128 |
| soldier/2 | 696044 | 282806 | 1319963 | 5592404 | 1398128 |
| soldier/3 | 1763042 | 1525802 | 1265549 | 5592404 | 1398128 |
| soldier/4 | 102908 | 41572 | 266560 | 1398100 | 349552 |
| soldier/5 | 560627 | 225024 | 1129755 | 5592404 | 1398128 |
| soldier/6 | 1370004 | 1141024 | 1169602 | 5592404 | 1398128 |
| soldier/7 | 561541 | 213196 | 999982 | 5592404 | 1398128 |
| soldier/8 | 1409388 | 1211240 | 1050532 | 5592404 | 1398128 |
| m4/0 | 801775 | 99532 | 925023 | 5592404 | 1398128 |
| m4/1 | 1185566 | 173292 | 1231794 | 5592404 | 1398128 |
| m4/2 | 1111413 | 1033168 | 1093787 | 5592404 | 1398128 |
| m4/3 | 253951 | 49158 | 282935 | 1398100 | 349552 |
| m4/4 | 174531 | 14524 | 260981 | 1398100 | 349552 |
| m4/5 | 151320 | 117656 | 229451 | 1398100 | 349552 |

Three 0.180의 별도 디코더: basis_transcoder.js 57529 B, basis_transcoder.wasm 527333 B; 합계 584862 B. 새 인코더와 이 디코더의 호환성은 검증하지 않았고 배포에도 넣지 않았다. 원본 PNG/JPEG GPU 추정도 RGBA8 동일; 타깃 GPU 포맷 지원 여부에 따라 KTX2 절감률이 달라진다. 실제 시험본 해시와 인코더 인자는 checks-p1/ktx2.json에 기록했다.

## 화면과 부팅

H01 정면/측면/얼굴 및 M4 비조준/조준 × 렌즈 0/70의 전후 20장. H01은 외부 검사 카메라, **정정(Q6, 2026-10-11 KST): 기존 M4 8장은 bag.open=true로 world 렌더가 생략되어 ADS/렌즈의 실제 화면 증거가 아니다. 이전 “실제 production ADS가 정착한 위치” 설명을 철회한다.** H01 검사 화면은 이 M4 오류와 별개다. 올바르게 재촬영한 M4 8장과 실제 ADS/렌더러 렌즈 값은 [Q6 기록](../downloads/checks-q6/report.json), [Q 검증](training-q-verification.md)에 있다. 배포에 이 검사 카메라·계측은 들어가지 않는다.

부팅 3회 교대 cold context: Linux Chromium software GPU, 1280×720, 동일 브라우저, 네트워크 차단, HTML 메모리 전달부터 모델/WASM/렌더러 준비까지. 물리 휴대폰이나 다운로드 시간 측정은 아니다.

| 회차 | v13 ms | P1 ms |
|---|---:|---:|
| 1 | 9487.4 | 9619.9 |
| 2 | 8474.6 | 6702.3 |
| 3 | 5064.1 | 4701.2 |

중앙값 8474.6 → 6702.3 ms. 표본 3회와 소프트웨어 GPU의 변동이 커 일반적인 로딩 속도 개선률로 단정하지 않는다.

- h01-front, 렌즈 0: [v13](../downloads/checks-p1/screens/before-h01-front-lens0.png) · [P1](../downloads/checks-p1/screens/current-h01-front-lens0.png)
- h01-front, 렌즈 70: [v13](../downloads/checks-p1/screens/before-h01-front-lens70.png) · [P1](../downloads/checks-p1/screens/current-h01-front-lens70.png)
- h01-side, 렌즈 0: [v13](../downloads/checks-p1/screens/before-h01-side-lens0.png) · [P1](../downloads/checks-p1/screens/current-h01-side-lens0.png)
- h01-side, 렌즈 70: [v13](../downloads/checks-p1/screens/before-h01-side-lens70.png) · [P1](../downloads/checks-p1/screens/current-h01-side-lens70.png)
- h01-face, 렌즈 0: [v13](../downloads/checks-p1/screens/before-h01-face-lens0.png) · [P1](../downloads/checks-p1/screens/current-h01-face-lens0.png)
- h01-face, 렌즈 70: [v13](../downloads/checks-p1/screens/before-h01-face-lens70.png) · [P1](../downloads/checks-p1/screens/current-h01-face-lens70.png)
- m4-hip, 렌즈 0: [v13](../downloads/checks-p1/screens/before-m4-hip-lens0.png) · [P1](../downloads/checks-p1/screens/current-m4-hip-lens0.png)
- m4-hip, 렌즈 70: [v13](../downloads/checks-p1/screens/before-m4-hip-lens70.png) · [P1](../downloads/checks-p1/screens/current-m4-hip-lens70.png)
- m4-ads, 렌즈 0: [v13](../downloads/checks-p1/screens/before-m4-ads-lens0.png) · [P1](../downloads/checks-p1/screens/current-m4-ads-lens0.png)
- m4-ads, 렌즈 70: [v13](../downloads/checks-p1/screens/before-m4-ads-lens70.png) · [P1](../downloads/checks-p1/screens/current-m4-ads-lens70.png)

오류/외부 요청 0. 공식 npm test 113/113, baseline identical. 위 화면/부팅/품질/KTX2 계측은 외부 작업 하네스이며 빌드 내 공식 테스트와 구분한다. S24 실기기 미검증. 구현 파일: scripts/training-webp.mjs(imageMetrics/compressGLB/assertTextureOnly/generateWebP), build-training.mjs, package.json/lock; 외부 검사 check-training-p1.mjs, check-training-ktx.mjs, training-p-browser.mjs, tests/training-textures.test.mjs.

R5 정정: Q6에서 적용했던 ORM 텍스처 SSIM≥0.97 기준을 철회했다. weapon/1은 P1q85 **173,292B**, weapon/4는 P1q85 **14,524B**로 바이트까지 되돌렸다. 나머지13장·병사 WebP·메시/UV/재질은 v17과 같다. M4 WebP GLB **3,629,420B**, 최신 독립 HTML **22,856,349B**이며 v17보다 **1,201,427B** 작다. 렌더SSIM: 비조준/렌즈0 0.993447, 조준/렌즈0 0.993548, 비조준/렌즈70 0.995492, 조준/렌즈70 0.995446. 총기 ROI 좌표와 최대 픽셀 차이는 `downloads/checks-r5/report.json`. 모든 상태≥0.97이므로 q 상향은 필요 없었다. 원래 P1 사진은 세계 렌더가 생략된 오류가 있었고, Q6/R5의 실제240틱 ADS 안정화·렌즈 적용 사진으로 정정했다.
