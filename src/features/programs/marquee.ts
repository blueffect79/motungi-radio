/** Keep the current title one line; animate only measured overflow. */
export function flowingTitle(container: HTMLElement) {
  const track = document.createElement("span");
  track.className = "title-track";
  const text = document.createElement("span");
  text.className = "title-text";
  const copy = document.createElement("span");
  copy.className = "title-copy";
  copy.setAttribute("aria-hidden", "true");
  copy.hidden = true;
  track.append(text, copy);
  container.replaceChildren(track);
  let disposed = false;
  let value: string | undefined;
  const measure = () => {
    if (disposed) return;
    const width = container.clientWidth;
    const overflowing = width > 0 && text.scrollWidth > width + 1;
    const distance = text.scrollWidth + 32;
    container.classList.toggle("flowing", overflowing);
    copy.hidden = !overflowing;
    container.style.setProperty("--title-cycle", `${distance}px`);
    container.style.setProperty(
      "--title-duration",
      `${Math.max(8, distance / 28)}s`,
    );
  };
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
  observer?.observe(container);
  observer?.observe(text);
  if (!observer) window.addEventListener("resize", measure);
  void document.fonts?.ready.then(measure);
  return {
    update(next: string) {
      if (disposed || next === value) return;
      value = next;
      container.classList.remove("flowing");
      copy.hidden = true;
      text.textContent = copy.textContent = next;
      container.title = next;
      container.setAttribute("aria-label", next);
      queueMicrotask(measure);
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    },
  };
}
