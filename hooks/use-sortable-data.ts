"use client";

import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Get a nested property value from an object using dot notation.
 * e.g., getNestedValue(obj, "kelas.nama") → obj.kelas.nama
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Compare two values for sorting.
 * Handles strings (case-insensitive), numbers, dates, booleans, and nulls.
 */
function compareValues(a: any, b: any, direction: "asc" | "desc"): number {
  // Handle null/undefined - push them to the end
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  let comparison = 0;

  if (typeof a === "boolean" && typeof b === "boolean") {
    comparison = a === b ? 0 : a ? -1 : 1;
  } else if (typeof a === "number" && typeof b === "number") {
    comparison = a - b;
  } else if (a instanceof Date && b instanceof Date) {
    comparison = a.getTime() - b.getTime();
  } else {
    // Try to parse as date
    const dateA = Date.parse(String(a));
    const dateB = Date.parse(String(b));
    if (!isNaN(dateA) && !isNaN(dateB) && String(a).length > 6) {
      comparison = dateA - dateB;
    } else {
      // Try to parse as number
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB) && String(a).trim() !== "" && String(b).trim() !== "") {
        comparison = numA - numB;
      } else {
        // Fall back to string comparison
        comparison = String(a).localeCompare(String(b), "id", {
          sensitivity: "base",
          numeric: true,
        });
      }
    }
  }

  return direction === "desc" ? -comparison : comparison;
}

/**
 * A generic hook for client-side sorting of tabular data.
 *
 * @param data - The array of items to sort
 * @returns An object with sortedData, sortConfig, and requestSort function
 *
 * @example
 * ```tsx
 * const { sortedData, sortConfig, requestSort } = useSortableData(students);
 *
 * // In table header:
 * <SortableTableHead label="Nama" sortKey="fullName" sortConfig={sortConfig} onSort={requestSort} />
 *
 * // In table body:
 * {sortedData.map(student => ...)}
 * ```
 */
export function useSortableData<T>(data: T[]) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "",
    direction: null,
  });

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        // New column: start with ascending
        return { key, direction: "asc" };
      }

      // Same column: cycle through asc → desc → null
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const valueA = getNestedValue(a, sortConfig.key);
      const valueB = getNestedValue(b, sortConfig.key);
      return compareValues(valueA, valueB, sortConfig.direction!);
    });
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
