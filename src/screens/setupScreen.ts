import { COLORS, type ColorName, colorStyle } from "../game/colors";
import {
  availableColors,
  canAddPlayer,
  canAddSharedTimer,
  type GameSetup,
  hasPlayerNamed,
  hasSharedTimerNamed,
  MAX_PLAYERS,
  MAX_SHARED_TIMERS,
  MIN_PLAYERS,
  type PlayerSetup,
  type SetupProblem,
  setupProblem,
} from "../game/engine";
import { type SavedNameList, savedPlayerNames, savedSharedTimerNames } from "../storage/savedNames";

const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

const PROBLEM_HINTS: Record<SetupProblem, string> = {
  "too-few-players": `Add at least ${MIN_PLAYERS} Players to start.`,
  "too-many-players": `A Game has at most ${MAX_PLAYERS} Players.`,
  "duplicate-color": "Each Player needs a different Color.",
  "duplicate-name": "Each Player needs a different name.",
  "too-many-shared-timers": `A Game has at most ${MAX_SHARED_TIMERS} Shared timers.`,
  "duplicate-shared-timer-name": "Each Shared timer needs a different name.",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Add-by-name controls shared by Players and Shared timers: a text field
 * with a "save" checkbox (off by default) and the Saved names not yet in
 * the Game, each pickable or deletable.
 */
function namePicker(options: {
  placeholder: string;
  saved: SavedNameList;
  /** Whether this name is already in the Game. */
  isInGame: (name: string) => boolean;
  /** Whether the Game has room for one more. */
  hasRoom: () => boolean;
  onAdd: (name: string) => void;
}) {
  let savedNames = options.saved.load();
  const canAdd = (name: string) => name !== "" && !options.isInGame(name) && options.hasRoom();

  const form = el("form", "add-name");
  const input = el("input");
  input.type = "text";
  input.placeholder = options.placeholder;
  input.autocomplete = "off";
  input.maxLength = 24;
  const saveLabel = el("label", "save-toggle");
  const saveBox = el("input");
  saveBox.type = "checkbox";
  saveLabel.append(saveBox, " save");
  const addButton = el("button", "secondary-button", "Add");
  addButton.type = "submit";
  form.append(input, saveLabel, addButton);

  const savedHeading = el("h3", undefined, "Saved names");
  const savedList = el("ul", "saved-names");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!canAdd(name)) return;
    if (saveBox.checked) savedNames = options.saved.save(name);
    input.value = "";
    saveBox.checked = false;
    options.onAdd(name);
  });
  input.addEventListener("input", updateAddButton);

  function updateAddButton() {
    addButton.disabled = !canAdd(input.value.trim());
  }

  function render() {
    const available = savedNames.filter((n) => !options.isInGame(n));
    savedHeading.hidden = available.length === 0;
    savedList.replaceChildren(
      ...available.map((name) => {
        const item = el("li", "saved-name");
        const pick = el("button", "saved-name__pick", name);
        pick.type = "button";
        pick.disabled = !options.hasRoom();
        pick.addEventListener("click", () => {
          if (canAdd(name)) options.onAdd(name);
        });
        const del = el("button", "icon-button", "×");
        del.type = "button";
        del.setAttribute("aria-label", `Delete saved name ${name}`);
        del.addEventListener("click", () => {
          if (!confirm(`Delete saved name "${name}"?`)) return;
          savedNames = options.saved.delete(name);
          render();
        });
        item.append(pick, del);
        return item;
      }),
    );
    updateAddButton();
  }

  return { elements: [form, savedHeading, savedList], render };
}

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
) {
  let players: PlayerSetup[] = [];
  let sharedTimers: string[] = [];
  /** Index of the Player whose Color palette is open, if any. */
  let paletteFor: number | null = null;
  const setup = (): GameSetup => ({ players, sharedTimers });

  const screen = el("main", "setup-screen");
  const header = el("header", "setup-header");
  const back = el("button", "text-button", "‹ Back");
  back.addEventListener("click", handlers.onBack);
  header.append(back, el("h1", undefined, "New game"));

  const playersHeading = el("h2");
  const playerList = el("ol", "player-list");
  const playerPicker = namePicker({
    placeholder: "New Player name",
    saved: savedPlayerNames,
    isInGame: (name) => hasPlayerNamed(players, name),
    hasRoom: () => canAddPlayer(players),
    onAdd: addPlayer,
  });

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

  screen.append(
    header,
    playersHeading,
    playerList,
    ...playerPicker.elements,
    sharedTimersHeading,
    sharedTimerList,
    ...sharedTimerPicker.elements,
    footer,
  );
  root.replaceChildren(screen);

  /** Add a Player with the first Color nobody has taken; tap their swatch to change it. */
  function addPlayer(name: string) {
    players = [...players, { name, color: availableColors(players)[0] }];
    render();
  }

  start.addEventListener("click", () => {
    if (setupProblem(setup()) === null) handlers.onStart(setup());
  });

  function renderPlayerRow(player: PlayerSetup, index: number) {
    const row = el("li", "player-row");
    row.dataset.index = String(index);

    const handle = el("span", "drag-handle", "≡");
    handle.setAttribute("aria-label", "Drag to reorder");
    enableDrag(handle, row);

    const swatch = el("button", "color-swatch");
    swatch.type = "button";
    swatch.style.background = colorStyle(player.color).fill;
    swatch.setAttribute("aria-label", `Color: ${player.color}. Change`);
    swatch.addEventListener("click", () => {
      paletteFor = paletteFor === index ? null : index;
      render();
    });

    const name = el("span", "player-name", player.name);
    const remove = el("button", "icon-button", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${player.name}`);
    remove.addEventListener("click", () => {
      players = players.filter((_, i) => i !== index);
      paletteFor = null;
      render();
    });

    row.append(handle, swatch, name, remove);
    if (paletteFor === index) row.append(renderPalette(index));
    return row;
  }

  /** The Color palette for one Player; Colors taken by other Players are disabled. */
  function renderPalette(index: number) {
    const palette = el("div", "palette");
    const available = new Set(availableColors(players, index));
    for (const color of COLOR_NAMES) {
      const option = el("button", "color-swatch");
      option.type = "button";
      option.style.background = colorStyle(color).fill;
      option.setAttribute("aria-label", color);
      option.disabled = !available.has(color);
      if (players[index].color === color) option.classList.add("color-swatch--selected");
      option.addEventListener("click", () => {
        players = players.map((p, i) => (i === index ? { ...p, color } : p));
        paletteFor = null;
        render();
      });
      palette.append(option);
    }
    return palette;
  }

  /**
   * Drag a row by its handle to change the starting Turn order. Rows only
   * slide visually while dragging (moving DOM nodes would drop the pointer
   * capture); the new order is applied on release.
   */
  function enableDrag(handle: HTMLElement, row: HTMLElement) {
    let drag: { startY: number; from: number; to: number; mids: number[]; height: number } | null = null;
    const rows = () => [...playerList.children] as HTMLElement[];

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const boxes = rows().map((r) => r.getBoundingClientRect());
      const from = rows().indexOf(row);
      drag = {
        startY: e.clientY,
        from,
        to: from,
        mids: boxes.map((b) => b.top + b.height / 2),
        height: boxes[from].height,
      };
      row.classList.add("player-row--dragging");
    });

    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      const center = drag.mids[drag.from] + dy;
      const { from, height } = drag;
      drag.to = drag.mids.filter((mid, i) => i !== from && mid < center).length;
      const to = drag.to;
      rows().forEach((r, i) => {
        let shift = 0;
        if (i === from) shift = dy;
        else if (from < i && i <= to) shift = -height;
        else if (to <= i && i < from) shift = height;
        r.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    });

    const finish = () => {
      if (!drag) return;
      const { from, to } = drag;
      drag = null;
      const reordered = [...players];
      reordered.splice(to, 0, ...reordered.splice(from, 1));
      players = reordered;
      paletteFor = null;
      render();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
  }

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
    playersHeading.textContent = `Players (${players.length})`;
    playerList.replaceChildren(...players.map(renderPlayerRow));
    playerPicker.render();
    sharedTimersHeading.textContent = `Shared timers (${sharedTimers.length}/${MAX_SHARED_TIMERS})`;
    sharedTimerList.replaceChildren(...sharedTimers.map(renderSharedTimerRow));
    sharedTimerPicker.render();
    const problem = setupProblem(setup());
    start.disabled = problem !== null;
    hint.textContent = problem ? PROBLEM_HINTS[problem] : "";
  }

  render();
}
