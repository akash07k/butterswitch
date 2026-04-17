/**
 * @module options/App
 *
 * ButterSwitch Options page — full settings interface.
 *
 * Organized into tabs: General, Sound Events, Themes, Logging.
 * Uses shadcn/ui Tabs (Radix) with default automatic activation.
 * Keyboard shortcuts (Alt+1-4) switch tabs via hotkeys-js.
 * Press Shift+? for a help announcement.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import hotkeys from "hotkeys-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { announce } from "@/shared/a11y/announcer";
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from "@/config/themes";
import { GeneralTab } from "./tabs/GeneralTab.js";
import { SoundEventsTab } from "./tabs/SoundEventsTab.js";
import { ThemesTab } from "./tabs/ThemesTab.js";
import { LoggingTab } from "./tabs/LoggingTab.js";

/** Tab definitions — id, label, and keyboard shortcut. */
const TAB_DEFINITIONS = [
  { id: "general", label: "General", shortcut: "Alt+1" },
  { id: "sound-events", label: "Sound Events", shortcut: "Alt+2" },
  { id: "themes", label: "Themes", shortcut: "Alt+3" },
  { id: "logging", label: "Logging", shortcut: "Alt+4" },
] as const;

/** Options page root — tabbed settings interface with local keyboard shortcuts. */
export default function App() {
  const [activeTab, setActiveTab] = useState("general");
  const [showWelcome, setShowWelcome] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const welcomeHeadingRef = useRef<HTMLHeadingElement>(null);

  // Check if this is the first visit (show welcome banner)
  useEffect(() => {
    async function init() {
      const stored = await browser.storage.local.get("onboarding.seen");
      if (!stored["onboarding.seen"]) {
        setShowWelcome(true);
        announce(
          "Welcome to ButterSwitch. A welcome banner is available above the tabs.",
          "polite",
        );
      }
    }
    init();
  }, []);

  /** Dismiss the welcome banner and mark onboarding as seen. */
  const dismissWelcome = () => {
    setShowWelcome(false);
    browser.storage.local.set({ "onboarding.seen": true });
    announce("Welcome banner dismissed", "polite");
    requestAnimationFrame(() => {
      headingRef.current?.focus();
    });
  };

  /** Handle tab change — announce the new tab name. */
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    const tab = TAB_DEFINITIONS.find((t) => t.id === tabId);
    if (tab) {
      announce(`${tab.label} settings loaded`, "polite");
    }
  }, []);

  /** Cycle through available themes. */
  const handleCycleTheme = useCallback(async () => {
    const stored = await browser.storage.local.get("general.activeTheme");
    const current = (stored["general.activeTheme"] as string) ?? DEFAULT_THEME_ID;
    const themeIds = BUILT_IN_THEMES.map((t) => t.id);
    const nextIndex = (themeIds.indexOf(current) + 1) % themeIds.length;
    const next = themeIds[nextIndex]!;
    await browser.storage.local.set({ "general.activeTheme": next });
    announce(`Theme changed to ${next}`, "polite");
  }, []);

  // Register local keyboard shortcuts via hotkeys-js
  useEffect(() => {
    const originalFilter = hotkeys.filter;
    hotkeys.filter = () => true;

    hotkeys("alt+1", (e) => {
      e.preventDefault();
      handleTabChange("general");
    });
    hotkeys("alt+2", (e) => {
      e.preventDefault();
      handleTabChange("sound-events");
    });
    hotkeys("alt+3", (e) => {
      e.preventDefault();
      handleTabChange("themes");
    });
    hotkeys("alt+4", (e) => {
      e.preventDefault();
      handleTabChange("logging");
    });
    hotkeys("alt+t", (e) => {
      e.preventDefault();
      handleCycleTheme();
    });
    hotkeys("shift+/", (e) => {
      e.preventDefault();
      announce(
        "Keyboard shortcuts: Alt+1 through Alt+4 switch tabs. Alt+T cycles theme. " +
          "Global shortcuts like Alt+M for mute work from any tab.",
        "assertive",
      );
    });

    return () => {
      hotkeys.unbind("alt+1,alt+2,alt+3,alt+4,alt+t,shift+/");
      hotkeys.filter = originalFilter;
    };
  }, [handleTabChange, handleCycleTheme]);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-6">
        ButterSwitch Options
      </h1>

      {showWelcome && (
        <div role="region" aria-label="Welcome" className="mb-6 border rounded-lg p-4 space-y-2">
          <h2 ref={welcomeHeadingRef} tabIndex={-1} className="text-lg font-semibold">
            Welcome to ButterSwitch
          </h2>
          <p className="text-muted-foreground">
            ButterSwitch plays audio cues for browser events — tabs, bookmarks, downloads, and
            navigation. Sounds play automatically as you browse. Use the General tab to adjust
            volume and mute. Use Sound Events to enable or disable individual events. Press Shift+?
            for keyboard shortcuts.
          </p>
          <button
            onClick={dismissWelcome}
            className="mt-2 px-4 py-2 rounded border border-input bg-transparent text-sm hover:bg-accent"
          >
            Got it
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start">
          {TAB_DEFINITIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} aria-keyshortcuts={tab.shortcut}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>

        <TabsContent value="sound-events">
          <SoundEventsTab />
        </TabsContent>

        <TabsContent value="themes">
          <ThemesTab />
        </TabsContent>

        <TabsContent value="logging">
          <LoggingTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
