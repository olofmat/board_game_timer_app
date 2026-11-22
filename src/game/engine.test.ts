import { describe, expect, it } from "vitest";
import {
  ACTIVATION_DELAY_MS,
  availableColors,
  canAddPlayer,
  createGame,
  type GameState,
  type PlayerSetup,
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

describe("Game setup", () => {
  const players = (count: number): PlayerSetup[] =>
    (["red", "blue", "green", "yellow", "purple", "orange", "black", "white", "pink", "teal", "brown"] as const)
      .slice(0, count)
      .map((color, i) => ({ name: `Player ${i + 1}`, color }));

  it("needs at least 2 Players", () => {
    expect(setupProblem(players(1))).toBe("too-few-players");
    expect(() => createGame(players(1), 0)).toThrow();
    expect(setupProblem(players(2))).toBeNull();
  });

  it("allows at most 10 Players", () => {
    expect(setupProblem(players(10))).toBeNull();
    expect(canAddPlayer(players(9))).toBe(true);
    expect(canAddPlayer(players(10))).toBe(false);
    expect(setupProblem(players(11))).toBe("too-many-players");
    expect(() => createGame(players(11), 0)).toThrow();
  });

  it("needs every Player to have a different Color", () => {
    const sameColor: PlayerSetup[] = [
      { name: "Anna", color: "red" },
      { name: "Bo", color: "blue" },
      { name: "Cleo", color: "red" },
    ];
    expect(setupProblem(sameColor)).toBe("duplicate-color");
    expect(() => createGame(sameColor, 0)).toThrow();
  });

  it("needs every Player to have a different name, ignoring case", () => {
    const sameName: PlayerSetup[] = [
      { name: "Anna", color: "red" },
      { name: "anna", color: "blue" },
    ];
    expect(setupProblem(sameName)).toBe("duplicate-name");
    expect(() => createGame(sameName, 0)).toThrow();
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
    const game = createGame(PLAYERS, 0);
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
    const game = tap(createGame(PLAYERS, 0), 1_000);
    const snap = snapshot(game, 4_000);
    expect(snap.state).toBe("running");
    expect(snap.players[0]).toMatchObject({ name: "Anna", timeMs: 3_000, turns: 1 });
    expect(snap.currentTurnMs).toBe(3_000);
    expect(snap.pausedMs).toBe(1_000);
    expect(snap.gameMs).toBe(3_000);
  });

  it("pauses and resumes the same Player without splitting their Turn", () => {
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let step = { game: createGame(PLAYERS, 0), now: 0 };
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      step = swipeAndHandOver(step.game, "right", step.now);
      const snap = snapshot(step.game, step.now);
      seen.push(snap.currentPlayer.name);
    }
    expect(seen).toEqual(["Bo", "Cleo", "Anna"]);
  });

  it("cycles backward from the first Player to the last: Anna ← Cleo", () => {
    const { game, now } = swipeAndHandOver(createGame(PLAYERS, 0), "left", 0);
    const snap = snapshot(game, now);
    expect(snap.currentPlayer.name).toBe("Cleo");
    expect(snap.previousName).toBe("Bo");
    expect(snap.nextName).toBe("Anna");
  });

  it("skips a Player swiped past within the Activation delay: no time, no Turn", () => {
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let step = swipeAndHandOver(tap(createGame(PLAYERS, 0), 0), "right", 1_000); // Bo
    step = swipeAndHandOver(step.game, "left", step.now + 1_000); // back to Anna
    const snap = snapshot(step.game, step.now + 500);
    expect(snap.players[0]).toMatchObject({ timeMs: 1_500, turns: 2 });
    expect(snap.currentTurnMs).toBe(500);
  });
});

describe("swiping while paused", () => {
  it("runs an Activation delay as Swiping time, then resumes on the new Player", () => {
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let game = tap(createGame(PLAYERS, 0), 0);
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
    let game = tap(createGame(PLAYERS, 0), 0);
    game = swipe(game, "right", 1_000);
    game = tap(game, 1_100); // pause
    game = tap(game, 2_000); // resume
    const snap = snapshot(game, 2_500);
    expect(snap.state).toBe("running");
    expect(snap.players[1]).toMatchObject({ timeMs: 500, turns: 1 });
  });
});

describe("engine state", () => {
  it("is plain JSON data: a round-tripped Game gives the same snapshot, even mid-Activation delay", () => {
    let game = tap(createGame(PLAYERS, 0), 0);
    game = swipe(game, "right", 2_000);
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    expect(snapshot(restored, 2_100)).toEqual(snapshot(game, 2_100));
    expect(snapshot(restored, 9_000)).toEqual(snapshot(game, 9_000));
  });
});
