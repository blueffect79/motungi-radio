const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
let rememberedTheme;
try {
  rememberedTheme = localStorage.getItem("radiokorea-site-theme");
} catch {
  /* Theme remains available without storage. */
}
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(theme) {
  root.dataset.theme = theme;
  themeButton.setAttribute(
    "aria-label",
    theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
  themeButton
    .querySelector("use")
    .setAttribute("href", theme === "dark" ? "#sun" : "#moon");
  document.querySelector('meta[name="theme-color"]').content =
    theme === "dark" ? "#121317" : "#fafafa";
}
applyTheme(
  ["light", "dark"].includes(rememberedTheme)
    ? rememberedTheme
    : systemDark.matches
      ? "dark"
      : "light",
);
themeButton.addEventListener("click", () => {
  rememberedTheme = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(rememberedTheme);
  try {
    localStorage.setItem("radiokorea-site-theme", rememberedTheme);
  } catch {
    /* No persistent preference required. */
  }
});
systemDark.addEventListener("change", (event) => {
  if (!rememberedTheme) applyTheme(event.matches ? "dark" : "light");
});
const miniButton = document.querySelector("#mini-toggle");
const previewModes = document.querySelectorAll("[data-preview-mode]");
function setPreviewMode(mini) {
  document.querySelector(".app-window").classList.toggle("is-mini", mini);
  document
    .querySelector(".showcase-desktop")
    .classList.toggle("mini-scene", mini);
  miniButton.setAttribute("aria-pressed", String(mini));
  miniButton.textContent = mini ? "전체" : "미니";
  previewModes.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String((button.dataset.previewMode === "mini") === mini),
    ),
  );
}
miniButton.addEventListener("click", () =>
  setPreviewMode(
    !document.querySelector(".app-window").classList.contains("is-mini"),
  ),
);
previewModes.forEach((button) =>
  button.addEventListener("click", () =>
    setPreviewMode(button.dataset.previewMode === "mini"),
  ),
);
