/**
 * @module log-table
 *
 * Accessible log table with inline expandable detail rows.
 *
 * When a user presses Enter on a row, a detail row expands INSIDE
 * the table (immediately below the parent row) showing structured
 * data and error info. Focus stays on the parent row — the user
 * presses Down Arrow to read the detail row.
 *
 * This follows the "disclosure table" pattern: aria-expanded on
 * parent rows, detail rows with colspan inside the same table.
 * React Aria Table provides grid keyboard navigation and sorting.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Table,
  TableHeader,
  Column,
  TableBody,
  Row,
  Cell,
  CheckboxGroup,
  Checkbox,
  type SortDescriptor,
  type Key,
} from "react-aria-components";
import { VisuallyHidden } from "react-aria";
import { announce } from "@react-aria/live-announcer";
import type { LogEntry } from "../../types.js";

interface LogTableProps {
  entries: LogEntry[];
  totalCount: number;
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  autoScroll: boolean;
  isLiveSession: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
  4: "FATAL",
};

const LEVEL_CLASSES: Record<number, string> = {
  0: "level-debug",
  1: "level-info",
  2: "level-warn",
  3: "level-error",
  4: "level-fatal",
};

const ALL_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "level", label: "Level" },
  { id: "tag", label: "Tag" },
  { id: "message", label: "Message" },
];

function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${hours}:${minutes}.${seconds}.${ms} ${ampm}`;
}

/**
 * Represents either a data row or an expanded detail row in the flat list.
 * React Aria's TableBody needs a flat array — we interleave both types.
 */
type TableItem =
  | { type: "data"; id: string; entry: LogEntry }
  | { type: "detail"; id: string; entry: LogEntry };

export function LogTable({
  entries,
  totalCount,
  visibleColumns,
  onVisibleColumnsChange,
  isLiveSession,
  autoScroll,
}: LogTableProps) {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const tableEndRef = useRef<HTMLDivElement>(null);
  const gridFocusedRef = useRef(false);

  // Auto-scroll when new entries arrive (only if enabled and grid not focused)
  useEffect(() => {
    if (autoScroll && !gridFocusedRef.current) {
      tableEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [entries.length, autoScroll]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const col = sortDescriptor.column as string;
      let first: string | number;
      let second: string | number;

      if (col === "date" || col === "time") {
        first = a.timestamp;
        second = b.timestamp;
      } else if (col === "level") {
        first = a.level;
        second = b.level;
      } else if (col === "tag") {
        first = a.tag;
        second = b.tag;
      } else {
        first = a.message;
        second = b.message;
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [entries, sortDescriptor]);

  /**
   * Build a flat items list: for each entry, emit a data item,
   * and if expanded, a detail item immediately after.
   * React Aria's TableBody renders this as a flat list of rows.
   */
  const tableItems: TableItem[] = useMemo(() => {
    const items: TableItem[] = [];
    for (const entry of sortedEntries) {
      items.push({ type: "data", id: entry.id, entry });
      if (expandedKeys.has(entry.id)) {
        items.push({ type: "detail", id: `${entry.id}-detail`, entry });
      }
    }
    return items;
  }, [sortedEntries, expandedKeys]);

  const handleSortChange = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    const colLabel =
      ALL_COLUMNS.find((c) => c.id === descriptor.column)?.label ?? descriptor.column;
    announce(`Sorted by ${colLabel}, ${descriptor.direction}`, "polite");
  };

  const handleRowAction = (key: Key) => {
    const keyStr = String(key);
    // Ignore actions on detail rows
    if (keyStr.endsWith("-detail")) return;

    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyStr)) {
        next.delete(keyStr);
        const entry = sortedEntries.find((e) => e.id === keyStr);
        const label = entry ? entry.message.slice(0, 40) : keyStr;
        announce(`Row collapsed: ${label}`, "polite");
      } else {
        next.add(keyStr);
        const entry = sortedEntries.find((e) => e.id === keyStr);
        const label = entry ? entry.message.slice(0, 40) : keyStr;
        announce(`Row expanded: ${label}. Press Down Arrow to read details.`, "polite");
      }
      return next;
    });
  };

  const handleColumnVisibilityChange = (selected: string[]) => {
    onVisibleColumnsChange(selected);
    announce(`Showing ${selected.length} of ${ALL_COLUMNS.length} columns`, "polite");
  };

  const activeColumns = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.id));

  const getCellContent = (entry: LogEntry, columnId: string): React.ReactNode => {
    switch (columnId) {
      case "date":
        return formatDate(entry.timestamp);
      case "time":
        return formatTime(entry.timestamp);
      case "level":
        return (
          <span className={LEVEL_CLASSES[entry.level]}>
            {LEVEL_LABELS[entry.level] ?? `LEVEL${entry.level}`}
          </span>
        );
      case "tag":
        return entry.tag;
      case "message":
        return entry.message;
      default:
        return null;
    }
  };

  /** Render the detail content for an expanded row. */
  const renderDetailContent = (entry: LogEntry): React.ReactNode => {
    return (
      <div className="detail-content">
        {entry.data && (
          <div>
            <strong>Data:</strong>
            {"\n"}
            {JSON.stringify(entry.data, null, 2)}
          </div>
        )}
        {entry.error && (
          <div>
            <strong>Error:</strong> {entry.error.name}: {entry.error.message}
            {entry.error.stack && (
              <>
                {"\n"}
                <strong>Stack:</strong>
                {"\n"}
                {entry.error.stack}
              </>
            )}
          </div>
        )}
        {!entry.data && !entry.error && <div>No additional details for this entry.</div>}
      </div>
    );
  };

  return (
    <div>
      <CheckboxGroup
        value={visibleColumns}
        onChange={handleColumnVisibilityChange}
        aria-label="Visible columns"
      >
        <span slot="label">Visible columns</span>
        {ALL_COLUMNS.map((col) => (
          <Checkbox key={col.id} value={col.id}>
            {col.label}
          </Checkbox>
        ))}
      </CheckboxGroup>

      <VisuallyHidden id="grid-instructions">
        {isLiveSession ? "Live session. " : "Historical session. "}
        Showing {entries.length} of {totalCount} entries. Use arrow keys to navigate rows. Press
        Enter to expand a row and show details inline. Press Enter again to collapse.
      </VisuallyHidden>

      <div
        id="log-grid"
        onFocus={() => {
          gridFocusedRef.current = true;
        }}
        onBlur={() => {
          gridFocusedRef.current = false;
        }}
      >
        <Table
          aria-label="Log entries"
          aria-describedby="grid-instructions"
          aria-rowcount={entries.length}
          sortDescriptor={sortDescriptor}
          onSortChange={handleSortChange}
          onRowAction={handleRowAction}
        >
          <TableHeader>
            {activeColumns.map((col) => (
              <Column key={col.id} id={col.id} isRowHeader={col.id === "message"} allowsSorting>
                {col.label}
              </Column>
            ))}
          </TableHeader>
          <TableBody items={tableItems}>
            {(item) => {
              if (item.type === "detail") {
                // Detail row: single cell spanning all columns
                return (
                  <Row key={item.id} id={item.id} className="detail-row">
                    <Cell>{renderDetailContent(item.entry)}</Cell>
                  </Row>
                );
              }

              // Data row: normal cells with aria-expanded
              const isExpanded = expandedKeys.has(item.id);
              return (
                <Row key={item.id} id={item.id} aria-expanded={isExpanded}>
                  {activeColumns.map((col) => (
                    <Cell key={col.id}>{getCellContent(item.entry, col.id)}</Cell>
                  ))}
                </Row>
              );
            }}
          </TableBody>
        </Table>
      </div>

      <div ref={tableEndRef} />
    </div>
  );
}
