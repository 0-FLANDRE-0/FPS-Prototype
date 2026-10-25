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

치료 1의 제품 코드를 구현했다. [동작·선택한 기본안](docs/medical-overhaul-bandage-1.md)과 [정책·실측 대장](docs/medical-overhaul-bandage-ledger.json)을 먼저 읽는다. 붕대 한 종류는 4초 고정, 내구도 100점(모두 게임 튜닝), 완료 시 필요한 자원만 소비하고 선택 상처를 부분 겉 지혈한다. 취소 시 자원/효과가 없고 재시작은 처음부터4초다. 완료 후 부위 HP는 점진적으로 현재 최대치까지 회복한다. 일반 처치로 최대 HP를 줄이거나 별도 현장 회복 상한을 두지 않는다.

최종 전체499/499, 미처치 v69 S0 240·단일28·684채널·젤5종과 M4/AK 각각600틱이 동일하다. 원본2D 보존과1280×720/844×390 실제 HTML 오프라인 검사, 두 화면의 실제 피격→native 클릭/터치 사용·취소·부분 지혈·계속 치료·회복을 확인했다. 빌드 정보의 medicalOverhaul.complete는false다. main 병합이나 완료판 배포는 하지 않았다.

다음은 계약의 치료2(지혈대)다. 다른 의료품·모드 전환·장기 후속 효과·흉부/다운 판정은 기존 경로를 유지한다. 붕대는 확인된 겉 유출만 제어하고 체강/사지 내부 유출을 치료하지 않는다. HP가 차도 기존 구조/골절/절단/장기 제한과 혈액 손실은 남는다. 같은 부위 새 피격은 회복을 중단시키며 새 상처를 다시 처치해야 한다. HP0/절단 복구·수술은 후속이다.

장기별 후속 계획은 계약 그대로 간=과다출혈 위협, 장·위 등 복부 장기=감염 위험, 폐=스태미나 불이익, 심장=급소 단순화다. 아직 구현하지 않았다. 항생제도 후보이며 확정 제품으로 취급하지 않는다. 생성된 세부 로그·8개 화면 캡처는 artifacts/qa/medical-overhaul-1에 있고, 위 대장은 수치와 재현 명령을 보관한다.

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.

