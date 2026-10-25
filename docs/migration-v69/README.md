# v69 독립 저장소 이관

CQB-HTML의 3D를 FPS-Prototype으로 분리했다. 2D는 고정 참고본이며 이후 3D 코드·수치·자산은 새 저장소가 소유한다. 게임 동작 변경은 이번 범위에 포함하지 않는다.

| 항목 | 기준 |
| --- | --- |
| 원래 저장소 | `0-FLANDRE-0/CQB-HTML` |
| 원래 브랜치 | `codex/mobile-3d-training-prototype` |
| 이관 기준 HEAD | `e46c309c9181f9093efd91798f569074047ad40a` |
| v69 최종 런타임 소스 | `e115f2c19ba68fa68ca92c0b9126f2d61a1713f4` |
| 새 저장소 / 브랜치 | `0-FLANDRE-0/FPS-Prototype` / `main` |
| 3D HTML | 39,405,309 B, SHA-256 `2a40d16d9dabd6c92498533308e5bb9c0d922b8c77cc980bd86ca5a13a7e7dfc` |
| 2D HTML | 3,641,864 B, SHA-256 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d` |

`file-inventory.json`는 이관 입력 637개(168,015,139 B)의 원래 경로·목적 경로·SHA를 기록한다. 그 뒤 경로 수정한 검사·빌드 도구와 새 문서는 별도 이관 변경이다. 3D 코드·자산·고정 2D 내용은 `preserved-files.json`의 294개 파일로 원본 바이트 보존을 검사한다. 앱의 오래된 README는 `docs/history/training-readme-v69.md`로 보관하고 새 안내로 교체했다.

## 옮긴 것과 남긴 것

- `apps/training/`의 소스·원본 자산·출처와 라이선스. 첫 이관에서는 런타임 경로를 유지했다.
- 원래 `src/`, `CQB_Tactical.html`, `reference/`를 `reference/2d/` 아래에 원래 상대 구조로 보관했다.
- 전체 단위 테스트와 필요한 모델·캡처 입력·옛 코드 비교용 두 소스 파일을 `tests/fixtures/`에 보관했다. 옛 Git 커밋을 실행 중 읽던 검사는 고정 파일을 읽는다.
- 3D 빌드·자산 생성·전체 테스트·새 이관 검사의 도구를 옮겼다. 모든 역사 버전별 보고 도구를 옮기지는 않았다.
- 설계서·대장·출처 문서와 이전 인계서를 보존했다. 과거 문서의 다운로드 링크는 원래 저장소 기준이다.
- 과거 Git 이력과 약 2.6 GB의 추적된 배포·검사 출력은 복제하지 않았다. 원래 저장소는 변경하지 않는다. 새 ZIP은 Git 추적 없이 Releases에 올린다.

## 연결을 끊은 부분

기본 `npm run build`는 3D만 빌드한다. catalog와 legacy-ballistics/flight/protection/medical을 2D에서 매번 재추출하던 단계는 제거했다. 이 파일들은 같은 내용의 독립 3D 포트가 됐다. 빌드 정보의 과거 출처 메타데이터는 `apps/training/data/ported-v69.json`에 고정했다. 3D 자산·영점·튜닝 생성은 기존 파이프라인을 쓴다.

2D 추출 도구는 비교 검사용으로 보존했고 덮어쓰기는 명시적 `--allow-reference-import`를 요구한다. 새 검사·출력 경로는 `artifacts/qa/`다. 형제 체크아웃, 원래 저장소의 Git 이력, 원래 다운로드 폴더가 현재 실행에 필요하지 않다.

## 이관 검사

실측 최종 결과는 [검증 결과](verification.json)와 Releases의 검사 ZIP에서 확인한다.

**전 항목 통과.** 실행 ZIP은 약 18.3 MB로 20 MB 미만이다. [ZIP 크기·SHA](downloads.json) · [실행판과 검사 ZIP](https://github.com/0-FLANDRE-0/FPS-Prototype/releases/tag/v69-migration).

| 검사 | 비교 내용 |
| --- | --- |
| 전체 테스트 | 기존 487개를 유지하고 경로·고정 입력 위치만 수정 |
| 원본 보존 | 294개 파일 SHA, 2D 조립 결과 전체 바이트 |
| 3D 동등성 | 전체 HTML SHA, S0 240조건, 단일 피격 28개, 684채널, 젤 5종 |
| 독립 빌드 | `reference/2d`와 기존 `dist`를 제거한 상태에서 정상 빌드, 전체 HTML 동일 |
| 브라우저 회귀 | M4/AK 각각 600틱·6발의 시점·총구·탄 방향·반동·의료 동일 |
| 실제 HTML | 1280×720 PC와 844×390 터치, 외부 요청 차단·오프라인, 패널 접근·SCAR 선택·적 1명 투입·메뉴 동결·재개·설정 저장/초기화 |

684채널은 **v69 자체**를 기준으로 모두 일치해야 한다. v68→v69에서 의도적으로 변경한 7.62 42채널도 이번에는 변경 대상이 아니다. 골든 값은 원래 v69 체크아웃에서 직접 생성하고 출처 HEAD를 기록했다. 계산 결과를 반올림하지 않은 JSON의 SHA를 비교한다.

Chromium 소프트웨어 렌더 환경의 자동 검사이며 실제 폰 하드웨어 성능 측정은 아니다. 관리 환경이 `file://`를 차단하므로 정확한 단일 HTML을 HTTP 라우트로 제공하고 브라우저 오프라인 상태에서 외부 요청이 없는지 확인한다. v69의 수치·모델·물리 한계는 기존 문서대로 유지한다. legacy 코드의 기존 중복 키 빌드 경고도 변경하지 않았다.

## 재현

```sh
npm ci
npm run build
npm test
npm run verify:reference
npm run verify:preserved
npm run verify:v69
node scripts/verify-independent-build.mjs
npm run test:browser
npm run package
```

빌드·테스트·브라우저는 메모리와 dist를 공유하므로 순서대로 실행한다. `verify-independent-build.mjs`는 참고본과 빌드 캐시를 임시 이동하며 실패해도 복구한다. 기준을 검증하는 실행에는 원래 저장소·네트워크가 필요 없다. `verify-v69 --record`는 최초 이관용이며 명시적 별도 원본 체크아웃 없이 실행할 수 없다. 이후 버전의 결과 차이는 새 대장으로 기록하고 v69 골든을 덮어쓰지 않는다.

분류: 이번 변경은 **저장소·빌드·검증 구조 변경**이다. 새 물리·의료 값이나 튜닝은 추가하지 않았다. 원본·출처·튜닝·사용자 설계값·게임 허용의 기존 분류는 각 대장을 유지한다.

## 이번 배포의 다운로드 경로

Releases 파일 업로드 주소(`uploads.github.com`)에서 HTTP 401이 발생했다. 이번 이관판의 실행·검사 ZIP과 SHA 파일은 별도 `builds/v69-migration` 브랜치에만 보관하고, Releases 본문에서 고정 커밋 다운로드 링크로 연결한다. `main`에는 실행·검사 ZIP을 추적하지 않는다. 이후 업로드 인증이 가능한 환경에서는 Releases 첨부 방식을 사용한다.
