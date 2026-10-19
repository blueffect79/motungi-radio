// Runs the installed Linux app through Tauri/WebKit's real WebDriver bridge.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
const application = resolve(process.argv[2]);
const temporary = mkdtempSync(join(tmpdir(), "motungi-linux-"));
const proofLabel = process.argv[3] ?? "deb";
const driver = spawn("tauri-driver", [], {
  stdio: "inherit",
  env: {
    ...process.env,
    TAURI_WEBVIEW_AUTOMATION: "true",
    APPIMAGE_EXTRACT_AND_RUN: "1",
    XDG_CONFIG_HOME: join(temporary, "config"),
    XDG_DATA_HOME: join(temporary, "data"),
  },
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
async function native(command, args) {
  const result = await request(`/session/${session}/execute/async`, "POST", {
    script: `const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1]).then(() => done({ok:true}), error => done({error:String(error)}));`,
    args: [command, args],
  });
  assert.equal(result.error, undefined, `native ${command}: ${result.error}`);
}
async function screenshot() {
  let pixels;
  // GTK may return a blank frame immediately after resizing the WebKit surface.
  await wait(async () => {
    pixels = Buffer.from(
      await request(`/session/${session}/screenshot`),
      "base64",
    );
    return pixels.length > 1000;
  });
  return pixels;
}
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
  await wait(() => execute('return !!document.querySelector(".welcome:not([hidden])") || document.querySelectorAll(".station").length > 0'));
  if (await execute('return !!document.querySelector(".welcome:not([hidden])")')) {
    assert.equal(await execute('return document.querySelector(".welcome input").checked'), false, "통계 기본 해제");
    await click("라디오 시작하기");
  }

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
    `dist-packages/linux-x64/proof/${proofLabel}-player.png`,
    await screenshot(),
  );
  await click("미니모드로 전환");
  await wait(() => execute('return !!document.querySelector(".mini-player") && innerWidth === 320 && innerHeight >= 98 && innerHeight <= 360'));
  writeFileSync(`dist-packages/linux-x64/proof/${proofLabel}-mini-player.png`, await screenshot());
  await click("일반 화면으로");
  await wait(() => execute('return !document.querySelector(".mini-player") && innerWidth === 380 && innerHeight === 640'));
  await click("채널 목록 표시 전환");
  await wait(() =>
    execute(
      'return !!document.querySelector(".channels-collapsed") && innerHeight >= 200 && innerHeight <= 360',
    ),
  );
  writeFileSync(
    `dist-packages/linux-x64/proof/${proofLabel}-mini.png`,
    await screenshot(),
  );
  await click("플레이어 고정");
  await wait(() =>
    execute(
      `return !!document.querySelector('input[aria-label="플레이어 투명도"]')`,
    ),
  );
  await execute(
    `const slider = document.querySelector('input[aria-label="플레이어 투명도"]'); slider.value = "25"; slider.dispatchEvent(new Event("input", {bubbles:true}));`,
  );
  await native("set_player_opacity", { percent: 65 });
  assert.equal(
    await execute(
      'return document.querySelector(".transparency-control output").textContent',
    ),
    "35%",
  );
  writeFileSync(
    `dist-packages/linux-x64/proof/${proofLabel}-pinned.png`,
    await screenshot(),
  );
  await click("플레이어 고정 해제");
  await wait(() =>
    execute('return !document.querySelector(".transparency-control")'),
  );
  await native("set_player_opacity", { percent: 100 });
  await native("plugin:event|emit", {
    event: "tray-action",
    payload: "settings",
  });
  await wait(() =>
    execute(
      'return !!document.querySelector("input[aria-label=\\"음량\\"]") && innerHeight >= 600',
    ),
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
    `dist-packages/linux-x64/proof/${proofLabel}-settings.png`,
    await screenshot(),
  );
  if (process.env.LINUX_LIVE_PROBE === "1") {
    await click("돌아가기");
    await click("채널 목록 표시 전환");
    await click("EBS FM 재생");
    await wait(() =>
      execute(
        `return document.querySelector('button[aria-label="방송 정지"]')?.title === "방송 정지" && !document.querySelector('.connecting')`,
      ),
    );
    await delay(5000);
    assert.equal(
      await execute(
        `return document.querySelector('button[aria-label="방송 정지"]')?.title === "방송 정지"`,
      ),
      true,
      "실시간 재생 상태 유지",
    );
    writeFileSync(
      `dist-packages/linux-x64/proof/${proofLabel}-live.png`,
      await screenshot(),
    );
    await native("plugin:event|emit", {
      event: "tray-action",
      payload: "playback",
    });
    await delay(2000);
    assert.equal(
      await execute(
        `return !!document.querySelector('button[aria-label="방송 재생"]')`,
      ),
      true,
      "정지 후 재생하지 않음",
    );
    console.log(
      "EBS FM 실제 스트리밍 playing 이벤트·5초 유지·정지 검사 통과 (가상 음원 출력, 사람의 청취 아님).",
    );
  }
  console.log(
    "Linux 설치본: 실제 IPC 채널 로드, 무음 시작, 채널 목록 접기, 고정·투명도 명령, 트레이 설정·정지 이벤트, 설정·기본 음량·화면 크기 검사 통과. 실제 청취·트레이·로그인·절전 미검증.",
  );
} finally {
  if (session) await request(`/session/${session}`, "DELETE").catch(() => {});
  driver.kill();
}
