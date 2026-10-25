# 고정 2D 참고본

`0-FLANDRE-0/CQB-HTML`의 커밋 `e46c309c9181f9093efd91798f569074047ad40a`에서 가져왔다. 원본 상대 경로를 보존한 `src/`, `CQB_Tactical.html`, `reference/`와 당시 README를 포함한다. 3D 기본 빌드의 입력이 아니다.

원본 HTML: 3,641,864 bytes, SHA-256 `ff330c641f9720e3a960adfd84ee084ea06f215366e88e7f03e14803a176f90d`.

루트에서 `npm run verify:reference`로 원본 조립 결과를 비교한다. 참고용 조립·개발 서버 도구는 `tools/`에 있다. 자동 추출 스크립트는 새 3D 파일을 덮어쓸 수 있으므로 명시적 `--allow-reference-import` 없이 실행되지 않는다. 일반 개발에서는 3D 소유 포트를 직접 관리한다.
