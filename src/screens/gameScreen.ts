import { colorStyle } from "../game/colors";
import {
  endGame,
  type GameState,
  pressSharedTimer,
  snapshot,
  type Summary,
  swipe,
  type SwipeDirection,
  tap,
} from "../game/engine";

/** Minimum horizontal travel (px) for a gesture to count as a swipe. */
const SWIPE_MIN_PX = 50;
/** Maximum travel (px) for a gesture to still count as a tap. */
const TAP_MAX_PX = 12;

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
 * The Game screen: renders engine snapshots and turns gestures in the
 * Player area and Shared timer presses into engine commands. Holds no
 * game rules.
 */
export function mountGameScreen(
  root: HTMLElement,
  initial: GameState,
  onEnd: (summary: Summary) => void,
  clock: () => number = Date.now,
) {
  let game = initial;
  let ended = false;

  const area = document.createElement("div");
  area.className = "player-area";
  const previous = document.createElement("div");
  previous.className = "neighbour neighbour--previous";
  const next = document.createElement("div");
  next.className = "neighbour neighbour--next";
  const name = document.createElement("div");
  name.className = "current-name";
  const paused = document.createElement("div");
  paused.className = "paused-overlay";
  paused.textContent = "PAUSED";
  area.append(previous, name, next, paused);

  // Shared timer buttons in the top quarter; with none, the Player area fills the screen.
  const sharedTimerNames = snapshot(game, clock()).sharedTimers.map((t) => t.name);
  const sharedTimerBar = document.createElement("div");
  sharedTimerBar.className = "shared-timers";
  sharedTimerBar.dataset.count = String(sharedTimerNames.length);
  const sharedTimerButtons = sharedTimerNames.map((sharedTimerName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shared-timer";
    button.textContent = sharedTimerName;
    button.addEventListener("click", () => {
      game = pressSharedTimer(game, index, clock());
      render();
    });
    return button;
  });
  sharedTimerBar.append(...sharedTimerButtons);

  // Bottom bar, out of the swipe area. Change order and Settings will join End game here.
  const bottomBar = document.createElement("nav");
  bottomBar.className = "bottom-bar";
  const endButton = document.createElement("button");
  endButton.type = "button";
  endButton.className = "bottom-bar__button";
  endButton.textContent = "End game";
  endButton.addEventListener("click", () => {
    // The Game ends when End game is pressed, not when the question is answered.
    const now = clock();
    if (!confirm("End the Game? Are you sure?")) return;
    ended = true;
    onEnd(endGame(game, now));
  });
  bottomBar.append(endButton);

  const screen = document.createElement("div");
  screen.className = "game-screen";
  if (sharedTimerButtons.length > 0) screen.append(sharedTimerBar);
  screen.append(area, bottomBar);
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
    sharedTimerButtons.forEach((button, i) => {
      const running = snap.runningSharedTimer === i;
      button.classList.toggle("shared-timer--running", running);
      button.setAttribute("aria-pressed", String(running));
    });
  }

  // The engine resolves the Handover lazily, so re-render every frame.
  const frame = () => {
    if (ended) return;
    render();
    requestAnimationFrame(frame);
  };
  frame();
}
