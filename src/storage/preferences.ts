/**
 * Preferences kept on this phone in localStorage (ADR-0002), remembered
 * between Games. Storage failures fall back to the default.
 */

const SHOW_TIMES_KEY = "bgt.showTimes";

/** Whether clocks are shown during a Game; off by default (names only). */
export function loadShowTimes(): boolean {
  try {
    return localStorage.getItem(SHOW_TIMES_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remember the Show times choice for future Games. */
export function saveShowTimes(showTimes: boolean): void {
  try {
    localStorage.setItem(SHOW_TIMES_KEY, String(showTimes));
  } catch {
    // Storage unavailable: the choice just won't survive a reload.
  }
}
