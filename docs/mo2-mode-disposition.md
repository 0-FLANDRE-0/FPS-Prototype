# MO2: 옛 모드 값 처분표

기준 `01eb585`. 원문·원시 객체는 [고정 정책 스냅샷](mo2-old-policy.json), 경로별 값은 [JSON 표](mo2-mode-disposition.json). 과거 모드를 실행 중 선택하는 코드·설정은 남기지 않았다. 임시 고정은 해당 제품의 후속 단계에서 다시 작성한다.

모드 이름이 있는 역사 문서와 이 표는 보존하며, 잔존 0 검사는 활성 앱·빌드 분기를 대상으로 한다. 기존 M4c의 리얼리스틱 **기본값**을 고정하고 부상/손 시간 배율은 모든 처치·장비 작업에서 폐기했다. 미처치 수식과 약물·수혈 효과식은 보존한다.

| 경로 | 이전 값(모드 순서 명시) | MO2 값/처분 | 분류 |
|---|---|---|---|
| M4_VALUES.defaultMode | realistic | 설정/UI/저장 모두 폐기 | 삭제 |
| M4_VALUES.sealSeconds | 25 | 6 | 임시 고정 |
| M4_VALUES.needleSeconds | 12 | 8 | 임시 고정 |
| M4_VALUES.txaSeconds | 20 | 8 | 임시 고정 |
| M4_VALUES.foamSeconds | 30 | 7 | 새 규칙 |
| M4_VALUES.backSealMultiplier | 1.8 | 1.8 | 임시 고정 |
| M4_VALUES.needleRadius | 0.065 | 0.065 | 임시 고정 |
| M4_VALUES.needleDrainPerS | 0.35 | 0.35 | 임시 고정 |
| M4_VALUES.ventDrainPerS | 0.015 | 0.015 | 임시 고정 |
| M4_VALUES.needleRecurrenceChance | 0.35 | 폐기; 기존 리얼리스틱에는 재발 없음 | 삭제 |
| M4_VALUES.needleRecurrenceMinS | 90 | 폐기 | 삭제 |
| M4_VALUES.needleRecurrenceMaxS | 300 | 폐기 | 삭제 |
| M4_VALUES.needleReachFailure | {"anterior":0.08,"lateral":0.02} | 폐기; 기존 리얼리스틱의 고정 성공 조건 | 삭제 |
| M4_VALUES.iatrogenicPneumo | 0.12 | 리얼리스틱 false; 새 경로에서 생성 안 함 | 임시 고정 |
| M4_VALUES.foamPain | 40 | 폐기: 범용 상처별 제품 | 새 규칙 |
| M4_VALUES.txaWindowS | 10800 | 10800 | 임시 고정 |
| CARE.catSeconds | {"arm":28,"leg":37.5} | 팔·다리5초 | 새 규칙 |
| CARE.oneHandMultiplier | 1.65 | 1; 부상·통증·떨림·관류·의식·손 기능 배율 전부 삭제 | 삭제 |
| CARE.bandageSeconds | 30 | 4초 | 새 규칙 |
| CARE.gauzePackingSeconds | 30 | 통합6초 | 새 규칙 |
| CARE.gauzePressureSeconds | 180 | 없음 | 새 규칙 |
| CARE.resumeSetupSeconds | 1.5 | 현대 제품: 처음부터 / 임시 제품: 남은 고정 시간 | 새 규칙 |
| CARE.aboveWoundM | 0.065 | 위치·원위부/두 번째 지혈대 검사 폐기 | 삭제 |
| CARE.catResidual | 5e-05 | 0 | 새 규칙 |
| CARE.looseArteryGain | 0.35 | 느슨한 지혈대 폐기 | 삭제 |
| CARE.looseVeinFactor | 0.15 | 느슨한 지혈대 폐기 | 삭제 |
| CARE.catPain | 70 | 5→55/180초, 제거 후30초 감소 | 새 규칙 |
| CARE.bandage | {"artery":0.8,"vein":0.15,"capillary":0.1} | 원래 계수 대신 상처당20mL/s 용량 | 새 규칙 |
| CARE.gauze | {"artery":0.03,"vein":0.05,"capillary":0.1} | 출혈원 면적에 따른 연속 내구도/완료0 | 새 규칙 |
| CARE.manualPressure | {"artery":0.15,"vein":0.15,"capillary":0.15} | 수동 압박 단계 폐기 | 삭제 |
| CARE.interruptedGauzeGain | 0.25 | 취소 시 진행/효과 없음 | 새 규칙 |
| M4B.backSealRealityMultiplier | 3 | 1.8 | 임시 고정 |
| M4B.walkRebleedGain | 1.0390625 | 결정론 샘·재출혈 위험률로 대체 | 삭제/새 규칙 |
| M4B.sprintRebleedGain | 0.015625 | 결정론 샘·재출혈 위험률로 대체 | 삭제/새 규칙 |
| M4B.profile.drugGain | {"game":1.1,"realistic":1,"reality":0.9} | 1 | 임시 고정 |
| M4B.profile.pillOnset | {"game":10,"realistic":60,"reality":180} | 60 | 임시 고정 |
| M4B.profile.otfcOnset | {"game":5,"realistic":30,"reality":120} | 30 | 임시 고정 |
| M4B.profile.ketamineOnset | {"game":3,"realistic":15,"reality":60} | 15 | 임시 고정 |
| M4B.profile.dissolveS | {"game":60,"realistic":240,"reality":480} | 240 | 임시 고정 |
| M4B.profile.connectS | {"game":5,"realistic":20,"reality":60} | 20 | 임시 고정 |
| M4B.profile.infuseS | {"game":60,"realistic":180,"reality":480} | 180 | 임시 고정 |
| M4B.profile.pillS | {"game":36000,"realistic":28800,"reality":28800} | 28800 | 임시 고정 |
| M4B.profile.otfcS | {"game":9000,"realistic":7200,"reality":7200} | 7200 | 임시 고정 |
| M4B.profile.ketamineS | {"game":2400,"realistic":1800,"reality":1800} | 1800 | 임시 고정 |
| M4B.application.pill | {"game":2,"realistic":4,"reality":6} | 4 | 임시 고정 |
| M4B.application.otfc | {"game":1,"realistic":2,"reality":3} | 2 | 임시 고정 |
| M4B.application.ketamine | {"game":2,"realistic":5,"reality":10} | 5 | 임시 고정 |
| M4C.caps | {"game":{"injury":1.2,"total":1.5},"realistic":{"injury":1.5,"total":2.2}} | 모든 부상/한 손 시간 배율 폐기 | 삭제 |
| M4C.profiles.catSeconds | {"game":{"leg":3,"arm":2.5},"realistic":{"leg":10,"arm":8}} | 팔·다리 모두5초 | 새 규칙 |
| M4C.profiles.bandageSeconds | {"game":3,"realistic":8} | 4초 | 새 규칙 |
| M4C.profiles.gauzePackingSeconds | {"game":3,"realistic":8} | 채우기·압박 분리 없이6초 | 새 규칙 |
| M4C.profiles.gauzePressureSeconds | {"game":4,"realistic":20} | 삭제 | 새 규칙 |
| M4C.profiles.sealSeconds | {"game":2,"realistic":6} | 6초 | 임시 고정 |
| M4C.profiles.needleSeconds | {"game":2,"realistic":8} | 8초 | 임시 고정 |
| M4C.profiles.txaSeconds | {"game":2,"realistic":8} | 8초 | 임시 고정 |
| M4C.profiles.foamSeconds | {"game":3,"realistic":12} | 7초 | 새 규칙 |
| M4C.oneHandPressureEfficacy | 0.98 | 폐기; 손 개수로 효과를 바꾸지 않음 | 삭제 |
| EQUIPMENT.backpackSeconds | {"game":1,"realistic":2,"reality":3.5} | 2 | 임시 고정 |
| EQUIPMENT.gearSeconds | {"game":0.6,"realistic":1.2,"reality":2} | 1.2 | 임시 고정 |
| PLATE_ACTION_SECONDS.worn | {"game":1.5,"realistic":5,"reality":10} | 5 | 임시 고정 |
| PLATE_ACTION_SECONDS.off | {"game":1,"realistic":3,"reality":5} | 3 | 임시 고정 |
| SEARCH_SECONDS | {"game":1,"realistic":3,"reality":5} | 3 | 임시 고정 |
| productCount.bandage | {"game":3,"realistic":2,"reality":1} | 2회(이전 표는 MO1에서100내구도로 우회됨) | 새 규칙 |
| productCount.gauze | {"game":3,"realistic":2,"reality":1} | 내구도100 | 새 규칙 |
| productCount.needle | {"game":3,"realistic":2,"reality":1} | 2회 | 임시 고정 |
| productCount.seal | {"game":4,"realistic":2,"reality":2} | 2회 | 임시 고정 |
| SYSTEMIC_CARE.txaDelay | {"game":5,"realistic":30,"reality":600} | 30 | 임시 고정 |
| SYSTEMIC_CARE.txa | {"game":0.5,"realistic":0.75,"reality":0.95} | 0.75 | 임시 고정 |
| SYSTEMIC_CARE.txaArtery | {"game":0.9,"realistic":1,"reality":1} | 1 | 임시 고정 |
| SYSTEMIC_CARE.foamDelay | {"game":3,"realistic":15,"reality":30} | 폐기: 상처별 폼 진행으로 교체 | 삭제/새 규칙 |
| SYSTEMIC_CARE.foam | {"game":0,"realistic":0.0365869140625,"reality":0.9} | 폐기: 상처별 폼 진행으로 교체 | 삭제/새 규칙 |
| SYSTEMIC_CARE.foamArtery | {"game":0.5,"realistic":0.8,"reality":1} | 폐기: 상처별 폼 진행으로 교체 | 삭제/새 규칙 |
| durationScale | {"game":"1/6","realistic":".4","reality":1} | 단일 고정 시간만 참조 | 삭제 |
| careProfile bandage | {"game":{"artery":0.3,"vein":0,"capillary":0},"realistic":{"artery":0.5,"vein":0.02,"capillary":0.01},"reality":{"artery":0.8,"vein":0.15,"capillary":0.1}} | MO1내구도와 기존 계수 모두 폐기. 상처당20mL/s | 새 규칙 |
| careProfile gauze | {"game":0,"realistic":5e-05,"reality":{"artery":0.03,"vein":0.05,"capillary":0.1}} | 완료0 / 부족시 남은 작업비율 | 새 규칙 |
| careProfile CAT | {"game":0,"realistic":5e-05,"reality":5e-05} | 완료0, 각 사지1개, 신규 상처 포함 | 새 규칙 |
| unaffected profiles | {"bloodMovement":[1,0.85,0.5],"ventPneumoPerS":0.006,"valveChance":0.1,"valveThreshold":0.24,"valveRisePerS":0.01,"analgesia":{"pill":25,"otfc":60,"ketamine":75},"effects":{"otfcDrowsy":7,"otfcRespiration":0.04,"shockAmplification":1.5,"ketamineDrowsy":5,"ketamineSympathetic":0.08,"ketamineDoubleCssPx":4,"ketamineDizzyCssPx":2,"ketamineColor":0.12,"ketamineAudioRate":0.92}} | 원본 값·식 유지; 모드 참조 없음 | 원본 유지 |
| untouched product fallback | {"cat":1,"txa":1,"foam":1,"pill":1,"otfc":1,"ketamine":1,"blood":1,"npa":1} | cat1/주입기160/폼300/기타1; NPA 플레이 사용은 후속 그대로 | 새 규칙/임시 고정 |

MO1 붕대의 실제 4초/100점과 작업량(상한 전 물리 손상량·면적 기반)은 MO2의 4초/2회/유량 한계로 교체했다. 이전 모드 붕대 계수표는 MO1에선 활성 붕대에 사용되지 않았다. 기존 NPA는 물품을 남기고 사용 불가 상태를 유지한다. 씰·바늘·흉부 악화 계산은 이번에 제거하지 않았다.
