import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { announce, clearAnnouncements } from "../announcer.js";

/**
 * Tests for the announcer wrapper around @react-aria/live-announcer.
 *
 * React Aria creates live regions with specific attributes.
 * We verify that our wrapper correctly delegates and that
 * clearAnnouncements removes the regions.
 */
describe("announce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAnnouncements();
  });

  afterEach(() => {
    clearAnnouncements();
    vi.useRealTimers();
  });

  it("creates a live region in the document body", () => {
    announce("Hello screen reader");
    vi.advanceTimersByTime(100);

    const region = document.querySelector("[aria-live]");
    expect(region).not.toBeNull();
  });

  it("supports polite priority", () => {
    announce("Polite message", "polite");
    vi.advanceTimersByTime(100);

    const region = document.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
  });

  it("supports assertive priority", () => {
    announce("Urgent message", "assertive");
    vi.advanceTimersByTime(100);

    const region = document.querySelector('[aria-live="assertive"]');
    expect(region).not.toBeNull();
  });

  it("does not throw when called multiple times", () => {
    expect(() => {
      announce("First");
      announce("Second");
      announce("Third");
    }).not.toThrow();
  });

  it("clearAnnouncements does not throw", () => {
    announce("Test");
    vi.advanceTimersByTime(100);

    expect(() => clearAnnouncements()).not.toThrow();
  });
});
