import {readFileSync} from 'node:fs';
import {checkBinaryArchitecture} from './check-binary-architecture.mjs';
const [mode,file] = process.argv.slice(2);
if (mode !== '--exe' || !file) throw Error('Usage: check-msix.mjs --exe FILE');
checkBinaryArchitecture(readFileSync(file),'x86_64-pc-windows-msvc');
console.log('Windows x64 binary check passed');
