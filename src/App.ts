import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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
import { flowingTitle } from "./features/programs/marquee";
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
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayKey = (value: string | number) => dayFormat.format(new Date(value));
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
      [
        "img.imbc.com",
        "image.cloud.sbs.co.kr",
        "programres.kbs.co.kr",
        "mediafactory.play.kbs.co.kr",
      ].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function mountApp(root: HTMLElement) {
  let stations: Catalog["stations"] = [],
    programs = new Map<string, ProgramState>(),
    ready = false,
    disposed = false;
  let panel: "channels" | "settings" | "schedule" = "channels",
    scheduleId: string | null = null;
  let channelsVisible = true,
    filter: "all" | "favorites" = "all",
    catalogError = "",
    infoError = "",
    actionError = "",
    lastVolume = 100;
  let pinned = false,
    pinBusy = false,
    transparency = 0,
    scheduleDate = "",
    scheduleFocusPending = false;
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
    title = node("strong", undefined, "current-title"),
    stationName = node("span", undefined, "current-station"),
    stationLabel = node("span", undefined, "station-label"),
    airtime = node("span", undefined, "program-time"),
    error = node("p", undefined, "error");
  const titleFlow = flowingTitle(title);
  stationName.append(stationLabel, document.createTextNode(" · "), airtime);
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
  const previousChannelName = node("span", undefined, "neighbor-name"),
    nextChannelName = node("span", undefined, "neighbor-name");
  const neighbors = () => {
    const playable = stations.filter((s) => s.streamKey !== "unavailable");
    const index = playable.findIndex((s) => s.id === player.state.stationId);
    return {
      previous:
        index >= 0 && playable.length > 1
          ? playable[(index - 1 + playable.length) % playable.length]
          : undefined,
      next:
        index >= 0 && playable.length > 1
          ? playable[(index + 1) % playable.length]
          : undefined,
    };
  };
  const previousChannel = button(
    "",
    "이전 채널",
    () => {
      const station = neighbors().previous;
      if (station) void player.select(station.id);
    },
    "previous-channel",
  );
  const nextChannel = button(
    "",
    "다음 채널",
    () => {
      const station = neighbors().next;
      if (station) void player.select(station.id);
    },
    "next-channel",
  );
  const glyph = (path: string) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const shape = document.createElementNS(svg.namespaceURI, "path");
    shape.setAttribute("d", path);
    svg.append(shape);
    return svg;
  };
  previousChannel.className = nextChannel.className = "channel-step";
  previousChannel.append(
    glyph("M6 5h2v14H6zM18 5v14L8 12z"),
    previousChannelName,
  );
  nextChannel.append(glyph("M16 5h2v14h-2zM6 5l10 7-10 7z"), nextChannelName);
  heroText.append(stationName, title, next);
  heroTop.append(cover, heroText);
  heroBottom.append(previousChannel, control, nextChannel);
  error.setAttribute("role", "alert");
  hero.append(heroTop, heroBottom, error);
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
      volume.value = String(v > 0 ? 0 : lastVolume || 100);
      volume.dispatchEvent(new Event("input"));
    },
    "mute",
  );
  const volumeHeading = node("div", undefined, "setting-heading"),
    volumeControls = node("div", undefined, "volume-controls");
  volumeHeading.append(volumeLabel, volumeValue);
  volumeControls.append(node("span", "◖))", "speaker"), volume, mute);
  volumeBox.append(volumeHeading, volumeControls);
  const channelToggle = button(
    "채널 숨기기",
    "채널 목록 표시 전환",
    () => {
      channelsVisible = !channelsVisible;
      // Preserve the existing settings contract; this now only controls the list.
      const playerMode = channelsVisible ? "full" : "mini";
      void settings.update((value) => ({ ...value, playerMode }));
      render();
    },
    "channel-visibility",
  );
  channelToggle.className = "channel-visibility";
  const channelToggleLabel = node("span");
  const channelChevron = glyph("m8 10 4 4 4-4");
  channelChevron.classList.add("channel-chevron");
  channelToggle.replaceChildren(
    glyph("M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"),
    channelToggleLabel,
    channelChevron,
  );
  channelToggle.setAttribute("aria-controls", "channel-panel");
  main.id = "channel-panel";
  hero.append(channelToggle);
  shell.append(header, hero, main);
  root.replaceChildren(shell);
  let headerState = "";
  let poller: ProgramPoller | undefined,
    resized = "",
    sizeQueue = Promise.resolve();
  function resize() {
    const compact = !channelsVisible && panel === "channels";
    const height = compact
      ? Math.max(
          200,
          header.offsetHeight
            ? Math.ceil(header.offsetHeight + hero.offsetHeight + 16)
            : 240,
        )
      : 640;
    const sizeKey = `${compact}:${height}`;
    if (sizeKey === resized) return;
    resized = sizeKey;
    sizeQueue = sizeQueue.then(async () => {
      try {
        await invoke("set_player_size", { mini: compact, height });
      } catch {
        actionError = "창 크기를 변경하지 못했습니다.";
        if (!disposed) render();
      }
    });
  }
  function program(id: string) {
    return currentProgram(programs.get(id) ?? unavailable(id));
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
    scheduleDate = dayKey(Date.now());
    scheduleFocusPending = true;
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
    const compact = !channelsVisible && panel === "channels";
    shell.classList.toggle("channels-collapsed", compact);
    channelToggle.hidden = panel !== "channels";
    channelToggleLabel.textContent = channelsVisible
      ? "채널 접기"
      : "채널 보기";
    channelToggle.setAttribute("aria-expanded", String(channelsVisible));
    shell.classList.toggle("panel-open", panel !== "channels");
    if (headerState !== `${panel}:${pinned}:${pinBusy}:${scheduleId}`) {
      headerState = `${panel}:${pinned}:${pinBusy}:${scheduleId}`;
      const heading = node(
        "h1",
        panel === "settings"
          ? "설정"
          : panel === "schedule"
            ? `${stations.find((s) => s.id === scheduleId)?.name ?? "방송"} 편성표`
            : "모퉁이 라디오",
      );
      heading.title = pinned ? "드래그해서 플레이어 이동" : "모퉁이 라디오";
      heading.onpointerdown = (event) => {
        if (!pinned || event.button !== 0) return;
        void invoke("start_player_drag").catch(() => {
          actionError = "창을 이동할 수 없습니다.";
          render();
        });
      };
      header.replaceChildren(heading);
      header.classList.toggle("draggable", pinned);
      if (panel !== "channels")
        header.append(button("← 돌아가기", "돌아가기", showChannels));
      header.append(
        (() => {
          const pin = button(
            "",
            pinned ? "플레이어 고정 해제" : "플레이어 고정",
            () => {
              if (pinBusy) return;
              pinBusy = true;
              render();
              void invoke("set_player_pinned", { pinned: !pinned })
                .then(() => {
                  pinned = !pinned;
                  return applyOpacity();
                })
                .catch(() => {
                  actionError = "플레이어 고정을 변경할 수 없습니다.";
                })
                .finally(() => {
                  pinBusy = false;
                  render();
                });
            },
            "pin",
          );
          pin.className = "pin-button";
          pin.title = pinned ? "고정 해제" : "고정하고 드래그해서 이동";
          pin.setAttribute("aria-pressed", String(pinned));
          pin.disabled = pinBusy;
          const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
          );
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("aria-hidden", "true");
          const path = document.createElementNS(svg.namespaceURI, "path");
          path.setAttribute("d", "M8 3h8M9 3v6l-3 4v2h12v-2l-3-4V3M12 15v6");
          svg.append(path);
          pin.append(svg);
          return pin;
        })(),
      );
      if (pinned) {
        const row = node("label", undefined, "transparency-control"),
          slider = node("input"),
          value = node("output", `${transparency}%`);
        slider.type = "range";
        slider.min = "0";
        slider.max = "60";
        slider.step = "1";
        slider.value = String(transparency);
        slider.setAttribute("aria-label", "플레이어 투명도");
        slider.title = `투명도 ${transparency}%`;
        slider.setAttribute("aria-valuetext", `투명도 ${transparency}%`);
        slider.dataset.key = "transparency";
        slider.oninput = () => {
          transparency = Number(slider.value);
          value.textContent = `${transparency}%`;
          slider.title = `투명도 ${transparency}%`;
          slider.setAttribute("aria-valuetext", `투명도 ${transparency}%`);
          void applyOpacity().catch(() => {
            actionError = "투명도를 변경할 수 없습니다.";
            render();
          });
        };
        row.append(node("span", "투명도"), slider, value);
        header.insertBefore(row, header.querySelector(".pin-button"));
      }
      const gear = button("", "설정", () => {
        panel = panel === "settings" ? "channels" : "settings";
        if (panel === "settings") void autostart.refresh();
        render();
      });
      gear.className = "settings-button";
      gear.title = panel === "settings" ? "설정 닫기" : "설정";
      gear.setAttribute("aria-pressed", String(panel === "settings"));
      gear.append(
        glyph(
          "M9.5 3h5l.7 2.5 2 .9 2.4-.6 2.5 4.3-1.7 1.8v2.2l1.7 1.8-2.5 4.3-2.4-.6-2 .9-.7 2.5h-5l-.7-2.5-2-.9-2.4.6L1.9 16l1.7-1.8V12.1l-1.7-1.8 2.5-4.3 2.4.6 2-.9z M15.5 12.5a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0",
        ),
      );
      header.append(gear);
    }
    const state = player.state,
      current = stations.find((s) => s.id === state.stationId),
      p = state.stationId ? program(state.stationId) : null;
    if (ready) syncTray(current, p);
    artwork(cover, current, p ?? undefined);
    titleFlow.update(
      p?.status === "available"
        ? (p.title ?? "프로그램 정보 없음")
        : current
          ? "프로그램 정보 없음"
          : "듣고 싶은 방송을 골라보세요",
    );
    stationLabel.textContent =
      current?.name ??
      (state.stationId ? "이용 불가 채널" : "내 곁의 작은 라디오");
    airtime.textContent =
      p?.status === "available"
        ? `${time.format(new Date(p.startsAt!))}–${time.format(new Date(p.endsAt!))}`
        : "실시간 라디오";
    const busy = ["playing", "loading"].includes(state.status);

    control.replaceChildren(
      glyph(busy ? "M7 5h4v14H7zM14 5h4v14h-4z" : "M8 4l13 8-13 8z"),
    );
    control.classList.toggle("connecting", state.status === "loading");
    control.title =
      state.status === "loading"
        ? "연결 중 · 누르면 정지"
        : busy
          ? "방송 정지"
          : "방송 재생";
    const adjacent = neighbors();
    previousChannelName.textContent = adjacent.previous?.name ?? "이전 채널";
    nextChannelName.textContent = adjacent.next?.name ?? "다음 채널";
    previousChannelName.title = previousChannelName.textContent;
    nextChannelName.title = nextChannelName.textContent;
    stationName.title = stationName.textContent ?? "";
    previousChannel.disabled = !adjacent.previous;
    nextChannel.disabled = !adjacent.next;
    previousChannel.setAttribute(
      "aria-label",
      adjacent.previous ? `이전 채널: ${adjacent.previous.name}` : "이전 채널",
    );
    nextChannel.setAttribute(
      "aria-label",
      adjacent.next ? `다음 채널: ${adjacent.next.name}` : "다음 채널",
    );
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
    const now = Date.now();
    const nextSlot = (
      schedules.get(state.stationId ?? "")?.entries ?? []
    ).reduce<Schedule["entries"][number] | undefined>((next, entry) => {
      const start = Date.parse(entry.startsAt);
      return start > now && (!next || start < Date.parse(next.startsAt))
        ? entry
        : next;
    }, undefined);
    next.textContent = nextSlot
      ? `다음 ${dayKey(nextSlot.startsAt) !== dayKey(Date.now()) ? "내일 " : ""}${time.format(new Date(nextSlot.startsAt))} · ${nextSlot.title}  ›`
      : pending.has(state.stationId ?? "")
        ? "다음 방송 확인 중…"
        : "다음 방송 · 편성표 보기  ›";
    next.disabled = !current;
    next.title = next.textContent;
    if (document.activeElement !== volume)
      volume.value = String(settings.settings.volume);
    volumeValue.textContent = `${volume.value}%`;
    mute.textContent = Number(volume.value) === 0 ? "음소거 해제" : "음소거";
    if (panel === "settings" && main.querySelector(".settings")) {
      const check = main.querySelector<HTMLInputElement>(
        "input[type=checkbox]",
      );
      if (check) check.checked = autostart.enabled;
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
      section.append(volumeBox);
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
        node("p", "실행 시 자동 재생하지 않습니다.", "muted"),
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
      const scheduleHeading = node("h2", station?.name ?? "편성표");
      scheduleHeading.title = scheduleHeading.textContent ?? "편성표";
      main.append(scheduleHeading, node("p", "편성표 · 한국 시간", "muted"));
      const allEntries = schedules.get(scheduleId ?? "")?.entries ?? [];
      const dates = [
        ...new Set(allEntries.map((e) => dayKey(e.startsAt))),
      ].sort();
      if (!dates.includes(scheduleDate) && dates.length)
        scheduleDate = dates.includes(dayKey(Date.now()))
          ? dayKey(Date.now())
          : dates[0];
      const dateNav = node("nav", undefined, "schedule-dates");
      dateNav.setAttribute("aria-label", "편성표 날짜");
      for (const date of dates) {
        const b = button(
          `${dateLabel.format(new Date(`${date}T12:00:00+09:00`))}${date === dayKey(Date.now()) ? " · 오늘" : ""}`,
          `${date} 편성표`,
          () => {
            scheduleDate = date;
            main.scrollTop = 0;
            render();
          },
        );
        b.setAttribute("aria-pressed", String(date === scheduleDate));
        dateNav.append(b);
      }
      main.append(dateNav);
      const entries = allEntries.filter(
        (e) => dayKey(e.startsAt) === scheduleDate,
      );
      if (pending.has(scheduleId ?? ""))
        main.append(node("p", "편성표 불러오는 중…", "muted"));
      else if (!entries.length)
        main.append(node("p", "편성 정보가 없습니다.", "muted"));
      for (const entry of entries) {
        const past = Date.parse(entry.endsAt) <= Date.now(),
          current = !past && Date.parse(entry.startsAt) <= Date.now(),
          item = node(
            "article",
            undefined,
            `schedule-row${current ? " current" : past ? " past" : ""}`,
          );
        const entryTitle = node("strong", entry.title);
        entryTitle.title = entry.title;
        item.append(
          node(
            "span",
            `${time.format(new Date(entry.startsAt))}–${time.format(new Date(entry.endsAt))}`,
            "program-time",
          ),
          entryTitle,
          node(
            "span",
            current ? "현재 방송" : past ? "방송 종료" : "예정",
            "schedule-state",
          ),
        );
        main.append(item);
      }
      if (
        entries.length &&
        !entries.some((e) => Date.parse(e.startsAt) > Date.now())
      )
        main.append(node("p", "이후 편성 미제공", "muted"));
      if (station)
        main.append(
          button("공식 편성표 ↗", "공식 편성표 확인", () => {
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
        const rowProgram = program(row.id);
        artwork(thumb, row.station, rowProgram, true);
        const copy = node("span", undefined, "station-copy");
        copy.append(
          node("strong", row.name),
          node(
            "span",
            row.available
              ? (rowProgram.title ?? "프로그램 정보 없음")
              : "이용 불가 · 삭제된 채널",
            "program",
          ),
        );
        copy.title = `${row.name} · ${copy.querySelector(".program")?.textContent ?? ""}`;
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
    if (
      panel === "schedule" &&
      scheduleFocusPending &&
      !pending.has(scheduleId ?? "")
    ) {
      const active = main.querySelector<HTMLElement>(".schedule-row.current");
      if (active)
        main.scrollTop = Math.max(0, active.offsetTop - main.offsetTop - 140);
      else main.scrollTop = 0;
      scheduleFocusPending = false;
    }
    if (focused)
      Array.from(root.querySelectorAll<HTMLElement>("[data-key]"))
        .find((e) => e.dataset.key === focused)
        ?.focus({ preventScroll: true });
    if (ready) resize();
  }
  let selectedId: string | null = null;
  let trayKey = "";
  let trayQueue = Promise.resolve<unknown>(undefined);
  let opacityQueue = Promise.resolve<unknown>(undefined);
  function applyOpacity() {
    const percent = pinned ? 100 - transparency : 100;
    const next = opacityQueue
      .catch(() => {})
      .then(() => invoke("set_player_opacity", { percent }));
    opacityQueue = next;
    return next;
  }
  function syncTray(station: Station | undefined, p: ProgramState | null) {
    const state = {
      station: station?.name ?? "",
      program: p?.status === "available" ? (p.title ?? "") : "",
      playing: player.state.status === "playing",
      busy: ["playing", "loading"].includes(player.state.status),
    };
    const key = JSON.stringify(state);
    if (key === trayKey) return;
    trayKey = key;
    trayQueue = trayQueue
      .then(() => invoke("set_tray_state", state))
      .catch(() => {
        if (trayKey === key) trayKey = "";
      });
  }
  player.subscribe(() => {
    render();
    const id = player.state.stationId;
    if (ready && id && id !== selectedId) {
      selectedId = id;
      void loadSchedule(id);
    }
  });
  let removeTray: UnlistenFn | undefined;
  void listen<string>("tray-action", ({ payload }) => {
    if (disposed) return;
    if (payload === "playback") {
      if (["playing", "loading"].includes(player.state.status)) player.stop();
      else void player.play();
    } else if (payload === "open" || payload === "settings") {
      panel = payload === "settings" ? "settings" : "channels";
      if (panel === "settings") void autostart.refresh();
      render();
    }
  })
    .then((remove) => {
      if (disposed) remove();
      else removeTray = remove;
    })
    .catch(() => {});
  await settings.load();
  channelsVisible = settings.settings.playerMode !== "mini";
  lastVolume = settings.settings.volume || 100;
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
        infoError = "정보 갱신 실패 · 재생은 유지됩니다.";
        throw new Error();
      }
      infoError = "";
      return r.data;
    },
    (values) => {
      programs = new Map(values.map((value) => [value.stationId, value]));
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
      (schedules
        .get(id)
        ?.entries.every((e) => Date.parse(e.endsAt) <= Date.now()) ||
        Date.now() - Date.parse(schedules.get(id)?.fetchedAt ?? "") > 300000)
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
    removeTray?.();
    titleFlow.dispose();
    player.dispose();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}
