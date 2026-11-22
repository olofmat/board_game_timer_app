import "./style.css";
import { createGame, type GameSetup, type GameState, pause, type Summary } from "./game/engine";
import { mountGameScreen } from "./screens/gameScreen";
import { mountHomeScreen } from "./screens/homeScreen";
import { mountSetupScreen } from "./screens/setupScreen";
import { mountSummaryScreen } from "./screens/summaryScreen";
import { setSafeToReload, startUpdates } from "./platform/updates";
import { APP_VERSION, CHANGELOG, releasesSince } from "./changelog";
import { showWhatsNew } from "./screens/whatsNew";
import { loadSeenVersion, saveSeenVersion } from "./storage/seenVersion";
import { clearSavedScreen, loadSavedScreen, saveGame, saveSummary } from "./storage/savedScreen";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");
const root = app;

/**
 * After an update, say once what changed. Only on the Home or Summary screen,
 * where the update was loaded, never over a running Game or Setup.
 */
function announceUpdate() {
  const seen = loadSeenVersion();
  if (seen === null) {
    // A fresh install: nothing has changed for this user.
    saveSeenVersion(APP_VERSION);
    return;
  }
  const releases = releasesSince(seen);
  if (releases.length === 0) return;
  showWhatsNew(`Updated to v${APP_VERSION}`, releases, () => saveSeenVersion(APP_VERSION));
}

function showHome() {
  setSafeToReload(true);
  mountHomeScreen(root, {
    onNewGame: () => showSetup(),
    onShowVersion: () => showWhatsNew("What's new", CHANGELOG),
  });
  announceUpdate();
}

function showSetup(initial?: GameSetup) {
  // The Summary is not kept once the next Game is being set up.
  setSafeToReload(false);
  clearSavedScreen();
  mountSetupScreen(root, { onBack: showHome, onStart: (setup) => showGame(createGame(setup, Date.now())) }, initial);
}

function showGame(game: GameState) {
  setSafeToReload(false);
  saveGame(game, Date.now());
  mountGameScreen(root, game, { onChange: saveGame, onEnd: showSummary });
}

function showSummary(summary: Summary) {
  saveSummary(summary);
  setSafeToReload(true);
  mountSummaryScreen(root, summary, {
    onPlayAgain: () => showSetup(summary.setup),
    onNewGame: () => showSetup(),
  });
  announceUpdate();
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

startUpdates();
