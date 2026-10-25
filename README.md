# FPS Prototype

CQB Training의 독립 3D 개발 저장소입니다. `0-FLANDRE-0/CQB-HTML`의 **v69**를 동작 변경 없이 이관했습니다. 앞으로 3D 기능·데이터·자산은 이 저장소에서 관리합니다.

- [실행판 다운로드](https://github.com/0-FLANDRE-0/FPS-Prototype/releases/tag/v69-migration)
- [작업 인계서](HANDOFF_KO.md) · [이관 기록과 검증](docs/migration-v69/README.md) · [문서 안내](docs/INDEX.md)

## 실행

Node.js 22 이상, npm, Git, Python 3를 사용합니다. Python은 표준 라이브러리만 필요합니다.

```sh
npm ci
npm run build
npm run dev
```

`http://127.0.0.1:5174`를 엽니다. `npm run dev`는 시작 시 빌드하며, 코드 수정 뒤에는 `npm run build` 후 새로고침합니다. 휴대폰에서 같은 네트워크의 개발 PC로 접속할 때는 `CQB_TRAINING_HOST=0.0.0.0 npm run dev`를 사용합니다.

빌드는 `dist/CQB_Training.html` 한 파일에 모델·텍스처·오디오·Three.js·Rapier/WASM을 내장합니다. 실행 시 외부 다운로드가 필요 없습니다. HTML은 약 39.4 MB이며 배포 ZIP은 20 MB 미만입니다. 실제 휴대폰의 파일 앱에서는 브라우저 또는 HTTP 서버로 열어야 할 수 있습니다.

## 코드와 참고 자료

| 경로 | 역할 |
| --- | --- |
| `apps/training/src/` | 독립 3D 코드. 진입점 `main.js` |
| `apps/training/src/generated/` | 기존 2D에서 가져온 3D 소유 코드·레지스트리와 3D 자산 생성물 |
| `apps/training/assets/` | 원본 모델·애니메이션·소리, 출처·라이선스, 빌드 입력 |
| `reference/2d/` | v69 당시 2D 소스·HTML 고정 참고본 |
| `tests/fixtures/` | 재현에 필요한 고정 입력과 v69 회귀 기준값 |
| `docs/` | 출처·수치 대장, 설계·검증 기록 |
| `dist/`, `artifacts/` | 로컬 생성물. Git 추적 제외 |

`legacy-*`라는 파일명은 유래를 표시합니다. 3D 빌드는 2D를 읽거나 다시 추출하지 않습니다. 이 파일의 현재 값은 3D에서 독립적으로 관리합니다. 2D는 변경하지 않으며 비교 도구의 명시적인 `--allow-reference-import` 없이는 재추출할 수 없습니다.

모델·음원별 권리와 변경 내역은 `apps/training/assets/*credits.json` 및 소리 출처 파일을 따릅니다. 보존한 원본에 새 라이선스를 일괄 부여하지 않습니다.

## 검증과 배포

빌드와 테스트는 순서대로 실행합니다. 같은 `dist/`를 사용하는 작업을 동시에 실행하지 않습니다.

```sh
npm run build
npm test
npm run verify:reference
npm run verify:v69
npm run test:browser
npm run package
```

v69 이관 기준은 전체 테스트 487개, S0 240조건·단일 피격 28개·684채널·젤 5종, M4/AK 각각 600틱·6발과 두 화면 오프라인 실행입니다. `verify:v69`는 이관 시점의 HTML까지 엄격히 비교하므로, 향후 의도적인 3D 변경에서는 차이를 검토하고 별도 버전 기준을 추가합니다. 이관 기준값은 덮어쓰지 않습니다.

브라우저 검사에는 Chromium이 필요합니다. 기본 실행 경로는 `/usr/bin/chromium`이며 다른 위치는 `CHROMIUM_PATH`로 지정합니다.

GitHub Actions 없이 로컬에서 검증하고 배포 ZIP을 GitHub Releases에 올립니다. 과거 대용량 ZIP·캡처 전체와 이전 Git 이력은 [원래 저장소](https://github.com/0-FLANDRE-0/CQB-HTML/tree/e46c309c9181f9093efd91798f569074047ad40a)에 보존합니다.

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.
