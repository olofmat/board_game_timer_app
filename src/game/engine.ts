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

/** "shared-timer": a Shared timer runs while the Current player (the interrupted Player) waits. */
export type RunState = "paused" | "running" | "activating" | "shared-timer";

export interface PlayerSetup {
  name: string;
  color: ColorName;
}

/** Everything needed to create a Game: Players in starting Turn order and Shared timer names. */
export interface GameSetup {
  players: PlayerSetup[];
  sharedTimers: string[];
}

export interface PlayerTimes extends PlayerSetup {
  timeMs: number;
  turns: number;
}

export interface SharedTimerTimes {
  name: string;
  timeMs: number;
}

export interface SharedTimerSnapshot extends SharedTimerTimes {
  /** Time since this Shared timer was last started (0 unless it is in play). */
  stretchMs: number;
}

export interface GameState {
  players: PlayerTimes[];
  sharedTimers: SharedTimerTimes[];
  /** Index of the Shared timer in play (running, or paused while mode is "paused"); null when play is with the Current player. */
  sharedTimerInPlay: number | null;
  /** Credited time in the current stretch of the Shared timer in play (pausing does not split it). */
  stretchMs: number;
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
  currentPlayer: PlayerTimes;
  state: RunState;
  previousName: string;
  nextName: string;
  players: PlayerTimes[];
  sharedTimers: SharedTimerSnapshot[];
  /** Index of the Shared timer in play (running, or paused while state is "paused"), or null. */
  sharedTimerInPlay: number | null;
  /** Time in the Current player's ongoing Turn (0 if they have none). */
  currentTurnMs: number;
  swipingMs: number;
  pausedMs: number;
  gameMs: number;
}

/** One Player's line in the Summary. */
export interface SummaryPlayer extends PlayerTimes {
  /** Total time divided by Turns; null for a Player who never had a Turn. */
  averageTurnMs: number | null;
}

/** What a Game adds up to after End game. */
export interface Summary {
  /** Slowest first. */
  players: SummaryPlayer[];
  sharedTimers: SharedTimerTimes[];
  swipingMs: number;
  pausedMs: number;
  gameMs: number;
  /** The setup to Play again with: same Players, Colors, Turn order and Shared timers. */
  setup: GameSetup;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const MAX_SHARED_TIMERS = 4;

/** Why a Game can't be created from this setup. */
export type SetupProblem =
  | "too-few-players"
  | "too-many-players"
  | "duplicate-color"
  | "duplicate-name"
  | "too-many-shared-timers"
  | "duplicate-shared-timer-name";

/** Check a setup before creating a Game from it; null means it is valid. */
export function setupProblem({ players, sharedTimers }: GameSetup): SetupProblem | null {
  if (players.length < MIN_PLAYERS) return "too-few-players";
  if (players.length > MAX_PLAYERS) return "too-many-players";
  if (new Set(players.map((p) => p.color)).size < players.length) return "duplicate-color";
  if (hasDuplicateName(players.map((p) => p.name))) return "duplicate-name";
  if (sharedTimers.length > MAX_SHARED_TIMERS) return "too-many-shared-timers";
  if (hasDuplicateName(sharedTimers)) return "duplicate-shared-timer-name";
  return null;
}

function hasDuplicateName(names: string[]): boolean {
  return new Set(names.map((n) => n.toLowerCase())).size < names.length;
}

/** Whether a Player with this name (ignoring case) is already in the setup. */
export function hasPlayerNamed(players: PlayerSetup[], name: string): boolean {
  return players.some((p) => p.name.toLowerCase() === name.toLowerCase());
}

/** Whether another Player can join this setup. */
export function canAddPlayer(players: PlayerSetup[]): boolean {
  return players.length < MAX_PLAYERS;
}

/** Whether a Shared timer with this name (ignoring case) is already in the setup. */
export function hasSharedTimerNamed(sharedTimers: string[], name: string): boolean {
  return sharedTimers.some((t) => t.toLowerCase() === name.toLowerCase());
}

/** Whether another Shared timer can join this setup. */
export function canAddSharedTimer(sharedTimers: string[]): boolean {
  return sharedTimers.length < MAX_SHARED_TIMERS;
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
export function createGame(setup: GameSetup, now: number): GameState {
  const problem = setupProblem(setup);
  if (problem) throw new Error(`Invalid Game setup: ${problem}`);
  return {
    players: setup.players.map(({ name, color }) => ({ name, color, timeMs: 0, turns: 0 })),
    sharedTimers: setup.sharedTimers.map((name) => ({ name, timeMs: 0 })),
    sharedTimerInPlay: null,
    stretchMs: 0,
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
 * Tap in the Player area: pause, or resume what was paused (see `resume`).
 * During a Shared timer it returns to the interrupted Player at once, as a
 * new Turn. Tapping during an Activation delay pauses on the new Current
 * player before their Handover, so they gain no time or Turn yet.
 */
export function tap(game: GameState, now: number): GameState {
  const settled = credit(game, now);
  if (settled.mode === "paused") return resume(settled, now);
  if (settled.mode === "shared-timer") return startClock(settled);
  return pause(settled, now);
}

/**
 * Pause whatever runs (from Settings, the way to pause during a Shared
 * timer). Pausing during an Activation delay pauses on the new Current
 * player before their Handover. Does nothing if already paused.
 */
export function pause(game: GameState, now: number): GameState {
  const settled = credit(game, now);
  if (settled.mode === "paused") return settled;
  return { ...settled, mode: "paused", handoverAt: null };
}

/** Resume what was paused: the Shared timer in play, or else the Current player. Does nothing unless paused. */
export function resume(game: GameState, now: number): GameState {
  const settled = credit(game, now);
  if (settled.mode !== "paused") return settled;
  if (settled.sharedTimerInPlay !== null) return { ...settled, mode: "shared-timer" };
  return startClock(settled);
}

/**
 * Swipe in the Player area: stop whatever runs and make the neighbouring
 * Player current, with their clock starting at the Handover. During a
 * Shared timer the neighbours are those of the interrupted Player.
 */
export function swipe(game: GameState, direction: SwipeDirection, now: number): GameState {
  const settled = stopSharedTimer(credit(game, now));
  return {
    ...settled,
    mode: "activating",
    currentIndex: turnOrderIndex(settled, direction === "right" ? 1 : -1),
    handoverAt: now + ACTIVATION_DELAY_MS,
  };
}

/**
 * Press a Shared timer button: stop whatever runs at once, with no
 * Activation delay, and start that Shared timer. The Current player
 * stays current as the interrupted Player. Pressing the running Shared
 * timer again returns to that Player, like a tap; pressing a paused one
 * resumes it.
 */
export function pressSharedTimer(game: GameState, index: number, now: number): GameState {
  const settled = credit(game, now);
  if (settled.sharedTimerInPlay === index) {
    if (settled.mode === "shared-timer") return startClock(settled);
    if (settled.mode === "paused") return resume(settled, now);
  }
  return {
    ...settled,
    mode: "shared-timer",
    handoverAt: null,
    sharedTimerInPlay: index,
    stretchMs: 0,
    // Returning to any Player from a Shared timer starts a new Turn.
    turnPlayerIndex: null,
  };
}

export function snapshot(game: GameState, now: number): Snapshot {
  const settled = credit(game, now);
  const playerAt = (offset: number) => settled.players[turnOrderIndex(settled, offset)];
  const current = playerAt(0);
  return {
    currentPlayer: { ...current },
    state: settled.mode,
    previousName: playerAt(-1).name,
    nextName: playerAt(1).name,
    players: settled.players.map((p) => ({ ...p })),
    sharedTimers: settled.sharedTimers.map((t, i) => ({
      ...t,
      stretchMs: i === settled.sharedTimerInPlay ? settled.stretchMs : 0,
    })),
    sharedTimerInPlay: settled.sharedTimerInPlay,
    currentTurnMs: settled.turnPlayerIndex === settled.currentIndex ? settled.turnMs : 0,
    swipingMs: settled.swipingMs,
    pausedMs: settled.pausedMs,
    gameMs: gameTime(settled),
  };
}

/** End the Game at `now`: everything that ran is credited and added up into the Summary. */
export function endGame(game: GameState, now: number): Summary {
  const settled = credit(game, now);
  return {
    players: settled.players
      .map((p) => ({ ...p, averageTurnMs: p.turns > 0 ? p.timeMs / p.turns : null }))
      .sort((a, b) => b.timeMs - a.timeMs),
    sharedTimers: settled.sharedTimers.map((t) => ({ ...t })),
    swipingMs: settled.swipingMs,
    pausedMs: settled.pausedMs,
    gameMs: gameTime(settled),
    setup: {
      players: settled.players.map(({ name, color }) => ({ name, color })),
      sharedTimers: settled.sharedTimers.map((t) => t.name),
    },
  };
}

/** Game time: all Players' time, all Shared timers' time and Swiping time; Paused time is left out. */
function gameTime(game: GameState): number {
  const playersMs = game.players.reduce((sum, p) => sum + p.timeMs, 0);
  const sharedMs = game.sharedTimers.reduce((sum, t) => sum + t.timeMs, 0);
  return playersMs + sharedMs + game.swipingMs;
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
    case "shared-timer":
      return {
        ...game,
        sharedTimers: game.sharedTimers.map((t, i) =>
          i === game.sharedTimerInPlay ? { ...t, timeMs: t.timeMs + elapsed } : t,
        ),
        since: now,
        stretchMs: game.stretchMs + elapsed,
      };
  }
}

/** Start the Current player's clock; a new Turn unless their Turn was the last one running. */
function startClock(game: GameState): GameState {
  const running = { ...stopSharedTimer(game), mode: "running" as const };
  if (game.turnPlayerIndex === game.currentIndex) return running;
  return {
    ...updateCurrentPlayer(running, (p) => ({ ...p, turns: p.turns + 1 })),
    turnPlayerIndex: game.currentIndex,
    turnMs: 0,
  };
}

function stopSharedTimer(game: GameState): GameState {
  return { ...game, sharedTimerInPlay: null, stretchMs: 0 };
}

/** Index of the Player `offset` steps from the Current player, cycling through the Turn order. */
function turnOrderIndex(game: GameState, offset: number): number {
  const count = game.players.length;
  return (((game.currentIndex + offset) % count) + count) % count;
}

function updateCurrentPlayer(game: GameState, change: (p: PlayerTimes) => PlayerTimes): GameState {
  return { ...game, players: game.players.map((p, i) => (i === game.currentIndex ? change(p) : p)) };
}
