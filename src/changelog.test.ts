import { describe, expect, it } from "vitest";
import { CHANGELOG, compareVersions, releasesSince } from "./changelog";

describe("compareVersions", () => {
  it("compares numerically, part by part", () => {
    expect(compareVersions("1.10.0", "1.9.3")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.1")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
  });
});

describe("releasesSince", () => {
  const changelog = [
    { version: "1.2.0", changes: ["c"] },
    { version: "1.1.0", changes: ["b"] },
    { version: "1.0.0", changes: ["a"] },
  ];

  it("lists only the releases newer than the one last seen", () => {
    expect(releasesSince("1.0.0", changelog).map((r) => r.version)).toEqual(["1.2.0", "1.1.0"]);
    expect(releasesSince("1.2.0", changelog)).toEqual([]);
  });
});

describe("CHANGELOG", () => {
  it("is newest first, with valid and distinct versions and at least one change each", () => {
    for (const release of CHANGELOG) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.changes.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
    }
  });
});
