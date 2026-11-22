import { APP_NAME } from "../appInfo";
import { VERSION_LABEL } from "../version";
import { el } from "./dom";

/** Home screen: the starting point, offering New game. The version at the bottom opens What's new. */
export function mountHomeScreen(root: HTMLElement, handlers: { onNewGame: () => void; onShowVersion: () => void }) {
  const screen = el("main", "home-screen");
  const heading = el("h1", undefined, APP_NAME);
  const newGame = el("button", "primary-button", "New game");
  newGame.addEventListener("click", () => handlers.onNewGame());
  const version = el("button", "version-label", VERSION_LABEL);
  version.type = "button";
  version.setAttribute("aria-label", `Version ${VERSION_LABEL}, show what's new`);
  version.addEventListener("click", () => handlers.onShowVersion());
  screen.append(heading, newGame, version);
  root.replaceChildren(screen);
}
