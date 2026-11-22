import { colorStyle } from "../game/colors";
import { type GameState, snapshot, swipe, type SwipeDirection, tap } from "../game/engine";

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
 * Player area into engine commands. Holds no game rules.
 */
export function mountGameScreen(root: HTMLElement, initial: GameState, clock: () => number = Date.now) {
  let game = initial;

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
  root.replaceChildren(area);

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
  }

  // The engine resolves the Handover lazily, so re-render every frame.
  const frame = () => {
    render();
    requestAnimationFrame(frame);
  };
  frame();
}
