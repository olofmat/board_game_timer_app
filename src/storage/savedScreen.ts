/**
 * The screen to come back to after the app is closed or reloaded: the
 * running Game (engine state is plain data, saved as-is) or the Summary
 * of the Game that just ended. Kept in localStorage (ADR-0002). Anything
 * unreadable, or saved by an incompatible version, is ignored.
 */
import type { GameState, Summary } from "../game/engine";

const KEY = "bgt.savedScreen";
/** Bump when the saved shape, including the engine's GameState or Summary, changes in a way older saves can't be read as. */
const VERSION = 1;

export type SavedScreen =
  | {
      screen: "game";
      game: GameState;
      /** When it was saved: the last moment the app is known to have been open. */
      savedAt: number;
    }
  | { screen: "summary"; summary: Summary };

function store(saved: SavedScreen): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...saved }));
  } catch {
    // Storage unavailable: the Game just won't survive a reload.
  }
}

export function saveGame(game: GameState, now: number): void {
  store({ screen: "game", game, savedAt: now });
}

export function saveSummary(summary: Summary): void {
  store({ screen: "summary", summary });
}

/** Forget the saved screen, e.g. once a new Game is being set up. */
export function clearSavedScreen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export function loadSavedScreen(): SavedScreen | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== VERSION) return null;
    if (parsed.screen === "game" && Array.isArray(parsed.game?.players) && typeof parsed.savedAt === "number") {
      return { screen: "game", game: parsed.game, savedAt: parsed.savedAt };
    }
    if (parsed.screen === "summary" && Array.isArray(parsed.summary?.players)) {
      return { screen: "summary", summary: parsed.summary };
    }
    return null;
  } catch {
    return null;
  }
}
