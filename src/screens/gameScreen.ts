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
import { keepScreenAwake } from "../platform/wakeLock";
import { loadShowTimes, saveShowTimes } from "../storage/preferences";
import { changeOrderPanel } from "./changeOrderPanel";
import { el } from "./dom";
import { formatTotalAndPart } from "./format";

/** Minimum horizontal travel (px) for a gesture to count as a swipe. */
const SWIPE_MIN_PX = 50;
/** Maximum travel (px) for a gesture to still count as a tap. */
const TAP_MAX_PX = 12;
/** With Show times on, Shared timer buttons show their current stretch too only up to this many buttons. */
const MAX_SHARED_TIMERS_SHOWING_STRETCH = 2;
/** How often the running Game is saved even without a command. */
const HEARTBEAT_MS = 5_000;

type Gesture = { kind: "tap" } | { kind: "swipe"; direction: SwipeDirection } | null;

/** Width of each edge strip of the Player area, as a fraction, where a tap moves to that side's Player. */
const TAP_EDGE_FRACTION = 0.25;

/**
 * Classify a finished pointer gesture. The previous Player is shown on the
 * left and the next on the right, and the gesture "pulls" a neighbour in:
 * swiping right to left goes to the next Player, left to right to the
 * previous one. A tap in the right quarter goes to the next Player, in
 * the left quarter to the previous one, and in the middle half it is a
 * plain tap (pause/resume). `xFraction` is where the gesture started,
 * 0 at the left edge of the Player area and 1 at the right.
 */
function classify(dx: number, dy: number, xFraction: number): Gesture {
  if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
    return { kind: "swipe", direction: dx < 0 ? "next" : "previous" };
  }
  if (Math.hypot(dx, dy) > TAP_MAX_PX) return null;
  if (xFraction >= 1 - TAP_EDGE_FRACTION) return { kind: "swipe", direction: "next" };
  if (xFraction < TAP_EDGE_FRACTION) return { kind: "swipe", direction: "previous" };
  return { kind: "tap" };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The clock symbol marking what is gaining time right now. An inline SVG
 * (not an emoji) so it looks the same on every phone; it is drawn in
 * `currentColor` and is decorative, hidden from screen readers.
 */
function clockIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "clock-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  const face = document.createElementNS(SVG_NS, "circle");
  face.setAttribute("cx", "12");
  face.setAttribute("cy", "12");
  face.setAttribute("r", "9.5");
  const hands = document.createElementNS(SVG_NS, "path");
  hands.setAttribute("d", "M12 6.5V12l3.5 2.5");
  svg.append(face, hands);
  return svg;
}

/**
 * Show times text for a Shared timer button: total and current stretch
 * with 1–2 buttons (the stretch only while it is in play), total alone
 * with 3–4 so the small buttons stay readable.
 */
function sharedTimerTimes(timer: SharedTimerSnapshot, inPlay: boolean, buttonCount: number): string {
  // Rounded together with the stretch, so the total ticks in step with it even when the stretch is hidden.
  const { total, part } = formatTotalAndPart(timer.timeMs, inPlay ? timer.stretchMs : 0);
  if (buttonCount > MAX_SHARED_TIMERS_SHOWING_STRETCH || !inPlay) return total;
  return `${total} · now ${part}`;
}

/**
 * The Game screen: renders engine snapshots and turns gestures in the
 * Player area, Shared timer presses and bottom-bar actions into engine
 * commands. Holds no game rules.
 */
export function mountGameScreen(
  root: HTMLElement,
  initial: GameState,
  handlers: {
    /** Called with the state and the time after every command, and every few seconds while the screen is open. */
    onChange: (game: GameState, now: number) => void;
    onEnd: (summary: Summary) => void;
  },
  clock: () => number = Date.now,
) {
  let game = initial;
  let ended = false;

  /** Take the result of an engine command: keep it, report it for saving and show it. */
  function applyCommand(next: GameState) {
    game = next;
    handlers.onChange(game, clock());
    render();
  }
  let showTimes = loadShowTimes();

  const area = el("div", "player-area");
  const previous = el("div", "neighbour neighbour--previous");
  const next = el("div", "neighbour neighbour--next");
  const nameText = el("span");
  const nameRow = el("span", "current-name__row");
  nameRow.append(clockIcon(), nameText);
  const nameBlock = el("div", "current-name");
  nameBlock.append(nameRow);
  const playerTimes = el("div", "player-times");
  const center = el("div", "player-center");
  center.append(nameBlock, playerTimes);
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
    const nameRow = el("span", "shared-timer__name");
    nameRow.append(clockIcon(), sharedTimerName);
    button.append(nameRow, times);
    button.addEventListener("click", () => {
      applyCommand(pressSharedTimer(game, index, clock()));
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
    stop();
    handlers.onEnd(endGame(game, now));
  });
  bottomBar.append(changeOrderButton, settingsButton, endButton);

  // Change order: opening it pauses the Game; Done applies the new Turn order, which leaves the Game paused.
  changeOrderButton.addEventListener("click", () => {
    const now = clock();
    applyCommand(pause(game, now));
    const players = snapshot(game, now).players.map(({ name, color }) => ({ name, color }));
    const panel = changeOrderPanel(players, {
      onDone: (newOrder) => {
        panel.remove();
        applyCommand(changeOrder(game, newOrder, clock()));
      },
      onCancel: () => panel.remove(),
    });
    screen.append(panel);
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
    showTimesBox.checked = showTimes;
    settings.hidden = false;
    applyCommand(pause(game, clock()));
  });
  pauseButton.addEventListener("click", () => {
    const now = clock();
    applyCommand(snapshot(game, now).state === "paused" ? resume(game, now) : pause(game, now));
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
    const box = area.getBoundingClientRect();
    const xFraction = box.width > 0 ? (start.x - box.left) / box.width : 0.5;
    const gesture = classify(e.clientX - start.x, e.clientY - start.y, xFraction);
    start = null;
    if (!gesture) return;
    const now = clock();
    applyCommand(gesture.kind === "tap" ? tap(game, now) : swipe(game, gesture.direction, now));
  });

  function render() {
    const snap = snapshot(game, clock());
    const color = colorStyle(snap.currentPlayer.color);
    area.style.setProperty("--player-fill", color.fill);
    area.style.setProperty("--player-text", color.text);
    area.dataset.state = snap.state;
    nameText.textContent = snap.currentPlayer.name;
    nameRow.classList.toggle("current-name__row--running", snap.state === "running");
    // Playing alone, both neighbours would be the Current player themselves.
    const alone = snap.players.length === 1;
    previous.textContent = alone ? "" : snap.previousName;
    next.textContent = alone ? "" : snap.nextName;
    playerTimes.hidden = !showTimes;
    const times = formatTotalAndPart(snap.currentPlayer.timeMs, snap.currentTurnMs);
    playerTimes.textContent = `Total ${times.total} · Turn ${times.part}`;
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

  // Closing or hiding the app pauses the Game at that moment, so time while it is closed is Paused time.
  const pauseWhenHidden = () => {
    if (document.visibilityState === "hidden") applyCommand(pause(game, clock()));
  };
  const pauseOnPageHide = () => applyCommand(pause(game, clock()));
  document.addEventListener("visibilitychange", pauseWhenHidden);
  window.addEventListener("pagehide", pauseOnPageHide);
  // Saving now and then keeps the last-known-open moment fresh in case the browser kills the app unannounced.
  const heartbeat = setInterval(() => handlers.onChange(game, clock()), HEARTBEAT_MS);
  const releaseWakeLock = keepScreenAwake();

  /** Leave the Game screen: stop rendering, saving and holding the screen awake. */
  function stop() {
    ended = true;
    document.removeEventListener("visibilitychange", pauseWhenHidden);
    window.removeEventListener("pagehide", pauseOnPageHide);
    clearInterval(heartbeat);
    releaseWakeLock();
  }

  // The engine resolves the Handover lazily, so re-render every frame.
  const frame = () => {
    if (ended) return;
    render();
    requestAnimationFrame(frame);
  };
  frame();
}
