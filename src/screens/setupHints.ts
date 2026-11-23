import { MAX_PLAYERS, MAX_SHARED_TIMERS, MIN_PLAYERS, type SetupProblem } from "../game/engine";

/** What to tell the host when the engine rejects the Players or Shared timers. */
export const PROBLEM_HINTS: Record<SetupProblem, string> = {
  "too-few-players": MIN_PLAYERS === 1 ? "A Game needs a Player." : `A Game needs at least ${MIN_PLAYERS} Players.`,
  "too-many-players": `A Game has at most ${MAX_PLAYERS} Players.`,
  "duplicate-color": "Each Player needs a different Color.",
  "duplicate-name": "Each Player needs a different name.",
  "too-many-shared-timers": `A Game has at most ${MAX_SHARED_TIMERS} Shared timers.`,
  "duplicate-shared-timer-name": "Each Shared timer needs a different name.",
};
