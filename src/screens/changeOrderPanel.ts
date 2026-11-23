import { type PlayerSetup, playersProblem } from "../game/engine";
import { el } from "./dom";
import { playerListEditor } from "./playerListEditor";
import { PROBLEM_HINTS } from "./setupHints";

const ORDER_HINT = "The first Player becomes the Current player.";

/**
 * Change order panel over the Game screen: drag Players to a new Turn
 * order, add a late arrival or remove someone who left. Done hands the
 * new Turn order back to be applied; Cancel changes nothing. The 1–10
 * Players and unique Colors rules come from the engine.
 */
export function changeOrderPanel(
  players: PlayerSetup[],
  handlers: { onDone: (players: PlayerSetup[]) => void; onCancel: () => void },
) {
  const editor = playerListEditor(players, updateControls);

  const panel = el("div", "overlay-panel overlay-panel--scroll");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Change order");
  const header = el("header", "setup-header");
  const cancel = el("button", "text-button", "‹ Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", handlers.onCancel);
  header.append(cancel, el("h1", undefined, "Change order"));

  const footer = el("footer", "setup-footer");
  const hint = el("p", "setup-hint");
  const done = el("button", "primary-button", "Done");
  done.type = "button";
  done.addEventListener("click", () => {
    if (playersProblem(editor.players()) === null) handlers.onDone(editor.players());
  });
  footer.append(hint, done);

  panel.append(header, ...editor.elements, footer);

  function updateControls() {
    const problem = playersProblem(editor.players());
    done.disabled = problem !== null;
    hint.textContent = problem ? PROBLEM_HINTS[problem] : ORDER_HINT;
  }

  updateControls();
  return panel;
}
