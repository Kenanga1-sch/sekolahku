"use client";

import { Fragment as ReactFragment, ReactNode } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { EmptyState } from "@/components/empty-state";
import type { SortConfig } from "@/hooks/use-sortable-data";

// ==========================================
// Types
// ==========================================

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    render?: (row: T) => ReactNode;
    /** Enable sorting header (requires sortConfig & onSort on the table) */
    sortable?: boolean;
    /** Hide this column on small (>= sm) table widths: hidden sm:table-cell */
    hideBelowSm?: boolean;
    /** How the column is used in the mobile (< md) card layout */
    card?: "title" | "field" | "hidden";
    cardSpan?: "full" | "half";
}

export interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    getRowId: (row: T, index: number) => string;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    onRowClick?: (row: T) => void;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    actions?: (row: T) => ReactNode;
    /** Optional expanded-row detail rendered under the row (both mobile card & desktop table) */
    expandedContent?: (row: T) => ReactNode;
    /** Controlled expansion for expandedContent: ids of expanded rows */
    expandedRowIds?: string[];
    onToggleExpand?: (id: string) => void;
    /** Row selection (checkbox column) */
    selectable?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: () => void;
    /** Client-side sorting (useSortableData) */
    sortConfig?: SortConfig;
    onSort?: (key: string) => void;
}

// ==========================================
// DataTable Component
// ==========================================

export function DataTable<T>({
    data,
    columns,
    getRowId,
    loading = false,
    emptyTitle = "Tidak Ada Data",
    emptyDescription = "Belum ada data yang tersedia saat ini.",
    emptyAction,
    onRowClick,
    onEdit,
    onDelete,
    actions,
    expandedContent,
    expandedRowIds = [],
    onToggleExpand,
    selectable = false,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
    sortConfig,
    onSort,
}: DataTableProps<T>) {
    const hasActions = Boolean(onEdit || onDelete || actions);
    const titleColumn = columns.find((col) => col.card === "title") ?? columns[0];
    const fieldColumns = columns.filter(
        (col) => col !== titleColumn && col.card !== "hidden" && col.card !== "title"
    );
    const colCount = columns.length + (hasActions ? 1 : 0) + (selectable ? 1 : 0);
    const allSelected = selectable && data.length > 0 && selectedIds.length === data.length;

    const renderCellContent = (row: T, column: Column<T>) => {
        if (column.render) {
            return column.render(row);
        }
        const keys = column.key.split(".");
        let value: unknown = row;
        for (const k of keys) {
            value = (value as Record<string, unknown>)?.[k];
        }
        return (value as ReactNode) ?? "-";
    };

    const defaultActions = (row: T) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                )}
                {onDelete && (
                    <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete(row)}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const rowAction = (row: T) => (actions ? actions(row) : hasActions ? defaultActions(row) : null);

    const handleClick = (row: T, index: number) => {
        onRowClick?.(row);
        // Keep the id accessible for selection handlers
        void getRowId(row, index);
    };

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {loading ? (
                    <div className="divide-y md:divide-y-0">
                        {/* Mobile card skeletons */}
                        <div className="md:hidden space-y-3 p-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop table skeletons */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {selectable && (
                                            <TableHead className="w-[40px]">
                                                <Skeleton className="h-4 w-4" />
                                            </TableHead>
                                        )}
                                        {columns.map((col) => (
                                            <TableHead key={col.key} style={{ width: col.width }}>
                                                <Skeleton className="h-4 w-20" />
                                            </TableHead>
                                        ))}
                                        {hasActions && <TableHead className="w-[50px]" />}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: colCount }).map((_, j) => (
                                                <TableCell key={j}>
                                                    <Skeleton className="h-4 w-24" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        variant="data"
                        title={emptyTitle}
                        description={emptyDescription}
                        action={emptyAction}
                    />
                ) : (
                    <>
                        {/* Mobile card list */}
                        <div className="md:hidden divide-y">
                            {data.map((row, index) => {
                                const id = getRowId(row, index);
                                const isSelected = selectedIds.includes(id);
                                return (
                                    <div
                                        key={id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleClick(row, index)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                handleClick(row, index);
                                            }
                                        }}
                                        className={`flex flex-col gap-3 px-4 py-3 transition-colors ${
                                            onRowClick ? "cursor-pointer active:bg-muted/50" : ""
                                        } ${isSelected ? "bg-muted/50" : ""}`}
                                    >
                                        <div className="flex items-start justify-between gap-3 overflow-hidden">
                                            <div className="flex min-w-0 flex-1 items-start gap-3 overflow-hidden">
                                                {selectable && (
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => onToggleSelect?.(id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-0.5"
                                                        aria-label="Pilih baris"
                                                    />
                                                )}
                                                {titleColumn && (
                                                    <div className="min-w-0 flex-1 overflow-hidden text-sm">
                                                        {renderCellContent(row, titleColumn)}
                                                    </div>
                                                )}
                                            </div>
                                            <div
                                                className="shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {rowAction(row)}
                                            </div>
                                        </div>
                                        {fieldColumns.length > 0 && (
                                            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                {fieldColumns.map((col) => (
                                                    <div
                                                        key={col.key}
                                                        className={col.cardSpan === "full" ? "col-span-2 min-w-0" : "min-w-0"}
                                                    >
                                                        <p className="text-xs font-medium uppercase text-muted-foreground/80">
                                                            {col.header}
                                                        </p>
                                                        <div className="mt-0.5 text-sm">
                                                            {renderCellContent(row, col)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {expandedContent && expandedRowIds.includes(id) && (
                                            <div className="mt-1 rounded-lg bg-slate-50/60 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 p-3">
                                                {expandedContent(row)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {selectable && (
                                            <TableHead className="w-[40px]">
                                                <Checkbox
                                                    checked={allSelected}
                                                    onCheckedChange={() => onToggleSelectAll?.()}
                                                    aria-label="Pilih semua"
                                                />
                                            </TableHead>
                                        )}
                                        {columns.map((col) => {
                                            if (col.sortable && sortConfig && onSort) {
                                                return (
                                                    <SortableTableHead
                                                        key={col.key}
                                                        label={col.header}
                                                        sortKey={col.key}
                                                        sortConfig={sortConfig}
                                                        onSort={onSort}
                                                        className={col.hideBelowSm ? "hidden lg:table-cell" : undefined}
                                                    />
                                                );
                                            }
                                            return (
                                                <TableHead
                                                    key={col.key}
                                                    style={{ width: col.width }}
                                                    className={col.hideBelowSm ? "hidden lg:table-cell" : undefined}
                                                >
                                                    {col.header}
                                                </TableHead>
                                            );
                                        })}
                                        {hasActions && <TableHead className="w-[50px]"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row, index) => {
                                        const id = getRowId(row, index);
                                        const isExpanded = expandedRowIds.includes(id);
                                        return (
                                            <ReactFragment key={id}>
                                                <TableRow
                                                    className={onRowClick || (expandedContent && onToggleExpand) ? "cursor-pointer" : undefined}
                                                    data-state={selectable && selectedIds.includes(id) ? "selected" : undefined}
                                                    onClick={() => {
                                                        if (onRowClick) handleClick(row, index);
                                                        else if (expandedContent && onToggleExpand) onToggleExpand(id);
                                                    }}
                                                >
                                                    {selectable && (
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={selectedIds.includes(id)}
                                                                onCheckedChange={() => onToggleSelect?.(id)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    {columns.map((col) => (
                                                        <TableCell
                                                            key={col.key}
                                                            className={col.hideBelowSm ? "hidden lg:table-cell" : undefined}
                                                        >
                                                            {renderCellContent(row, col)}
                                                        </TableCell>
                                                    ))}
                                                    {hasActions && (
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            {rowAction(row)}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                                {expandedContent && isExpanded && (
                                                    <TableRow className="bg-slate-50/20 dark:bg-zinc-900/5 border-t border-dashed">
                                                        <TableCell colSpan={colCount} className="p-4">
                                                            {expandedContent(row)}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </ReactFragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

// ==========================================
// Pagination Component
// ==========================================

export interface TablePaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Optional total count label, e.g. "128 transaksi" */
    label?: string;
}

export function TablePagination({ page, totalPages, onPageChange, label }: TablePaginationProps) {
    if (totalPages <= 1 && !label) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-sm text-muted-foreground">
                {label ? `${label} — ` : ""}Halaman {page} dari {Math.max(totalPages, 1)}
            </div>
            {totalPages > 1 && (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Selanjutnya
                    </Button>
                </div>
            )}
        </div>
    );
}
