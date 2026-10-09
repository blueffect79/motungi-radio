import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Catalog, ProgramState, Result } from "./shared/contracts";
import { PlayerController } from "./features/player/controller";
import { HtmlAudioTransport } from "./features/player/transport";
import { resolveStream } from "./features/player/invoke";
import { bindPlaybackLifecycle } from "./features/player/lifecycle";
import {
  AutostartController,
  SettingsController,
} from "./features/settings/controller";
import {
  ProgramPoller,
  currentProgram,
  unavailable,
} from "./features/programs";
import {
  channelRows,
  changeRegion,
  type ChannelRow,
} from "./features/channels/model";
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function button(text: string, label: string, action: () => void, key = label) {
  const b = node("button", text);
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.dataset.key = key;
  b.onclick = action;
  return b;
}
const time = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export async function mountApp(root: HTMLElement) {
  let stations: Catalog["stations"] = [],
    programs: ProgramState[] = [],
    catalogError = "",
    infoError = "",
    actionError = "",
    panel = false,
    regionsOpen = false,
    ready = false,
    displayId: string | null = null;
  const settings = new SettingsController(undefined, () => render());
  const autostart = new AutostartController(undefined, () => render());
  const player = new PlayerController({
    transport: new HtmlAudioTransport(),
    resolve: resolveStream,
    persist: (patch) => {
      void settings.update((s) => ({ ...s, ...patch }));
    },
  });
  const lifecycle = bindPlaybackLifecycle(player);
  const shell = node("div", undefined, "shell"),
    footer = node("footer"),
    footerName = node("strong"),
    footerStatus = node("span", undefined, "play-status"),
    footerError = node("p", undefined, "error");
  const control = button(
    "재생",
    "방송 재생",
    () => {
      if (["playing", "loading"].includes(player.state.status)) player.stop();
      else void player.play();
    },
    "play",
  );
  const volumeLabel = node("label", "음량"),
    volume = node("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.dataset.key = "volume";
  volume.setAttribute("aria-label", "음량");
  volume.oninput = () => player.setVolume(Number(volume.value));
  volumeLabel.append(volume);
  footerError.setAttribute("role", "alert");
  footer.append(footerName, footerStatus, control, volumeLabel, footerError);
  shell.append(footer);
  root.replaceChildren(shell);
  let poller: ProgramPoller | undefined;
  function program(id: string) {
    const p = currentProgram(
      programs.find((p) => p.stationId === id) ?? unavailable(id),
    );
    return p.status === "available"
      ? `${p.title} · ${time.format(new Date(p.startsAt!))}–${time.format(new Date(p.endsAt!))} (한국 시간)${p.sourceKind === "schedule" ? " · 편성표 기준" : ""}`
      : "프로그램 정보 확인 불가";
  }
  function favorite(id: string) {
    void settings.update((s) => ({
      ...s,
      favoriteIds: s.favoriteIds.includes(id)
        ? s.favoriteIds.filter((v) => v !== id)
        : [...s.favoriteIds, id],
    }));
  }
  async function region(id: string) {
    displayId = id;
    await settings.update((s) => ({ ...s, tbnStationId: id }));
    if (changeRegion(stations, player.state, id)) void player.select(id);
    render();
  }
  function stationRow(row: ChannelRow, group = false) {
    const item = node("div", undefined, "station");
    const choose = button(
      group ? `TBN 교통방송 · ${row.station?.region ?? row.name}` : row.name,
      `${row.name} 재생`,
      () => {
        displayId = row.id;
        void player.select(row.id);
      },
      `station-${group ? "group-" : ""}${row.id}`,
    );
    choose.className = "station-choice";
    choose.disabled = !row.available;
    choose.setAttribute(
      "aria-pressed",
      String(
        player.state.stationId === row.id && player.state.status === "playing",
      ),
    );
    choose.append(
      node(
        "span",
        row.available ? program(row.id) : "이용 불가 · 삭제된 채널",
        "program",
      ),
    );
    item.append(
      choose,
      button(
        settings.settings.favoriteIds.includes(row.id) ? "★" : "☆",
        `${row.name} 즐겨찾기 ${settings.settings.favoriteIds.includes(row.id) ? "해제" : "추가"}`,
        () => favorite(row.id),
        `favorite-${group ? "group-" : ""}${row.id}`,
      ),
    );
    return item;
  }
  function render() {
    const focus = (document.activeElement as HTMLElement | null)?.dataset.key;
    const oldScroll = root.querySelector("main")?.scrollTop ?? 0;
    const header = node("header");
    header.append(
      node("h1", "한국 라디오"),
      button("설정", "설정", () => {
        panel = !panel;
        if (panel) void autostart.refresh();
        render();
      }),
      button("−", "창 숨기기", () => {
        void getCurrentWindow()
          .hide()
          .catch(() => {
            actionError = "창을 숨길 수 없습니다.";
            render();
          });
      }),
    );
    const oldHeader = shell.querySelector("header");
    if (oldHeader) oldHeader.replaceWith(header);
    else shell.prepend(header);
    const main = node("main");
    main.setAttribute("aria-label", "방송 목록");
    if (!ready) main.append(node("p", "방송 목록을 불러오는 중입니다."));
    for (const message of [catalogError, settings.error?.message, actionError])
      if (message) {
        const p = node("p", message, "error");
        p.setAttribute("role", "alert");
        main.append(p);
      }
    if (panel) {
      const section = node("section", undefined, "settings");
      section.append(node("h2", "설정"));
      const label = node("label", "로그인 시 실행");
      const check = node("input");
      check.type = "checkbox";
      check.checked = autostart.enabled;
      check.dataset.key = "autostart";
      check.onchange = () => {
        void autostart.set(check.checked);
      };
      label.prepend(check);
      section.append(
        label,
        node("p", `OS 등록 상태: ${autostart.enabled ? "켜짐" : "꺼짐"}`),
      );
      if (autostart.error)
        section.append(node("p", autostart.error.message, "error"));
      section.append(
        button("앱 종료", "앱 종료", () => {
          void invoke("quit_app").catch(() => {
            actionError = "앱을 종료할 수 없습니다.";
            render();
          });
        }),
      );
      main.append(section);
    }
    if (ready) {
      const rows = channelRows(stations, settings.settings);
      main.append(node("h2", "즐겨찾기"));
      if (!rows.favorites.length)
        main.append(node("p", "별을 눌러 즐겨찾기를 추가하세요.", "muted"));
      rows.favorites.forEach((row) => main.append(stationRow(row)));
      rows.removed.forEach((id) =>
        main.append(node("p", `${id} · 마지막 채널 이용 불가`, "error")),
      );
      main.append(node("h2", "전체 방송"));
      rows.all.forEach((row) => {
        const group = row.station?.groupId === "tbn";
        main.append(stationRow(row, group));
        if (group) {
          const toggle = button(
            regionsOpen ? "지역 선택 닫기" : "지역 선택",
            "TBN 지역 선택",
            () => {
              regionsOpen = !regionsOpen;
              render();
            },
            "regions",
          );
          toggle.className = "region-toggle";
          toggle.setAttribute("aria-expanded", String(regionsOpen));
          main.append(toggle);
          if (regionsOpen) {
            const groupNode = node("div", undefined, "regions");
            groupNode.setAttribute("role", "group");
            groupNode.setAttribute("aria-label", "TBN 13개 지역");
            rows.regions.forEach((s) => {
              const b = button(
                s.region ?? s.name,
                `${s.name} 지역 선택`,
                () => {
                  void region(s.id);
                },
                `region-${s.id}`,
              );
              b.setAttribute("aria-pressed", String(row.id === s.id));
              b.append(node("span", program(s.id), "program"));
              groupNode.append(b);
            });
            main.append(groupNode);
          }
        }
      });
      if (displayId) {
        const selected = stations.find((s) => s.id === displayId);
        const section = node("section", undefined, "selected");
        section.append(
          node("h2", "선택한 방송"),
          node("strong", selected?.name ?? `${displayId} · 이용 불가`),
          node("p", selected ? program(displayId) : "삭제된 채널입니다."),
        );
        main.append(section);
      }
      if (infoError) main.append(node("p", infoError, "muted"));
    }
    const oldMain = shell.querySelector("main");
    if (oldMain) oldMain.replaceWith(main);
    else shell.insertBefore(main, footer);
    const state = player.state,
      current = stations.find((s) => s.id === state.stationId),
      busy = state.status === "playing" || state.status === "loading";
    footerName.textContent =
      current?.name ??
      (state.stationId ? "이용 불가 채널" : "선택한 방송 없음");
    footerStatus.textContent = {
      idle: "방송을 선택하세요",
      stopped: "정지됨",
      playing: "재생 중",
      loading: "연결 중",
      error: "연결 오류",
    }[state.status];
    control.textContent = busy
      ? "정지"
      : state.status === "error"
        ? "다시 시도"
        : "재생";
    control.setAttribute("aria-label", busy ? "방송 정지" : "방송 재생");
    control.disabled = !current;
    if (document.activeElement !== volume)
      volume.value = String(settings.settings.volume);
    footerError.textContent = state.error
      ? `오디오: ${state.error.message}`
      : "";
    footerError.hidden = !state.error;
    const scroll = root.querySelector("main");
    if (scroll) scroll.scrollTop = oldScroll;
    if (focus)
      Array.from(root.querySelectorAll<HTMLElement>("[data-key]"))
        .find((e) => e.dataset.key === focus)
        ?.focus({ preventScroll: true });
  }
  player.subscribe(render);
  render();
  await settings.load();
  displayId = settings.settings.lastStationId;
  player.restore(displayId, settings.settings.volume);
  try {
    const result = await invoke<Result<Catalog>>("list_stations");
    if (result.ok) stations = result.data.stations;
    else catalogError = result.error.message;
  } catch {
    catalogError = "방송 목록을 불러올 수 없습니다. 앱을 다시 열어 주세요.";
  }
  ready = true;
  render();
  poller = new ProgramPoller(
    stations.map((s) => s.id),
    async (stationIds) => {
      try {
        const result = await invoke<Result<ProgramState[]>>("get_programs", {
          stationIds,
        });
        if (!result.ok) throw new Error();
        infoError = "";
        return result.data;
      } catch {
        infoError =
          "프로그램 정보를 갱신하지 못했습니다. 방송 재생은 계속됩니다.";
        throw new Error();
      }
    },
    (values) => {
      programs = values;
      render();
    },
  );
  void poller.refresh();
  const refresh = () => {
    if (!document.hidden) void poller?.refresh();
  };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  return () => {
    poller?.stop();
    lifecycle();
    player.dispose();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}
