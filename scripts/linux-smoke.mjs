// Runs the installed Linux app through Tauri/WebKit's real WebDriver bridge.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const application = resolve(process.argv[2]);
const driver = spawn("tauri-driver", [], {
  stdio: "inherit",
  env: { ...process.env, TAURI_WEBVIEW_AUTOMATION: "true" },
});
let session;
async function request(path, method = "GET", body) {
  const response = await fetch(`http://127.0.0.1:4444${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error)
    throw new Error(JSON.stringify(result));
  return result.value;
}
async function wait(check) {
  const deadline = Date.now() + 30000;
  do {
    if (await check()) return;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error("Linux 앱 상태 확인 시간 초과");
}
const execute = (script, args = []) =>
  request(`/session/${session}/execute/sync`, "POST", { script, args });
const click = async (label) => {
  const element = await request(`/session/${session}/element`, "POST", {
    using: "css selector",
    value: `button[aria-label="${label}"]`,
  });
  await request(
    `/session/${session}/element/${element["element-6066-11e4-a52e-4f735466cecf"]}/click`,
    "POST",
    {},
  );
};
mkdirSync("dist-packages/linux-x64/proof", { recursive: true });
try {
  await wait(async () => {
    try {
      await request("/status");
      return true;
    } catch {
      return false;
    }
  });
  const created = await request("/session", "POST", {
    capabilities: {
      alwaysMatch: { browserName: "wry", "tauri:options": { application } },
    },
  });
  session = created.sessionId;
  await wait(() =>
    execute(
      'return !!document.querySelector("button[aria-label=\\"방송 재생\\"]") && document.querySelectorAll(".station").length > 0',
    ),
  );
  assert.equal(
    await execute(
      `return document.querySelector('button[aria-label="방송 재생"]').title === "방송 재생"`,
    ),
    true,
    "시작은 무음",
  );
  writeFileSync(
    "dist-packages/linux-x64/proof/player.png",
    Buffer.from(await request(`/session/${session}/screenshot`), "base64"),
  );
  await click("미니 플레이어");
  await wait(() => execute('return !!document.querySelector(".mini")'));
  writeFileSync(
    "dist-packages/linux-x64/proof/mini.png",
    Buffer.from(await request(`/session/${session}/screenshot`), "base64"),
  );
  await click("설정");
  await wait(() =>
    execute('return !!document.querySelector("input[aria-label=\\"음량\\"]")'),
  );
  assert.equal(
    await execute(
      'return document.querySelector("input[aria-label=\\"음량\\"]").value',
    ),
    "100",
  );
  assert.equal(
    await execute("return document.documentElement.scrollWidth <= innerWidth"),
    true,
    "가로 넘침 없음",
  );
  writeFileSync(
    "dist-packages/linux-x64/proof/settings.png",
    Buffer.from(await request(`/session/${session}/screenshot`), "base64"),
  );
  console.log(
    "Linux 설치본: 실제 IPC 채널 로드, 무음 시작, 미니 모드, 설정·기본 음량·화면 크기 검사 통과. 실제 청취·트레이·로그인·절전 미검증.",
  );
} finally {
  if (session) await request(`/session/${session}`, "DELETE").catch(() => {});
  driver.kill();
}
