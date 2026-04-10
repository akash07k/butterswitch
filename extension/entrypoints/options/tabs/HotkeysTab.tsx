/**
 * @module options/tabs/HotkeysTab
 *
 * Hotkeys settings tab — view and customize keyboard shortcuts.
 *
 * Displays all configured hotkey bindings. Users can edit the
 * hotkey string for each command. All hotkeys are user-configurable
 * to avoid conflicts with screen reader shortcuts.
 */

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

/** Human-readable names for hotkey command IDs. */
const COMMAND_NAMES: Record<string, string> = {
  "global:toggle-mute": "Toggle Mute",
  "global:volume-up": "Volume Up",
  "global:volume-down": "Volume Down",
  "global:cycle-theme": "Cycle Theme",
  "global:open-sound-events": "Open Sound Events",
  "global:open-themes": "Open Themes",
  "global:open-hotkeys": "Open Hotkeys",
  "global:show-help": "Show Help",
};

export function HotkeysTab() {
  const [bindings, setBindings] = useState<Record<string, string>>(
    DEFAULT_SETTINGS.hotkeys.bindings,
  );

  // Load saved bindings
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get(null);
        const loaded: Record<string, string> = { ...DEFAULT_SETTINGS.hotkeys.bindings };
        for (const [key, value] of Object.entries(stored)) {
          if (key.startsWith("hotkeys.bindings.")) {
            const commandId = key.replace("hotkeys.bindings.", "");
            loaded[commandId] = value as string;
          }
        }
        setBindings(loaded);
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

  /** Save a single hotkey binding. */
  const handleBindingChange = (commandId: string, newBinding: string) => {
    setBindings((prev) => ({ ...prev, [commandId]: newBinding }));
    browser.storage.local.set({ [`hotkeys.bindings.${commandId}`]: newBinding });
    const name = COMMAND_NAMES[commandId] ?? commandId;
    announce(`${name} hotkey set to ${newBinding}`, "polite");
  };

  /** Reset all bindings to defaults. */
  const handleResetAll = () => {
    setBindings(DEFAULT_SETTINGS.hotkeys.bindings);
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS.hotkeys.bindings)) {
      browser.storage.local.set({ [`hotkeys.bindings.${key}`]: value });
    }
    announce("All hotkeys reset to defaults", "polite");
  };

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">Hotkeys</h2>
      <p className="text-muted-foreground">
        Customize keyboard shortcuts. All hotkeys can be changed to avoid conflicts with your screen
        reader.
      </p>

      <Table>
        <TableCaption className="sr-only">Keyboard shortcut bindings</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Command</TableHead>
            <TableHead scope="col">Hotkey</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(bindings).map(([commandId, binding]) => (
            <TableRow key={commandId}>
              <TableCell className="font-medium">{COMMAND_NAMES[commandId] ?? commandId}</TableCell>
              <TableCell>
                <Label htmlFor={`hotkey-${commandId}`} className="sr-only">
                  Hotkey for {COMMAND_NAMES[commandId] ?? commandId}
                </Label>
                <Input
                  id={`hotkey-${commandId}`}
                  aria-label={`Hotkey for ${COMMAND_NAMES[commandId] ?? commandId}`}
                  value={binding}
                  onChange={(e) => handleBindingChange(commandId, e.target.value)}
                  className="w-40"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button variant="outline" onClick={handleResetAll}>
        Reset All to Defaults
      </Button>
    </div>
  );
}
