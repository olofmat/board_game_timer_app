import { describe, expect, it } from "vitest";
import {
  ACTIVATION_DELAY_MS,
  availableColors,
  canAddPlayer,
  canAddSharedTimer,
  changeOrder,
  createGame,
  endGame,
  type GameSetup,
  type GameState,
  pause,
  playersProblem,
  type PlayerSetup,
  pressSharedTimer,
  resume,
  setupProblem,
  snapshot,
  swipe,
  type SwipeDirection,
  tap,
} from "./engine";

/** Swipe and let the Activation delay pass, returning the state and the time after the Handover. */
function swipeAndHandOver(game: GameState, direction: SwipeDirection, now: number) {
  return { game: swipe(game, direction, now), now: now + ACTIVATION_DELAY_MS };
}

const PLAYERS: PlayerSetup[] = [
  { name: "Anna", color: "red" },
  { name: "Bo", color: "blue" },
  { name: "Cleo", color: "green" },
];

const GAME: GameSetup = { players: PLAYERS, sharedTimers: [] };

describe("Game setup", () => {
  const players = (count: number): PlayerSetup[] =>
    (["red", "blue", "green", "yellow", "purple", "orange", "black", "white", "pink", "teal", "brown"] as const)
      .slice(0, count)
      .map((color, i) => ({ name: `Player ${i + 1}`, color }));

  it("needs at least 1 Player", () => {
    expect(setupProblem({ players: players(0), sharedTimers: [] })).toBe("too-few-players");
    expect(() => createGame({ players: players(0), sharedTimers: [] }, 0)).toThrow();
    expect(setupProblem({ players: players(1), sharedTimers: [] })).toBeNull();
  });

  it("allows at most 10 Players", () => {
    expect(setupProblem({ players: players(10), sharedTimers: [] })).toBeNull();
    expect(canAddPlayer(players(9))).toBe(true);
    expect(canAddPlayer(players(10))).toBe(false);
    expect(setupProblem({ players: players(11), sharedTimers: [] })).toBe("too-many-players");
    expect(() => createGame({ players: players(11), sharedTimers: [] }, 0)).toThrow();
  });

  it("needs every Player to have a different Color", () => {
    const sameColor: PlayerSetup[] = [
      { name: "Anna", color: "red" },
      { name: "Bo", color: "blue" },
      { name: "Cleo", color: "red" },
    ];
    expect(setupProblem({ players: sameColor, sharedTimers: [] })).toBe("duplicate-color");
    expect(() => createGame({ players: sameColor, sharedTimers: [] }, 0)).toThrow();
  });

  it("needs every Player to have a different name, ignoring case", () => {
    const sameName: PlayerSetup[] = [
      { name: "Anna", color: "red" },
      { name: "anna", color: "blue" },
    ];
    expect(setupProblem({ players: sameName, sharedTimers: [] })).toBe("duplicate-name");
    expect(() => createGame({ players: sameName, sharedTimers: [] }, 0)).toThrow();
  });

  it("allows 0–4 Shared timers, which don't count toward the 10-Player limit", () => {
    const timers = (count: number) => ["fight", "buying", "trade", "market", "war"].slice(0, count);
    expect(setupProblem({ players: players(10), sharedTimers: timers(0) })).toBeNull();
    expect(setupProblem({ players: players(10), sharedTimers: timers(4) })).toBeNull();
    expect(canAddSharedTimer(timers(3))).toBe(true);
    expect(canAddSharedTimer(timers(4))).toBe(false);
    expect(setupProblem({ players: players(2), sharedTimers: timers(5) })).toBe("too-many-shared-timers");
    expect(() => createGame({ players: players(2), sharedTimers: timers(5) }, 0)).toThrow();
  });

  it("needs every Shared timer to have a different name, ignoring case", () => {
    const setup = { players: players(2), sharedTimers: ["Fight", "fight"] };
    expect(setupProblem(setup)).toBe("duplicate-shared-timer-name");
    expect(() => createGame(setup, 0)).toThrow();
  });

  it("offers a Player only the Colors no other Player in the Game has taken", () => {
    const setup: PlayerSetup[] = [
      { name: "Anna", color: "red" },
      { name: "Bo", color: "blue" },
    ];
    expect(availableColors(setup)).toEqual([
      "green", "yellow", "purple", "orange", "black", "white", "pink", "teal", "brown", "grey",
    ]);
    expect(availableColors(setup, 1)).toEqual([
      "blue", "green", "yellow", "purple", "orange", "black", "white", "pink", "teal", "brown", "grey",
    ]);
  });
});

describe("a new Game", () => {
  it("opens paused on the first Player", () => {
    const game = createGame(GAME, 0);
    const snap = snapshot(game, 5_000);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.state).toBe("paused");
    expect(snap.previousName).toBe("Cleo");
    expect(snap.nextName).toBe("Bo");
    expect(snap.gameMs).toBe(0);
    expect(snap.pausedMs).toBe(5_000);
  });
});

describe("tap", () => {
  it("resumes the Current player, whose clock then runs in their first Turn", () => {
    const game = tap(createGame(GAME, 0), 1_000);
    const snap = snapshot(game, 4_000);
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ name: "Anna", timeMs: 3_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(3_000);
    expect(snap.pausedMs).toBe(1_000);
    expect(snap.gameMs).toBe(3_000);
  });

  it("pauses and resumes the same Player without splitting their Turn", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = tap(game, 2_000); // pause
    expect(snapshot(game, 7_000)).toMatchObject({ state: "paused", pausedMs: 5_000, gameMs: 2_000 });
    game = tap(game, 7_000); // resume
    const snap = snapshot(game, 8_000);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 3_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(3_000);
    expect(snap.pausedMs).toBe(5_000);
    expect(snap.gameMs).toBe(3_000);
  });
});

describe("swipe", () => {
  it("stops the running clock at once and hands over to the next Player after the Activation delay", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 10_000);

    const during = snapshot(game, 10_100);
    expect(during.state).toBe("activating");
    expect(during.currentPlayer.name).toBe("Bo");
    expect(during.players[0].timeMs).toBe(10_000);
    expect(during.players[1]).toMatchObject({ timeMs: 0, turns: 0 });
    expect(during.swipingMs).toBe(100);

    const after = snapshot(game, 12_000);
    expect(after.state).toBe("running");
    expect(after.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
    expect(after.players[1]).toMatchObject({ timeMs: 1_700, turns: 1 });
    expect(after.currentTurnMs).toBe(1_700);
    expect(after.swipingMs).toBe(300);
    expect(after.gameMs).toBe(12_000);
  });

  it("cycles forward through the Turn order: Anna → Bo → Cleo → Anna", () => {
    let step = { game: createGame(GAME, 0), now: 0 };
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      step = swipeAndHandOver(step.game, "next", step.now);
      const snap = snapshot(step.game, step.now);
      seen.push(snap.currentPlayer.name);
    }
    expect(seen).toEqual(["Bo", "Cleo", "Anna"]);
  });

  it("cycles backward from the first Player to the last: Anna ← Cleo", () => {
    const { game, now } = swipeAndHandOver(createGame(GAME, 0), "previous", 0);
    const snap = snapshot(game, now);
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.previousName).toBe("Bo");
    expect(snap.nextName).toBe("Anna");
  });

  it("skips a Player swiped past within the Activation delay: no time, no Turn", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 5_000); // to Bo
    game = swipe(game, "next", 5_200); // past Bo to Cleo
    const snap = snapshot(game, 6_000);
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.players[1]).toMatchObject({ name: "Bo", timeMs: 0, turns: 0 });
    expect(snap.players[2]).toMatchObject({ timeMs: 500, turns: 1 });
    expect(snap.swipingMs).toBe(500);
    expect(snap.gameMs).toBe(6_000);
  });

  it("continues the Turn when swiping back to the same Player before the Handover", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 4_000); // to Bo
    game = swipe(game, "previous", 4_100); // back to Anna before Bo's Handover
    const snap = snapshot(game, 5_400);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ timeMs: 5_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(5_000);
    expect(snap.players[1]).toMatchObject({ timeMs: 0, turns: 0 });
    expect(snap.swipingMs).toBe(400);
  });

  it("starts a new Turn when play is handed back to a Player after someone else's Turn", () => {
    let step = swipeAndHandOver(tap(createGame(GAME, 0), 0), "next", 1_000); // Bo
    step = swipeAndHandOver(step.game, "previous", step.now + 1_000); // back to Anna
    const snap = snapshot(step.game, step.now + 500);
    expect(snap.players[0]).toMatchObject({ timeMs: 1_500, turns: 2 });
    expect(snap.currentTurnMs).toBe(500);
  });
});

describe("playing alone", () => {
  const SOLO: GameSetup = { players: [{ name: "Anna", color: "red" }], sharedTimers: ["fight", "buying"] };

  it("switches between the one Player and the Shared timers", () => {
    let game = tap(createGame(SOLO, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pressSharedTimer(game, 1, 12_000);
    game = tap(game, 15_000);
    const snap = snapshot(game, 16_000);
    expect(snap.state).toBe("running");
    expect(snap.currentPlayer).toMatchObject({ name: "Anna", timeMs: 11_000, turns: 2 });
    expect(snap.sharedTimers.map((t) => t.timeMs)).toEqual([2_000, 3_000]);
    expect(snap.gameMs).toBe(16_000);
  });

  it("swiping returns to the same Player: from a Shared timer as a new Turn, while running as the same Turn", () => {
    let game = tap(createGame(SOLO, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    let step = swipeAndHandOver(game, "next", 12_000);
    expect(snapshot(step.game, step.now + 1_000)).toMatchObject({
      state: "running",
      currentPlayer: { name: "Anna", timeMs: 11_000, turns: 2 },
      currentTurnMs: 1_000,
    });
    step = swipeAndHandOver(step.game, "previous", step.now + 1_000);
    const snap = snapshot(step.game, step.now + 1_000);
    expect(snap.currentPlayer).toMatchObject({ name: "Anna", timeMs: 12_000, turns: 2 });
    expect(snap.currentTurnMs).toBe(2_000);
    expect(snap.swipingMs).toBe(2 * ACTIVATION_DELAY_MS);
  });
});

describe("swiping while paused", () => {
  it("runs an Activation delay as Swiping time, then resumes on the new Player", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = tap(game, 1_000); // pause on Anna
    game = swipe(game, "next", 3_000);

    expect(snapshot(game, 3_100)).toMatchObject({ state: "activating", pausedMs: 2_000, swipingMs: 100 });

    const snap = snapshot(game, 4_300);
    expect(snap.state).toBe("running");
    expect(snap.currentPlayer.name).toBe("Bo");
    expect(snap.players[1]).toMatchObject({ timeMs: 1_000, turns: 1 });
    expect(snap.swipingMs).toBe(300);
    expect(snap.pausedMs).toBe(2_000);
    expect(snap.gameMs).toBe(2_300);
  });

  it("continues the paused Player's Turn when swiping away and back before the Handover", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = tap(game, 1_000); // pause on Anna
    game = swipe(game, "next", 2_000);
    game = swipe(game, "previous", 2_100);
    const snap = snapshot(game, 3_400);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 2_000, turns: 1 });
  });
});

describe("tapping during the Activation delay", () => {
  it("pauses on the new Current player; the delay so far is Swiping time and no Turn starts", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 1_000);
    game = tap(game, 1_100);
    const snap = snapshot(game, 5_000);
    expect(snap.state).toBe("paused");
    expect(snap.currentPlayer.name).toBe("Bo");
    expect(snap.players[1]).toMatchObject({ timeMs: 0, turns: 0 });
    expect(snap.swipingMs).toBe(100);
    expect(snap.pausedMs).toBe(3_900);
  });

  it("resumes straight away on that Player with a new Turn on the next tap", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 1_000);
    game = tap(game, 1_100); // pause
    game = tap(game, 2_000); // resume
    const snap = snapshot(game, 2_500);
    expect(snap.state).toBe("running");
    expect(snap.players[1]).toMatchObject({ timeMs: 500, turns: 1 });
  });
});

describe("Shared timers", () => {
  const WITH_TIMERS: GameSetup = { players: PLAYERS, sharedTimers: ["fight", "buying"] };

  it("pressing one stops the Current player's clock at once and starts it; its time is part of Game time", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    const snap = snapshot(game, 14_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.sharedTimerInPlay).toBe(0);
    expect(snap.currentPlayer.name).toBe("Anna"); // the interrupted Player
    expect(snap.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
    expect(snap.sharedTimers).toEqual([
      { name: "fight", timeMs: 4_000, stretchMs: 4_000 },
      { name: "buying", timeMs: 0, stretchMs: 0 },
    ]);
    expect(snap.gameMs).toBe(14_000);
  });

  it("tapping the Player area resumes the interrupted Player at once, as a new Turn", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = tap(game, 14_000);
    const snap = snapshot(game, 15_000);
    expect(snap.state).toBe("running");
    expect(snap.sharedTimerInPlay).toBeNull();
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 11_000, turns: 2 });
    expect(snap.currentTurnMs).toBe(1_000);
    expect(snap.sharedTimers[0]).toEqual({ name: "fight", timeMs: 4_000, stretchMs: 0 });
    expect(snap.swipingMs).toBe(0);
    expect(snap.gameMs).toBe(15_000);
  });

  it("pressing the running Shared timer again resumes the interrupted Player, as a new Turn", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 1, 10_000);
    game = pressSharedTimer(game, 1, 13_000);
    const snap = snapshot(game, 15_000);
    expect(snap.state).toBe("running");
    expect(snap.sharedTimerInPlay).toBeNull();
    expect(snap.players[0]).toMatchObject({ timeMs: 12_000, turns: 2 });
    expect(snap.sharedTimers[1]).toMatchObject({ timeMs: 3_000 });
  });

  it("pressing another Shared timer switches straight to it, keeping the interrupted Player", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pressSharedTimer(game, 1, 12_000);
    const snap = snapshot(game, 15_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.sharedTimerInPlay).toBe(1);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.sharedTimers).toEqual([
      { name: "fight", timeMs: 2_000, stretchMs: 0 },
      { name: "buying", timeMs: 3_000, stretchMs: 3_000 },
    ]);
    expect(snap.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
    expect(snap.gameMs).toBe(15_000);
  });

  it.each([
    ["next", "Bo", 1],
    ["previous", "Cleo", 2],
  ] as const)("swiping to the %s Player goes to the Player after/before the interrupted one, with the Activation delay", (direction, name, index) => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = swipe(game, direction, 12_000);

    const during = snapshot(game, 12_100);
    expect(during.state).toBe("activating");
    expect(during.sharedTimerInPlay).toBeNull();
    expect(during.currentPlayer.name).toBe(name);
    expect(during.sharedTimers[0]).toEqual({ name: "fight", timeMs: 2_000, stretchMs: 0 });
    expect(during.players[index]).toMatchObject({ timeMs: 0, turns: 0 });

    const after = snapshot(game, 13_300);
    expect(after.state).toBe("running");
    expect(after.players[index]).toMatchObject({ timeMs: 1_000, turns: 1 });
    expect(after.swipingMs).toBe(300);
    expect(after.gameMs).toBe(13_300);
  });

  it("swiping away and back to the interrupted Player before the Handover still starts a new Turn", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = swipe(game, "next", 12_000);
    game = swipe(game, "previous", 12_100);
    const snap = snapshot(game, 13_000);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 10_600, turns: 2 });
  });

  it("pressing one during an Activation delay interrupts the new Current player before their Handover", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = swipe(game, "next", 10_000);
    game = pressSharedTimer(game, 0, 10_100);
    const snap = snapshot(game, 12_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.currentPlayer.name).toBe("Bo");
    expect(snap.players[1]).toMatchObject({ timeMs: 0, turns: 0 });
    expect(snap.swipingMs).toBe(100);
    expect(snap.sharedTimers[0].timeMs).toBe(1_900);
  });

  it("pressing one while paused starts it; the pause ends there", () => {
    let game = createGame(WITH_TIMERS, 0);
    game = pressSharedTimer(game, 1, 5_000);
    const snap = snapshot(game, 8_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.pausedMs).toBe(5_000);
    expect(snap.sharedTimers[1].timeMs).toBe(3_000);
    expect(snap.gameMs).toBe(3_000);
  });
});

describe("pause and resume (from Settings)", () => {
  const WITH_TIMERS: GameSetup = { players: PLAYERS, sharedTimers: ["fight", "buying"] };

  it("pauses a running Shared timer; resuming continues that Shared timer and its stretch", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pause(game, 12_000);

    const paused = snapshot(game, 20_000);
    expect(paused.state).toBe("paused");
    expect(paused.sharedTimerInPlay).toBe(0);
    expect(paused.currentPlayer.name).toBe("Anna");
    expect(paused.sharedTimers[0]).toEqual({ name: "fight", timeMs: 2_000, stretchMs: 2_000 });
    expect(paused.pausedMs).toBe(8_000);

    game = resume(game, 20_000);
    const snap = snapshot(game, 21_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.sharedTimers[0]).toEqual({ name: "fight", timeMs: 3_000, stretchMs: 3_000 });
    expect(snap.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
    expect(snap.gameMs).toBe(13_000);
  });

  it("a tap while paused on a Shared timer resumes that Shared timer", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 1, 10_000);
    game = pause(game, 12_000);
    game = tap(game, 15_000);
    const snap = snapshot(game, 16_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.sharedTimerInPlay).toBe(1);
    expect(snap.sharedTimers[1]).toEqual({ name: "buying", timeMs: 3_000, stretchMs: 3_000 });
    expect(snap.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
  });

  it("pauses a running Player; resuming continues their Turn", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pause(game, 4_000);
    game = resume(game, 9_000);
    const snap = snapshot(game, 10_000);
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ timeMs: 5_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(5_000);
    expect(snap.pausedMs).toBe(5_000);
  });

  it("pausing while paused and resuming while running change nothing", () => {
    const paused = pause(createGame(WITH_TIMERS, 0), 1_000);
    expect(snapshot(pause(paused, 2_000), 3_000)).toEqual(snapshot(paused, 3_000));
    const running = tap(paused, 1_000);
    expect(snapshot(resume(running, 2_000), 3_000)).toEqual(snapshot(running, 3_000));
  });

  it("swiping while paused on a Shared timer ends it and goes to the Player after the interrupted one", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pause(game, 12_000);
    game = swipe(game, "next", 15_000);
    const snap = snapshot(game, 16_000);
    expect(snap.state).toBe("running");
    expect(snap.sharedTimerInPlay).toBeNull();
    expect(snap.currentPlayer.name).toBe("Bo");
    expect(snap.players[1]).toMatchObject({ timeMs: 700, turns: 1 });
    expect(snap.sharedTimers[0].timeMs).toBe(2_000);
  });

  it("pressing the paused Shared timer's button resumes it, continuing its stretch", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pause(game, 12_000);
    game = pressSharedTimer(game, 0, 15_000);
    const snap = snapshot(game, 16_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.sharedTimers[0]).toEqual({ name: "fight", timeMs: 3_000, stretchMs: 3_000 });
  });
});

describe("Show times", () => {
  it("gives the Current player's total time alongside their current Turn time", () => {
    let step = swipeAndHandOver(tap(createGame(GAME, 0), 0), "next", 1_000); // Bo
    step = swipeAndHandOver(step.game, "previous", step.now + 2_000); // Anna again
    const snap = snapshot(step.game, step.now + 500);
    expect(snap.currentPlayer).toEqual({ name: "Anna", color: "red", timeMs: 1_500, turns: 2 });
    expect(snap.currentTurnMs).toBe(500);
  });
});

describe("Change order", () => {
  const [ANNA, BO, CLEO] = PLAYERS;

  it("makes the first Player in the new order Current, with the Game paused", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = changeOrder(game, [CLEO, ANNA, BO], 5_000);
    const snap = snapshot(game, 8_000);
    expect(snap.state).toBe("paused");
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.previousName).toBe("Bo");
    expect(snap.nextName).toBe("Anna");
    expect(snap.players.map((p) => p.name)).toEqual(["Cleo", "Anna", "Bo"]);
    expect(snap.players[1]).toMatchObject({ name: "Anna", timeMs: 5_000, turns: 1 });
    expect(snap.pausedMs).toBe(3_000);
  });

  it("starts a new Turn on resume, even when the same Player is first again", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = changeOrder(game, [ANNA, CLEO, BO], 5_000);
    game = tap(game, 6_000);
    const snap = snapshot(game, 7_000);
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ name: "Anna", timeMs: 6_000, turns: 2 });
    expect(snap.currentTurnMs).toBe(1_000);
  });

  it("adds a Player who arrives late, starting with no time and no Turns", () => {
    const DAN: PlayerSetup = { name: "Dan", color: "yellow" };
    let game = tap(createGame(GAME, 0), 0);
    game = changeOrder(game, [ANNA, BO, DAN, CLEO], 5_000);
    let step = swipeAndHandOver(tap(game, 5_000), "next", 6_000); // Bo
    step = swipeAndHandOver(step.game, "next", step.now + 1_000); // Dan
    const snap = snapshot(step.game, step.now + 2_000);
    expect(snap.currentPlayer).toEqual({ name: "Dan", color: "yellow", timeMs: 2_000, turns: 1 });
    expect(snap.nextName).toBe("Cleo");
  });

  it("removes the Current player, who keeps their time and Turns and is marked as having left in the Summary", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = changeOrder(game, [BO, CLEO], 5_000); // Anna leaves mid-Turn
    const paused = snapshot(game, 6_000);
    expect(paused.currentPlayer.name).toBe("Bo");
    expect(paused.players.map((p) => p.name)).toEqual(["Bo", "Cleo"]);
    expect(paused.previousName).toBe("Cleo");
    expect(paused.gameMs).toBe(5_000);

    game = tap(game, 6_000);
    const summary = endGame(game, 8_000);
    expect(summary.players).toEqual([
      { name: "Anna", color: "red", timeMs: 5_000, turns: 1, averageTurnMs: 5_000, left: true },
      { name: "Bo", color: "blue", timeMs: 2_000, turns: 1, averageTurnMs: 2_000, left: false },
      { name: "Cleo", color: "green", timeMs: 0, turns: 0, averageTurnMs: null, left: false },
    ]);
    expect(summary.gameMs).toBe(7_000);
    expect(summary.setup.players).toEqual([BO, CLEO]);
  });

  it("keeps the Player rules: 1–10 Players with different Colors and names", () => {
    const game = tap(createGame(GAME, 0), 0);
    const tooFew: PlayerSetup[] = [];
    const sameColor = [ANNA, { name: "Dan", color: "red" as const }];
    expect(playersProblem(tooFew)).toBe("too-few-players");
    expect(playersProblem(sameColor)).toBe("duplicate-color");
    expect(playersProblem([ANNA])).toBeNull();
    expect(playersProblem([ANNA, BO])).toBeNull();
    expect(() => changeOrder(game, tooFew, 1_000)).toThrow();
    expect(() => changeOrder(game, sameColor, 1_000)).toThrow();

    const colors = ["red", "blue", "green", "yellow", "purple", "orange", "black", "white", "pink", "teal", "brown"] as const;
    const eleven = colors.map((color, i) => ({ name: `Player ${i + 1}`, color }));
    expect(playersProblem(eleven)).toBe("too-many-players");
    expect(playersProblem(eleven.slice(0, 10))).toBeNull();
    expect(() => changeOrder(game, eleven, 1_000)).toThrow();

    const sameName = [ANNA, { name: "anna", color: "blue" as const }];
    expect(playersProblem(sameName)).toBe("duplicate-name");
    expect(() => changeOrder(game, sameName, 1_000)).toThrow();
  });

  it("brings back a removed Player who is added again, with the time they had", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = changeOrder(game, [BO, CLEO], 5_000);
    game = changeOrder(game, [CLEO, ANNA, BO], 6_000);
    const summary = endGame(game, 7_000);
    expect(summary.players.find((p) => p.name === "Anna")).toMatchObject({ timeMs: 5_000, turns: 1, left: false });
    expect(summary.players.filter((p) => p.left)).toEqual([]);
  });

  it("ends a Shared timer in play: resuming goes to the first Player, as a new Turn", () => {
    let game = tap(createGame({ players: PLAYERS, sharedTimers: ["fight"] }, 0), 0);
    game = pressSharedTimer(game, 0, 2_000);
    game = changeOrder(game, [BO, CLEO, ANNA], 4_000);
    game = tap(game, 5_000);
    const snap = snapshot(game, 6_000);
    expect(snap.state).toBe("running");
    expect(snap.sharedTimerInPlay).toBeNull();
    expect(snap.sharedTimers[0].timeMs).toBe(2_000);
    expect(snap.currentPlayer).toMatchObject({ name: "Bo", timeMs: 1_000, turns: 1 });
  });
});

describe("End game", () => {
  it("lists Players slowest first with their total time, Turns and average Turn length", () => {
    // Anna 2s, Bo 9s over two Turns, Cleo 4s.
    let step = { game: tap(createGame(GAME, 0), 0), now: 2_000 };
    step = swipeAndHandOver(step.game, "next", step.now); // Bo
    step = swipeAndHandOver(step.game, "next", step.now + 5_000); // Cleo
    step = swipeAndHandOver(step.game, "previous", step.now + 4_000); // Bo again
    const summary = endGame(step.game, step.now + 4_000);
    expect(summary.players).toEqual([
      { name: "Bo", color: "blue", timeMs: 9_000, turns: 2, averageTurnMs: 4_500, left: false },
      { name: "Cleo", color: "green", timeMs: 4_000, turns: 1, averageTurnMs: 4_000, left: false },
      { name: "Anna", color: "red", timeMs: 2_000, turns: 1, averageTurnMs: 2_000, left: false },
    ]);
  });

  it("adds up Shared timers, Swiping time and Game time, with Paused time left out of Game time", () => {
    let game = createGame({ players: PLAYERS, sharedTimers: ["fight", "buying"] }, 0);
    game = tap(game, 1_000); // 1s paused, then Anna
    game = pressSharedTimer(game, 0, 4_000); // Anna 3s
    game = swipe(game, "next", 6_000); // fight 2s, then 0.3s Swiping time
    game = tap(game, 10_300); // Bo 4s, then paused
    game = pressSharedTimer(game, 1, 12_300); // 2s paused
    const summary = endGame(game, 13_300); // buying 1s
    expect(summary.sharedTimers).toEqual([
      { name: "fight", timeMs: 2_000 },
      { name: "buying", timeMs: 1_000 },
    ]);
    expect(summary.swipingMs).toBe(300);
    expect(summary.pausedMs).toBe(3_000);
    expect(summary.gameMs).toBe(10_300);
  });

  it("gives a Player who never had a Turn no average Turn length", () => {
    const summary = endGame(tap(createGame(GAME, 0), 0), 1_000);
    expect(summary.players.find((p) => p.name === "Bo")).toEqual({
      name: "Bo", color: "blue", timeMs: 0, turns: 0, averageTurnMs: null, left: false,
    });
  });

  it("keeps the Game's setup for Play again: same Players, Colors, Turn order and Shared timers", () => {
    const setup: GameSetup = { players: PLAYERS, sharedTimers: ["fight"] };
    let step = swipeAndHandOver(tap(createGame(setup, 0), 0), "next", 5_000);
    step = swipeAndHandOver(step.game, "next", step.now + 9_000);
    expect(endGame(step.game, step.now + 1_000).setup).toEqual(setup);
  });
});

describe("engine state", () => {
  it("is plain JSON data: a round-tripped Game gives the same snapshot, even mid-Activation delay", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "next", 2_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 2_100)).toEqual(snapshot(game, 2_100));
    expect(snapshot(restored, 9_000)).toEqual(snapshot(game, 9_000));
  });

  it("round-trips a Game with removed Players and a paused Shared timer", () => {
    let game = tap(createGame({ players: PLAYERS, sharedTimers: ["fight"] }, 0), 0);
    game = changeOrder(game, [PLAYERS[1], PLAYERS[2]], 3_000);
    game = pressSharedTimer(game, 0, 4_000);
    game = pause(game, 6_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 9_000)).toEqual(snapshot(game, 9_000));
    expect(endGame(restored, 9_000)).toEqual(endGame(game, 9_000));
  });

  it("closing the app pauses the Game at that moment: time while closed is Paused time", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = pause(game, 5_000); // app hidden
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    const reopened = snapshot(restored, 3_600_000);
    expect(reopened.state).toBe("paused");
    expect(reopened.players[0]).toMatchObject({ timeMs: 5_000, turns: 1 });
    expect(reopened.pausedMs).toBe(3_595_000);
    expect(reopened.gameMs).toBe(5_000);
    const resumed = snapshot(tap(restored, 3_600_000), 3_601_000);
    expect(resumed.players[0]).toMatchObject({ timeMs: 6_000, turns: 1 });
  });

  it("round-trips while a Shared timer runs, crediting time since to that Shared timer", () => {
    let game = tap(createGame({ players: PLAYERS, sharedTimers: ["fight"] }, 0), 0);
    game = pressSharedTimer(game, 0, 2_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 60_000)).toEqual(snapshot(game, 60_000));
    expect(snapshot(restored, 60_000).sharedTimers[0].timeMs).toBe(58_000);
  });
});
