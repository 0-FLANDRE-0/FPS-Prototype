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

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.
