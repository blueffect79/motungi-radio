import config from "./config.json";
import app from "../../../src-tauri/tauri.conf.json";
import type { Playback } from "../../shared/contracts";
type Event = "app_opened" | "playback_started" | "playback_failed" | "listening_summary" | "channel_changed" | "feature_used" | "app_updated";
type Properties = { method?: "previous" | "next" | "list"; feature?: "schedule" | "pin"; seconds?: number; previous_version?: string };
/** Explicit events only. No titles, station identifiers, URLs, device IDs or DOM capture. */
export class Analytics {
  private enabled = false;
  private started = false;
  private active = new Set<AbortController>();
  private last = "";
  private playingSince: number | null = null;
  private timer?: ReturnType<typeof setInterval>;
  readonly configured = /^phc_[a-zA-Z0-9]+$/.test(config.projectKey) && ["US", "EU"].includes(config.region);
  setEnabled(enabled: boolean) {
    this.enabled = enabled && this.configured;
    if (!this.enabled) {
      for (const request of this.active) request.abort();
      this.active.clear(); clearInterval(this.timer); this.timer = undefined;
      this.playingSince = null; this.last = "";
      return;
    }
    if (!this.started) {
      this.started = true;
      this.capture("app_opened");
      try {
        const previous = localStorage.getItem("analytics-version");
        if (previous && previous !== app.version) this.capture("app_updated", {previous_version:previous});
        localStorage.setItem("analytics-version", app.version);
      } catch { /* Analytics must never interrupt playback. */ }
    }
    if (!this.timer) this.timer = setInterval(() => this.summarize(), 30 * 60 * 1000);
  }
  capture(event: Event, properties: Properties = {}) {
    if (!this.enabled) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem("analytics-budget") || "{}");
      const count = saved.day === today && Number.isFinite(saved.count) ? saved.count : 0;
      if (count >= 100) return;
      let id = localStorage.getItem("analytics-id");
      if (!id) { id = crypto.randomUUID(); localStorage.setItem("analytics-id", id); }
      localStorage.setItem("analytics-budget", JSON.stringify({day:today,count:count+1}));
      const controller = new AbortController();
      this.active.add(controller);
      const timeout = setTimeout(() => controller.abort(), 5000);
      void fetch(`https://${config.region === "EU" ? "eu" : "us"}.i.posthog.com/i/v0/e/`, {
        method:"POST", credentials:"omit", referrerPolicy:"no-referrer", signal:controller.signal,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({api_key:config.projectKey,event,properties:{...properties,distinct_id:id,app_version:app.version,platform:/Win/.test(navigator.platform)?"windows":/Mac/.test(navigator.platform)?"macos":"linux",$process_person_profile:false,$geoip_disable:true,$ip:"0.0.0.0"}}),
      }).catch(() => {}).finally(() => {clearTimeout(timeout);this.active.delete(controller);});
    } catch { /* Blocked storage or networking must not affect the app. */ }
  }
  playback(state: Playback) {
    if (!this.enabled) return;
    const key = `${state.requestId}:${state.status}`;
    if (key === this.last) return;
    this.last = key;
    if (state.status !== "playing") {this.summarize();this.playingSince = null;}
    if (state.status === "playing" && this.playingSince === null) {
      this.playingSince = Date.now(); this.capture("playback_started");
    }
    if (state.status === "error") this.capture("playback_failed");
  }
  private summarize() {
    if (this.playingSince === null) return;
    const seconds = Math.max(0, Math.floor((Date.now()-this.playingSince)/1000));
    this.playingSince = Date.now();
    if (seconds) this.capture("listening_summary",{seconds});
  }
  dispose() { this.summarize(); this.setEnabled(false); }
}
