import { describe, it, expect } from "vitest";
import { IsoDateFormatter } from "../src/core/formatter.js";

describe("IsoDateFormatter", () => {
  const formatter = new IsoDateFormatter();
  const date = new Date("2026-03-30T13:51:00.331Z");

  it("formats date as ISO 8601 date string", () => {
    expect(formatter.formatDate(date)).toBe("2026-03-30");
  });

  it("formats time as ISO 8601 time string with milliseconds", () => {
    expect(formatter.formatTime(date)).toBe("13:51:00.331");
  });
});
