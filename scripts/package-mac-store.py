#!/usr/bin/env python3
"""Create a Mac App Store upload pkg only from verified Store credentials.
Does not upload, create certificates, or change the installed app.
"""
import argparse, datetime, hashlib, json, plistlib, re, shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def validate_profile(profile, bundle_id, now):
    ent = profile.get('Entitlements', {})
    app_id = ent.get('com.apple.application-identifier', '')
    teams = profile.get('TeamIdentifier', [])
    if len(teams) != 1 or app_id != teams[0] + '.' + bundle_id:
        raise ValueError('Provisioning profile must match the explicit app and team')
    if profile.get('ExpirationDate', now) <= now:
        raise ValueError('Provisioning profile expired')
    if profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices') or ent.get('get-task-allow') or ent.get('com.apple.security.get-task-allow'):
        raise ValueError('Use a Mac App Store distribution profile, not development/adhoc')
    if not profile.get('DeveloperCertificates'):
        raise ValueError('Profile has no distribution certificate')
    return teams[0], ent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', required=True, type=Path)
    ap.add_argument('--profile', required=True, type=Path)
    ap.add_argument('--application-identity', required=True)
    ap.add_argument('--installer-identity', required=True)
    ap.add_argument('--output', required=True, type=Path)
    args = ap.parse_args()
    if not re.match(r'^(Apple Distribution|3rd Party Mac Developer Application):', args.application_identity):
        raise ValueError('App Store application certificate required; Developer ID is not valid here')
    if not args.installer_identity.startswith('3rd Party Mac Developer Installer:'):
        raise ValueError('Mac Installer Distribution certificate required')
    if args.output.exists():
        raise ValueError('Output folder must not already exist')
    info = plistlib.loads((args.app / 'Contents/Info.plist').read_bytes())
    config = json.loads((ROOT/'src-tauri/tauri.conf.json').read_text())
    if info.get('CFBundleIdentifier') != config['identifier'] or info.get('CFBundleShortVersionString') != config['version']:
        raise ValueError('App identity/version mismatch')
    if info.get('LSApplicationCategoryType') != 'public.app-category.music':
        raise ValueError('Build again with the Store music category')
    exe = args.app/'Contents/MacOS'/info['CFBundleExecutable']
    if set(run('lipo','-archs',str(exe)).decode().split()) != {'arm64','x86_64'}:
        raise ValueError('Universal arm64/x86_64 Store bundle required')
    profile = plistlib.loads(run('security','cms','-D','-i',str(args.profile)))
    team, ent = validate_profile(profile, config['identifier'], datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    identities = run('security','find-identity','-v','-p','codesigning').decode()
    fingerprints = [hashlib.sha1(cert).hexdigest().upper() for cert in profile['DeveloperCertificates']]
    if not any(fingerprint in line and args.application_identity in line for fingerprint in fingerprints for line in identities.splitlines()):
        raise ValueError('Profile certificate must match the application signing identity with its private key')
    # Use an ASCII payload directory: productbuild can silently emit an empty
    # payload for the Korean filename. CFBundleDisplayName remains Korean.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.motungi-mac-store-', dir=args.output.parent) as directory:
        Path(directory).chmod(0o755)
        stage=Path(directory)/'Motungi Radio.app'
        shutil.copytree(args.app,stage,symlinks=True)
        shutil.copyfile(args.profile,stage/'Contents/embedded.provisionprofile')
        entitlements=Path(directory)/'Entitlements.plist'
        entitlements.write_bytes(plistlib.dumps({
            'com.apple.security.app-sandbox':True,
            'com.apple.security.network.client':True,
            'com.apple.application-identifier':ent['com.apple.application-identifier'],
            'com.apple.developer.team-identifier':team,
        }))
        run('codesign','--force','--options','runtime','--sign',args.application_identity,'--entitlements',str(entitlements),str(stage))
        run('codesign','--verify','--deep','--strict',str(stage))
        args.output.mkdir(parents=True)
        pkg=args.output/f"motungi-radio-{config['version']}-mac-app-store.pkg"
        run('xcrun','productbuild','--sign',args.installer_identity,'--component',str(stage),'/Applications',str(pkg))
        run('pkgutil','--check-signature',str(pkg))
        expanded=Path(directory)/'expanded'
        run('pkgutil','--expand-full',str(pkg),str(expanded))
        packed_apps=list(expanded.rglob('*.app'))
        if len(packed_apps) != 1:
            raise ValueError('Package must contain exactly one application payload')
        packed_app=packed_apps[0]
        packed_exe=packed_app/'Contents/MacOS'/info['CFBundleExecutable']
        if not packed_exe.is_file() or packed_exe.read_bytes() != (stage/'Contents/MacOS'/info['CFBundleExecutable']).read_bytes():
            raise ValueError('Package executable payload is missing or differs from signed app')
        run('codesign','--verify','--deep','--strict',str(packed_app))
        (args.output/'SHA256SUMS.txt').write_text(hashlib.sha256(pkg.read_bytes()).hexdigest()+'  '+pkg.name+'\n')
        print('Signed Mac App Store pkg created:', pkg)

if __name__ == '__main__':
    main()
