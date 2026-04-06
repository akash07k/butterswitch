import { useState, useEffect, useRef } from "react";
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

export function LogTable({
  entries,
  totalCount,
  visibleColumns,
  onVisibleColumnsChange,
  autoScroll,
}: LogTableProps) {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const tableEndRef = useRef<HTMLDivElement>(null);
  const gridFocusedRef = useRef(false);

  // Auto-scroll when new entries arrive (only if enabled and grid not focused)
  useEffect(() => {
    if (autoScroll && !gridFocusedRef.current) {
      tableEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [entries.length, autoScroll]);

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
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

  const handleSortChange = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    const colLabel =
      ALL_COLUMNS.find((c) => c.id === descriptor.column)?.label ?? descriptor.column;
    announce(`Sorted by ${colLabel}, ${descriptor.direction}`, "polite");
  };

  const handleRowAction = (key: Key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        announce("Row collapsed", "polite");
      } else {
        next.add(key);
        announce("Row expanded", "polite");
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
        Showing {entries.length} of {totalCount} entries. Use arrow keys to navigate rows. Press
        Enter to expand a row. Press Escape to collapse.
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
          <TableBody items={sortedEntries}>
            {(entry) => (
              <Row key={entry.id} id={entry.id}>
                {(columnKey) => <Cell>{getCellContent(entry, String(columnKey))}</Cell>}
              </Row>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Expanded row details rendered outside the table */}
      {sortedEntries
        .filter((entry) => expandedKeys.has(entry.id))
        .map((entry) => (
          <div
            key={`detail-${entry.id}`}
            role="region"
            aria-label={`Details for ${LEVEL_LABELS[entry.level]} entry: ${entry.message}`}
            className="detail-row"
          >
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
          </div>
        ))}

      <div ref={tableEndRef} />
    </div>
  );
}
