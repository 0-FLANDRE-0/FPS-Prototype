"""Package locally verified MO4 intermediate preview; no completed-overhaul release."""
import json,hashlib
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
qa=root/'artifacts/qa/mo4'
ledger=json.loads((root/'docs/mo4-ledger.json').read_text())
assert ledger['stage']=='MO4' and ledger['complete'] is False
assert ledger['verification']['tests']['failed']==0
assert ledger['verification']['offline']['passed']
assert ledger['build']['sha256']==hashlib.sha256((root/'dist/CQB_Training.html').read_bytes()).hexdigest()
out=root/'artifacts/FPS-Prototype-MO4-preview.zip'
with ZipFile(out,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
 for f in ['CQB_Training.html','training-build-info.json']:z.write(root/'dist'/f,'dist/'+f)
 z.writestr('README_KO.txt','MO4 의료 개편 중간 시험판. 전체 완료판이 아닙니다.\n압축을 풀고 dist/CQB_Training.html을 브라우저로 엽니다. 필요시 로컬 HTTP 서버를 사용합니다.\n모델·렌더러·WASM·소리를 내장합니다.\n공통 폐 배율에서 M80 목표 미달, 기존 해부 도형에 위·방광·분리 장 없음.\n정책·검증·한계는 MO4.md와 mo4-ledger.json을 확인하세요.\n')
 z.write(root/'docs/mo4-heart-infection.md','MO4.md')
 for name in ['mo4-sources.md','mo4-ledger.json','mo4-instructions.md','mo4-tables.md','mo4-numerical-results.json','mo3-sources.md']:z.write(root/'docs'/name,name)
 for f in sorted((root/'docs/media/mo4').glob('*')):z.write(f,'media/mo4/'+f.name)
 for f in sorted((root/'apps/training/assets').glob('*credits.json')):z.write(f,'credits/'+f.name)
assert out.stat().st_size<20_000_000
with ZipFile(out)as z:assert z.testzip()is None
r={'passed':True,'stage':'MO4-preview','published':False,'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'htmlSHA256':ledger['build']['sha256'],'sourceCommit':ledger['sourceCommit']}
(qa/'package.json').write_text(json.dumps(r,indent=2)+'\n')
(root/'docs/mo4-package.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
