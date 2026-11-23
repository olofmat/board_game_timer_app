/**
 * What changed in each version, newest first. This list is where the
 * version number comes from: to release, add an entry at the top and push.
 *
 * Bump by semver: a new feature raises the middle number (1.2.0 → 1.3.0),
 * a fix only raises the last one (1.2.0 → 1.2.1). Write each change as the
 * players would notice it; after an update the app shows the new entries
 * once, on the Home or Summary screen.
 */
export interface Release {
  version: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.1.0",
    changes: [
      "You can start a Game with just one Player, to time yourself playing alone. Switch between your own clock and the Shared timers.",
    ],
  },
  {
    version: "1.0.0",
    changes: [
      "The version number is shown at the bottom of the Home screen. Tap it to see what's new.",
      "After an update, a note like this one says what changed.",
      "New versions load by themselves when you're on the Home or Summary screen.",
      "Total and Turn now tick over together.",
    ],
  },
];

/** The running version: the newest entry in the changelog. */
export const APP_VERSION = CHANGELOG[0].version;

/** Compare two "major.minor.patch" versions: negative if a is older than b, 0 if equal, positive if newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The releases newer than `seen`, newest first. */
export function releasesSince(seen: string, changelog: Release[] = CHANGELOG): Release[] {
  return changelog.filter((release) => compareVersions(release.version, seen) > 0);
}
