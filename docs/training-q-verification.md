# Q — medical-v2 / v17 로컬 검증

첨부 [Q 지시서](training-q-instructions.md)의 기능 사양을 이번 작업 범위로 적용했다. 먼저 앱 코드 무변경 [Q0 조사](training-q0-diagnosis.md)를 보고한 뒤 별도 medical-v2로 수정했다. 원본 src/**와 generated 의료 원문 선언은 무수정이다. H01은 A자 고정이며 쓰러짐·치료·소생술은 없다. R/S 범위의 혈관/장기/부위별 출혈·창상 프로파일을 변경하지 않았다.

## 실행 기준

- 기본 medicalModel=v2. 설정의 의료 계산에서 legacy를 선택할 수 있으며 변경하면 H01 의료 기록만 초기화한다. 기존 설정에도 기본v2를 추가한다.
- 실제 production 사격/RNG로 만든 legacy/v2 인체 상태를 production TrainingMedical.tick(1/60초)으로 900초 실행했다. 각 v2 사례를 같은 seed로2회 실행해901행·모든 첫 전환·전체 최종 actor·통증 연쇄 기록이 완전히 일치했다. 치료 없음.
- 전체 원본 AST 선언과 파일 해시 보존, 원본 tick 순서 유지,7개 슬롯만 교체. summary/sync의 외부 API도 교체 함수에 연결한다. [MD 장부](medical-v2-ledger.md) / [동일 항목 JSON](medical-v2-ledger.json).

## 첫 전환 (초)

|시나리오|손실15/30/40%|의식<80/<50/<20|downed (주 원인)|unconscious|arrest (주 원인)|dead (주 원인)|
|---|---|---|---|---:|---|---|
|bare-forearm|139.583 / 370.350 / 없음|416.733 / 427.083 / 452.850|429.683 (hypotension)|452.850|518.750 (hemorrhagic_shock)|818.750 (hemorrhagic_shock)|
|front-neck|34.667 / 68.100 / 90.050|83.983 / 89.900 / 108.417|93.067 (critical_status)|108.417|148.233 (hemorrhagic_shock)|448.233 (hemorrhagic_shock)|
|soft-through-body-rear|90.150 / 192.050 / 264.767|230.867 / 244.050 / 270.367|247.417 (hypotension)|270.367|314.083 (hemorrhagic_shock)|614.083 (hemorrhagic_shock)|
|bare-upper-thigh|139.583 / 370.350 / 없음|416.733 / 427.083 / 452.850|429.683 (hypotension)|452.850|518.750 (hemorrhagic_shock)|818.750 (hemorrhagic_shock)|
|arm-first-body|54.650 / 138.833 / 198.950|168.917 / 177.917 / 203.483|182.633 (hypotension)|203.483|244.217 (hemorrhagic_shock)|544.217 (hemorrhagic_shock)|

없음은900초 안에 미도달이다. 심정지 뒤 유효 출혈이 줄어 40% 손실에 못 이르는 사례가 있다. 모든 출혈 사망에서 arrest→dead는300초다. 이 시각은 게임 결과이며 임상 생존 예측이 아니다.

## 불변 조건 — 매 tick 검사

|조건|결과|
|---|---|
|직접 head/neck 외 사망은 arrest를 거치고 그때 unconscious|5건 모두 통과|
|살아 있는 동안 deathReason 비어 있음; downed 시 downReason 존재|모든 tick 통과|
|neck_destroyed는 외상 neck HP=0에서만|통과;5건 출혈사는hemorrhagic_shock|
|살아 있는 동안 pain≥painFloor|모든 tick 통과|
|손실30% 모든 사례 shock>0|5건 통과|
|출혈 구간 의식 목표 한 tick 변화<5|모든 tick 통과; target slew≤60/s,1/60tick에서최대1|
|허혈로 외상 HP 변화 없음|8부위 ×5건 ×전체 tick 통과|
|arrest HR/BP/MAP/관류/O₂=0, perceivedPain=0|모든 arrest tick 통과|

|시나리오|손실30% shock|최대 의식 목표 tick 차이|900초 pain/바닥|
|---|---:|---:|---|
|bare-forearm|37.3756|1.000000|37.4400/37.4400|
|front-neck|37.0339|1.000000|16.6758/16.6758|
|soft-through-body-rear|37.5132|1.000000|17.3677/17.3677|
|bare-upper-thigh|37.3756|1.000000|37.4400/37.4400|
|arm-first-body|37.1378|1.000000|28.1531/28.1531|

## 통증 연쇄 (legacy → 전체v2, 동일 피격 후60초)

pain → injuryDrive → adrenaline/painMasking → HR/BP/전투효율을 원본 함수로 그대로 계산했다. 추가로 이 연쇄를 누르는 튜닝은 없다. 아래는 모든 Q 변경의 합성 비교이며 통증 하나만의 기여를 분리한 실험은 아니다. 쇼크/관류/허혈·의식 변화도 결과에 기여한다. 전체초별 연쇄는 각 JSON의chain 배열이다.

|시나리오|pain|injuryDrive|adrenaline|masking|HR|SBP|전투효율|
|---|---|---|---|---|---|---|
|bare-forearm|0.000 → 37.440|0.016 → 0.219|0.006 → 0.215|0.004 → 0.119|82.972 → 96.881|121.047 → 133.101|87.862 → 70.377|
|front-neck|0.000 → 16.676|0.147 → 0.273|0.105 → 0.229|0.062 → 0.130|112.806 → 122.988|119.440 → 121.633|88.570 → 79.782|
|soft-through-body-rear|0.000 → 17.368|0.071 → 0.158|0.052 → 0.144|0.031 → 0.080|89.220 → 95.160|124.706 → 130.001|97.438 → 94.048|
|bare-upper-thigh|0.000 → 37.440|0.016 → 0.219|0.006 → 0.215|0.004 → 0.119|82.972 → 96.881|121.047 → 133.101|89.333 → 73.045|
|arm-first-body|0.000 → 28.153|0.026 → 0.205|0.009 → 0.189|0.007 → 0.106|90.259 → 103.615|119.722 → 129.260|92.118 → 85.640|

기록 당시의 원본 wound/partPain은 유지했다. 의식불명/심정지 때 perceivedPain은0이지만 raw pain과 바닥 성분은 남는다. 원본 stress가 perceivedPain을 갱신하더라도 원본 HR이 읽기 전에0으로 만드는 소비 순서도 단위 검사했다.

## 회귀와 오프라인

- 공식 npm test **132/132**. original full updateUnit vs legacy3D P2 3건×61행 완전 일치. P3legacy5건×301행은 v15 저장 결과와 완전 일치.
- fresh context에서 두 모드 각각600틱6발: 총구·방향·카메라·걸음/스프링이 v16과 byte-equivalent JSON으로 완전히 일치. 두 모드 서로도 동일 hash: e5dde2e0d7c8c488946a3abca7a543bfc9ce63d19c9f71a3691e39e670d91517.
- 기존13사격+상부대퇴, 두 모드28검사: 의료를 제외한 전체 결과(탄도·방호·인체·잔여탄·카운트·탄약·HUD)가 완전히 일치. legacy 의료도 v16과 동일하다. v16 legacy 계산은 v15와 동일하며 Q0/P3와원본2D로 확인했다.
- 의료 변경 전체 경로 678개는 [changed-medical-fields.json](../downloads/checks-q/changed-medical-fields.json), fixture별 목록은 browser-report.json. 추가 필드/기존 의미 변경은 장부에 구분했다.
- 원본 baseline **3,641,864B**, SHA ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d 동일. src/**, 원본HTML, sourceGLB, aim, ballistics, physics, armor/body/head형상 무변경.
- native v9/v13 GLB 및 soldier WebP 바이트/기준 해시 동일. M4 비이미지 데이터/메시/UV/스킨/노드/재질/sampler 동일. 지정 ORM2장 외13장 이미지 바이트 동일. assets-report.json.
- **최종 HTML 그대로** offline844×390/1280×720: 기본v2·실제 설정 선택·legacy reload저장·v2 전환 시의료 초기화·real RAF 실행을 검사했다. JS오류0·외부요청0. exact HTML SHA 5aa97e870c0cd76b0818adfad31023fb5b7519dab9f1cf74ec91ac1749a176c9.
- 직전 Q 빌드에서 기존 전체 조작(동시 터치, ADS 토글/유지, F 상자, H01 의료 pause/resume)도 통과했다. 최종 HTML은 위 해시로 별도 오프라인 검사를 수행했다. 직전 빌드의 확장 조작 검사와 구분한다.
- QA계측은 별도하네스이며 배포HTML에 __CQBTest가 없다. Chromium file://는환경정책상차단되어 메모리에서 exact HTML을 전달하고 네트워크를끊었다. 직접 file:// 실행과 S24 실기기는 미검증이다.

## Q6 화면 정정/품질

P1 M4 사진은 bag.open=true로 3D 렌더링을 생략한 화면이었다. “실제 ADS 정착 위치” 문장을 [P1 문서](training-p1-textures.md)에서철회했다. v13원본텍스처/현재텍스처각각4상태를 재촬영하고 실제 AimState.ads 및 렌더러 lens 값을 JSON에남겼다. ADS raw값은0.9999999999999998(부동소수점추종정착), settledAdsState=1; 비조준0이다. 강도70일때renderer k는hip0.7/ADS0.28, 강도0은null pass다. 버전마다 4장이 서로 다른지 픽셀 해시로 검사하며, 실패하면 중단한다. [Q6 JSON](../downloads/checks-q6/report.json).

|ORM 이미지|P1 B/SSIM|Q6 B/SSIM|선택|증가 B|
|---|---|---|---|---:|
|weapon/1|173292/0.915432|1060274/1.000000|lossless (q100 lossy실패)|886982|
|weapon/4|14524/0.956092|58732/0.973328|q100|44208|

|용량|v16|v17|
|---|---:|---:|
|M4 WebP GLB|3,629,420|4560612|
|독립 HTML|22,803,809|24057776|

기존 normal, baseColor와 다른 이미지의 선택 바이트는 그대로다. SSIM 0.97과 q는 출력 품질 조정값이며, 의학·방호 성능 값과 구분한다.

## ATLS10 경향 비교 — 보고 전용

Hall & Drobatz2021 Table2의ACS허가 ATLS10(2018) Table3-1재인쇄PDF를직접다시열어확인했다. [PDF](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2021.638104/pdf), 확인2026-10-10UTC, 원문해시는P3와동일하다. source-evidence/atls-source.json. 게임의식0–100은GCS가아니며shock0–100도ATLS등급이나임상쇼크지수가아니다. 표에맞추는추가상수튜닝은하지않았다.

|ATLS10|손실|HR 경향|BP 경향|GCS 경향|
|---|---|---|---|---|
|I|<15%|거의 변화 없음|거의 변화 없음|거의 변화 없음|
|II|15–30%|유지/증가|거의 변화 없음|거의 변화 없음|
|III|31–40%|증가|유지/감소|감소|
|IV|>40%|증가/큰 증가|감소|감소|

|시나리오|비교구간|시각|실제손실%|HR|SBP|게임의식(GCS아님)|
|---|---|---:|---:|---:|---:|---:|
|bare-forearm|I|0.000|0.0000|75.000|117.000|100.000|
|bare-forearm|II|139.583|15.0001|105.117|134.976|100.000|
|bare-forearm|III (30%샘플)|370.350|30.0001|138.234|120.794|100.000|
|bare-forearm|IV|미도달|—|—|—|—|
|front-neck|I|0.000|0.0000|75.000|117.001|80.000|
|front-neck|II|34.667|15.0068|100.838|132.028|99.999|
|front-neck|III (30%샘플)|68.100|30.0030|131.149|119.136|100.000|
|front-neck|IV|90.050|40.0037|173.189|77.655|48.051|
|soft-through-body-rear|I|0.000|0.0000|75.000|117.001|100.000|
|soft-through-body-rear|II|90.150|15.0008|103.462|132.734|100.000|
|soft-through-body-rear|III (30%샘플)|192.050|30.0022|132.053|118.763|100.000|
|soft-through-body-rear|IV|264.767|40.0003|190.000|64.139|23.449|
|bare-upper-thigh|I|0.000|0.0000|75.000|117.000|100.000|
|bare-upper-thigh|II|139.583|15.0001|105.117|134.976|100.000|
|bare-upper-thigh|III (30%샘플)|370.350|30.0001|138.234|120.794|100.000|
|bare-upper-thigh|IV|미도달|—|—|—|—|
|arm-first-body|I|0.000|0.0000|75.000|117.000|100.000|
|arm-first-body|II|54.650|15.0027|102.000|133.480|100.000|
|arm-first-body|III (30%샘플)|138.833|30.0010|135.167|119.982|100.000|
|arm-first-body|IV|198.950|40.0004|190.000|64.150|23.023|

30%는 지시서의 전환 샘플이며, III 등급 원문의 31% 정수 경계와 구분한다. 30% 순간의 의식은 약 100이지만, 손실 31–40% 범위에서 연속으로 내려가 80 미만이 된다. 이 경향은 5건 모두 검사했다. 일부 사례는 심정지 때 출혈이 줄어 40%에 못 이른다. 팔뚝과 대퇴의 원본 출혈률이 같은 문제는 R 범위로 유지했다. 이 사망 시각을 임상적으로 검증했다고 해석하면 안 된다.

## 출처 구분/파일

MAP 교육 리뷰는 직접 확인했다. 고정 60은 개인의 하한을 보장하지 않는 게임 기준이다. Rossen·Beecher 원문은 읽지 못해 원문 확인 완료나 새 임상 수치의 근거로 표시하지 않았다. 심정지 후 의식 0까지의 10초와 사망까지의 300초는 조정값이다. 접근 결과는 source-evidence.json과 변경 장부에 남겼다.

각 사례의 legacy/v2 CSV 901행과 JSON(첫 전환, 전체 finalActor, chain), 6종 중첩 그래프 30장을 downloads/checks-q에 담았다. Q0의 모든 tick 자료는 gzip NDJSON이다. 변경 장부, Q6 화면 8개와 최종 오프라인 화면 4개도 ZIP에 포함한다.

![의식 중첩](../downloads/checks-q/arm-first-body-consciousness.png)

![통증 중첩](../downloads/checks-q/arm-first-body-pain.png)

![수정 M4 ADS/lens70](../downloads/checks-q6/current-m4-ads-lens70.png)

GitHub Actions를 실행하지 않고 로컬에서 빌드·검증·ZIP CRC와 전체 파일의 바이트 대조를 수행해 전달한다. [빌드정보](../downloads/training-build-info-medical-v2-v17.json), [최종검증JSON](../downloads/verification-medical-v2-v17.json), [배송대조](../downloads/delivery-medical-v2-v17.json). S24실기기미검증.
