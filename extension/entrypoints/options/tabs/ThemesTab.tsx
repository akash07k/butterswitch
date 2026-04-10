/**
 * @module options/tabs/ThemesTab
 *
 * Themes settings tab — browse installed sound themes,
 * preview sounds, and import custom themes.
 *
 * For v1, only the built-in "Subtle" theme is available.
 * Custom theme import (via .zip) will be added in a future version.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { announce } from "@/shared/a11y/announcer";
import { sendLog } from "@/core/messaging/send";

/** Built-in theme metadata. */
const BUILT_IN_THEMES = [
  {
    id: "subtle",
    name: "Subtle",
    description:
      "Soft clicks and gentle chimes. Minimal, non-intrusive audio cues for everyday browsing.",
    author: "ButterSwitch (sounds from Kenney.nl, CC0 license)",
    soundCount: 28,
  },
];

export function ThemesTab() {
  const [activeTheme, setActiveTheme] = useState("subtle");

  // Load active theme from storage
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get("general.activeTheme");
        if (stored["general.activeTheme"]) {
          setActiveTheme(stored["general.activeTheme"]);
        }
      } catch {
        // Use default
      }
    }
    load();
  }, []);

  const handleThemeChange = (themeId: string) => {
    setActiveTheme(themeId);
    browser.storage.local.set({ "general.activeTheme": themeId });
    const theme = BUILT_IN_THEMES.find((t) => t.id === themeId);
    announce(`Theme changed to ${theme?.name ?? themeId}`, "polite");
    sendLog("info", `Theme changed to ${theme?.name ?? themeId}`, { themeId });
  };

  const activeThemeInfo = BUILT_IN_THEMES.find((t) => t.id === activeTheme);

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">Themes</h2>

      {/* Active Theme */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Active Theme</legend>

        <div className="space-y-2">
          <Label htmlFor="active-theme">Sound Theme</Label>
          <Select value={activeTheme} onValueChange={handleThemeChange}>
            <SelectTrigger id="active-theme" className="w-full">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {BUILT_IN_THEMES.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  {theme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme details */}
        {activeThemeInfo && (
          <div className="space-y-1 text-sm">
            <p>
              <strong>Description:</strong> {activeThemeInfo.description}
            </p>
            <p>
              <strong>Author:</strong> {activeThemeInfo.author}
            </p>
            <p>
              <strong>Sounds:</strong> {activeThemeInfo.soundCount} audio files
            </p>
          </div>
        )}
      </fieldset>

      {/* Custom Themes — placeholder for v1 */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Custom Themes</legend>
        <p className="text-muted-foreground">
          Import custom sound themes from .zip files. Each theme contains a theme.json manifest and
          OGG sound files.
        </p>
        <Button variant="outline" disabled>
          Import Theme (.zip) — Coming Soon
        </Button>
      </fieldset>

      {/* Reset */}
      <Button
        variant="outline"
        onClick={() => {
          setActiveTheme("subtle");
          browser.storage.local.set({ "general.activeTheme": "subtle" });
          announce("Theme reset to Subtle (default)", "polite");
          sendLog("warn", "Theme reset to Subtle (default)", { source: "options" });
        }}
      >
        Reset Theme Settings
      </Button>
    </div>
  );
}
