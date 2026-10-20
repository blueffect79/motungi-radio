import importlib.util
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('package_update', Path(__file__).with_name('package-macos-update.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ArchiveTests(unittest.TestCase):
    def test_rejects_appledouble_root_that_tauri_strips_to_empty_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'bad.tar.gz'
            with tarfile.open(archive, 'w:gz') as bundle:
                bundle.addfile(tarfile.TarInfo('._Radio.app'))
                root = tarfile.TarInfo('Radio.app'); root.type = tarfile.DIRTYPE
                bundle.addfile(root)
            with self.assertRaises(ValueError): module.validate(archive)

    def test_clean_package_preserves_executable_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            app = Path(temporary) / 'Radio.app'
            binary = app / 'Contents/MacOS/radio'; binary.parent.mkdir(parents=True)
            binary.write_bytes(b'executable'); binary.chmod(0o755)
            archive = Path(temporary) / 'clean.tar.gz'
            module.package(app, archive)
            with tarfile.open(archive) as bundle:
                self.assertEqual(bundle.getmember('Radio.app/Contents/MacOS/radio').mode, 0o755)
            with self.assertRaises(FileExistsError): module.package(app, archive)

if __name__ == '__main__': unittest.main()
