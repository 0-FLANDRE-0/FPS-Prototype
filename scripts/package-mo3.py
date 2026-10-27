"""Package verified MO3 preview locally; do not publish a completed overhaul release."""
import json,hashlib
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
qa=root/'artifacts/qa/mo3'
ledger=json.loads((root/'docs/mo3-ledger.json').read_text())
assert ledger['stage']=='MO3' and ledger['complete'] is False
assert ledger['verification']['tests']['failed']==0
assert ledger['verification']['offline']['passed']
out=root/'artifacts/FPS-Prototype-MO3-preview.zip'
with ZipFile(out,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
 for f in ['CQB_Training.html','training-build-info.json']: z.write(root/'dist'/f,'dist/'+f)
 z.writestr('README_KO.txt','MO3 의료 개편 중간 시험판. 전체 개편 완료판이 아닙니다.\n압축을 풀고 dist/CQB_Training.html을 브라우저로 엽니다. 필요시 로컬 HTTP 서버를 사용합니다.\n네트워크 없이 모델·렌더러·WASM·소리를 내장합니다. 소리 재생은 시작 버튼 이후 활성화됩니다.\n원본2D·탄도·방호·원시 손상 유지. 사용·정책/출처/검증은 MO3.md와 mo3-ledger.json 참조.\n')
 z.write(root/'docs/mo3-unified-bleeding.md','MO3.md')
 z.write(root/'docs/mo3-sources.md','mo3-sources.md')
 z.write(root/'docs/mo3-ledger.json','mo3-ledger.json')
 for name in ['mo3-instructions.md','mo3-numerical-results.json','mo3-physiology-comparison.json','medical-s1-ledger.json','medical-b1c-ledger.json']:z.write(root/'docs'/name,name)
 for f in sorted((root/'docs/media/mo3').glob('*.webp')):z.write(f,'media/mo3/'+f.name)
 for f in sorted((root/'apps/training/assets').glob('*credits.json')):z.write(f,'credits/'+f.name)
assert out.stat().st_size<20_000_000
with ZipFile(out)as z:assert z.testzip()is None
r={'passed':True,'stage':'MO3-preview','published':False,'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'htmlSHA256':ledger['build']['sha256'],'sourceCommit':ledger['sourceCommit']}
(qa/'package.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
