import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChromeAudioBackend } from "../chrome-backend.js";

/**
 * Install a mock of the Chrome offscreen + runtime APIs the backend uses.
 * By default `createDocument` resolves immediately; tests that need to
 * exercise the concurrency window between two in-flight callers can call
 * `mock.blockNextCreate()` to make the next createDocument hang until
 * `releasePendingCreate()` is called.
 */
function installChromeMock() {
  const calls = {
    createDocument: 0,
    closeDocument: 0,
    sendMessage: 0,
    getContexts: 0,
  };

  let documentExists = false;
  let pendingCreateResolve: (() => void) | null = null;
  let blockNext = false;

  const chromeMock = {
    offscreen: {
      Reason: { AUDIO_PLAYBACK: "AUDIO_PLAYBACK" },
      createDocument: vi.fn(async () => {
        calls.createDocument++;
        if (blockNext) {
          blockNext = false;
          await new Promise<void>((resolve) => {
            pendingCreateResolve = resolve;
          });
        }
        documentExists = true;
      }),
      closeDocument: vi.fn(async () => {
        calls.closeDocument++;
        documentExists = false;
      }),
    },
    runtime: {
      ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
      getURL: (path: string) => `chrome-extension://test/${path}`,
      getContexts: vi.fn(async () => {
        calls.getContexts++;
        return documentExists ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : [];
      }),
      sendMessage: vi.fn(async () => {
        calls.sendMessage++;
        return { type: "SOUND_PLAYED", success: true, latencyMs: 10 };
      }),
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

  return {
    calls,
    setDocumentExists: (v: boolean) => {
      documentExists = v;
    },
    blockNextCreate: () => {
      blockNext = true;
    },
    releasePendingCreate: () => {
      pendingCreateResolve?.();
      pendingCreateResolve = null;
    },
    waitForPendingCreate: async (): Promise<void> => {
      while (!pendingCreateResolve) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    },
  };
}

describe("ChromeAudioBackend", () => {
  let mock: ReturnType<typeof installChromeMock>;

  beforeEach(() => {
    mock = installChromeMock();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("creates the offscreen document on initialize", async () => {
    const backend = new ChromeAudioBackend();
    await backend.initialize();

    expect(mock.calls.createDocument).toBe(1);
    expect(backend.isReady()).toBe(true);
  });

  it("skips creating the offscreen document when one already exists", async () => {
    mock.setDocumentExists(true);
    const backend = new ChromeAudioBackend();
    await backend.initialize();

    expect(mock.calls.createDocument).toBe(0);
    expect(backend.isReady()).toBe(true);
  });

  it("regression: two concurrent plays only call createDocument once", async () => {
    // The race window the IIFE / creatingPromise pattern guards against.
    // Without it, both play() calls would await hasDocument(), both see
    // false, both call createDocument(), and Chrome would reject the
    // second with "Only a single offscreen document may be created."
    mock.blockNextCreate();
    const backend = new ChromeAudioBackend();

    const playA = backend.play("foo.ogg");
    const playB = backend.play("bar.ogg");

    // Wait until createDocument is actually in-flight, then release it
    // so both plays unblock from the shared creatingPromise.
    await mock.waitForPendingCreate();
    mock.releasePendingCreate();

    const [resultA, resultB] = await Promise.all([playA, playB]);

    expect(mock.calls.createDocument).toBe(1);
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(mock.calls.sendMessage).toBe(2);
  });

  it("forwards play options through chrome.runtime.sendMessage", async () => {
    mock.setDocumentExists(true);
    const backend = new ChromeAudioBackend();
    await backend.initialize();
    await backend.play("ding.ogg", { volume: 0.5, rate: 1.2 });

    const sendMessageMock = (
      globalThis as unknown as {
        chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
      }
    ).chrome.runtime.sendMessage;

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: "PLAY_SOUND",
      url: "ding.ogg",
      options: { volume: 0.5, rate: 1.2 },
    });
  });

  it("returns a failure result when sendMessage rejects", async () => {
    mock.setDocumentExists(true);
    const backend = new ChromeAudioBackend();
    await backend.initialize();

    const sendMessageMock = (
      globalThis as unknown as {
        chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
      }
    ).chrome.runtime.sendMessage;
    sendMessageMock.mockRejectedValueOnce(new Error("offscreen exploded"));

    const result = await backend.play("ding.ogg");
    expect(result.success).toBe(false);
    expect(result.error).toBe("offscreen exploded");
    expect(result.latencyMs).toBe(0);
  });

  it("dispose closes the offscreen document and clears ready state", async () => {
    mock.setDocumentExists(true);
    const backend = new ChromeAudioBackend();
    await backend.initialize();
    await backend.dispose();

    expect(mock.calls.closeDocument).toBe(1);
    expect(backend.isReady()).toBe(false);
  });

  it("dispose is safe to call when no document exists", async () => {
    const backend = new ChromeAudioBackend();
    await backend.dispose();
    expect(mock.calls.closeDocument).toBe(0);
  });

  it("stopAll silently no-ops when the offscreen document is gone", async () => {
    const backend = new ChromeAudioBackend();
    const sendMessageMock = (
      globalThis as unknown as {
        chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
      }
    ).chrome.runtime.sendMessage;
    sendMessageMock.mockRejectedValueOnce(new Error("no offscreen"));

    // Must not throw.
    await backend.stopAll();
  });
});
