import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function buildPlan(channel, extra = [], platform = process.platform) {
  if (!['direct', 'appstore', 'microsoft-store'].includes(channel)) throw Error('배포 경로는 direct, appstore 또는 microsoft-store여야 합니다.');
  if (channel === 'appstore' && platform !== 'darwin') throw Error('App Store 빌드는 macOS에서 실행해야 합니다.');
  if (channel === 'microsoft-store' && platform !== 'win32') throw Error('Microsoft Store 빌드는 Windows에서 실행해야 합니다.');
  // Only architecture / bundle / debug options may cross this boundary.
  for (let i = 0; i < extra.length; i++) {
    const option = extra[i];
    if (['--debug','--no-bundle','--verbose'].includes(option)) continue;
    if (option === '--target') {
      const target = extra[++i];
      if (!target || !/^(aarch64-apple-darwin|x86_64-apple-darwin|universal-apple-darwin|x86_64-pc-windows-msvc|x86_64-unknown-linux-gnu)$/.test(target)) throw Error('지원하지 않는 빌드 대상입니다.');
      if (channel === 'microsoft-store' && target !== 'x86_64-pc-windows-msvc') throw Error('Microsoft Store는 Windows x64 대상만 허용합니다.');
      if (channel === 'appstore' && !target.endsWith('apple-darwin')) throw Error('스토어판은 Mac 대상만 허용합니다.');
      continue;
    }
    if (option === '--bundles') {
      const bundles = extra[++i];
      if (channel === 'microsoft-store') throw Error('MSIX는 별도 패키징합니다.');
      if (channel === 'appstore' ? bundles !== 'app' : !bundles || !/^(app|dmg|nsis|msi|deb|appimage)(,(app|dmg|nsis|msi|deb|appimage))*$/.test(bundles)) throw Error('배포 경로에 맞지 않는 번들입니다.');
      continue;
    }
    throw Error('배포 경계를 바꾸는 옵션은 허용하지 않습니다: ' + option);
  }
  const store = channel !== 'direct';
  const config = channel === 'microsoft-store' ? 'src-tauri/tauri.microsoft-store.conf.json' : 'src-tauri/tauri.appstore.conf.json';
  const feature = channel === 'microsoft-store' ? 'microsoft-store' : 'app-store';
  return {args: ['build', ...(store ? ['--features', feature, '--config', config] : []), ...extra, ...(store ? ['--', '--no-default-features'] : [])], target: channel === 'microsoft-store' ? 'src-tauri/target-microsoft-store' : channel === 'appstore' ? 'src-tauri/target-appstore' : 'src-tauri/target'};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const plan = buildPlan(process.argv[2], process.argv.slice(3));
    const environment = {...process.env,CARGO_TARGET_DIR:resolve(root,plan.target)};
    delete environment.TAURI_CONFIG;
    const child = spawn(process.execPath, ['scripts/desktop.mjs', ...plan.args], {cwd:root, stdio:'inherit', env:environment});
    child.on('error', e => {console.error(e.message);process.exitCode=1;});
    child.on('exit', code => {process.exitCode=code ?? 1;});
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
