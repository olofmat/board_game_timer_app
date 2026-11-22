import "./style.css";
import { createGame, type GameSetup, type GameState, pause, type Summary } from "./game/engine";
import { mountGameScreen } from "./screens/gameScreen";
import { mountHomeScreen } from "./screens/homeScreen";
import { mountSetupScreen } from "./screens/setupScreen";
import { mountSummaryScreen } from "./screens/summaryScreen";
import { clearSavedScreen, loadSavedScreen, saveGame, saveSummary } from "./storage/savedScreen";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");
const root = app;

function showHome() {
  mountHomeScreen(root, showSetup);
}

function showSetup(initial?: GameSetup) {
  // The Summary is not kept once the next Game is being set up.
  clearSavedScreen();
  mountSetupScreen(root, { onBack: showHome, onStart: (setup) => showGame(createGame(setup, Date.now())) }, initial);
}

function showGame(game: GameState) {
  saveGame(game, Date.now());
  mountGameScreen(root, game, { onChange: saveGame, onEnd: showSummary });
}

function showSummary(summary: Summary) {
  saveSummary(summary);
  mountSummaryScreen(root, summary, {
    onPlayAgain: () => showSetup(summary.setup),
    onNewGame: () => showSetup(),
  });
}

/**
 * Come back to where the app was. A Game is paused at the moment it was
 * last saved; normally that is when the app was hidden, which already
 * paused it.
 */
const saved = loadSavedScreen();
if (saved?.screen === "game") showGame(pause(saved.game, saved.savedAt));
else if (saved?.screen === "summary") showSummary(saved.summary);
else showHome();
