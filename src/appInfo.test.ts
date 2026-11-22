import { describe, expect, it } from "vitest";
import { APP_NAME, placeholderMessage } from "./appInfo";

describe("placeholderMessage", () => {
  it("names the app", () => {
    expect(placeholderMessage()).toContain(APP_NAME);
  });
});
