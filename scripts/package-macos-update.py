"""Package a notarized .app without AppleDouble entries that break Tauri installation."""
import os
from pathlib import Path
import subprocess
import sys
import tarfile


def validate(archive):
    with tarfile.open(archive, 'r:gz') as bundle:
        entries = bundle.getmembers()
        if not entries or any(part.startswith('._') or part == '__MACOSX'
                              for entry in entries for part in Path(entry.name).parts):
            raise ValueError('AppleDouble metadata or empty update archive')
        roots = {Path(entry.name).parts[0] for entry in entries}
        if len(roots) != 1 or not next(iter(roots)).endswith('.app'):
            raise ValueError('Expected exactly one .app root')


def package(app, output):
    app, output = Path(app).resolve(), Path(output).resolve()
    if not app.is_dir() or app.suffix != '.app':
        raise ValueError('Expected a notarized .app directory')
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['tar', '--no-xattrs', '-czf', str(output), '-C', str(app.parent), app.name],
                   env={**os.environ, 'COPYFILE_DISABLE': '1'}, check=True)
    validate(output)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python3 scripts/package-macos-update.py APP OUTPUT.app.tar.gz')
    package(*sys.argv[1:])
