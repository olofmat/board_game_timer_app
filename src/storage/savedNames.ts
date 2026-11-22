/**
 * Saved Player names, kept on this phone in localStorage (ADR-0002).
 * Colors are never saved. Storage failures (private mode, blocked
 * storage) degrade to an empty list rather than breaking the app.
 */

const PLAYER_NAMES_KEY = "bgt.savedPlayerNames";

export function loadSavedPlayerNames(): string[] {
  try {
    const raw = localStorage.getItem(PLAYER_NAMES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

function store(names: string[]): void {
  try {
    localStorage.setItem(PLAYER_NAMES_KEY, JSON.stringify(names));
  } catch {
    // Storage unavailable: the name just won't survive a reload.
  }
}

/** Add a Saved name (ignored if already saved, ignoring case), returning the new list. */
export function savePlayerName(name: string): string[] {
  const names = loadSavedPlayerNames();
  if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return names;
  const updated = [...names, name].sort((a, b) => a.localeCompare(b));
  store(updated);
  return updated;
}

export function deleteSavedPlayerName(name: string): string[] {
  const updated = loadSavedPlayerNames().filter((n) => n !== name);
  store(updated);
  return updated;
}
