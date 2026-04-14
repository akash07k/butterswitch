/**
 * @module options/tabs/SoundEventsTab
 *
 * Sound Events settings tab — filterable table of all 63 browser events
 * with per-event controls: enable/disable, volume, pitch, and preview.
 *
 * Uses a plain HTML table (not a grid) because each row is an independent
 * settings control, not a spreadsheet. NVDA reads row/column context
 * automatically with native tables.
 *
 * All interactive controls have aria-label with the event name
 * (e.g., "Volume for Tab Created") so screen readers provide
 * full context when tabbing through controls.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { sendLog, sendPreviewSound } from "@/core/messaging/send";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEventDefaults } from "@/config/events";
import { Play } from "lucide-react";
import { announce } from "@/shared/a11y/announcer";
import { EVENT_REGISTRY } from "@/modules/sound-engine/event-registry";
import type { EventDefinition } from "@/modules/sound-engine/types";

/** Per-event config stored in settings. */
interface EventConfig {
  enabled: boolean;
  volume: number;
  pitch: number;
}

/** Available tier filter options. */
const TIER_OPTIONS = [
  { value: "1", label: "Essential only (Tier 1)" },
  { value: "1-2", label: "Essential + Useful (Tier 1-2)" },
  { value: "all", label: "All events" },
] as const;

/** Sound Events settings tab — filterable table of all browser events with per-event controls. */
export function SoundEventsTab() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("1");
  const [configs, setConfigs] = useState<Record<string, EventConfig>>({});

  // Load per-event configs from storage
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get(null);
        const loadedConfigs: Record<string, EventConfig> = {};
        for (const event of EVENT_REGISTRY) {
          const key = `sounds.events.${event.id}`;
          if (stored[key]) {
            loadedConfigs[event.id] = stored[key] as EventConfig;
          } else {
            loadedConfigs[event.id] = {
              enabled: getEventDefaults(event.id).enabled,
              volume: 100,
              pitch: 1.0,
            };
          }
        }
        setConfigs(loadedConfigs);
      } catch {
        // Use defaults
        const defaults: Record<string, EventConfig> = {};
        for (const event of EVENT_REGISTRY) {
          defaults[event.id] = {
            enabled: getEventDefaults(event.id).enabled,
            volume: 100,
            pitch: 1.0,
          };
        }
        setConfigs(defaults);
      }
    }
    load();
  }, []);

  // Filter events by search + tier
  const filteredEvents = useMemo(() => {
    const query = search.toLowerCase();
    return EVENT_REGISTRY.filter((event) => {
      // Tier filter
      if (tierFilter === "1" && event.tier !== 1) return false;
      if (tierFilter === "1-2" && event.tier > 2) return false;

      // Search filter
      if (query) {
        return (
          event.label.toLowerCase().includes(query) ||
          event.category.toLowerCase().includes(query) ||
          event.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [search, tierFilter]);

  // Note: search result count announcements are handled by the role="status"
  // div in the UI (#event-count). No separate announce() call needed —
  // that would cause NVDA to read the count twice.

  /** Save a single event config to storage. */
  const saveEventConfig = (eventId: string, config: EventConfig) => {
    browser.storage.local.set({ [`sounds.events.${eventId}`]: config });
  };

  /** Toggle an event's enabled state. */
  const handleToggle = (event: EventDefinition, checked: boolean) => {
    const updated = { ...configs[event.id]!, enabled: checked };
    setConfigs((prev) => ({ ...prev, [event.id]: updated }));
    saveEventConfig(event.id, updated);
    announce(`${event.label} ${checked ? "enabled" : "disabled"}`, "polite");
  };

  /** Update an event's volume. */
  const handleVolume = (event: EventDefinition, values: number[]) => {
    const volume = values[0] ?? 100;
    const updated = { ...configs[event.id]!, volume };
    setConfigs((prev) => ({ ...prev, [event.id]: updated }));
    saveEventConfig(event.id, updated);
  };

  /** Update an event's pitch. */
  const handlePitch = (event: EventDefinition, values: number[]) => {
    const pitch = values[0] ?? 1.0;
    const updated = { ...configs[event.id]!, pitch };
    setConfigs((prev) => ({ ...prev, [event.id]: updated }));
    saveEventConfig(event.id, updated);
  };

  /** Preview an event's sound. */
  const handlePreview = async (event: EventDefinition) => {
    announce(`Playing preview for ${event.label}`, "polite");
    sendLog("info", `Preview requested: ${event.label}`, { eventId: event.id });
    try {
      const result = await sendPreviewSound(event.id);
      if (!result.success) {
        announce(`Preview unavailable for ${event.label}`, "polite");
        sendLog("warn", `Preview failed: ${event.label}`, {
          eventId: event.id,
          error: result.error,
        });
      }
    } catch {
      announce(`Preview unavailable for ${event.label}`, "polite");
    }
  };

  /** Handle tier filter change. */
  const handleTierChange = (value: string) => {
    setTierFilter(value);
    const option = TIER_OPTIONS.find((o) => o.value === value);
    if (option) {
      announce(`Filter: ${option.label}`, "polite");
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <h2 className="text-xl font-semibold">Sound Events</h2>

      {/* Filters */}
      <fieldset className="space-y-3 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Filters</legend>

        {/* Search */}
        <div className="space-y-1">
          <Label htmlFor="event-search">Search events</Label>
          <Input
            id="event-search"
            type="search"
            placeholder="Filter by name, category, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-describedby="event-count"
          />
        </div>

        {/* Tier filter */}
        <div className="flex gap-4 items-center">
          <span className="text-sm font-medium">Show:</span>
          {TIER_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="tier-filter"
                value={option.value}
                checked={tierFilter === option.value}
                onChange={() => handleTierChange(option.value)}
                className="w-4 h-4"
              />
              {option.label}
            </label>
          ))}
        </div>

        {/* Result count */}
        <div id="event-count" role="status" className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {EVENT_REGISTRY.length} events
        </div>
      </fieldset>

      {/* Events table */}
      <Table>
        <TableCaption className="sr-only">
          Sound event configuration. Each row controls one browser event.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Event</TableHead>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col">Enabled</TableHead>
            <TableHead scope="col">Volume</TableHead>
            <TableHead scope="col">Pitch</TableHead>
            <TableHead scope="col">Preview</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredEvents.map((event) => {
            const config = configs[event.id] ?? {
              enabled: getEventDefaults(event.id).enabled,
              volume: 100,
              pitch: 1.0,
            };
            return (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  {event.label}
                  <span className="block text-xs text-muted-foreground">{event.description}</span>
                </TableCell>
                <TableCell className="capitalize">{event.category}</TableCell>
                <TableCell>
                  <Switch
                    aria-label={`Enable ${event.label}`}
                    checked={config.enabled}
                    onCheckedChange={(checked) => handleToggle(event, checked)}
                  />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Slider
                    aria-label={`Volume for ${event.label}`}
                    aria-valuetext={`${config.volume} percent`}
                    value={[config.volume]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => handleVolume(event, v)}
                    disabled={!config.enabled}
                  />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Slider
                    aria-label={`Pitch for ${event.label}`}
                    aria-valuetext={`${config.pitch.toFixed(1)}x speed`}
                    value={[config.pitch]}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    onValueChange={(v) => handlePitch(event, v)}
                    disabled={!config.enabled}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Preview sound for ${event.label}`}
                    onClick={() => handlePreview(event)}
                    disabled={!config.enabled}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Reset */}
      <Button
        variant="outline"
        onClick={async () => {
          const defaults: Record<string, EventConfig> = {};
          const keysToRemove = EVENT_REGISTRY.map((e) => `sounds.events.${e.id}`);
          for (const event of EVENT_REGISTRY) {
            defaults[event.id] = {
              enabled: getEventDefaults(event.id).enabled,
              volume: 100,
              pitch: 1.0,
            };
          }
          await browser.storage.local.remove(keysToRemove);
          setConfigs(defaults);
          announce("All sound event settings reset to defaults", "polite");
          sendLog("warn", "Sound event settings reset to defaults", { source: "options" });
        }}
      >
        Reset Sound Event Settings
      </Button>
    </div>
  );
}
