/**
 * @module components/ui/shortcut-recorder
 *
 * Keyboard shortcut recorder with manual entry fallback.
 *
 * Dual-mode component for setting hotkeys-js shortcut bindings:
 * 1. **Recorder mode** (default): focus the field and press keys to capture
 * 2. **Manual mode**: type the hotkeys-js string directly (e.g., "alt+t")
 *
 * Accessibility (WCAG AAA):
 * - Uses native `<input>` to guarantee NVDA enters focus mode
 * - `aria-roledescription="shortcut recorder"` overrides "edit, read only"
 * - Visible instructions explain the non-standard interaction
 * - Captured shortcuts announced via aria-live assertive region
 * - Escape always cancels recording (never stored as a shortcut)
 * - Tab passes through naturally (no keyboard trap)
 * - Blocked keys list includes screen reader, browser, and OS-reserved keys
 * - Manual entry toggle provides WCAG 3.3.5 Help / 2.5.6 alternative
 */

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { announce } from "@/shared/a11y/announcer";

/** Keys that are modifiers only — don't produce a shortcut on their own. */
const MODIFIER_KEYS = new Set(["Alt", "Control", "Shift", "Meta", "OS"]);

/**
 * Keys blocked from recording.
 * - Insert/CapsLock: screen reader modifiers (NVDA, JAWS)
 * - Tab: focus navigation (keyboard trap risk)
 * - Escape: reserved for cancel
 * - F1/F5/F6/F11/F12: browser-reserved function keys
 * - NumLock/ScrollLock/Pause/PrintScreen: OS-level, unreliable capture
 */
const BLOCKED_KEYS = new Set([
  "Insert",
  "CapsLock",
  "Tab",
  "Escape",
  "NumLock",
  "ScrollLock",
  "Pause",
  "PrintScreen",
  "F1",
  "F5",
  "F6",
  "F11",
  "F12",
]);

/**
 * Browser-reserved Ctrl combinations that JavaScript cannot prevent.
 * These fire before the keydown handler gets a chance to act.
 */
const BROWSER_RESERVED_CTRL = new Set(["w", "t", "n", "Tab"]);

/**
 * Convert a KeyboardEvent.key value to hotkeys-js format.
 * hotkeys-js uses lowercase names: "a", "1", "enter", "up", etc.
 */
function normalizeKey(key: string): string {
  const map: Record<string, string> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    " ": "space",
    Enter: "enter",
    Backspace: "backspace",
    Delete: "delete",
    Home: "home",
    End: "end",
    PageUp: "pageup",
    PageDown: "pagedown",
  };
  return map[key] ?? key.toLowerCase();
}

/**
 * Build a human-readable label from a hotkeys-js string.
 * Uses "plus" spelling for screen readers (some skip the "+" character).
 * e.g., "alt+t" → "Alt plus T"
 */
function formatForAnnouncement(shortcut: string): string {
  if (!shortcut) return "";
  return shortcut
    .split("+")
    .map((part) => {
      const lower = part.trim().toLowerCase();
      if (lower === "ctrl" || lower === "control") return "Ctrl";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "meta" || lower === "command") return "Command";
      if (lower.length === 1) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" plus ");
}

/**
 * Build a visual display label from a hotkeys-js string.
 * e.g., "alt+t" → "Alt + T"
 */
function formatForDisplay(shortcut: string): string {
  if (!shortcut) return "";
  return shortcut
    .split("+")
    .map((part) => {
      const lower = part.trim().toLowerCase();
      if (lower === "ctrl" || lower === "control") return "Ctrl";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "meta" || lower === "command") return "Cmd";
      if (lower.length === 1) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" + ");
}

interface ShortcutRecorderProps {
  /** Current shortcut value in hotkeys-js format (e.g., "alt+t"). */
  value: string;
  /** Called when the user records a new shortcut. */
  onChange: (shortcut: string) => void;
  /** Accessible label for the recorder. */
  "aria-label": string;
  /** ID of the instructions element for aria-describedby. */
  "aria-describedby"?: string;
  /** HTML id attribute. */
  id?: string;
  /** Additional class names. */
  className?: string;
}

export function ShortcutRecorder({
  value,
  onChange,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  id,
  className,
}: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState(value);
  const previousValueRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Enter recording mode when the recorder input gains focus. */
  const handleRecorderFocus = useCallback(() => {
    previousValueRef.current = value;
    setRecording(true);
    announce(
      `Recording shortcut for ${ariaLabel.replace("Shortcut for ", "")}. Press your desired key combination. Press Escape to cancel.`,
      "assertive",
    );
  }, [value, ariaLabel]);

  /** Exit recording mode when the recorder input loses focus. */
  const handleRecorderBlur = useCallback(() => {
    setRecording(false);
  }, []);

  /** Capture key combinations in recorder mode. */
  const handleRecorderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const { key, altKey, ctrlKey, shiftKey, metaKey } = e;

      // Tab passes through — never capture (keyboard trap prevention)
      if (key === "Tab") return;

      // Escape cancels recording — never store as a shortcut
      if (key === "Escape") {
        e.preventDefault();
        onChange(previousValueRef.current);
        setRecording(false);
        announce("Recording cancelled.", "polite");
        inputRef.current?.blur();
        return;
      }

      // Block everything else from default browser behavior
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses (wait for the completing key)
      if (MODIFIER_KEYS.has(key)) return;

      // Ignore blocked keys (screen reader, browser, OS reserved)
      if (BLOCKED_KEYS.has(key)) return;

      // Ignore browser-reserved Ctrl combos (can't be prevented anyway)
      if (ctrlKey && BROWSER_RESERVED_CTRL.has(key.toLowerCase())) return;

      // Build the shortcut string in hotkeys-js format
      const parts: string[] = [];
      if (ctrlKey) parts.push("ctrl");
      if (altKey) parts.push("alt");
      if (shiftKey) parts.push("shift");
      if (metaKey) parts.push("command");

      const normalizedKey = normalizeKey(key);
      parts.push(normalizedKey);

      const shortcut = parts.join("+");

      // Validate: require at least a modifier for single character keys
      const isSpecialKey = normalizedKey.length > 1;
      const hasModifier = ctrlKey || altKey || metaKey;
      if (!isSpecialKey && !hasModifier && !shiftKey) {
        announce(
          `${key.toUpperCase()} alone is not valid. Press a modifier like Alt or Ctrl with a letter.`,
          "assertive",
        );
        return;
      }

      onChange(shortcut);
      setRecording(false);
      announce(`Shortcut set to ${formatForAnnouncement(shortcut)}.`, "assertive");
      inputRef.current?.blur();
    },
    [onChange],
  );

  /** Clear the current binding. */
  const handleClear = useCallback(() => {
    onChange("");
    setManualText("");
    announce(`Shortcut for ${ariaLabel.replace("Shortcut for ", "")} cleared.`, "polite");
  }, [onChange, ariaLabel]);

  /** Toggle between recorder and manual entry mode. */
  const handleToggleMode = useCallback(() => {
    const nextMode = !manualMode;
    setManualMode(nextMode);
    if (nextMode) {
      setManualText(value);
      announce("Switched to manual entry. Type the shortcut string, for example alt+t.", "polite");
    } else {
      announce("Switched to shortcut recorder. Focus the field and press keys.", "polite");
    }
  }, [manualMode, value]);

  /** Save manual text entry on blur. */
  const handleManualBlur = useCallback(() => {
    const trimmed = manualText.trim().toLowerCase();
    if (trimmed !== value) {
      onChange(trimmed);
      if (trimmed) {
        announce(`Shortcut set to ${formatForAnnouncement(trimmed)}.`, "polite");
      }
    }
  }, [manualText, value, onChange]);

  const displayText = recording ? "Press keys\u2026" : value ? formatForDisplay(value) : "Not set";

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {manualMode ? (
        /* Manual text entry mode */
        <input
          id={id}
          type="text"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onBlur={handleManualBlur}
          placeholder="e.g., alt+t"
          className={cn(
            "h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm",
            "outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
          )}
        />
      ) : (
        /* Recorder mode — native <input> guarantees NVDA focus mode */
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="none"
          readOnly
          aria-label={ariaLabel}
          aria-roledescription="shortcut recorder"
          aria-describedby={ariaDescribedBy}
          value={displayText}
          onFocus={handleRecorderFocus}
          onBlur={handleRecorderBlur}
          onKeyDown={handleRecorderKeyDown}
          className={cn(
            "h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm",
            "outline-none transition-[color,box-shadow] cursor-pointer caret-transparent",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
            recording && "border-primary ring-[3px] ring-primary/30",
            !value && !recording && "text-muted-foreground",
          )}
        />
      )}

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={`Clear shortcut for ${ariaLabel.replace("Shortcut for ", "")}`}
          className={cn(
            "h-9 px-2 rounded-md border border-input bg-transparent text-sm",
            "hover:bg-accent hover:text-accent-foreground",
            "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
          )}
        >
          Clear
        </button>
      )}

      {/* Toggle between recorder and manual entry */}
      <button
        type="button"
        onClick={handleToggleMode}
        aria-label={manualMode ? "Switch to shortcut recorder" : "Switch to manual entry"}
        className={cn(
          "h-9 px-2 rounded-md border border-input bg-transparent text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
        )}
      >
        {manualMode ? "Record" : "Type"}
      </button>
    </div>
  );
}

export { formatForDisplay };
