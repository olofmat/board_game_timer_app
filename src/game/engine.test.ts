import { describe, expect, it } from "vitest";
import {
  ACTIVATION_DELAY_MS,
  availableColors,
  canAddPlayer,
  canAddSharedTimer,
  createGame,
  type GameSetup,
  type GameState,
  type PlayerSetup,
  pressSharedTimer,
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

  it("needs at least 2 Players", () => {
    expect(setupProblem({ players: players(1), sharedTimers: [] })).toBe("too-few-players");
    expect(() => createGame({ players: players(1), sharedTimers: [] }, 0)).toThrow();
    expect(setupProblem({ players: players(2), sharedTimers: [] })).toBeNull();
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
    game = swipe(game, "right", 10_000);

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
      step = swipeAndHandOver(step.game, "right", step.now);
      const snap = snapshot(step.game, step.now);
      seen.push(snap.currentPlayer.name);
    }
    expect(seen).toEqual(["Bo", "Cleo", "Anna"]);
  });

  it("cycles backward from the first Player to the last: Anna ← Cleo", () => {
    const { game, now } = swipeAndHandOver(createGame(GAME, 0), "left", 0);
    const snap = snapshot(game, now);
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.previousName).toBe("Bo");
    expect(snap.nextName).toBe("Anna");
  });

  it("skips a Player swiped past within the Activation delay: no time, no Turn", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "right", 5_000); // to Bo
    game = swipe(game, "right", 5_200); // past Bo to Cleo
    const snap = snapshot(game, 6_000);
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.players[1]).toMatchObject({ name: "Bo", timeMs: 0, turns: 0 });
    expect(snap.players[2]).toMatchObject({ timeMs: 500, turns: 1 });
    expect(snap.swipingMs).toBe(500);
    expect(snap.gameMs).toBe(6_000);
  });

  it("continues the Turn when swiping back to the same Player before the Handover", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "right", 4_000); // to Bo
    game = swipe(game, "left", 4_100); // back to Anna before Bo's Handover
    const snap = snapshot(game, 5_400);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ timeMs: 5_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(5_000);
    expect(snap.players[1]).toMatchObject({ timeMs: 0, turns: 0 });
    expect(snap.swipingMs).toBe(400);
  });

  it("starts a new Turn when play is handed back to a Player after someone else's Turn", () => {
    let step = swipeAndHandOver(tap(createGame(GAME, 0), 0), "right", 1_000); // Bo
    step = swipeAndHandOver(step.game, "left", step.now + 1_000); // back to Anna
    const snap = snapshot(step.game, step.now + 500);
    expect(snap.players[0]).toMatchObject({ timeMs: 1_500, turns: 2 });
    expect(snap.currentTurnMs).toBe(500);
  });
});

describe("swiping while paused", () => {
  it("runs an Activation delay as Swiping time, then resumes on the new Player", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = tap(game, 1_000); // pause on Anna
    game = swipe(game, "right", 3_000);

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
    game = swipe(game, "right", 2_000);
    game = swipe(game, "left", 2_100);
    const snap = snapshot(game, 3_400);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 2_000, turns: 1 });
  });
});

describe("tapping during the Activation delay", () => {
  it("pauses on the new Current player; the delay so far is Swiping time and no Turn starts", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "right", 1_000);
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
    game = swipe(game, "right", 1_000);
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
    expect(snap.runningSharedTimer).toBe(0);
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
    expect(snap.runningSharedTimer).toBeNull();
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
    expect(snap.runningSharedTimer).toBeNull();
    expect(snap.players[0]).toMatchObject({ timeMs: 12_000, turns: 2 });
    expect(snap.sharedTimers[1]).toMatchObject({ timeMs: 3_000 });
  });

  it("pressing another Shared timer switches straight to it, keeping the interrupted Player", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = pressSharedTimer(game, 1, 12_000);
    const snap = snapshot(game, 15_000);
    expect(snap.state).toBe("shared-timer");
    expect(snap.runningSharedTimer).toBe(1);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.sharedTimers).toEqual([
      { name: "fight", timeMs: 2_000, stretchMs: 0 },
      { name: "buying", timeMs: 3_000, stretchMs: 3_000 },
    ]);
    expect(snap.players[0]).toMatchObject({ timeMs: 10_000, turns: 1 });
    expect(snap.gameMs).toBe(15_000);
  });

  it.each([
    ["right", "Bo", 1],
    ["left", "Cleo", 2],
  ] as const)("swiping %s goes to the Player after/before the interrupted one, with the Activation delay", (direction, name, index) => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = pressSharedTimer(game, 0, 10_000);
    game = swipe(game, direction, 12_000);

    const during = snapshot(game, 12_100);
    expect(during.state).toBe("activating");
    expect(during.runningSharedTimer).toBeNull();
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
    game = swipe(game, "right", 12_000);
    game = swipe(game, "left", 12_100);
    const snap = snapshot(game, 13_000);
    expect(snap.currentPlayer.name).toBe("Anna");
    expect(snap.players[0]).toMatchObject({ timeMs: 10_600, turns: 2 });
  });

  it("pressing one during an Activation delay interrupts the new Current player before their Handover", () => {
    let game = tap(createGame(WITH_TIMERS, 0), 0);
    game = swipe(game, "right", 10_000);
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

describe("engine state", () => {
  it("is plain JSON data: a round-tripped Game gives the same snapshot, even mid-Activation delay", () => {
    let game = tap(createGame(GAME, 0), 0);
    game = swipe(game, "right", 2_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 2_100)).toEqual(snapshot(game, 2_100));
    expect(snapshot(restored, 9_000)).toEqual(snapshot(game, 9_000));
  });

  it("round-trips while a Shared timer runs, crediting time since to that Shared timer", () => {
    let game = tap(createGame({ players: PLAYERS, sharedTimers: ["fight"] }, 0), 0);
    game = pressSharedTimer(game, 0, 2_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 60_000)).toEqual(snapshot(game, 60_000));
    expect(snapshot(restored, 60_000).sharedTimers[0].timeMs).toBe(58_000);
  });
});
