import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  Catalog,
  ProgramState,
  Result,
  Schedule,
  Station,
} from "./shared/contracts";
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
import { channelRows } from "./features/channels/model";
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
const dateLabel = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
});
export function safeArtwork(raw?: string | null) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      ["img.imbc.com", "image.cloud.sbs.co.kr"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function mountApp(root: HTMLElement) {
  let stations: Catalog["stations"] = [],
    programs: ProgramState[] = [],
    ready = false,
    disposed = false;
  let panel: "channels" | "settings" | "schedule" = "channels",
    scheduleId: string | null = null;
  let mode: "full" | "mini" = "full",
    filter: "all" | "favorites" = "all",
    catalogError = "",
    infoError = "",
    actionError = "",
    lastVolume = 50;
  const schedules = new Map<string, Schedule>(),
    pending = new Set<string>();
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
    header = node("header"),
    main = node("main"),
    hero = node("footer", undefined, "now-playing");
  const cover = node("div", undefined, "cover"),
    heroText = node("div", undefined, "hero-copy"),
    status = node("span", undefined, "play-status"),
    title = node("strong", undefined, "current-title"),
    stationName = node("span", undefined, "current-station"),
    airtime = node("span", undefined, "program-time"),
    error = node("p", undefined, "error");
  const control = button(
    "재생",
    "방송 재생",
    () => {
      if (["playing", "loading"].includes(player.state.status)) player.stop();
      else void player.play();
    },
    "play",
  );
  control.className = "play-button";
  const next = button(
    "다음 방송 확인",
    "현재 채널 편성표",
    () => {
      if (player.state.stationId) openSchedule(player.state.stationId);
    },
    "current-schedule",
  );
  next.className = "next-program";
  const heroTop = node("div", undefined, "hero-top"),
    heroBottom = node("div", undefined, "hero-bottom");
  heroText.append(status, title, stationName);
  heroTop.append(cover, heroText);
  heroBottom.append(airtime, control);
  error.setAttribute("role", "alert");
  hero.append(heroTop, heroBottom, next, error);
  hero.setAttribute("aria-label", "현재 프로그램");
  const volumeBox = node("section", undefined, "volume-setting"),
    volumeLabel = node("label", "음량"),
    volume = node("input"),
    volumeValue = node("output");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.id = "app-volume";
  volume.dataset.key = "volume";
  volume.setAttribute("aria-label", "음량");
  volumeLabel.htmlFor = volume.id;
  volume.oninput = () => {
    volumeValue.textContent = `${volume.value}%`;
    player.setVolume(Number(volume.value));
  };
  const mute = button(
    "음소거",
    "음소거",
    () => {
      const v = Number(volume.value);
      if (v > 0) lastVolume = v;
      volume.value = String(v > 0 ? 0 : lastVolume || 50);
      volume.dispatchEvent(new Event("input"));
    },
    "mute",
  );
  const volumeHeading = node("div", undefined, "setting-heading"),
    volumeControls = node("div", undefined, "volume-controls");
  volumeHeading.append(volumeLabel, volumeValue);
  volumeControls.append(node("span", "◖))", "speaker"), volume, mute);
  volumeBox.append(volumeHeading, volumeControls);
  shell.append(header, hero, main);
  root.replaceChildren(shell);
  let headerState = "";
  let poller: ProgramPoller | undefined,
    resized = "",
    sizeQueue = Promise.resolve();
  function resize() {
    const compact = mode === "mini" && panel === "channels";
    if (String(compact) === resized) return;
    resized = String(compact);
    sizeQueue = sizeQueue.then(async () => {
      try {
        await invoke("set_player_size", { mini: compact });
      } catch {
        actionError = "창 크기를 변경하지 못했습니다.";
        if (!disposed) render();
      }
    });
  }
  function program(id: string) {
    return currentProgram(
      programs.find((p) => p.stationId === id) ?? unavailable(id),
    );
  }
  function artwork(
    target: HTMLElement,
    s?: Station,
    p?: ProgramState,
    small = false,
  ) {
    const url = safeArtwork(p?.imageUrl),
      key = `${s?.id}:${url}`;
    if (target.dataset.art === key) return;
    target.dataset.art = key;
    target.replaceChildren();
    const fallback = () => {
      target.replaceChildren(
        node("span", s?.providerId.toUpperCase() ?? "RADIO", "cover-mark"),
      );
    };
    if (url) {
      const img = node("img");
      img.src = url;
      img.alt = small ? "" : `${p?.title ?? s?.name} 프로그램 이미지`;
      img.referrerPolicy = "no-referrer";
      img.onerror = fallback;
      target.append(img);
    } else fallback();
  }
  async function loadSchedule(id: string, force = false) {
    if (pending.has(id) || (!force && schedules.has(id))) return;
    pending.add(id);
    try {
      const r = await invoke<Result<Schedule>>("get_schedule", {
        stationId: id,
      });
      if (
        !disposed &&
        r.ok &&
        r.data.stationId === id &&
        Array.isArray(r.data.entries)
      )
        schedules.set(id, r.data);
      else schedules.delete(id);
    } catch {
      schedules.delete(id);
    } finally {
      pending.delete(id);
      if (!disposed) render();
    }
  }
  function openSchedule(id: string) {
    scheduleId = id;
    panel = "schedule";
    void loadSchedule(id, true);
    render();
  }
  function showChannels() {
    panel = "channels";
    render();
  }
  function render() {
    if (disposed) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset.key,
      scroll = main.scrollTop;
    document.documentElement.dataset.theme =
      settings.settings.appearance ?? "system";
    const compact = mode === "mini" && panel === "channels";
    shell.classList.toggle("mini", compact);
    shell.classList.toggle("panel-open", panel !== "channels");
    if (headerState !== `${panel}:${mode}`) {
      headerState = `${panel}:${mode}`;
      header.replaceChildren(node("h1", "한국 라디오"));
      if (panel !== "channels")
        header.append(button("← 돌아가기", "돌아가기", showChannels));
      else
        header.append(
          button(
            mode === "mini" ? "채널 목록" : "미니",
            mode === "mini" ? "기본 플레이어" : "미니 플레이어",
            () => {
              mode = mode === "mini" ? "full" : "mini";
              const selected = mode;
              void settings.update((s) => ({ ...s, playerMode: selected }));
              render();
            },
          ),
        );
      header.append(
        button(panel === "settings" ? "닫기" : "설정", "설정", () => {
          panel = panel === "settings" ? "channels" : "settings";
          if (panel === "settings") void autostart.refresh();
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
    }
    const state = player.state,
      current = stations.find((s) => s.id === state.stationId),
      p = state.stationId ? program(state.stationId) : null;
    artwork(cover, current, p ?? undefined);
    title.textContent =
      p?.status === "available"
        ? p.title
        : current
          ? "프로그램 정보 확인 불가"
          : "듣고 싶은 방송을 골라보세요";
    stationName.textContent =
      current?.name ??
      (state.stationId ? "이용 불가 채널" : "내 곁의 작은 라디오");
    status.textContent = {
      idle: "READY",
      stopped: "정지됨",
      playing: "재생 중",
      loading: "연결 중",
      error: "연결 오류",
    }[state.status];
    airtime.textContent =
      p?.status === "available"
        ? `${time.format(new Date(p.startsAt!))}–${time.format(new Date(p.endsAt!))}${p.sourceKind === "schedule" ? " · 편성표 기준" : " · 한국 시간"}`
        : "실시간 라디오";
    const busy = ["playing", "loading"].includes(state.status);
    control.textContent = busy ? "■ 정지" : "▶ 재생";
    control.setAttribute("aria-label", busy ? "방송 정지" : "방송 재생");
    control.disabled = !current;
    error.textContent = state.error ? `오디오: ${state.error.message}` : "";
    if (compact)
      error.textContent = [
        error.textContent,
        settings.error?.message,
        actionError,
      ]
        .filter(Boolean)
        .join(" / ");
    error.hidden = !error.textContent;
    const nextSlot = schedules
      .get(state.stationId ?? "")
      ?.entries.find((e) => Date.parse(e.startsAt) > Date.now());
    next.textContent = nextSlot
      ? `다음 ${time.format(new Date(nextSlot.startsAt))} · ${nextSlot.title}  ›`
      : pending.has(state.stationId ?? "")
        ? "다음 방송 확인 중…"
        : "다음 방송 · 편성표 보기  ›";
    next.disabled = !current;
    if (document.activeElement !== volume)
      volume.value = String(settings.settings.volume);
    volumeValue.textContent = `${volume.value}%`;
    mute.textContent = Number(volume.value) === 0 ? "음소거 해제" : "음소거";
    if (panel === "settings" && main.querySelector(".settings")) {
      const check = main.querySelector<HTMLInputElement>(
        "input[type=checkbox]",
      );
      if (check) check.checked = autostart.enabled;
      const os = main.querySelector(".os-state");
      if (os)
        os.textContent = `OS 등록 상태: ${autostart.enabled ? "켜짐" : "꺼짐"}`;
      main
        .querySelectorAll<HTMLButtonElement>(".appearance button")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(
              b.dataset.value === (settings.settings.appearance ?? "system"),
            ),
          ),
        );
      const alert = main.querySelector(".settings-error");
      if (alert)
        alert.textContent = [
          settings.error?.message,
          autostart.error?.message,
          actionError,
        ]
          .filter(Boolean)
          .join(" · ");
      if (ready) resize();
      return;
    }
    main.replaceChildren();
    main.setAttribute(
      "aria-label",
      panel === "channels"
        ? "방송 목록"
        : panel === "settings"
          ? "설정"
          : "편성표",
    );
    for (const message of [catalogError, settings.error?.message, actionError])
      if (message) {
        const alert = node("p", message, "error");
        alert.setAttribute("role", "alert");
        main.append(alert);
      }
    if (panel === "settings") {
      const section = node("section", undefined, "settings");
      section.append(node("h2", "내 취향대로"), volumeBox);
      const appearance = node("div", undefined, "appearance");
      appearance.append(node("h3", "화면 모드"));
      for (const [value, label] of [
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ] as const) {
        const b = button(label, `${label} 모드`, () => {
          void settings.update((s) => ({ ...s, appearance: value }));
        });
        b.setAttribute(
          "aria-pressed",
          String((settings.settings.appearance ?? "system") === value),
        );
        b.dataset.value = value;
        appearance.append(b);
      }
      const label = node("label", "로그인 시 실행", "autostart"),
        check = node("input");
      check.type = "checkbox";
      check.checked = autostart.enabled;
      check.dataset.key = "autostart";
      check.onchange = () => {
        void autostart.set(check.checked);
      };
      label.append(check);
      section.append(
        appearance,
        label,
        node(
          "p",
          `OS 등록 상태: ${autostart.enabled ? "켜짐" : "꺼짐"}`,
          "muted os-state",
        ),
        node(
          "p",
          "앱을 열거나 로그인해도 자동으로 재생하지 않습니다.",
          "muted",
        ),
      );
      const settingsError = node(
        "p",
        autostart.error?.message,
        "error settings-error",
      );
      settingsError.setAttribute("role", "alert");
      section.append(settingsError);
      section.append(
        button("앱 종료", "앱 종료", () => {
          void invoke("quit_app").catch(() => {
            actionError = "앱을 종료할 수 없습니다.";
            render();
          });
        }),
      );
      main.append(section);
    } else if (panel === "schedule") {
      const station = stations.find((s) => s.id === scheduleId);
      main.append(
        node("h2", station?.name ?? "편성표"),
        node(
          "p",
          "편성표 기준 · 한국 시간 · 방송사 사정에 따라 변경될 수 있습니다.",
          "muted",
        ),
      );
      const entries =
        schedules
          .get(scheduleId ?? "")
          ?.entries.filter((e) => Date.parse(e.endsAt) > Date.now()) ?? [];
      if (pending.has(scheduleId ?? ""))
        main.append(node("p", "편성표를 불러오는 중입니다.", "muted"));
      else if (!entries.length)
        main.append(
          node(
            "p",
            "다음 프로그램 정보를 확인할 수 없습니다. 공식 페이지에서 편성표를 확인해 주세요.",
            "muted",
          ),
        );
      for (const entry of entries) {
        const current = Date.parse(entry.startsAt) <= Date.now(),
          item = node(
            "article",
            undefined,
            `schedule-row${current ? " current" : ""}`,
          );
        item.append(
          node(
            "span",
            `${dateLabel.format(new Date(entry.startsAt))} ${time.format(new Date(entry.startsAt))}–${time.format(new Date(entry.endsAt))}`,
            "program-time",
          ),
          node("strong", entry.title),
          node("span", current ? "현재 방송" : "예정", "schedule-state"),
        );
        main.append(item);
      }
      if (
        entries.length &&
        !entries.some((e) => Date.parse(e.startsAt) > Date.now())
      )
        main.append(node("p", "이후 편성은 아직 확인할 수 없습니다.", "muted"));
      if (station)
        main.append(
          button("공식 페이지에서 편성표 확인 ↗", "공식 편성표 확인", () => {
            void invoke("open_station_page", { stationId: station.id }).catch(
              () => {
                actionError = "공식 페이지를 열 수 없습니다.";
                render();
              },
            );
          }),
          button("새로고침", "편성표 새로고침", () => {
            void loadSchedule(station.id, true);
            render();
          }),
        );
    } else if (ready) {
      const tabs = node("nav", undefined, "channel-tabs");
      for (const [value, label] of [
        ["all", "전체 채널"],
        ["favorites", "즐겨찾기"],
      ] as const) {
        const b = button(label, label, () => {
          filter = value;
          render();
        });
        b.setAttribute("aria-pressed", String(filter === value));
        tabs.append(b);
      }
      main.append(tabs);
      const rows = channelRows(stations, settings.settings),
        visible = filter === "all" ? rows.all : rows.favorites;
      if (!visible.length)
        main.append(node("p", "별을 눌러 즐겨찾기를 추가하세요.", "muted"));
      for (const row of visible) {
        const item = node("div", undefined, "station");
        item.classList.toggle("selected", row.id === state.stationId);
        const choose = button(
          "",
          `${row.name} 재생`,
          () => {
            void player.select(row.id);
          },
          `station-${filter}-${row.id}`,
        );
        choose.className = "station-choice";
        choose.disabled = !row.available;
        const thumb = node("div", undefined, "cover thumbnail");
        artwork(thumb, row.station, program(row.id), true);
        const copy = node("span", undefined, "station-copy");
        copy.append(
          node("strong", row.name),
          node(
            "span",
            row.available
              ? (program(row.id).title ?? "프로그램 정보 확인 불가")
              : "이용 불가 · 삭제된 채널",
            "program",
          ),
        );
        choose.append(thumb, copy);
        const schedule = button(
          "편성표",
          `${row.name} 편성표`,
          () => openSchedule(row.id),
          `schedule-${filter}-${row.id}`,
        );
        schedule.className = "schedule-button";
        schedule.disabled = !row.available;
        const isFavorite = settings.settings.favoriteIds.includes(row.id),
          favorite = button(
            isFavorite ? "★" : "☆",
            `${row.name} 즐겨찾기 ${isFavorite ? "해제" : "추가"}`,
            () => {
              void settings.update((s) => ({
                ...s,
                favoriteIds: s.favoriteIds.includes(row.id)
                  ? s.favoriteIds.filter((v) => v !== row.id)
                  : [...s.favoriteIds, row.id],
              }));
            },
            `favorite-${filter}-${row.id}`,
          );
        favorite.className = "favorite";
        favorite.setAttribute("aria-pressed", String(isFavorite));
        item.append(choose, schedule, favorite);
        main.append(item);
      }
      for (const id of rows.removed)
        main.append(node("p", `${id} · 마지막 채널 이용 불가`, "error"));
      if (infoError) main.append(node("p", infoError, "muted"));
    } else main.append(node("p", "방송 목록을 불러오는 중입니다."));
    main.scrollTop = scroll;
    if (focused)
      Array.from(root.querySelectorAll<HTMLElement>("[data-key]"))
        .find((e) => e.dataset.key === focused)
        ?.focus({ preventScroll: true });
    if (ready) resize();
  }
  let selectedId: string | null = null;
  player.subscribe(() => {
    render();
    const id = player.state.stationId;
    if (ready && id && id !== selectedId) {
      selectedId = id;
      void loadSchedule(id);
    }
  });
  await settings.load();
  mode = settings.settings.playerMode ?? "full";
  lastVolume = settings.settings.volume || 50;
  player.restore(settings.settings.lastStationId, settings.settings.volume);
  try {
    const r = await invoke<Result<Catalog>>("list_stations");
    if (r.ok)
      stations = r.data.stations.filter(
        (s) => s.groupId !== "tbn" || s.id === "tbn-gyeongin",
      );
    else catalogError = r.error.message;
  } catch {
    catalogError = "방송 목록을 불러올 수 없습니다. 앱을 다시 열어 주세요.";
  }
  ready = true;
  render();
  if (player.state.stationId) void loadSchedule(player.state.stationId);
  poller = new ProgramPoller(
    stations.map((s) => s.id),
    async (stationIds) => {
      const r = await invoke<Result<ProgramState[]>>("get_programs", {
        stationIds,
      });
      if (!r.ok) {
        infoError =
          "프로그램 정보를 갱신하지 못했습니다. 방송 재생은 계속됩니다.";
        throw new Error();
      }
      infoError = "";
      return r.data;
    },
    (values) => {
      programs = values;
      render();
    },
  );
  void poller.refresh();
  const refresh = () => {
    if (!document.hidden) {
      void poller?.refresh();
      const id = panel === "schedule" ? scheduleId : player.state.stationId;
      if (id) void loadSchedule(id, true);
      if (panel === "settings") void autostart.refresh();
    }
  };
  const timer = setInterval(() => {
    render();
    const id = player.state.stationId;
    if (
      id &&
      schedules
        .get(id)
        ?.entries.every((e) => Date.parse(e.endsAt) <= Date.now())
    )
      void loadSchedule(id, true);
  }, 60000);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  return () => {
    disposed = true;
    clearInterval(timer);
    poller?.stop();
    lifecycle();
    player.dispose();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}
