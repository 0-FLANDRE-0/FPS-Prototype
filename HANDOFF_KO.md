# FPS Prototype 인계서

현재 작업 저장소는 **0-FLANDRE-0/FPS-Prototype**, 기본 브랜치는 **main**이다. CQB-HTML v69에서 독립 이관했다. 이후 3D 개발은 여기서 계속한다.

- [최신 이관 실행판](https://github.com/0-FLANDRE-0/FPS-Prototype/releases/tag/v69-migration)
- [설치·실행·검증](README.md)
- [이관 범위·검증 결과](docs/migration-v69/README.md)
- [v69 SCAR-H·7.62 변경과 알려진 한계](docs/training-w1-v69.md)
- [기존 전체 인계서 보존본](docs/history/CQB-HTML-HANDOFF-v69.md)

3D 코드는 `apps/training/`, 2D 참고본은 `reference/2d/`에 있다. 2D와 연결된 자동 추출을 기본 빌드에서 제거했다. 기존 레지스트리·legacy 함수는 독립 3D 소유 포트로 유지한다. 파일 이름만으로 2D에서 다시 생성하지 않는다. 이번 이관에서 게임 수식·데이터·화면은 변경하지 않았다.

시작 명령은 `npm ci` → `npm run build` → `npm test`다. 기본 실행은 `npm run dev`로 5174 포트다. 독립 빌드·전체 HTML 바이트 일치·수치 및 브라우저 기준 비교를 이관 기록에서 확인한다. 장기간 개발 후 v69와 달라진 부분은 의도적 변경과 오류를 구분해 새 버전 대장에 기록한다.

과거 배포 ZIP과 대량 캡처는 새 Git에 복제하지 않았다. 역사 문서의 `downloads/` 링크는 당시 CQB-HTML 경로이며, [원본 고정 커밋](https://github.com/0-FLANDRE-0/CQB-HTML/tree/e46c309c9181f9093efd91798f569074047ad40a/downloads)에서 확인한다. 새 결과는 로컬 `artifacts/`와 GitHub Releases를 사용한다. 모든 과거 버전 보고 도구를 이관한 것은 아니며, 현재 빌드·전체 테스트·v69 이관 검사에 필요한 도구와 입력을 옮겼다.

실제 폰 하드웨어 성능은 미측정이다. 알려진 v69 동작·수치 한계는 그대로 이어받았다. 이관만으로 한계가 해결된 것으로 보고하지 않는다. Actions는 사용하지 않는다.

## 진행 중인 의료 개편

작업 브랜치는 `feature/medical-overhaul`이다. 기준은 `31277925afa25a01a2781544ff2472551f29049c`의 v69 이관판이며, [의료 개편 확정 규칙과 구현 순서](docs/medical-overhaul-contract.md)를 따른다.

현재 단계는 **MO3 혈관 상한·상처당 단일 출혈·폐 스태미나**다. [동작과 검증](docs/mo3-unified-bleeding.md), [대장](docs/mo3-ledger.json), [출처/추정표](docs/mo3-sources.md), [지시서](docs/mo3-instructions.md)를 먼저 읽는다. 기준 `d349025`의 MO2b를 이어갔다. 옛 MO2/MO2b 문서·골든은 당시 상태로 보존했다.

이름 붙은 혈관 상한은 정상 혈류×k6다. k6는 임상 완전 절단 생존 범위에 검증되지 않은 게임 튜닝이다. 원래 개구 유량 식·현재 CO 제한·장기2/3 상한·자연지혈을 유지한다. 상처 생성 시 MAP93·CO5250의 Qref총량을 고정하고 경계20mL/s를 유지한다.

상처당 출혈량 하나다. 출혈원은 실제 해부학 부위 상처에 연결하고, 같은 사격의 그 부위 상처가 없으면 피부 개구/추가 HP 없는 `medical.bleedingWounds` 연계 손상으로 표시·처치한다. 겉/사지 구획/체강 목적지와 혈액 저류·압박·충만을 없앴다. 기존 externalBleedRate는 단일 총량 호환 별칭, internal은0이다. 혈액 차감은 한 번이다. 붕대는 min(1,20/Qref총), 거즈·주입기·폼은 모든 부위에 적용한다. CAT는 해당 사지 소속의 전 출혈을 멈춘다. MO2b 시간·자원·회복·움직임 확률은 유지한다. 옛 성분별 작업점의 합만 자원 비용으로 보존했다.

폐 전용 호흡·산소·기흉·혈흉·판막·의인성·재발과 씰/바늘/NPA를 삭제했다. IFAK는 빠진 칸을 비워 둔다. 좌우 폐 d를 raw S1 severity에서 읽어 legMax에 1−.25(d좌+d우)를 적용하고, 회복량도 기존 legMax 비례로 한 번만 감소한다. HP 회복은 폐 d를 지우지 않는다. 목 기도·뇌간·척수A·OTFC 호흡 억제는 유지한다.

검증: 전체488/488, 고정2D 보존136파일, 탄도/원시 손상·즉시HP 240+28조건 보존,684채널·젤5종 v69 동일. 미처치 출혈/폐 후속 수치는 의도적 변경이며 v69 골든을 덮어쓰지 않고 MO3 기준을 추가했다. M4/AK600틱 운동학과 건강 의료 수치, 두 화면 실제 처치/연계 손상·폐 HUD·오프라인 실행을 대장에 기록한다. 빌드·테스트는 순서대로 실행하고 현재 검사는 MO3 문서 명령을 쓴다.

다음은 MO4 심장/감염, MO5 약물/TXA/수혈 재작성 등 별도 지시 범위다. 일반 치료는 혈액·골절·절단·장기·확정 사망을 복구하지 않는다. 전체 개편은 `complete:false`, main 병합·전체 완료판 배포·Actions는 하지 않는다.

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.

