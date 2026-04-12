import { CheckboxGroup, Checkbox } from "react-aria-components";
import { announce } from "@react-aria/live-announcer";

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

export function LevelFilter({ enabledLevels, onChange }: LevelFilterProps) {
  const handleChange = (selected: string[]) => {
    const levels = selected.map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
    onChange(levels);

    const names = levels.map((l) => LEVELS.find((lv) => lv.value === l)?.label).filter(Boolean);
    if (names.length === LEVELS.length) {
      announce("Showing all log levels", "polite");
    } else if (names.length === 0) {
      announce("No log levels selected. No entries will be shown.", "polite");
    } else {
      announce(`Filtering by ${names.join(", ")}`, "polite");
    }
  };

  return (
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
  );
}
