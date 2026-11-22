import {
  canAddSharedTimer,
  type GameSetup,
  hasSharedTimerNamed,
  MAX_SHARED_TIMERS,
  setupProblem,
} from "../game/engine";
import { savedSharedTimerNames } from "../storage/savedNames";
import { el } from "./dom";
import { namePicker } from "./namePicker";
import { playerListEditor } from "./playerListEditor";
import { PROBLEM_HINTS } from "./setupHints";

/**
 * New game screen: pick Players from Saved names or type new ones (Guests
 * unless "save" is ticked), give each a Color, drag to set the starting
 * Turn order, add 0–4 Shared timers the same way, then Start. Game rules
 * (2–10 Players, unique Colors, at most 4 Shared timers) come from the
 * engine's setup check.
 */
export function mountSetupScreen(
  root: HTMLElement,
  handlers: { onStart: (setup: GameSetup) => void; onBack: () => void },
  /** Pre-filled setup, e.g. the last Game's for Play again; empty when omitted. */
  initial: GameSetup = { players: [], sharedTimers: [] },
) {
  let sharedTimers: string[] = [...initial.sharedTimers];
  const playerEditor = playerListEditor(initial.players, render);
  const setup = (): GameSetup => ({ players: playerEditor.players(), sharedTimers });

  const screen = el("main", "setup-screen");
  const header = el("header", "setup-header");
  const back = el("button", "text-button", "‹ Back");
  back.addEventListener("click", handlers.onBack);
  header.append(back, el("h1", undefined, "New game"));

  const sharedTimersHeading = el("h2");
  const sharedTimerList = el("ul", "shared-timer-list");
  const sharedTimerPicker = namePicker({
    placeholder: "New Shared timer, e.g. fight",
    saved: savedSharedTimerNames,
    isInGame: (name) => hasSharedTimerNamed(sharedTimers, name),
    hasRoom: () => canAddSharedTimer(sharedTimers),
    onAdd: (name) => {
      sharedTimers = [...sharedTimers, name];
      render();
    },
  });

  const footer = el("footer", "setup-footer");
  const hint = el("p", "setup-hint");
  const start = el("button", "primary-button", "Start");
  footer.append(hint, start);

  screen.append(header, ...playerEditor.elements, sharedTimersHeading, sharedTimerList, ...sharedTimerPicker.elements, footer);
  root.replaceChildren(screen);

  start.addEventListener("click", () => {
    if (setupProblem(setup()) === null) handlers.onStart(setup());
  });

  function renderSharedTimerRow(name: string, index: number) {
    const row = el("li", "shared-timer-row");
    const remove = el("button", "icon-button", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.addEventListener("click", () => {
      sharedTimers = sharedTimers.filter((_, i) => i !== index);
      render();
    });
    row.append(el("span", "shared-timer-name", name), remove);
    return row;
  }

  function render() {
    sharedTimersHeading.textContent = `Shared timers (${sharedTimers.length}/${MAX_SHARED_TIMERS})`;
    sharedTimerList.replaceChildren(...sharedTimers.map(renderSharedTimerRow));
    sharedTimerPicker.render();
    const problem = setupProblem(setup());
    start.disabled = problem !== null;
    hint.textContent = problem ? PROBLEM_HINTS[problem] : "";
  }

  render();
}
