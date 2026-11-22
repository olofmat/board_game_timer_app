/**
 * The Game engine: pure rules for timing a Game. No DOM or browser APIs.
 * Time is always passed in as `now` (milliseconds); state is plain
 * JSON-serializable data and every command returns a new state.
 * Terms follow GLOSSARY.md.
 */

import { COLORS, type ColorName } from "./colors";

/** Length of the Activation delay. */
export const ACTIVATION_DELAY_MS = 300;

/** Swipe right moves to the next Player in the Turn order, left to the previous one. */
export type SwipeDirection = "right" | "left";

export type RunState = "paused" | "running" | "activating";

export interface PlayerSetup {
  name: string;
  color: ColorName;
}

export interface PlayerTimes extends PlayerSetup {
  timeMs: number;
  turns: number;
}

export interface GameState {
  players: PlayerTimes[];
  currentIndex: number;
  mode: RunState;
  /** When the current mode started; time since then is not yet credited. */
  since: number;
  /** When an Activation delay ends (the Handover); null unless activating. */
  handoverAt: number | null;
  /** The Player whose Turn was last running, or null before the first Turn. */
  turnPlayerIndex: number | null;
  /** Credited time in the current Turn of `turnPlayerIndex`. */
  turnMs: number;
  swipingMs: number;
  pausedMs: number;
}

export interface Snapshot {
  currentPlayer: PlayerSetup;
  state: RunState;
  previousName: string;
  nextName: string;
  players: PlayerTimes[];
  /** Time in the Current player's ongoing Turn (0 if they have none). */
  currentTurnMs: number;
  swipingMs: number;
  pausedMs: number;
  gameMs: number;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Why a Game can't be created from this setup. */
export type SetupProblem = "too-few-players" | "too-many-players" | "duplicate-color";

/** Check a setup before creating a Game from it; null means it is valid. */
export function setupProblem(players: PlayerSetup[]): SetupProblem | null {
  if (players.length < MIN_PLAYERS) return "too-few-players";
  if (players.length > MAX_PLAYERS) return "too-many-players";
  if (new Set(players.map((p) => p.color)).size < players.length) return "duplicate-color";
  return null;
}

/** Whether another Player can join this setup. */
export function canAddPlayer(players: PlayerSetup[]): boolean {
  return players.length < MAX_PLAYERS;
}

/**
 * Colors no other Player in the setup has taken, in palette order. With
 * `forIndex`, that Player's own Color counts as available.
 */
export function availableColors(players: PlayerSetup[], forIndex?: number): ColorName[] {
  const taken = new Set(players.filter((_, i) => i !== forIndex).map((p) => p.color));
  return (Object.keys(COLORS) as ColorName[]).filter((c) => !taken.has(c));
}

/** Create a Game from a valid setup, opening paused on the first Player. Throws on an invalid setup. */
export function createGame(players: PlayerSetup[], now: number): GameState {
  const problem = setupProblem(players);
  if (problem) throw new Error(`Invalid Game setup: ${problem}`);
  return {
    players: players.map(({ name, color }) => ({ name, color, timeMs: 0, turns: 0 })),
    currentIndex: 0,
    mode: "paused",
    since: now,
    handoverAt: null,
    turnPlayerIndex: null,
    turnMs: 0,
    swipingMs: 0,
    pausedMs: 0,
  };
}

/**
 * Tap in the Player area: pause, or resume the Current player.
 * Tapping during an Activation delay pauses on the new Current player
 * before their Handover, so they gain no time or Turn yet.
 */
export function tap(game: GameState, now: number): GameState {
  const settled = credit(game, now);
  if (settled.mode === "paused") return startClock(settled);
  return { ...settled, mode: "paused", handoverAt: null };
}

/**
 * Swipe in the Player area: stop whatever runs and make the neighbouring
 * Player current, with their clock starting at the Handover.
 */
export function swipe(game: GameState, direction: SwipeDirection, now: number): GameState {
  const settled = credit(game, now);
  return {
    ...settled,
    mode: "activating",
    currentIndex: turnOrderIndex(settled, direction === "right" ? 1 : -1),
    handoverAt: now + ACTIVATION_DELAY_MS,
  };
}

export function snapshot(game: GameState, now: number): Snapshot {
  const settled = credit(game, now);
  const playerAt = (offset: number) => settled.players[turnOrderIndex(settled, offset)];
  const current = playerAt(0);
  const playersMs = settled.players.reduce((sum, p) => sum + p.timeMs, 0);
  return {
    currentPlayer: { name: current.name, color: current.color },
    state: settled.mode,
    previousName: playerAt(-1).name,
    nextName: playerAt(1).name,
    players: settled.players.map((p) => ({ ...p })),
    currentTurnMs: settled.turnPlayerIndex === settled.currentIndex ? settled.turnMs : 0,
    swipingMs: settled.swipingMs,
    pausedMs: settled.pausedMs,
    // Shared timers will add to Game time once they exist.
    gameMs: playersMs + settled.swipingMs,
  };
}

/** Credit all time up to `now` to whatever was running, so `since` becomes `now`. */
function credit(game: GameState, now: number): GameState {
  const elapsed = now - game.since;
  switch (game.mode) {
    case "activating": {
      const handoverAt = game.handoverAt ?? game.since;
      if (now < handoverAt) return { ...game, since: now, swipingMs: game.swipingMs + elapsed };
      const handedOver = startClock({
        ...game,
        since: handoverAt,
        handoverAt: null,
        swipingMs: game.swipingMs + (handoverAt - game.since),
      });
      return credit(handedOver, now);
    }
    case "paused":
      return { ...game, since: now, pausedMs: game.pausedMs + elapsed };
    case "running":
      return {
        ...updateCurrentPlayer(game, (p) => ({ ...p, timeMs: p.timeMs + elapsed })),
        since: now,
        turnMs: game.turnMs + elapsed,
      };
  }
}

/** Start the Current player's clock; a new Turn unless their Turn was the last one running. */
function startClock(game: GameState): GameState {
  if (game.turnPlayerIndex === game.currentIndex) return { ...game, mode: "running" };
  return {
    ...updateCurrentPlayer(game, (p) => ({ ...p, turns: p.turns + 1 })),
    mode: "running",
    turnPlayerIndex: game.currentIndex,
    turnMs: 0,
  };
}

/** Index of the Player `offset` steps from the Current player, cycling through the Turn order. */
function turnOrderIndex(game: GameState, offset: number): number {
  const count = game.players.length;
  return (((game.currentIndex + offset) % count) + count) % count;
}

function updateCurrentPlayer(game: GameState, change: (p: PlayerTimes) => PlayerTimes): GameState {
  return { ...game, players: game.players.map((p, i) => (i === game.currentIndex ? change(p) : p)) };
}
