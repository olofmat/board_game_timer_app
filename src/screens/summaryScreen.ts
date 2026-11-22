import { colorStyle } from "../game/colors";
import type { Summary } from "../game/engine";
import { el } from "./dom";
import { formatDuration } from "./format";

function totalRow(label: string, ms: number, className = "summary-total") {
  const row = el("div", className);
  row.append(el("span", undefined, label), el("span", "summary-time", formatDuration(ms)));
  return row;
}

/**
 * Summary screen after End game: Players slowest first with total time,
 * Turns and average Turn length (Players who left marked as such), then Shared timers, Swiping time, Paused
 * time and Game time. Not kept once the next Game starts.
 */
export function mountSummaryScreen(
  root: HTMLElement,
  summary: Summary,
  handlers: { onPlayAgain: () => void; onNewGame: () => void },
) {
  const screen = el("main", "summary-screen");
  screen.append(el("h1", undefined, "Summary"));

  const table = el("table", "summary-players");
  const head = el("thead");
  const headRow = el("tr");
  for (const label of ["Player", "Total", "Turns", "Avg Turn"]) headRow.append(el("th", undefined, label));
  head.append(headRow);
  const body = el("tbody");
  table.append(head, body);
  for (const player of summary.players) {
    const row = el("tr");
    const nameCell = el("td", "summary-player");
    const swatch = el("span", "summary-swatch");
    swatch.style.background = colorStyle(player.color).fill;
    nameCell.append(swatch, player.name);
    if (player.left) nameCell.append(el("span", "summary-left", " (left)"));
    row.append(
      nameCell,
      el("td", "summary-time", formatDuration(player.timeMs)),
      el("td", "summary-number", String(player.turns)),
      el("td", "summary-time", player.averageTurnMs === null ? "–" : formatDuration(player.averageTurnMs)),
    );
    body.append(row);
  }
  screen.append(table);

  const totals = el("section", "summary-totals");
  if (summary.sharedTimers.length > 0) {
    totals.append(el("h2", undefined, "Shared timers"));
    for (const timer of summary.sharedTimers) totals.append(totalRow(timer.name, timer.timeMs));
  }
  totals.append(
    el("h2", undefined, "Game"),
    totalRow("Swiping time", summary.swipingMs),
    totalRow("Paused time", summary.pausedMs),
    totalRow("Game time", summary.gameMs, "summary-total summary-total--game"),
  );
  screen.append(totals);

  const footer = el("footer", "summary-footer");
  const playAgain = el("button", "primary-button", "Play again");
  playAgain.addEventListener("click", handlers.onPlayAgain);
  const newGame = el("button", "secondary-button", "New game");
  newGame.addEventListener("click", handlers.onNewGame);
  footer.append(playAgain, newGame);
  screen.append(footer);

  root.replaceChildren(screen);
}
