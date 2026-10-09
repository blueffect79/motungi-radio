const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
let rememberedTheme;
try {
  rememberedTheme = localStorage.getItem("motungi-radio-site-theme");
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
    localStorage.setItem("motungi-radio-site-theme", rememberedTheme);
  } catch {
    /* No persistent preference required. */
  }
});
systemDark.addEventListener("change", (event) => {
  if (!rememberedTheme) applyTheme(event.matches ? "dark" : "light");
});
const track = document.querySelector(".feature-track");
const dots = [...document.querySelectorAll("[data-slide]")];
const arrows = [...document.querySelectorAll("[data-direction]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentSlide = 0;
function selectSlide(index) {
  if (!track.clientWidth || !Number.isFinite(index)) return;
  const next = Math.max(0, Math.min(dots.length - 1, index));
  track.scrollTo({
    left: next * track.clientWidth,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}
function updateSlide() {
  if (!track.clientWidth) return;
  currentSlide = Math.max(
    0,
    Math.min(dots.length - 1, Math.round(track.scrollLeft / track.clientWidth)),
  );
  dots.forEach((dot, index) =>
    dot.setAttribute("aria-pressed", String(index === currentSlide)),
  );
  arrows[0].disabled = currentSlide === 0;
  arrows[1].disabled = currentSlide === dots.length - 1;
}
let frame;
track.addEventListener(
  "scroll",
  () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateSlide);
  },
  { passive: true },
);
dots.forEach((dot) =>
  dot.addEventListener("click", () => selectSlide(Number(dot.dataset.slide))),
);
arrows.forEach((arrow) =>
  arrow.addEventListener("click", () =>
    selectSlide(currentSlide + Number(arrow.dataset.direction)),
  ),
);
track.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  selectSlide(currentSlide + (event.key === "ArrowRight" ? 1 : -1));
});
// Touch uses native scrolling; mouse users can drag the same surface.
let drag;
track.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  drag = { x: event.clientX, scroll: track.scrollLeft, id: event.pointerId };
  track.setPointerCapture(event.pointerId);
});
track.addEventListener("pointermove", (event) => {
  if (!drag || Math.abs(event.clientX - drag.x) < 6) return;
  track.classList.add("is-dragging");
  track.scrollLeft = drag.scroll + drag.x - event.clientX;
});
function finishDrag() {
  if (!drag) return;
  const index = Math.round(track.scrollLeft / track.clientWidth);
  drag = undefined;
  track.classList.remove("is-dragging");
  selectSlide(index);
}
track.addEventListener("pointerup", finishDrag);
track.addEventListener("pointercancel", finishDrag);
track.addEventListener("lostpointercapture", finishDrag);
window.addEventListener("resize", () =>
  track.scrollTo({
    left: currentSlide * track.clientWidth,
    behavior: "instant",
  }),
);
updateSlide();
