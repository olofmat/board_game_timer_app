/** A duration as m:ss, or h:mm:ss from an hour up; seconds are rounded down. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * A running total and the part of it still going (the current Turn, or a
 * Shared timer's current stretch), formatted so both tick over on the same
 * frame. Rounding each down by itself would let the total, which carries
 * leftover milliseconds from earlier turns, step up to a second before the
 * part does. Only the display is rounded; the stored times stay exact.
 */
export function formatTotalAndPart(totalMs: number, partMs: number): { total: string; part: string } {
  const partSeconds = Math.floor(partMs / 1000);
  const earlierSeconds = Math.floor((totalMs - partMs) / 1000);
  return { total: formatDuration((earlierSeconds + partSeconds) * 1000), part: formatDuration(partSeconds * 1000) };
}
