"""Package the locally verified standalone build; no CI or tracked ZIP outputs."""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts'
QA = OUT / 'qa/migration'
MAX_BYTES = 20_000_000

def add(z, path, name):
    entry = ZipInfo(name, (2026, 10, 25, 0, 0, 0))
    entry.compress_type = ZIP_DEFLATED
    entry.external_attr = 0o100644 << 16
    z.writestr(entry, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)

for name in ['identity', '600-tick', 'offline', 'preserved', 'independent-build', 'unit-tests']:
    report = json.loads((QA / (name + '.json')).read_text())
    if report.get('passed') is not True:
        raise SystemExit(f'Passing verification required: {name}')

OUT.mkdir(exist_ok=True)
game = OUT / 'CQB-Training-v69-migration.zip'
with ZipFile(game, 'w') as z:
    for name in ['CQB_Training.html', 'training-build-info.json']:
        add(z, ROOT / 'dist' / name, 'dist/' + name)
    add(z, ROOT / 'README.md', 'README.md')
    add(z, ROOT / 'docs/migration-v69/README.md', 'MIGRATION.md')
    for path in sorted((ROOT / 'apps/training/assets').glob('*credits.json')):
        add(z, path, 'credits/' + path.name)

checks = OUT / 'CQB-Training-v69-migration-checks.zip'
with ZipFile(checks, 'w') as z:
    for path in sorted(QA.rglob('*')):
        if path.is_file():
            add(z, path, 'checks/' + str(path.relative_to(QA)))
    for path in sorted((ROOT / 'docs/migration-v69').glob('*')):
        if path.is_file():
            add(z, path, 'migration/' + path.name)
    add(z, ROOT / 'tests/fixtures/v69/golden.json', 'baseline/v69-golden.json')
    add(z, ROOT / 'dist/training-build-info.json', 'training-build-info.json')

files = []
for path in [game, checks]:
    assert path.stat().st_size < MAX_BYTES, f'{path.name} exceeds 20 MB'
    with ZipFile(path) as z:
        assert z.testzip() is None
    files.append({'name': path.name, 'bytes': path.stat().st_size,
                  'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
receipt = {'passed': True, 'files': files,
           'htmlSHA256': hashlib.sha256((ROOT / 'dist/CQB_Training.html').read_bytes()).hexdigest()}
(OUT / 'migration-downloads.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
