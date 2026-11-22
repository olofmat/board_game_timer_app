/**
 * Saved names, kept on this phone in localStorage (ADR-0002). Player names
 * and Shared timer names are separate lists. Colors are never saved.
 * Storage failures (private mode, blocked storage) degrade to an empty
 * list rather than breaking the app.
 */

export interface SavedNameList {
  load(): string[];
  /** Add a Saved name (ignored if already saved, ignoring case), returning the new list. */
  save(name: string): string[];
  delete(name: string): string[];
}

function savedNameList(key: string): SavedNameList {
  function load(): string[] {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
    } catch {
      return [];
    }
  }

  function store(names: string[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(names));
    } catch {
      // Storage unavailable: the name just won't survive a reload.
    }
  }

  return {
    load,
    save(name) {
      const names = load();
      if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return names;
      const updated = [...names, name].sort((a, b) => a.localeCompare(b));
      store(updated);
      return updated;
    },
    delete(name) {
      const updated = load().filter((n) => n !== name);
      store(updated);
      return updated;
    },
  };
}

export const savedPlayerNames = savedNameList("bgt.savedPlayerNames");
export const savedSharedTimerNames = savedNameList("bgt.savedSharedTimerNames");
