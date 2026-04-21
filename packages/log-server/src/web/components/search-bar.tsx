import { useEffect, useRef } from "react";
import { SearchField, Input, Label, Text } from "react-aria-components";
import { VisuallyHidden } from "react-aria";
import { enqueueAnnounce } from "../lib/announce.js";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

const ANNOUNCE_DEBOUNCE_MS = 500;

/** Full-text search field for filtering log entries. Announces result counts to screen readers. */
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
        enqueueAnnounce(`${resultCount} of ${totalCount} log entries match your search`);
      } else {
        enqueueAnnounce(`Showing all ${totalCount} log entries`);
      }
    }, ANNOUNCE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, resultCount, totalCount]);

  return (
    <>
      {/* Hidden heading so H-key nav can reach the search region.       */}
      {/* The visible <Label>Search logs</Label> below is the field's    */}
      {/* accessible name; this is the landmark heading for the group.  */}
      <VisuallyHidden elementType="h3">Search</VisuallyHidden>
      <SearchField value={value} onChange={onChange}>
        <Label>Search logs</Label>
        <Input placeholder="Filter by message, tag, or error..." />
        <Text slot="description">
          Searches across message, tag, and error fields. Results update as you type.
        </Text>
      </SearchField>
    </>
  );
}
