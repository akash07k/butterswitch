/**
 * @module options/tabs/HotkeysTab
 *
 * Hotkeys settings tab — view and customize keyboard shortcuts.
 *
 * Two sections:
 * 1. **Global shortcuts** — registered via browser.commands API, work
 *    from any tab. Displayed read-only here because the browser manages
 *    them. Provides a button to open the browser's shortcut editor.
 * 2. **Page shortcuts** — handled by hotkeys-js, work only in the
 *    popup and options page. Editable inline.
 *
 * All hotkeys are user-configurable to avoid conflicts with screen
 * reader shortcuts (NVDA uses Insert+key, JAWS uses Insert+key).
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShortcutRecorder } from "@/components/ui/shortcut-recorder";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { announce } from "@/shared/a11y/announcer";
import { DEFAULT_SETTINGS } from "@/core/settings/defaults";

/** Human-readable names for global command IDs (browser.commands). */
const GLOBAL_COMMAND_NAMES: Record<string, string> = {
  "toggle-mute": "Toggle Mute",
  "open-options": "Open Options Page",
};

/** Human-readable names for local command IDs (hotkeys-js). */
const LOCAL_COMMAND_NAMES: Record<string, string> = {
  "local:cycle-theme": "Cycle Theme",
  "local:tab-sound-events": "Sound Events Tab",
  "local:tab-themes": "Themes Tab",
  "local:tab-hotkeys": "Hotkeys Tab",
  "local:tab-logging": "Logging Tab",
  "local:show-help": "Show Help",
};

/** Local binding defaults (only the local: prefixed ones). */
const LOCAL_DEFAULTS: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_SETTINGS.hotkeys.bindings).filter(([key]) => key.startsWith("local:")),
);

interface BrowserCommand {
  name: string;
  description: string;
  shortcut: string;
}

export function HotkeysTab() {
  const [globalCommands, setGlobalCommands] = useState<BrowserCommand[]>([]);
  const [localBindings, setLocalBindings] = useState<Record<string, string>>(LOCAL_DEFAULTS);

  // Load global commands from the browser
  useEffect(() => {
    async function loadGlobalCommands() {
      try {
        const commands = await browser.commands.getAll();
        setGlobalCommands(
          commands
            .filter((cmd) => cmd.name && cmd.name !== "_execute_action")
            .map((cmd) => ({
              name: cmd.name ?? "",
              description: cmd.description ?? "",
              shortcut: cmd.shortcut ?? "Not set",
            })),
        );
      } catch {
        // browser.commands might not be available in all contexts
      }
    }
    loadGlobalCommands();
  }, []);

  // Load saved local bindings from storage
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get(null);
        const loaded: Record<string, string> = { ...LOCAL_DEFAULTS };
        for (const [key, value] of Object.entries(stored)) {
          if (key.startsWith("hotkeys.bindings.local:")) {
            const commandId = key.replace("hotkeys.bindings.", "");
            loaded[commandId] = value as string;
          }
        }
        setLocalBindings(loaded);
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

  /** Debounce timer for hotkey change announcements. */
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending announce timer on unmount
  useEffect(() => {
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  /** Save a single local hotkey binding. */
  const handleLocalBindingChange = (commandId: string, newBinding: string) => {
    setLocalBindings((prev) => ({ ...prev, [commandId]: newBinding }));
    browser.storage.local.set({ [`hotkeys.bindings.${commandId}`]: newBinding });

    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(() => {
      const name = LOCAL_COMMAND_NAMES[commandId] ?? commandId;
      announce(`${name} shortcut set to ${newBinding}`, "polite");
    }, 500);
  };

  /** Reset local bindings to defaults. */
  const handleResetLocal = () => {
    setLocalBindings(LOCAL_DEFAULTS);
    for (const [key, value] of Object.entries(LOCAL_DEFAULTS)) {
      browser.storage.local.set({ [`hotkeys.bindings.${key}`]: value });
    }
    announce("Page shortcuts reset to defaults", "polite");
  };

  /** Copy the browser's shortcut editor URL to inform the user. */
  const handleOpenShortcutEditor = () => {
    announce(
      "To change global shortcuts, open your browser's extension shortcuts page. " +
        "In Chrome, navigate to chrome://extensions/shortcuts. " +
        "In Firefox, go to about:addons, click the gear icon, then Manage Extension Shortcuts.",
      "assertive",
    );
  };

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">Hotkeys</h2>
      <p className="text-muted-foreground">
        Keyboard shortcuts for controlling ButterSwitch. Global shortcuts work from any tab. Page
        shortcuts work when the popup or options page is open.
      </p>

      {/* Global Shortcuts — read-only, managed by browser */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Global Shortcuts</legend>
        <p className="text-sm text-muted-foreground">
          These shortcuts work from any tab. To change them, use your browser&apos;s extension
          shortcut editor.
        </p>

        <Table>
          <TableCaption className="sr-only">
            Global keyboard shortcuts managed by the browser
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Command</TableHead>
              <TableHead scope="col">Shortcut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {globalCommands.map((cmd) => (
              <TableRow key={cmd.name}>
                <TableCell className="font-medium">
                  {GLOBAL_COMMAND_NAMES[cmd.name] ?? cmd.description}
                </TableCell>
                <TableCell>
                  <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">{cmd.shortcut}</kbd>
                </TableCell>
              </TableRow>
            ))}
            {globalCommands.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  Loading shortcuts...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Button variant="outline" size="sm" onClick={handleOpenShortcutEditor}>
          How to Change Global Shortcuts
        </Button>
      </fieldset>

      {/* Page Shortcuts — editable, managed by hotkeys-js */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Page Shortcuts</legend>
        <p id="page-shortcuts-instructions" className="text-sm text-muted-foreground">
          These shortcuts work when the popup or options page is open. Focus a shortcut field and
          press your desired key combination, or use the Type button to enter it manually. Press
          Escape to cancel recording. Insert-based shortcuts are not supported because screen
          readers reserve the Insert key.
        </p>

        <Table>
          <TableCaption className="sr-only">Page keyboard shortcuts you can customize</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Command</TableHead>
              <TableHead scope="col">Shortcut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(localBindings).map(([commandId, binding]) => (
              <TableRow key={commandId}>
                <TableCell className="font-medium">
                  {LOCAL_COMMAND_NAMES[commandId] ?? commandId}
                </TableCell>
                <TableCell>
                  <ShortcutRecorder
                    id={`hotkey-${commandId}`}
                    aria-label={`Shortcut for ${LOCAL_COMMAND_NAMES[commandId] ?? commandId}`}
                    aria-describedby="page-shortcuts-instructions"
                    value={binding}
                    onChange={(newBinding) => handleLocalBindingChange(commandId, newBinding)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button variant="outline" size="sm" onClick={handleResetLocal}>
          Reset Page Shortcuts
        </Button>
      </fieldset>
    </div>
  );
}
