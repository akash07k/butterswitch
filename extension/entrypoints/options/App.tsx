/**
 * @module options/App
 *
 * ButterSwitch Options page — full settings interface.
 *
 * Organized into tabs: General, Sound Events, Themes, Hotkeys, Logging.
 * Uses shadcn/ui Tabs (Radix) with manual activation mode —
 * arrow keys move focus between tabs, Enter/Space activates.
 * This is better for screen readers when tabs have heavy content.
 *
 * Each tab panel starts with an h2 heading for screen reader's heading
 * navigation (H key). Tab switches are announced via the
 * announcer utility.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import hotkeys from "hotkeys-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { announce } from "@/shared/a11y/announcer";
import { focusFirst } from "@/shared/a11y/focus";
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from "@/config/themes";
import { GeneralTab } from "./tabs/GeneralTab.js";
import { SoundEventsTab } from "./tabs/SoundEventsTab.js";
import { ThemesTab } from "./tabs/ThemesTab.js";
import { HotkeysTab } from "./tabs/HotkeysTab.js";
import { LoggingTab } from "./tabs/LoggingTab.js";

/** Tab definitions — id, label, and component. */
const TAB_DEFINITIONS = [
  { id: "general", label: "General" },
  { id: "sound-events", label: "Sound Events" },
  { id: "themes", label: "Themes" },
  { id: "hotkeys", label: "Hotkeys" },
  { id: "logging", label: "Logging" },
] as const;

/** Options page root — tabbed settings interface with local keyboard shortcuts. */
export default function App() {
  const [activeTab, setActiveTab] = useState("general");
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Focus the first control in the default tab on initial load
  useEffect(() => {
    setTimeout(() => {
      const panel = panelRefs.current["general"];
      if (panel) focusFirst(panel);
    }, 100);
  }, []);

  /**
   * Handle tab change — announce the new tab and move focus
   * into the panel content for screen readers.
   */
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    const tab = TAB_DEFINITIONS.find((t) => t.id === tabId);
    if (tab) {
      announce(`${tab.label} settings loaded`, "polite");
    }

    // Move focus into the panel after a short delay
    // (Radix needs time to mount the panel content)
    setTimeout(() => {
      const panel = panelRefs.current[tabId];
      if (panel) focusFirst(panel);
    }, 50);
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
    // Allow hotkeys to fire even when focus is in input/select/textarea
    hotkeys.filter = () => true;

    hotkeys("alt+1", (e) => {
      e.preventDefault();
      handleTabChange("sound-events");
    });
    hotkeys("alt+2", (e) => {
      e.preventDefault();
      handleTabChange("themes");
    });
    hotkeys("alt+3", (e) => {
      e.preventDefault();
      handleTabChange("hotkeys");
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
    };
  }, [handleTabChange, handleCycleTheme]);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ButterSwitch Options</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} activationMode="manual">
        <TabsList className="w-full justify-start">
          {TAB_DEFINITIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* General Tab */}
        <TabsContent
          value="general"
          ref={(el) => {
            panelRefs.current["general"] = el;
          }}
        >
          <GeneralTab />
        </TabsContent>

        {/* Sound Events Tab */}
        <TabsContent
          value="sound-events"
          ref={(el) => {
            panelRefs.current["sound-events"] = el;
          }}
        >
          <SoundEventsTab />
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent
          value="themes"
          ref={(el) => {
            panelRefs.current["themes"] = el;
          }}
        >
          <ThemesTab />
        </TabsContent>

        {/* Hotkeys Tab */}
        <TabsContent
          value="hotkeys"
          ref={(el) => {
            panelRefs.current["hotkeys"] = el;
          }}
        >
          <HotkeysTab />
        </TabsContent>

        {/* Logging Tab */}
        <TabsContent
          value="logging"
          ref={(el) => {
            panelRefs.current["logging"] = el;
          }}
        >
          <LoggingTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
