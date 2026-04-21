/**
 * Verifies the centralized announcement queue collapses bursts of polite
 * messages into a single combined announcement and that assertive
 * messages bypass the queue entirely.
 *
 * The implementation lives in src/web/lib/announce.ts. We mock
 * @react-aria/live-announcer so we can assert on the exact arguments
 * the queue passes through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const announceMock = vi.fn();

vi.mock("@react-aria/live-announcer", () => ({
  announce: (...args: unknown[]) => announceMock(...args),
}));

// Import AFTER the mock so the module's import binding picks up the mocked function.
const { enqueueAnnounce, announceAssertive, _flushAnnounceQueueForTest } =
  await import("../src/web/lib/announce.js");

beforeEach(() => {
  announceMock.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  // Drain any pending timer to keep tests isolated.
  _flushAnnounceQueueForTest();
  vi.useRealTimers();
});

describe("enqueueAnnounce", () => {
  it("delivers a single message after the flush window", () => {
    enqueueAnnounce("hello");
    expect(announceMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(announceMock).toHaveBeenCalledWith("hello", "polite");
    expect(announceMock).toHaveBeenCalledTimes(1);
  });

  it("collapses multiple bursts within the flush window into one announcement", () => {
    enqueueAnnounce("first");
    enqueueAnnounce("second");
    enqueueAnnounce("third");

    vi.advanceTimersByTime(200);

    expect(announceMock).toHaveBeenCalledTimes(1);
    expect(announceMock).toHaveBeenCalledWith("first. second. third", "polite");
  });

  it("delivers separate announcements after each flush window", () => {
    enqueueAnnounce("burst-1-a");
    enqueueAnnounce("burst-1-b");
    vi.advanceTimersByTime(200);

    enqueueAnnounce("burst-2-a");
    vi.advanceTimersByTime(200);

    expect(announceMock).toHaveBeenCalledTimes(2);
    expect(announceMock).toHaveBeenNthCalledWith(1, "burst-1-a. burst-1-b", "polite");
    expect(announceMock).toHaveBeenNthCalledWith(2, "burst-2-a", "polite");
  });

  it("ignores empty messages", () => {
    enqueueAnnounce("");
    vi.advanceTimersByTime(200);
    expect(announceMock).not.toHaveBeenCalled();
  });
});

describe("announceAssertive", () => {
  it("fires immediately without queueing", () => {
    announceAssertive("error!");
    expect(announceMock).toHaveBeenCalledWith("error!", "assertive");
    expect(announceMock).toHaveBeenCalledTimes(1);
  });

  it("does not interfere with the polite queue", () => {
    enqueueAnnounce("polite-1");
    announceAssertive("urgent!");

    expect(announceMock).toHaveBeenCalledTimes(1);
    expect(announceMock).toHaveBeenCalledWith("urgent!", "assertive");

    vi.advanceTimersByTime(200);

    expect(announceMock).toHaveBeenCalledTimes(2);
    expect(announceMock).toHaveBeenLastCalledWith("polite-1", "polite");
  });

  it("ignores empty messages", () => {
    announceAssertive("");
    expect(announceMock).not.toHaveBeenCalled();
  });
});
