import { colorStyle } from "../game/colors";
import {
  changeOrder,
  endGame,
  type GameState,
  pause,
  pressSharedTimer,
  resume,
  type SharedTimerSnapshot,
  snapshot,
  type Summary,
  swipe,
  type SwipeDirection,
  tap,
} from "../game/engine";
import { loadShowTimes, saveShowTimes } from "../storage/preferences";
import { changeOrderPanel } from "./changeOrderPanel";
import { el } from "./dom";
import { formatDuration } from "./format";

/** Minimum horizontal travel (px) for a gesture to count as a swipe. */
const SWIPE_MIN_PX = 50;
/** Maximum travel (px) for a gesture to still count as a tap. */
const TAP_MAX_PX = 12;
/** With Show times on, Shared timer buttons show their current stretch too only up to this many buttons. */
const MAX_SHARED_TIMERS_SHOWING_STRETCH = 2;

type Gesture = { kind: "tap" } | { kind: "swipe"; direction: SwipeDirection } | null;

/** Classify a finished pointer gesture by how far it travelled. */
function classify(dx: number, dy: number): Gesture {
  if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
    return { kind: "swipe", direction: dx > 0 ? "right" : "left" };
  }
  if (Math.hypot(dx, dy) <= TAP_MAX_PX) return { kind: "tap" };
  return null;
}

/**
 * Show times text for a Shared timer button: total and current stretch
 * with 1–2 buttons (the stretch only while it is in play), total alone
 * with 3–4 so the small buttons stay readable.
 */
function sharedTimerTimes(timer: SharedTimerSnapshot, inPlay: boolean, buttonCount: number): string {
  const total = formatDuration(timer.timeMs);
  if (buttonCount > MAX_SHARED_TIMERS_SHOWING_STRETCH || !inPlay) return total;
  return `${total} · now ${formatDuration(timer.stretchMs)}`;
}

/**
 * The Game screen: renders engine snapshots and turns gestures in the
 * Player area, Shared timer presses and bottom-bar actions into engine
 * commands. Holds no game rules.
 */
export function mountGameScreen(
  root: HTMLElement,
  initial: GameState,
  onEnd: (summary: Summary) => void,
  clock: () => number = Date.now,
) {
  let game = initial;
  let ended = false;
  let showTimes = loadShowTimes();

  const area = el("div", "player-area");
  const previous = el("div", "neighbour neighbour--previous");
  const next = el("div", "neighbour neighbour--next");
  const name = el("div", "current-name");
  const playerTimes = el("div", "player-times");
  const center = el("div", "player-center");
  center.append(name, playerTimes);
  const paused = el("div", "paused-overlay", "PAUSED");
  area.append(previous, center, next, paused);

  // Shared timer buttons in the top quarter; with none, the Player area fills the screen.
  const sharedTimerNames = snapshot(game, clock()).sharedTimers.map((t) => t.name);
  const sharedTimerBar = el("div", "shared-timers");
  sharedTimerBar.dataset.count = String(sharedTimerNames.length);
  const sharedTimerButtons = sharedTimerNames.map((sharedTimerName, index) => {
    const button = el("button", "shared-timer");
    button.type = "button";
    const times = el("span", "shared-timer__times");
    button.append(el("span", "shared-timer__name", sharedTimerName), times);
    button.addEventListener("click", () => {
      game = pressSharedTimer(game, index, clock());
      render();
    });
    return { button, times };
  });
  sharedTimerBar.append(...sharedTimerButtons.map((b) => b.button));

  // Bottom bar, out of the swipe area.
  const bottomBar = el("nav", "bottom-bar");
  const changeOrderButton = el("button", "bottom-bar__button", "Change order");
  changeOrderButton.type = "button";
  const settingsButton = el("button", "bottom-bar__button", "⚙ Settings");
  settingsButton.type = "button";
  const endButton = el("button", "bottom-bar__button", "End game");
  endButton.type = "button";
  endButton.addEventListener("click", () => {
    // The Game ends when End game is pressed, not when the question is answered.
    const now = clock();
    if (!confirm("End the Game? Are you sure?")) return;
    ended = true;
    onEnd(endGame(game, now));
  });
  bottomBar.append(changeOrderButton, settingsButton, endButton);

  // Change order: opening it pauses the Game; Done applies the new Turn order, which leaves the Game paused.
  changeOrderButton.addEventListener("click", () => {
    const now = clock();
    game = pause(game, now);
    const players = snapshot(game, now).players.map(({ name, color }) => ({ name, color }));
    const panel = changeOrderPanel(players, {
      onDone: (newOrder) => {
        game = changeOrder(game, newOrder, clock());
        panel.remove();
        render();
      },
      onCancel: () => panel.remove(),
    });
    screen.append(panel);
    render();
  });

  // Settings: opening it pauses the Game, and closing it leaves the Game as it is.
  const settings = el("div", "overlay-panel");
  settings.hidden = true;
  settings.setAttribute("role", "dialog");
  settings.setAttribute("aria-label", "Settings");
  const pauseButton = el("button", "primary-button");
  pauseButton.type = "button";
  const showTimesLabel = el("label", "settings-toggle");
  const showTimesBox = el("input");
  showTimesBox.type = "checkbox";
  showTimesLabel.append(showTimesBox, " Show times");
  const done = el("button", "secondary-button", "Done");
  done.type = "button";
  settings.append(el("h1", undefined, "Settings"), pauseButton, showTimesLabel, done);

  settingsButton.addEventListener("click", () => {
    game = pause(game, clock());
    showTimesBox.checked = showTimes;
    settings.hidden = false;
    render();
  });
  pauseButton.addEventListener("click", () => {
    const now = clock();
    game = snapshot(game, now).state === "paused" ? resume(game, now) : pause(game, now);
    render();
  });
  showTimesBox.addEventListener("change", () => {
    showTimes = showTimesBox.checked;
    saveShowTimes(showTimes);
    render();
  });
  done.addEventListener("click", () => {
    settings.hidden = true;
  });

  const screen = el("div", "game-screen");
  if (sharedTimerButtons.length > 0) screen.append(sharedTimerBar);
  screen.append(area, bottomBar, settings);
  root.replaceChildren(screen);

  let start: { id: number; x: number; y: number } | null = null;
  area.addEventListener("pointerdown", (e) => {
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  area.addEventListener("pointercancel", () => {
    start = null;
  });
  area.addEventListener("pointerup", (e) => {
    if (!start || start.id !== e.pointerId) return;
    const gesture = classify(e.clientX - start.x, e.clientY - start.y);
    start = null;
    if (!gesture) return;
    const now = clock();
    game = gesture.kind === "tap" ? tap(game, now) : swipe(game, gesture.direction, now);
    render();
  });

  function render() {
    const snap = snapshot(game, clock());
    const color = colorStyle(snap.currentPlayer.color);
    area.style.setProperty("--player-fill", color.fill);
    area.style.setProperty("--player-text", color.text);
    area.dataset.state = snap.state;
    name.textContent = snap.currentPlayer.name;
    previous.textContent = snap.previousName;
    next.textContent = snap.nextName;
    playerTimes.hidden = !showTimes;
    playerTimes.textContent = `Total ${formatDuration(snap.currentPlayer.timeMs)} · Turn ${formatDuration(snap.currentTurnMs)}`;
    sharedTimerButtons.forEach(({ button, times }, i) => {
      const inPlay = snap.sharedTimerInPlay === i;
      const running = inPlay && snap.state === "shared-timer";
      button.classList.toggle("shared-timer--running", running);
      button.classList.toggle("shared-timer--paused", inPlay && !running);
      button.setAttribute("aria-pressed", String(running));
      times.hidden = !showTimes;
      times.textContent = sharedTimerTimes(snap.sharedTimers[i], inPlay, sharedTimerButtons.length);
    });
    pauseButton.textContent = snap.state === "paused" ? "Resume" : "Pause";
  }

  // The engine resolves the Handover lazily, so re-render every frame.
  const frame = () => {
    if (ended) return;
    render();
    requestAnimationFrame(frame);
  };
  frame();
}
