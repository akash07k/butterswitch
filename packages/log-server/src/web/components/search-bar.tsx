import { useEffect, useRef } from "react";
import { SearchField, Input, Label, Text } from "react-aria-components";
import { announce } from "@react-aria/live-announcer";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

const ANNOUNCE_DEBOUNCE_MS = 500;

export function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  // Debounced result count announcement
  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (value) {
        announce(`${resultCount} of ${totalCount} log entries match your search`, "polite");
      } else {
        announce(`Showing all ${totalCount} log entries`, "polite");
      }
    }, ANNOUNCE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, resultCount, totalCount]);

  return (
    <SearchField value={value} onChange={onChange} aria-label="Search log entries">
      <Label>Search logs</Label>
      <Input placeholder="Filter by message, tag, or error..." />
      <Text slot="description">
        Searches across message, tag, and error fields. Results update as you type.
      </Text>
    </SearchField>
  );
}
