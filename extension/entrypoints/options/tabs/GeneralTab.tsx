/**
 * @module options/tabs/GeneralTab
 *
 * General settings tab — master volume, active theme,
 * mute toggle, and module enable/disable toggles.
 *
 * Settings are read from and written to browser.storage.local.
 * Changes take effect immediately — the background script
 * watches for storage changes.
 */

import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from "@/config/themes";
import { sendLog } from "@/core/messaging/send";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { announce } from "@/shared/a11y/announcer";

/** General settings tab — master volume, mute, theme selector, and module toggles. */
export function GeneralTab() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [activeTheme, setActiveTheme] = useState(DEFAULT_THEME_ID);
  const [soundEngineEnabled, setSoundEngineEnabled] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmResetRef = useRef<HTMLButtonElement>(null);

  // Auto-cancel factory reset confirmation after 5 seconds, focus confirm button
  useEffect(() => {
    if (!confirmReset) return;
    requestAnimationFrame(() => confirmResetRef.current?.focus());
    const timer = setTimeout(() => setConfirmReset(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  // Load settings on mount
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get([
          "general.muted",
          "general.masterVolume",
          "general.activeTheme",
          "general.enabledModules",
        ]);
        if (stored["general.muted"] !== undefined) setMuted(stored["general.muted"] as boolean);
        if (stored["general.masterVolume"] !== undefined)
          setVolume(stored["general.masterVolume"] as number);
        if (stored["general.activeTheme"] !== undefined)
          setActiveTheme(stored["general.activeTheme"] as string);
        if (stored["general.enabledModules"] !== undefined) {
          const modules = stored["general.enabledModules"] as string[];
          setSoundEngineEnabled(modules.includes("sound-engine"));
        }
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

  /** Save a setting to storage, announce the change, and log it. */
  const saveSetting = (key: string, value: unknown, announcement?: string) => {
    browser.storage.local.set({ [key]: value });
    if (announcement) announce(announcement, "polite");
    sendLog("info", `Setting changed: ${key}`, { key, value });
  };

  const handleMuteChange = (checked: boolean) => {
    const newMuted = !checked;
    setMuted(newMuted);
    saveSetting("general.muted", newMuted, newMuted ? "All sounds muted" : "Sounds unmuted");
  };

  /** Update volume UI state on drag (does NOT save to storage yet). */
  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0] ?? 80);
  };

  /** Save volume to storage when slider is released. */
  const handleVolumeCommit = (values: number[]) => {
    const newVolume = values[0] ?? 80;
    setVolume(newVolume);
    saveSetting("general.masterVolume", newVolume);
    announce(`Volume set to ${newVolume} percent`, "polite");
  };

  const handleThemeChange = (themeId: string) => {
    setActiveTheme(themeId);
    saveSetting("general.activeTheme", themeId, `Theme changed to ${themeId}`);
  };

  /** Toggle the sound engine. Writes the full enabledModules array (not a boolean). */
  const handleSoundEngineToggle = (checked: boolean) => {
    setSoundEngineEnabled(checked);
    const modules = checked ? ["sound-engine"] : [];
    saveSetting(
      "general.enabledModules",
      modules,
      checked ? "Sound engine enabled" : "Sound engine disabled",
    );
  };

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">General</h2>

      {/* Sound Controls */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Sound Controls</legend>

        {/* Mute Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="mute-toggle">Sound</Label>
          <Switch id="mute-toggle" checked={!muted} onCheckedChange={handleMuteChange} />
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <Label htmlFor="volume-slider">Master Volume: {volume}%</Label>
          <Slider
            id="volume-slider"
            aria-label="Master volume"
            aria-valuetext={`${volume} percent`}
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            onValueCommit={handleVolumeCommit}
            disabled={muted}
          />
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label htmlFor="theme-select">Sound Theme</Label>
          <Select value={activeTheme} onValueChange={handleThemeChange}>
            <SelectTrigger id="theme-select" className="w-full">
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
      </fieldset>

      {/* Module Toggles */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Modules</legend>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="sound-engine-toggle">Sound Engine</Label>
            <p id="sound-engine-desc" className="text-sm text-muted-foreground">
              Plays audio cues for browser events like tab switching, page loading, and downloads.
            </p>
          </div>
          <Switch
            id="sound-engine-toggle"
            aria-describedby="sound-engine-desc"
            checked={soundEngineEnabled}
            onCheckedChange={handleSoundEngineToggle}
          />
        </div>
      </fieldset>

      {/* Reset */}
      <Button
        variant="outline"
        onClick={() => {
          setMuted(false);
          setVolume(80);
          setActiveTheme(DEFAULT_THEME_ID);
          setSoundEngineEnabled(true);
          browser.storage.local.set({
            "general.muted": false,
            "general.masterVolume": 80,
            "general.activeTheme": DEFAULT_THEME_ID,
            "general.enabledModules": ["sound-engine"],
          });
          announce("General settings reset to defaults", "polite");
          sendLog("warn", "General settings reset to defaults", { source: "options" });
        }}
      >
        Reset General Settings
      </Button>

      {!confirmReset ? (
        <Button
          variant="outline"
          onClick={() => {
            setConfirmReset(true);
            announce("Are you sure? Press Factory Reset again to confirm.", "assertive");
          }}
        >
          Reset All Settings (Factory Reset)
        </Button>
      ) : (
        <Button
          ref={confirmResetRef}
          variant="destructive"
          onClick={async () => {
            await browser.storage.local.clear();
            setMuted(false);
            setVolume(80);
            setActiveTheme(DEFAULT_THEME_ID);
            setSoundEngineEnabled(true);
            announce(
              "All settings reset to factory defaults. Reload the extension for full effect.",
              "assertive",
            );
            sendLog("warn", "Factory reset: all settings cleared", { source: "options" });
            setConfirmReset(false);
          }}
        >
          Confirm Factory Reset
        </Button>
      )}
    </div>
  );
}
