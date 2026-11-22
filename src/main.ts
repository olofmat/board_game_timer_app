import "./style.css";
import { createGame } from "./game/engine";
import { mountGameScreen } from "./screens/gameScreen";
import { mountHomeScreen } from "./screens/homeScreen";
import { mountSetupScreen } from "./screens/setupScreen";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");
const root = app;

function showHome() {
  mountHomeScreen(root, showSetup);
}

function showSetup() {
  mountSetupScreen(root, {
    onBack: showHome,
    onStart: (players) => mountGameScreen(root, createGame(players, Date.now())),
  });
}

showHome();
