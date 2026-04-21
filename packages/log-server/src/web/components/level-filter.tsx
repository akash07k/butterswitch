import { CheckboxGroup, Checkbox } from "react-aria-components";
import { VisuallyHidden } from "react-aria";
import { enqueueAnnounce } from "../lib/announce.js";

interface LevelFilterProps {
  enabledLevels: number[];
  onChange: (levels: number[]) => void;
}

const LEVELS = [
  { value: 0, label: "DEBUG" },
  { value: 1, label: "INFO" },
  { value: 2, label: "WARN" },
  { value: 3, label: "ERROR" },
  { value: 4, label: "FATAL" },
];

/** Checkbox group for toggling visible log levels. Announces filter state to screen readers. */
export function LevelFilter({ enabledLevels, onChange }: LevelFilterProps) {
  const handleChange = (selected: string[]) => {
    const levels = selected.map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
    onChange(levels);

    const names = levels.map((l) => LEVELS.find((lv) => lv.value === l)?.label).filter(Boolean);
    if (names.length === LEVELS.length) {
      enqueueAnnounce("Showing all log levels");
    } else if (names.length === 0) {
      enqueueAnnounce("No log levels selected. No entries will be shown.");
    } else {
      enqueueAnnounce(`Filtering by ${names.join(", ")}`);
    }
  };

  return (
    <>
      {/* Hidden heading — lets NVDA H-key nav reach this filter group. */}
      <VisuallyHidden elementType="h3">Level filter</VisuallyHidden>
      <CheckboxGroup
        value={enabledLevels.map(String)}
        onChange={handleChange}
        aria-label="Filter by level"
      >
        <span slot="label">Filter by level</span>
        {LEVELS.map((level) => (
          <Checkbox key={level.value} value={String(level.value)}>
            {level.label}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </>
  );
}
