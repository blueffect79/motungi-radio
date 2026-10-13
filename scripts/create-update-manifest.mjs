// Run only after signed, notarized (Mac) update artifacts have been verified.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
const [version, directory, output] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !directory || !output) throw new Error('Usage: node scripts/create-update-manifest.mjs VERSION ARTIFACT_DIR OUTPUT.json');
const files = {
  'darwin-aarch64': `motungi-radio-${version}-macos-arm64.app.tar.gz`,
  'darwin-x86_64': `motungi-radio-${version}-macos-x64.app.tar.gz`,
  'windows-x86_64': `motungi-radio-${version}-windows-x64.exe`,
  'linux-x86_64': `motungi-radio-${version}-linux-x64.AppImage`,
};
const platforms = {};
for (const [target, name] of Object.entries(files)) {
  const file = resolve(directory, name);
  if (!existsSync(file) || readFileSync(file).length < 1024) throw new Error(`Missing artifact: ${name}`);
  const signature = readFileSync(file + '.sig', 'utf8').trim();
  const decoded = Buffer.from(signature, 'base64').toString('utf8');
  if (!decoded.startsWith('untrusted comment:') || !decoded.includes('trusted comment:')) throw new Error(`Invalid signature format: ${name}`);
  platforms[target] = { signature, url: `https://github.com/devsejong/motungi-radio/releases/download/v${version}/${basename(file)}` };
}
writeFileSync(output, JSON.stringify({version, pub_date: new Date().toISOString(), notes: '모퉁이 라디오 업데이트', platforms}, null, 2) + '\n');
