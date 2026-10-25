# FPS Prototype 작업 규칙

- 작업 시작 시 `HANDOFF_KO.md`와 관련 최신 대장·설계서를 읽는다.
- 기본 개발 대상은 `apps/training/`의 3D다. `reference/2d/`는 고정 참고본이며 일반 기능 개발에서 수정하지 않는다.
- `src/generated/legacy-*`와 catalog는 3D 소유 포트다. 빌드에서 2D 재추출을 추가하지 않는다. 필요한 3D 변경은 명시적으로 적용하고 출처를 남긴다.
- 문서 값은 출처 / 원본 / 튜닝 / 사용자 설계값 / 게임 허용을 구분한다. 계산·판정·의료의 범위 밖 변경을 함께 넣지 않는다.
- 원본 모델·소리와 크레딧은 보존한다. 변경은 파생본으로 만들며 빌드 재현 입력을 유지한다.
- `npm ci`, `npm run build`, `npm test`가 기본이다. 빌드와 테스트는 같은 dist를 사용하므로 동시에 실행하지 않는다.
- `npm run verify:reference`는 2D 보존을 검사한다. `npm run verify:v69`와 `npm run test:browser`는 이관 시점 기준 비교다. 의도적 게임 변경이 생기면 차이를 보고하고 새 기준을 추가한다. 과거 기준을 자동 갱신해서 통과시키지 않는다.
- 화면 변경은 1280×720과 844×390에서 검증한다. 브라우저 검사는 `CHROMIUM_PATH`를 지정할 수 있다. 관리 환경에서 file://가 막히면 우회하지 말고 HTTP의 정확한 HTML을 오프라인 요청 차단 상태로 검증한다.
- `dist/`, `artifacts/`, `downloads/`, node_modules는 커밋하지 않는다. 새 ZIP은 Releases에 보관한다.
- GitHub Actions를 사용하지 않는다. 커밋 메시지에 `[skip ci]`를 넣고 로컬 검증 결과를 기록한다.
- 원래 CQB-HTML 저장소·브랜치와 이력은 유지한다. 새 저장소에서 과거 커밋·형제 체크아웃에 의존하는 검사나 빌드를 만들지 않는다.

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.
