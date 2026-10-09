import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBinaryArchitecture } from './check-binary-architecture.mjs';
const arm = 'aarch64-apple-darwin';
const intel = 'x86_64-apple-darwin';
const windows = 'x86_64-pc-windows-msvc';
const macho = cpu => {
  const bytes = Buffer.alloc(40);
  bytes.writeUInt32LE(0xfeedfacf, 0);
  bytes.writeUInt32LE(cpu, 4);
  bytes.writeUInt32LE(2, 12);
  bytes.writeUInt32LE(8, 20);
  return bytes;
};
const pe = machine => {
  const bytes = Buffer.alloc(392);
  bytes.write('MZ');
  bytes.writeUInt32LE(128, 0x3c);
  bytes.writeUInt32LE(0x4550, 128);
  bytes.writeUInt16LE(machine, 132);
  bytes.writeUInt16LE(240, 148);
  bytes.writeUInt16LE(0x20b, 152);
  return bytes;
};
test('thin Mach-O arm64 및 x64의 정확한 target 허용', () => {
  assert.equal(checkBinaryArchitecture(macho(0x0100000c), arm), 'macos-arm64');
  assert.equal(checkBinaryArchitecture(macho(0x01000007), intel), 'macos-x64');
});
test('Mach-O의 잘못된 CPU, 32bit 및 잘린 헤더/명령 거절', () => {
  assert.throws(() => checkBinaryArchitecture(macho(0x01000007), arm), /CPU/);
  assert.throws(() => checkBinaryArchitecture(macho(12), arm), /CPU/);
  assert.throws(() => checkBinaryArchitecture(Buffer.alloc(31), arm), /헤더 잘림/);
  assert.throws(() => checkBinaryArchitecture(macho(0x0100000c).subarray(0, 35), arm), /commands 잘림/);
});
test('Windows 실제 앱의 AMD64 PE32+ 허용', () => {
  assert.equal(checkBinaryArchitecture(pe(0x8664), windows), 'windows-x64');
});
test('Windows 실제 앱의 x86 및 ARM64 거절', () => {
  for (const machine of [0x14c, 0xaa64]) assert.throws(() => checkBinaryArchitecture(pe(machine), windows), /AMD64/);
});
test('잘린 PE와 위조 PE offset 및 서명 거절', () => {
  for (const length of [2, 63, 140, 160]) assert.throws(() => checkBinaryArchitecture(pe(0x8664).subarray(0, length), windows));
  const offset = pe(0x8664); offset.writeUInt32LE(0xffffffff, 0x3c);
  assert.throws(() => checkBinaryArchitecture(offset, windows), /범위/);
  const signature = pe(0x8664); signature.writeUInt32LE(0, 128);
  assert.throws(() => checkBinaryArchitecture(signature, windows), /서명/);
});
