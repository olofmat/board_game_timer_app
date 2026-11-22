import type { SavedNameList } from "../storage/savedNames";
import { el } from "./dom";

/**
 * Add-by-name controls shared by Players and Shared timers: a text field
 * with a "save" checkbox (off by default) and the Saved names not yet in
 * the Game, each pickable or deletable.
 */
export function namePicker(options: {
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
