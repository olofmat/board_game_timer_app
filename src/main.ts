import "./style.css";
import { createGame, type GameSetup, type Summary } from "./game/engine";
import { mountGameScreen } from "./screens/gameScreen";
import { mountHomeScreen } from "./screens/homeScreen";
import { mountSetupScreen } from "./screens/setupScreen";
import { mountSummaryScreen } from "./screens/summaryScreen";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");
const root = app;

function showHome() {
  mountHomeScreen(root, showSetup);
}

function showSetup(initial?: GameSetup) {
  mountSetupScreen(root, { onBack: showHome, onStart: showGame }, initial);
}

function showGame(setup: GameSetup) {
  mountGameScreen(root, createGame(setup, Date.now()), showSummary);
}

function showSummary(summary: Summary) {
  mountSummaryScreen(root, summary, {
    onPlayAgain: () => showSetup(summary.setup),
    onNewGame: () => showSetup(),
  });
}

showHome();
