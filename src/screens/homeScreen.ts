import { APP_NAME } from "../appInfo";

/** Home screen: the starting point, offering New game. */
export function mountHomeScreen(root: HTMLElement, onNewGame: () => void) {
  const screen = document.createElement("main");
  screen.className = "home-screen";
  const heading = document.createElement("h1");
  heading.textContent = APP_NAME;
  const newGame = document.createElement("button");
  newGame.className = "primary-button";
  newGame.textContent = "New game";
  newGame.addEventListener("click", () => onNewGame());
  screen.append(heading, newGame);
  root.replaceChildren(screen);
}
