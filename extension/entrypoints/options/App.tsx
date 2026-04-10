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

import { useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { announce } from "@/shared/a11y/announcer";
import { focusFirst } from "@/shared/a11y/focus";
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

export default function App() {
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /**
   * Handle tab change — announce the new tab and move focus
   * into the panel content for screen readers.
   */
  const handleTabChange = useCallback((tabId: string) => {
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

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ButterSwitch Options</h1>

      <Tabs defaultValue="general" onValueChange={handleTabChange} activationMode="manual">
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
