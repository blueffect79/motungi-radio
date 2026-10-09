// 실제 앱 실행파일을 검증한다. NSIS 설치기 자체는 x86이어도 정상이다.
export function checkBinaryArchitecture(bytes, target) {
  const fail = message => { throw new Error(`앱 아키텍처 검증 실패 (${target}): ${message}`); };
  if (target === 'x86_64-pc-windows-msvc') {
    if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') fail('DOS 헤더 없음 또는 잘림');
    const pe = bytes.readUInt32LE(0x3c);
    if (pe < 64 || pe + 24 > bytes.length) fail('PE 헤더 위치가 파일 범위를 벗어남');
    if (bytes.readUInt32LE(pe) !== 0x00004550) fail('PE 서명 불일치');
    if (bytes.readUInt16LE(pe + 4) !== 0x8664) fail('AMD64 실행파일이 아님');
    const optionalSize = bytes.readUInt16LE(pe + 20);
    if (optionalSize < 2 || pe + 24 + optionalSize > bytes.length) fail('PE optional header 잘림');
    if (bytes.readUInt16LE(pe + 24) !== 0x20b) fail('PE32+ 실행파일이 아님');
    return 'windows-x64';
  }
  const cpus = { 'aarch64-apple-darwin': 0x0100000c, 'x86_64-apple-darwin': 0x01000007 };
  if (!(target in cpus)) fail('지원하지 않는 target');
  if (bytes.length < 32) fail('Mach-O 헤더 잘림');
  if (bytes.readUInt32LE(0) !== 0xfeedfacf) fail('64비트 little-endian thin Mach-O가 아님');
  if (bytes.readUInt32LE(4) !== cpus[target]) fail('Mach-O CPU와 target 불일치');
  if (bytes.readUInt32LE(12) !== 2) fail('Mach-O 실행파일이 아님');
  if (32 + bytes.readUInt32LE(20) > bytes.length) fail('Mach-O load commands 잘림');
  return target === 'aarch64-apple-darwin' ? 'macos-arm64' : 'macos-x64';
}
