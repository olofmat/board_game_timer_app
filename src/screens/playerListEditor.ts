import { COLORS, type ColorName, colorStyle } from "../game/colors";
import {
  availableColors,
  canAddPlayer,
  hasPlayerNamed,
  type PlayerSetup,
} from "../game/engine";
import { savedPlayerNames } from "../storage/savedNames";
import { el } from "./dom";
import { namePicker } from "./namePicker";

const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

/**
 * Editable list of Players, used by setup and Change order: drag rows to
 * set the Turn order, tap a swatch to pick a Color (Colors other Players
 * have are disabled), remove a Player, and add one from Saved names or by
 * typing (a Guest unless "save" is ticked) with the first free Color.
 */
export function playerListEditor(initial: PlayerSetup[], onChange: () => void) {
  let players: PlayerSetup[] = [...initial];
  /** Index of the Player whose Color palette is open, if any. */
  let paletteFor: number | null = null;

  const heading = el("h2");
  const playerList = el("ol", "player-list");
  const picker = namePicker({
    placeholder: "New Player name",
    saved: savedPlayerNames,
    isInGame: (name) => hasPlayerNamed(players, name),
    hasRoom: () => canAddPlayer(players),
    onAdd: (name) => update([...players, { name, color: availableColors(players)[0] }]),
  });

  function update(next: PlayerSetup[]) {
    players = next;
    paletteFor = null;
    render();
    onChange();
  }

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
    remove.addEventListener("click", () => update(players.filter((_, i) => i !== index)));

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
      option.addEventListener("click", () => update(players.map((p, i) => (i === index ? { ...p, color } : p))));
      palette.append(option);
    }
    return palette;
  }

  /**
   * Drag a row by its handle to change the Turn order. Rows only
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
      update(reordered);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
  }

  function render() {
    heading.textContent = `Players (${players.length})`;
    playerList.replaceChildren(...players.map(renderPlayerRow));
    picker.render();
  }

  render();
  return { elements: [heading, playerList, ...picker.elements], players: () => players };
}
