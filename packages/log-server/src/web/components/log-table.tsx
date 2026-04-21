/**
 * @module log-table
 *
 * Accessible log table with plain HTML semantics.
 *
 * Uses a standard `<table>` (NOT role="grid") so NVDA's native table
 * navigation (Ctrl+Alt+Arrow) works. Each row has:
 * - ID column (first) — entry position number for reference
 * - Details button (last) — expands inline disclosure showing data/error/stack
 *
 * Sorting via `<button>` inside `<th>` with `aria-sort`.
 * Detail rows use `hidden` attribute when collapsed, `aria-expanded`
 * + `aria-controls` on the toggle button.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { CheckboxGroup, Checkbox } from "react-aria-components";
import { VisuallyHidden } from "react-aria";
import { enqueueAnnounce } from "../lib/announce.js";
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
  { id: "id", label: "#" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "level", label: "Level" },
  { id: "tag", label: "Tag" },
  { id: "message", label: "Message" },
  { id: "details", label: "Details" },
];

/** Sort direction for column headers. */
type SortDirection = "ascending" | "descending" | "none";

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
  return `${hours}:${minutes}:${seconds}.${ms} ${ampm}`;
}

/** Accessible log entry table with sortable columns, expandable detail rows, and configurable column visibility. */
export function LogTable({
  entries,
  totalCount,
  visibleColumns,
  onVisibleColumnsChange,
  isLiveSession,
  autoScroll,
}: LogTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("descending");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tableEndRef = useRef<HTMLDivElement>(null);
  const gridFocusedRef = useRef(false);

  // Auto-scroll when new entries arrive (only if enabled and table not focused)
  useEffect(() => {
    if (autoScroll && !gridFocusedRef.current) {
      tableEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [entries.length, autoScroll]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let first: string | number;
      let second: string | number;

      if (sortColumn === "date" || sortColumn === "time") {
        first = a.timestamp;
        second = b.timestamp;
      } else if (sortColumn === "level") {
        first = a.level;
        second = b.level;
      } else if (sortColumn === "tag") {
        first = a.tag;
        second = b.tag;
      } else {
        first = a.message;
        second = b.message;
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDirection === "descending" ? -cmp : cmp;
    });
  }, [entries, sortColumn, sortDirection]);

  /** Toggle sort on a column header. */
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      const newDir = sortDirection === "ascending" ? "descending" : "ascending";
      setSortDirection(newDir);
      const label = ALL_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId;
      enqueueAnnounce(`Sorted by ${label}, ${newDir}`);
    } else {
      setSortColumn(columnId);
      setSortDirection("ascending");
      const label = ALL_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId;
      enqueueAnnounce(`Sorted by ${label}, ascending`);
    }
  };

  /** Toggle detail row visibility for an entry. */
  const toggleDetails = (entryId: string, entryIndex: number, entry: LogEntry) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const levelLabel = LEVEL_LABELS[entry.level] ?? "LOG";
      const msgPreview = entry.message.slice(0, 50);

      if (next.has(entryId)) {
        next.delete(entryId);
        enqueueAnnounce(`Details hidden for entry ${entryIndex + 1}`);
      } else {
        next.add(entryId);
        enqueueAnnounce(`Details shown for entry ${entryIndex + 1}, ${levelLabel}: ${msgPreview}`);
      }
      return next;
    });
  };

  const handleColumnVisibilityChange = (selected: string[]) => {
    onVisibleColumnsChange(selected);
    enqueueAnnounce(`Showing ${selected.length} of ${ALL_COLUMNS.length} columns`);
  };

  const activeColumns = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.id));

  /** Total column count for detail row colspan. */
  const totalColCount = activeColumns.length;

  /** Which special columns are visible. */
  const showIdColumn = visibleColumns.includes("id");
  const showDetailsColumn = visibleColumns.includes("details");

  /** Data columns only (exclude id and details for sort headers). */
  const sortableColumns = activeColumns.filter((c) => c.id !== "id" && c.id !== "details");

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

  return (
    <div>
      {/* Column visibility controls */}
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

      <VisuallyHidden id="table-instructions">
        {isLiveSession ? "Live session. " : "Historical session. "}
        Showing {entries.length} of {totalCount} entries. Use Ctrl+Alt+Arrow keys to navigate the
        table. Each row has a Details button to expand additional information.
      </VisuallyHidden>

      {/* Plain HTML table — NVDA native table navigation works */}
      <div
        id="log-grid"
        onFocus={() => {
          gridFocusedRef.current = true;
        }}
        onBlur={() => {
          gridFocusedRef.current = false;
        }}
      >
        <table
          className="log-grid"
          aria-describedby="table-instructions"
          aria-rowcount={entries.length}
        >
          <caption className="sr-only">Log entries</caption>
          <thead>
            <tr>
              {/* ID column — entry position number */}
              {showIdColumn && <th scope="col">#</th>}

              {/* Data columns — sortable */}
              {sortableColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sortColumn === col.id ? sortDirection : "none"}
                >
                  <button type="button" onClick={() => handleSort(col.id)}>
                    {col.label}
                    {sortColumn === col.id && (
                      <span aria-hidden="true">{sortDirection === "ascending" ? " ▲" : " ▼"}</span>
                    )}
                  </button>
                </th>
              ))}

              {/* Details column */}
              {showDetailsColumn && <th scope="col">Details</th>}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, index) => {
              const isExpanded = expandedIds.has(entry.id);
              const levelLabel = LEVEL_LABELS[entry.level] ?? "LOG";
              const msgPreview = entry.message.slice(0, 50);
              const detailsId = `details-${entry.id}`;

              return (
                <React.Fragment key={entry.id}>
                  {/* Data row */}
                  <tr aria-rowindex={index + 1}>
                    {showIdColumn && <td>{index + 1}</td>}
                    {sortableColumns.map((col) => (
                      <td key={col.id}>{getCellContent(entry, col.id)}</td>
                    ))}
                    {showDetailsColumn && (
                      <td>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={detailsId}
                          aria-label={`${isExpanded ? "Hide" : "Show"} details for entry ${index + 1}, ${levelLabel}: ${msgPreview}`}
                          onClick={() => toggleDetails(entry.id, index, entry)}
                        >
                          {isExpanded ? "Hide details" : "Show details"}
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Detail row — hidden when collapsed */}
                  <tr id={detailsId} hidden={!isExpanded} className="detail-row">
                    <td colSpan={totalColCount}>
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
                        {!entry.data && !entry.error && (
                          <div>No additional details for this entry.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={tableEndRef} />
    </div>
  );
}
