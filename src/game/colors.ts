/** The fixed palette of board-game piece Colors, with a readable text color for each. */
export const COLORS = {
  red: { fill: "#d32f2f", text: "#ffffff" },
  blue: { fill: "#1e63c6", text: "#ffffff" },
  green: { fill: "#2e8b3e", text: "#ffffff" },
  yellow: { fill: "#f4c430", text: "#1b1b1f" },
  purple: { fill: "#7b3fa0", text: "#ffffff" },
  orange: { fill: "#ef7d1a", text: "#1b1b1f" },
  black: { fill: "#111111", text: "#ffffff" },
  white: { fill: "#f5f5f5", text: "#1b1b1f" },
  pink: { fill: "#f06aa8", text: "#1b1b1f" },
  teal: { fill: "#14998f", text: "#ffffff" },
  brown: { fill: "#7a4a24", text: "#ffffff" },
  grey: { fill: "#8a8a8a", text: "#1b1b1f" },
} as const;

export type ColorName = keyof typeof COLORS;

export function colorStyle(color: ColorName): (typeof COLORS)[ColorName] {
  return COLORS[color];
}
