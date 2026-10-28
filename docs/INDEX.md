# 문서 안내

- 현재 시작점: [루트 인계서](../HANDOFF_KO.md)
- 진행 중인 의료 개편: [MO4 심장·감염·동맥/폐 보정](mo4-heart-infection.md), [대장](mo4-ledger.json), [출처/튜닝](mo4-sources.md), [혈관·심장표](mo4-tables.md) — feature/medical-overhaul, 전체 완료판 아님
- 의료 개편 범위: [확정 규칙과 구현 순서](medical-overhaul-contract.md)
- 독립 개발과 검증: [README](../README.md), [이관 기록](migration-v69/README.md)
- 최신 기능: [W1/v69 SCAR-H](training-w1-v69.md), [수치 대장](w1-ledger.json), [출처](w1-sources.json)
- 역사: [CQB-HTML 인계서 보존본](history/CQB-HTML-HANDOFF-v69.md), [이전 앱 안내](history/training-readme-v69.md)

기존 설계·대장 문서는 내용과 수치의 유래를 보존했다. 문서에 나오는 버전 번호·옛 명령·`downloads/` 링크는 당시 상태이며 현재 실행 안내는 루트 README를 따른다. 역사 원자료는 [CQB-HTML의 이관 기준 커밋](https://github.com/0-FLANDRE-0/CQB-HTML/tree/e46c309c9181f9093efd91798f569074047ad40a/downloads)에 남아 있다. 새 저장소에는 현재 검증에 필요한 입력·골든 값만 `tests/fixtures/`로 이관했다.


- 의료 개편 치료1: [붕대·회복](medical-overhaul-bandage-1.md), [실측·정책 대장](medical-overhaul-bandage-ledger.json). 작업 브랜치 feature/medical-overhaul, 전체 개편 완료판 아님.

- 의료 개편 이전 MO2: [지혈·회복](mo2-hemostasis.md), [수치 대장](mo2-ledger.json), [모드 처분표](mo2-mode-disposition.md). 당시 정책 기록이다.

- 의료 개편 이전 MO2b: [기준 유량·내구도·확률](mo2b-reference-flow.md), [대장](mo2b-ledger.json).
- 의료 개편 이전 MO3: [단일 출혈·폐 정리](mo3-unified-bleeding.md), [대장](mo3-ledger.json). MO4의 직접 비교 기준이다.
