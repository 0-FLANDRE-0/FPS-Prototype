# MO3 혈류 출처와 추정 대장

모든 아래 값은 **안정 혈류 또는 추정값**이다. 혈관 파열 유량을 직접 측정한 자료가 아니다. 실제 게임 상한은 `정상mL/min /60 × k6`이며 **현재 CO 총량 제한을 추가로 받는다**. k6는 검증된 인체 상수가 아닌 튜닝이다. 장면의 콜라이더 지름은 실제 혈관 내강 지름 측정이 아니다.

논문 서지의 쪽 범위와 Abstract 또는 Table3의 항목을 확인했다. PDF의 특정 표 인쇄 쪽을 확인하지 못한 자료는 범위/표 위치로 표시하며 정확한 쪽을 지어내지 않았다. 이 제한 때문에 “모든 항목의 특정 인쇄 쪽 검증 완료”로 보고하지 않는다.

## 확인한 자료

- `femoral`: [Holland et al., 1998](https://pubmed.ncbi.nlm.nih.gov/9833575/), 1079–1086, Abstract. 건강40명, common femoral284±21 mL/min. 표준오차/해석은 논문 보고 그대로이며 개인별 값이 아님.
- `popliteal`: [Holland et al., 1998](https://pubmed.ncbi.nlm.nih.gov/9833575/), 1079–1086, Abstract. 같은 연구 popliteal72±5 mL/min.
- `carotid`: [Bogren et al., 1994](https://pubmed.ncbi.nlm.nih.gov/8148554/), 37–42, Abstract. common carotid465±52 mL/min. 경동맥 게임 세그먼트에 적용. 경정맥은 이 territory의 짝정맥 추정이며 측정값이 아니다.
- `subclavian`: [Huonker et al., 2003](https://journals.physiology.org/doi/10.1152/japplphysiol.00710.2001), 685–691, Table3(표 인쇄 쪽 미확인). 비훈련 비장애30명 우측192.9±53.9, 좌측182.4±53.6 mL/min. 게임은 우측 평균을 양측에 대칭 적용하는 튜닝. 다른 열의 운동선수208.4값을 대조군으로 쓰지 않았다.
- `brachial`: [Newcomer et al., 2004](https://pmc.ncbi.nlm.nih.gov/articles/PMC1665001/), 1001–1011, Abstract. 건강 젊은 남성8명 전완 유량 baseline25/30/29 mL/min을 평균28로 썼다. 전완 측정의 상완 전체 세그먼트 대응은 튜닝 추정이며 직접 상완 정상값으로 부르지 않는다.
- `subclavianVein`: [Effect of patient position… 2003](https://jamanetwork.com/journals/jamasurgery/fullarticle/395417), 996–1000, discussion1001, flow table(표 인쇄 쪽 미확인). 앙와위 기준275(SEM50) mL/min. 측정 자세/모집단 차이를 게임 양측 쇄골하정맥에 매핑하는 것은 튜닝.
- `S1`: [기존 S1 기준 순환](medical-s1-ledger.json), 원본 코드 상수. CO5250 mL/min을 중심 대동맥 기준으로 쓴다. 복부 대정맥65%/흉부 합성 대정맥100%CO는 튜닝 추정이다.
- `B1c`: [기존 B1c 간 관류](medical-b1c-ledger.json), 원본 코드 분율. 간정맥25%/문맥20%CO. 새 환자 실측값으로 제시하지 않는다.

## k의 근거 수준

[Haemorrhage and Survival Times…](https://pmc.ncbi.nlm.nih.gov/articles/PMC9955172/), Diagnostics2023;13:732, DOI10.3390/diagnostics13040732, Case3를 확인했다. 대퇴부 총상16:45와 사망 등록17:05라는 사례 연표는 있으나, 고립된 완전 대퇴동맥 절단·무처치·측정 순환 조건의 생존 범위가 아니다. 지혈/동반 손상/사망 확인 지연 등의 불확실성을 제거할 수 없어 이20분을 k 역산에 사용하지 않았다. 이번 조사에서 쓸 수 있는 통제 완전손상 자료 범위를 확보하지 못했다.

**k6는 근거 없이 선택한 게임 튜닝**이다. 기존 심정지 후300초 지연을 유지하는 게임 사망 시간도 임상 생존값에 직접 맞출 수 없다. 게임의 대퇴 완전 손상 무처치 사망385.8→421.52초는 구현 전후 결과이며 k의 의학적 검증이 아니다.

## 추정 규칙

- 짝정맥은 해당 동맥 territory 유량을 쓰는 추정(쇄골하정맥은 별도 측정 자료).
- 액와는 쇄골하192.9×(콜라이더지름/기준10mm)². 요골/척골은 전완28×(지름/기준6mm)². 장골은 대퇴284×(지름/기준8mm)². **기준 지름과 분기 매핑은 튜닝**이다.
- 알려지지 않은 혈관은 같은 대퇴 기준 지름² 추정, 최대 원본 CO. 에너지 기반 절단 추정 출혈원도 이 규칙을 쓴다.
- 근위/원위 슬와동맥은 동일 named source를 공유한다. 자연지혈은 원래 규칙 유지.
- 간·비장·신장 실질 장기 유량×2/3는 원래 B1c이며 named vessel k와 별도다.

## 장면의 혈관별 적용값

표의 지름은 보존된 실제 피격 도형에서 가져왔다. 정상 혈류/분기 추정값과 도형의 해부학 정확도를 혼동하지 않는다. 쪽/자료 키는 위 문헌 목록과 연결된다. 좌우 대칭 적용과 짝정맥은 각각 매핑·추정 튜닝이다.

| ID | 도형 지름 mm | 기준 mL/min | k | 개별 상한 mL/s | 자료 키 | 구분 |
|---|---:|---:|---:|---:|---|---|
| left-carotid | 4.8600 | 465.0000 | 6 | 46.5000 | carotid | 출처 측정값; game common-carotid mapping |
| left-jugular | 7.0200 | 465.0000 | 6 | 46.5000 | carotid | 튜닝 추정: paired carotid territory return, not a jugular measurement |
| left-subclavian | 7.3696 | 192.9000 | 6 | 19.2900 | subclavian | 출처 측정값; population/site mapping tuning |
| left-subclavian-vein | 10.8430 | 275.0000 | 6 | 27.5000 | subclavianVein | 출처 측정값; posture/site mapping tuning |
| left-axillary | 7.1624 | 98.9565 | 6 | 9.8956 | subclavian | 튜닝 추정: fitted diameter² vs10mm subclavian reference |
| left-axillary-vein | 9.5498 | 175.9226 | 6 | 17.5923 | subclavian | 튜닝 추정: fitted diameter² vs10mm subclavian reference |
| left-brachial | 4.5654 | 28.0000 | 6 | 2.8000 | brachial | 튜닝 추정: sourced forearm baseline arithmetic mean; fitted brachial segment |
| left-brachial-vein | 5.7067 | 28.0000 | 6 | 2.8000 | brachial | 튜닝 추정: paired brachial flow |
| left-radial | 3.6941 | 10.6141 | 6 | 1.0614 | brachial | 튜닝 추정: fitted diameter² vs6mm brachial reference |
| left-ulnar | 3.6941 | 10.6141 | 6 | 1.0614 | brachial | 튜닝 추정: fitted diameter² vs6mm brachial reference |
| left-iliac | 13.8612 | 852.5847 | 6 | 85.2585 | femoral | 튜닝 추정: fitted diameter² vs8mm common-femoral reference |
| left-iliac-vein | 18.0195 | 1440.8681 | 6 | 144.0868 | femoral | 튜닝 추정: fitted diameter² vs8mm common-femoral reference |
| left-femoral | 8.2457 | 284.0000 | 6 | 28.4000 | femoral | 출처 common-femoral resting measurement |
| left-femoral-vein | 11.5056 | 284.0000 | 6 | 28.4000 | femoral | 튜닝 추정: paired femoral territory return |
| left-popliteal-proximal | 5.0638 | 72.0000 | 6 | 7.2000 | popliteal | 출처 popliteal resting measurement; proximal/distal same-vessel cap |
| left-popliteal | 3.9547 | 72.0000 | 6 | 7.2000 | popliteal | 출처 popliteal resting measurement; proximal/distal same-vessel cap |
| left-popliteal-vein | 5.6495 | 72.0000 | 6 | 7.2000 | popliteal | 튜닝 추정: paired artery resting flow |
| right-carotid | 4.8600 | 465.0000 | 6 | 46.5000 | carotid | 출처 측정값; game common-carotid mapping |
| right-jugular | 7.0200 | 465.0000 | 6 | 46.5000 | carotid | 튜닝 추정: paired carotid territory return, not a jugular measurement |
| right-subclavian | 7.3696 | 192.9000 | 6 | 19.2900 | subclavian | 출처 측정값; population/site mapping tuning |
| right-subclavian-vein | 10.8430 | 275.0000 | 6 | 27.5000 | subclavianVein | 출처 측정값; posture/site mapping tuning |
| right-axillary | 7.1895 | 99.7083 | 6 | 9.9708 | subclavian | 튜닝 추정: fitted diameter² vs10mm subclavian reference |
| right-axillary-vein | 8.1872 | 129.3007 | 6 | 12.9301 | subclavian | 튜닝 추정: fitted diameter² vs10mm subclavian reference |
| right-brachial | 4.5761 | 28.0000 | 6 | 2.8000 | brachial | 튜닝 추정: sourced forearm baseline arithmetic mean; fitted brachial segment |
| right-brachial-vein | 5.7201 | 28.0000 | 6 | 2.8000 | brachial | 튜닝 추정: paired brachial flow |
| right-radial | 4.2060 | 13.7591 | 6 | 1.3759 | brachial | 튜닝 추정: fitted diameter² vs6mm brachial reference |
| right-ulnar | 4.2060 | 13.7591 | 6 | 1.3759 | brachial | 튜닝 추정: fitted diameter² vs6mm brachial reference |
| right-iliac | 13.8612 | 852.5847 | 6 | 85.2585 | femoral | 튜닝 추정: fitted diameter² vs8mm common-femoral reference |
| right-iliac-vein | 18.0195 | 1440.8681 | 6 | 144.0868 | femoral | 튜닝 추정: fitted diameter² vs8mm common-femoral reference |
| right-femoral | 8.3285 | 284.0000 | 6 | 28.4000 | femoral | 출처 common-femoral resting measurement |
| right-femoral-vein | 11.6211 | 284.0000 | 6 | 28.4000 | femoral | 튜닝 추정: paired femoral territory return |
| right-popliteal-proximal | 4.5125 | 72.0000 | 6 | 7.2000 | popliteal | 출처 popliteal resting measurement; proximal/distal same-vessel cap |
| right-popliteal | 4.1391 | 72.0000 | 6 | 7.2000 | popliteal | 출처 popliteal resting measurement; proximal/distal same-vessel cap |
| right-popliteal-vein | 5.9129 | 72.0000 | 6 | 7.2000 | popliteal | 튜닝 추정: paired artery resting flow |
| thoracic-aorta | 20.6321 | 5250.0000 | 6 | 525.0000 | S1 | 원본 S1 resting cardiac output; central aortic segment |
| abdominal-aorta | 15.7500 | 5250.0000 | 6 | 525.0000 | S1 | 원본 S1 resting cardiac output; central aortic segment |
| thoracic-vena-cava | 20.6221 | 5250.0000 | 6 | 525.0000 | S1 | 튜닝 추정: fitted central return; abdominal65%CO / thoracic merged return100%CO |
| abdominal-vena-cava | 18.9000 | 3412.5000 | 6 | 341.2500 | S1 | 튜닝 추정: fitted central return; abdominal65%CO / thoracic merged return100%CO |
| hepatic-vein-trunk | 9.4500 | 1312.5000 | 6 | 131.2500 | B1c | 원본 B1c territory fractions, not new patient-specific measurements |
| portal-vein | 9.4500 | 1050.0000 | 6 | 105.0000 | B1c | 원본 B1c territory fractions, not new patient-specific measurements |
