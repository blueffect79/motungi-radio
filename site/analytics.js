// Download-page analytics only; the desktop app does not load this script.
const measurementId = "G-QH9GXX3Y6Y";
const publicSite = location.hostname === "devsejong.github.io" &&
  location.pathname.startsWith("/motungi-radio/");

if (publicSite && /^G-[A-Z0-9]+$/.test(measurementId)) {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);

  // A click is download intent, not proof of a completed download or installation.
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element
      ? event.target.closest("a[data-download-platform]") : null;
    if (!link) return;
    const url = new URL(link.href);
    const version = url.pathname.match(/\/v([^/]+)/)?.[1];
    gtag("event", "download_click", {
      platform: link.dataset.downloadPlatform,
      architecture: link.dataset.downloadArchitecture,
      app_version: version,
      destination: url.pathname.includes("/download/") ? "installer" : "release_page",
      link_url: link.href,
      transport_type: "beacon",
    });
  });
}
