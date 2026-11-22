import { type Release } from "../changelog";
import { el } from "./dom";

/**
 * A sheet over the bottom of the screen listing what changed, closed with OK.
 * It is added to the page body so that a screen change doesn't remove it.
 */
export function showWhatsNew(title: string, releases: Release[], onClose?: () => void): void {
  document.querySelector(".whats-new")?.remove();

  const backdrop = el("div", "whats-new");
  const sheet = el("section", "whats-new__sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", title);
  sheet.append(el("h2", undefined, title));

  const list = el("div", "whats-new__list");
  for (const release of releases) {
    if (releases.length > 1) list.append(el("h3", undefined, `v${release.version}`));
    const items = el("ul");
    for (const change of release.changes) items.append(el("li", undefined, change));
    list.append(items);
  }

  const ok = el("button", "primary-button", "OK");
  ok.type = "button";
  const close = () => {
    backdrop.remove();
    onClose?.();
  };
  ok.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  sheet.append(list, ok);
  backdrop.append(sheet);
  document.body.append(backdrop);
  ok.focus();
}
