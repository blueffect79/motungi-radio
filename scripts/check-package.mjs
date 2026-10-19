import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const config = JSON.parse(read("src-tauri/tauri.conf.json"));
assert.equal(config.version, JSON.parse(read("package.json")).version);
assert.equal(
  config.version,
  read("src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1],
);
assert.equal(config.bundle.macOS.minimumSystemVersion, "13.0");
assert.equal(config.bundle.macOS.signingIdentity, "-");
assert.equal(config.bundle.windows.nsis.installMode, "currentUser");
for (const icon of config.bundle.icon)
  assert(
    existsSync(new URL(`../src-tauri/${icon}`, import.meta.url)),
    `아이콘 누락: ${icon}`,
  );
for (const path of [
  "LICENSE",
  "README.md",
  "docs/install.md",
  "docs/release-checklist.md",
])
  assert(read(path).length > 100, `문서 누락: ${path}`);
const linux = JSON.parse(read("src-tauri/tauri.linux.conf.json"));
assert.equal(linux.app.windows[0].resizable, true);
assert.equal(linux.app.windows[0].minWidth, 320);
assert.equal(linux.app.windows[0].maxWidth, 380);
assert.equal(linux.app.windows[0].minHeight, 98);
assert.match(linux.productName, /^[a-z0-9][a-z0-9+.-]+$/);
assert(
  read("src-tauri/" + linux.bundle.linux.deb.desktopTemplate).includes(
    "Name=모퉁이 라디오",
  ),
);
console.log(
  "패키지 메타데이터/아이콘/문서 사전검증 통과 (설치·실행 검증 아님)",
);
