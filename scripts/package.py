#!/usr/bin/env python3
"""Package the built application and launchers; exclude credentials and machine state."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release' / 'my-tier.zip'
if not (root / 'dist' / 'index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')
output.parent.mkdir(parents=True, exist_ok=True)
files = ['package.json', 'package-lock.json', 'README.md', 'START-HERE.txt',
         'START-Windows.bat', 'START-macOS.command', 'START-Linux.sh',
         'index.html', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'playwright.pages.config.ts', '.gitignore']
for folder in ['dist', 'server', 'src', 'public', 'launch', 'scripts', 'tests', '.github']:
    files.extend(str(p.relative_to(root)) for p in (root / folder).rglob('*')
                 if p.is_file() and '__pycache__' not in p.parts)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for relative in sorted(set(files)):
        path = root / relative
        info = zipfile.ZipInfo('my-tier/' + relative)
        info.compress_type = zipfile.ZIP_DEFLATED
        executable = relative.endswith('.command') or relative.endswith('.sh')
        info.create_system = 3
        info.external_attr = ((0o100755 if executable else 0o100644) << 16)
        data = path.read_bytes()
        if relative.endswith('.bat'):
            data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        archive.writestr(info, data)
print(f'Package: {output} ({output.stat().st_size:,} bytes, {len(set(files))} files)')
