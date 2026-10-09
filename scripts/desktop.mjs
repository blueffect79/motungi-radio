import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
const localCargo = join(root, '.local-tools', 'cargo');
if (existsSync(join(localCargo, 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo'))) {
  env.CARGO_HOME = localCargo;
  env.RUSTUP_HOME = join(root, '.local-tools', 'rustup');
  env.PATH = `${join(localCargo, 'bin')}${delimiter}${env.PATH ?? ''}`;
}
const child = spawn(process.execPath, [join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), ...process.argv.slice(2)], {
  cwd: root, env, stdio: 'inherit',
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
