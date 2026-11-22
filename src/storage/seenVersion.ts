/**
 * The last app version whose changes the user has seen, kept on this phone
 * in localStorage (ADR-0002). Storage failures mean no "what's new" note.
 */

const KEY = "bgt.seenVersion";

/**
 * The version last seen, or null when none is recorded. A phone that already
 * has data from the app but no recorded version ran a version from before
 * versions were tracked, which counts as "0.0.0" so its first update shows
 * what's new; a fresh install shows nothing.
 */
export function loadSeenVersion(): string | null {
  try {
    const seen = localStorage.getItem(KEY);
    if (seen) return seen;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith("bgt.")) return "0.0.0";
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSeenVersion(version: string): void {
  try {
    localStorage.setItem(KEY, version);
  } catch {
    // Storage unavailable: nothing to remember it in.
  }
}
