import "./style.css";
import { createGame } from "./game/engine";
import { mountGameScreen } from "./screens/gameScreen";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");

// Temporary fixed test Game until Game setup exists.
const game = createGame(
  [
    { name: "Anna", color: "red" },
    { name: "Bo", color: "blue" },
    { name: "Cleo", color: "yellow" },
  ],
  Date.now(),
);
mountGameScreen(app, game);
