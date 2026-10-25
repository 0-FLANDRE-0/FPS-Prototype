# R 검증 — 몸속 판정·출혈 감소·출혈 내성 (v18)

2026-10-11 KST. 게임 시뮬레이터 지시서 R을 적용했다. [사전 조사](training-r0-diagnosis.md)를 먼저 기록한 뒤 v17 e2192f9에서 작업했다. 원본 src/**와 생성된 원문 선언은 그대로이며, 변경은 v2 입력/슬롯과 표시 관찰 기능에 한정한다. 기본 v2, legacy 선택 시 의료 기록 초기화, H01 A자 고정은 유지한다. GitHub Actions를 실행하지 않고 로컬에서 빌드·검증·ZIP을 만들었다.

## 구현과 치수 구분

69개 혈관·장기·뼈 도형은 24관절 리그의 뼈 로컬 공간에 붙는다. 혈관/긴 뼈는 다중 캡슐, 장기는 타원체이며, 관절 경로는 두 소유 부위에 나눴다. 갈비뼈는 개별 도형 없이 기존 흉벽 주소를 유지한다. 프로파일은 JSON 약17KB(직렬화 기준)로, 새 GLB·텍스처는 없다. 설정 ‘몸속 판정 표시’는 기본 꺼짐이며 동맥 빨강·정맥 파랑·장기 보라·뼈 흰색, 마지막 실제 교차는 노랑이다. 켜기/끄기 두 fresh 브라우저 문맥에서 사격·전체 의료 기록이 바이트 동일했다.

비율 좌표는 소유 인체 메쉬의 뼈 축 길이와 단면 중심/rx/rz를 측정해 변환한다. 오목한 피격체에서 단순 볼록껍질 판정을 사용하지 않는다. 중심이 실제 내부인지 확인하고, 각 선분과 모든 표면 삼각형의 최소 간격으로 캡슐을 맞춘다. 타원체는 내부 구의 보수적 경계로 맞춘다. 뼈의 bind inverse/child 길이/메쉬 종축 span/비율 위치의 단면만 필요하며 H01의 절대 위치·크기를 정의하지 않는다. 최종 지름/축 크기는 geometry/report.json sizes, 측정값은 measurements에 기록했다. 이것은 해부 메시나 임상 정밀 아틀라스가 아닌 몸 안에 들어오는 간단한 판정 프록시다.

직접 읽은 문헌 치수와 실제 저작 비율은 구분한다. 다음 성인 자료는 참고값이며, 프로파일의 모든 위치·경로·지름·축 비율과 몸 안쪽으로 줄인 최종 도형은 **게임 튜닝값**이다. 성인 남성만의 대표 치수를 직접 확인하지 못한 혈관, 뇌·폐·척수 및 기타 세부 치수는 문헌값으로 인증하지 않는다. 문헌의 고정 cm를 H01 상수로 삽입하지 않았다.

|직접 읽은 자료|확인한 내용|적용 구분|
|---|---|---|
|[2021 동맥 초음파 리뷰](https://pmc.ncbi.nlm.nih.gov/articles/PMC8107253/) — EuropePMC fullTextXML 직접 열람|성인 요골2.2–2.3±.4mm, 척골2.3–2.5±.5mm, 상완3.9±.5mm, 총/표재/심부 대퇴6.6±1.2/5.2±1.2/4.9±.9mm|성별 분리 대표값 아님; 참고. 실제 radiusRatio는 튜닝|
|[IMAIOS의 Gray1918 심장 정의](https://www.imaios.com/en/e-anatomy/anatomical-structures/heart-1541224336)|성인 길이12cm/너비8–9cm/두께6cm|역사 자료 참고; 피팅 축은 튜닝|
|[Whalen 등2024 초음파/해부 비교](https://www.sdms.org/docs/default-source/jdmspdf/pdf-with-cme-test-comparing-abdominal-and-retroperitoneal-organ-ma25.pdf?sfvrsn=2)|배경 간13–15.5cm, 신장9–12cm, 비장12–13cm; 측정 평면의 차이|성인 남성 3축 규격으로 쓰지 않음; 실제 축은 튜닝|
|[Mortensen 등1990](https://pubmed.ncbi.nlm.nih.gov/2297079/)|체형/혈관 치수 상관과 정맥 팽창성; 접근한 초록에 대표 지름 없음|숫자는 검증 완료로 표시하지 않음|

몸속 쿼리는 실제 점유 인체 구간과 체내 정지까지만 조회한다. 탄의 반지름은 원본 getProjectileDiameterMm/2000. 캡슐 사슬의 교차 구간을 합치고 타원체와의 Euclidean 거리로 실제 sphere sweep을 계산한다. 깊이·길이·중심선 거리·도형/2D 식별자를 기록하며, 혈관·장기의 20mm 근접은 기록만 한다. 저항·속도·관통·잔여탄·샷 RNG는 변경하지 않는다.

교차한 혈관의 식별자가 원본 명명/주요 혈관 정규식을 통과해 confirmed가 된다. 정맥은 vesselKind로 구분한다. 교차 없는 경우 위험%·주소·부위 파괴에서 후보/확정으로 올리지 않는다. 장기의 실제 교차는 원본 후보 모델과 confirmed_limited 입력으로 연결하되 기존 심각도·효과·깊이/에너지 문턱을 유지한다. 심장은 기존 monitor-only이며, 원본에 없는 뇌·척수 독립 효과는 추가하지 않는다. 폐 교차가 없으면 폐 손상/기흉 입력을 끈다. 골절은 첫 교차 뼈만 기존 확률과 의료 LCG로 굴리며 뼈가 없으면 RNG도 소비하지 않는다. 근접 피해와 탄종 창상·조직 저항 차이는 S에 남겼다.

## 출혈 및 내성

원본의 초기/지속 출혈량·골절 보너스·원본 응고 계수·상처 감소 엔진을 재사용한다. 자연 감소 바닥만 근육×.001(골절×.20), 명명 분지 동맥×.35/정맥×.15, 감소율 상한.08로 교체했다. 장기만 맞은 상처는 원본 장기 바닥을 유지한다. 주요 혈관 lock은 그대로다. 원본 pulse 함수에서 소수점 표시용 반올림 전의 항을 반환하는 helper를 자동 추출해 계산 정밀도를 유지한다. 혈압항은 동맥 MAP/93, 정맥/근육 .65+.35×MAP/93으로 한 번만 적용하며 정맥만의 유량×.55를 적용한다. 심정지 유효 유량×.05(Q)는 유지한다. 새 감소/정맥 계수는 전부 게임 튜닝이다.

‘혈관·골절이 없는 팔다리 상처는 대개 비치명적’, ‘주요 동맥은 무치료 시 치명적’은 **설계 기대**다. [2023 혈관 총상 관찰 연구](https://pmc.ncbi.nlm.nih.gov/articles/PMC10327304/)를 fullTextXML로 직접 읽어 대퇴 동맥 손상의24h 사망 연관(P=.022)과 조기 출혈 통제의 중요성을 확인했으나, 치료받은 관찰군에서 무치료 생존 확률/시간을 추정하지 않았다. [영국 군 외상 지침](https://cms.cgo.mod.uk/clinical-guidelines-for-operations/treatment-guidelines/musculoskeletal/gunshot-injuries-to-extremities/)도 무치료 생존을 보증하는 근거가 아니다. 구체 사망 시간을 문헌에 맞추지 않았다. 열람/차단/사용 범위는 source-evidence.json.

R0에서 시간 피로 누적의 역전을 재현했다. 새 피로 E=clamp((혈량결손−.40)/.60)^4×부하로 바꿔 머문 시간에 쌓이지 않게 하고, 결손/부하가 줄면 회복하게 했다. `checks-r-sweep/fatigue-only.json`은 최종 R 피로식만 적용하고 Q의 심정지 hold 조건을 유지한 제거 실험이다. 이때1–32ml/s가50.300–59.595% 손실에서 심정지했다. 처음 피로만 고쳤을 때는 혈량2500ml 미만+보상 빈맥만으로 원본 peri_arrest 표시가 켜져15초 후 심정지해 역전이 남았다. 최소 추가 수정으로 peri hold에 O2<.4 또는 SBP<60이라는 실제 순환 저하 조건을 붙였다. HR/BP/기타 HD 수식과 15/20초 유지, 잔여1200ml, Q 사망300초는 그대로다. 자동 생성한 HD 파생 함수는 해당 피로 블록만 다르고 원문 선언은 바이트 동일하다. 전/후 식·출처/튜닝·2D 의존 필드·69개 대응표는 [장부](medical-v2-ledger.md)와 [JSON](medical-v2-ledger.json).

고정 외부 출혈만1/2/4/8/16/32ml/s, 무통증·무내부손상, 실제 생산 tick1/60, 최대3600초. before/after JSON·12CSV·손실/SBP/MAP/피로8그래프는 checks-r-sweep. 심정지 ‘직전’ 값은 arrest.contributingFactors, 심정지 이후 BP/MAP는0이다.

|ml/s|Q 심정지 s / 손실%|R 심정지 s / 손실%|
|---:|---:|---:|
|1|1903.300 / 38.066|3600초 심정지 없음 / 관찰 종료 손실72%|
|2|1010.900 / 40.436|1900.000 / 76.000|
|4|557.717 / 44.617|950.017 / 76.001|
|8|314.367 / 50.299|475.017 / 76.003|
|16|189.033 / 60.491|237.500 / 76.000|
|32|118.750 / 76.000|118.750 / 76.000|

심정지 발생한2–32ml/s끼리 손실 역전 없음(1%p 허용), 순수 출혈40% 이하 심정지 없음. 1ml/s는 우측 절단된 관측이며 심정지 손실%를 추정해 비교하지 않았다. 빠른 출혈의76%는 임상 타당성 인증이 아니라 원본 exsanguination 문턱의 결과다.

## 실제 사격 10사례

생산 인벤토리·tick/fire·독립 샷/의료 RNG. 기존14개의 좌표는 유지했다. 신규5개의 조준점은 비율 도형 중심 또는 대퇴 단면 비율 위치이며 A자·맨살 장비 상태다. 제작된 도형에 조준점을 두되 실제 물리 사격이 맞았는지 다시 검사했다. 동일 seed1800초1/60×2, 1801개1Hz 관측행·전환 표·전체 최종 주체·RNG가 두 번 완전히 같았다. 모든 tick에서 외상 HP 불변·의식 타깃 연속·통증 바닥·사망 이유 시점·순환 정지·300초 사망 등의 Q 불변 조건을 유지했다.

|시나리오|실제 교차|혈관 evidence|downed s|arrest s|dead s|
|---|---|---|---:|---:|---:|
|bare-forearm|left-radius|none/none|—|—|—|
|front-neck|cervical-spine, cervical-spinal-cord|none/none|753.267|1565.750|—|
|soft-through-body-rear|lumbar-spine, lumbar-spinal-cord|none/none|369.883|695.650|995.650|
|bare-upper-thigh|없음|none/none|—|—|—|
|arm-first-body|left-radius|none/none, none/none|—|—|—|
|forearm-radial|left-radial|confirmed/named_branch|112.200|398.183|698.183|
|thigh-femoral|left-femoral|confirmed/major_named|49.733|97.817|397.817|
|neck-carotid|left-carotid|confirmed/major_named|0.000|74.450|374.450|
|torso-liver|liver|none/none|93.767|244.133|544.133|
|thigh-lateral-muscle|없음|none/none|—|—|—|

간 사례의 vascularEvidence는 none이고 confirmed 장기+원본 solid_organ_injury다. 지시서의 ‘신규 fixture는 vascularEvidence confirmed’는 혈관을 직접 겨냥한3개에 적용했으며, 간만 교차한 사례에서 혈관 confirmed를 거짓으로 생성하지 않았다. 근육 사례는 none/none이고 혈관·뼈 없음. 혈관·골절 없는 팔뚝/대퇴/외측 근육은1800초 downed·arrest가 없었다. 대퇴/경동맥은1800초 안에 arrest. 모든 뼈 비접촉 상처는 골절 없음, 팔뚝 뼈 분류는radius_ulna. 기존 목 중앙탄은 경동맥 대신 경추·척수 프록시와 교차했으며 기존 전환 기대치를 강제로 유지하지 않았다.

각 사격의 internalHits/nearMisses/입력 대응표와 상처·실제 seed는 checks-r/actual-v2-inputs.json. 1801행 JSON/CSV와 출혈/의식 그래프는 *-v2.*. 손실15/30/40%, 의식80/50/20%, downed/unconscious/arrest/dead의 전환을 사례 JSON의 transitions와 physiology-report.json에 기록했다. 각 시나리오명.png는 몸속 표시를 켠 마지막 실제 교차 강조 화면이다.

A자/standing/aim/crouch/walk(걷기5위상) 9개 검사에서 도형 모두 실제 변환한 닫힌 소유 메쉬 안에 있었다. 원본 몸+키.9/팔다리 굵기1.15+키1.1/굵기.9는 리그·메쉬를 함께 변형한 후 같은 비율 프로파일로 재측정했다. 3몸×5상대 조준점은 같은 기대 구조를 맞았고 대퇴 외측은 혈관/뼈 없음. geometry/report.json에 치수·측정·교차·실패0 기록.

## 회귀와 렌더

- 공식 npm test **135/135**, 원본 baseline **3,641,864B / ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d** 동일.
- legacy P2 3×61행, P3 5×301행, Q legacy5×901행 완전 일치. 기존14사격×2모드 탄도/방호/바깥 피격/에너지/잔여탄 동일. legacy 상처·의료 전체 동일. 새 internalHits/nearMisses만 물리 비교에서 제외했고 변경 의료 경로 목록은 regression/browser-report.json.
- 두 모드600틱6발의 카메라/총구/방향/보행/스프링 기록 완전 동일. 원본 선언/방호 metadata·v9rig/v13skin/병사 WebP 바이트 동일. M4 비이미지 버퍼와 나머지13이미지 동일, 두 ORM은 P1 선택 바이트 동일. assets-report.json.
- exact 최종 독립 HTML, 계측 번들 없이 오프라인844×390/1280×720, 몸속 표시 on/off·legacy 저장/재시작·v2 초기화·실제 게임 시작 성공. 오류0/외부 요청0. 실제 file:// 및 S24 실기기는 미검증이다.

R5는 실제240틱 ADS 안정화·세계 렌더·렌즈0/70로 v13/최신8사진을 찍었다. 총기 영역 ROI를 사용했으며 빈 배경 전체 SSIM으로 대체하지 않았다.

|렌즈|조준|총기 ROI SSIM|최대 채널 픽셀 차이|
|---:|---|---:|---:|
|0|비조준|0.993447|35|
|0|ADS|0.993548|22|
|70|비조준|0.995492|31|
|70|ADS|0.995446|19|

모두≥.97이므로 weapon/1·4 q85 유지. 선택 바이트173,292B/14,524B. 최신 용량/해시는 릴리스 검증 JSON과 정정한 [P1 문서](training-p1-textures.md)를 따른다.

## 다운로드 검증

[GitHub v18 ZIP](https://github.com/0-FLANDRE-0/CQB-HTML/raw/9d26411c4051111473f5851cd2161874a0cdaad3/downloads/CQB-Training.zip) — 개발 브랜치 반영, 기본 브랜치 병합 없음. 비공개 저장소 로그인 필요. Actions 실행0. 기능 커밋9c21bf9, 소스 스냅샷161ebb8, ZIP 배송 커밋9d26411. HTML22,856,349B / SHA49e80532900908630c5b0a454fab0df5c774600cb4c83f519c7890d01b6d5116. ZIP34,403,904B / SHA1a97953367f8cc45d23d41c05a19d541dc506883642c731ae3764e0ac9a43f55. GitHub HTTP200 실제 재다운로드, ZIP 전체/CRC/내부107파일 모두 로컬 패키지와 바이트 일치. [영수증](../downloads/delivery-internal-bleeding-v18.json).
