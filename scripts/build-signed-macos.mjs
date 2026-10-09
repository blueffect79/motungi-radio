import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2];
const targets = ["aarch64-apple-darwin", "x86_64-apple-darwin"];
const checkOnly = process.argv[3] === "--check";
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (process.platform !== "darwin") fail("Mac에서 실행하세요.");
if (!targets.includes(target) || process.argv.length > (checkOnly ? 4 : 3)) {
  fail(
    "사용법: node scripts/build-signed-macos.mjs <aarch64-apple-darwin|x86_64-apple-darwin> [--check]",
  );
}
const identity = process.env.APPLE_SIGNING_IDENTITY;
const keychainProfile = process.env.APPLE_NOTARY_PROFILE;
if (!identity?.startsWith("Developer ID Application: ")) {
  fail(
    "APPLE_SIGNING_IDENTITY에 Developer ID Application 인증서 이름을 설정하세요. 임시 서명은 허용하지 않습니다.",
  );
}
const appleIdAuth = ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"].every(
  (key) => process.env[key],
);
const apiAuth =
  ["APPLE_API_ISSUER", "APPLE_API_KEY", "APPLE_API_KEY_PATH"].every(
    (key) => process.env[key],
  ) && existsSync(process.env.APPLE_API_KEY_PATH);
if (!appleIdAuth && !apiAuth && !keychainProfile)
  fail(
    "Apple 공증 인증이 필요합니다. APPLE_NOTARY_PROFILE 또는 기존 Apple 인증 환경변수를 설정하세요.",
  );

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error || result.status !== 0)
    fail(`${command} 검증 또는 실행 실패. 서명된 배포본으로 공개하지 마세요.`);
  return result.stdout ?? "";
}
const identities = run(
  "security",
  ["find-identity", "-v", "-p", "codesigning"],
  true,
);
if (!identities.split("\n").some((line) => line.includes(`"${identity}"`))) {
  fail(
    "선택한 인증서와 개인 키가 Mac 키체인에 없습니다. Developer ID Application 인증서를 먼저 설치하세요.",
  );
}
if (checkOnly) {
  console.log(
    "서명·공증 사전조건 확인 완료. 실제 공증 성공은 빌드 후 검증합니다.",
  );
  process.exit(0);
}

// Explicit override prevents the default ad-hoc identity from reaching a release build.
run(process.execPath, [
  "scripts/desktop.mjs",
  "build",
  "--target",
  target,
  "--bundles",
  "dmg",
  "--config",
  JSON.stringify({
    bundle: { macOS: { signingIdentity: identity, hardenedRuntime: true } },
  }),
]);
const targetRoot = process.env.CARGO_TARGET_DIR
  ? resolve(root, process.env.CARGO_TARGET_DIR)
  : join(root, "src-tauri", "target");
const bundle = join(targetRoot, target, "release", "bundle");
const app = join(bundle, "macos", "모퉁이 라디오.app");
run("codesign", ["--verify", "--deep", "--strict", app]);
if (keychainProfile && !appleIdAuth && !apiAuth) {
  const dmgDir = join(bundle, "dmg");
  const dmgs = readdirSync(dmgDir).filter((name) => name.endsWith(".dmg"));
  if (dmgs.length !== 1) fail("공증 대상 DMG가 하나여야 합니다.");
  const dmg = join(dmgDir, dmgs[0]);
  const response = run(
    "xcrun",
    [
      "notarytool",
      "submit",
      dmg,
      "--keychain-profile",
      keychainProfile,
      "--wait",
      "--output-format",
      "json",
    ],
    true,
  );
  if (JSON.parse(response).status !== "Accepted")
    fail("Apple 공증이 승인되지 않았습니다. 배포를 중단하세요.");
  run("xcrun", ["stapler", "staple", dmg]);
  run("xcrun", ["stapler", "validate", dmg]);
  run("spctl", [
    "--assess",
    "--type",
    "open",
    "--context",
    "context:primary-signature",
    "--verbose=2",
    dmg,
  ]);
} else {
  run("xcrun", ["stapler", "validate", app]);
}
run("spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
console.log(`서명·공증·Gatekeeper 검증 완료: ${bundle}`);
