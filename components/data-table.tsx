"use client";

import { ReactNode } from "react";
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
import { Card, CardContent } from "@/components/ui/card";

// ==========================================
// Types
// ==========================================

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    render?: (row: T) => ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
    data: T[];
    columns: Column<T>[];
    loading?: boolean;
    emptyMessage?: string;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    actions?: (row: T) => ReactNode;
}

// ==========================================
// DataTable Component
// ==========================================

export function DataTable<T extends { id: string }>({
    data,
    columns,
    loading = false,
    emptyMessage = "Tidak ada data",
    onEdit,
    onDelete,
    actions,
}: DataTableProps<T>) {
    const hasActions = onEdit || onDelete || actions;

    const renderCellContent = (row: T, column: Column<T>) => {
        if (column.render) {
            return column.render(row);
        }
        // Access nested properties using key (e.g., "expand.room.name")
        const keys = column.key.split(".");
        let value: unknown = row;
        for (const k of keys) {
            value = (value as Record<string, unknown>)?.[k];
        }
        return value as ReactNode ?? "-";
    };

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col) => (
                                <TableHead key={col.key} style={{ width: col.width }}>
                                    {col.header}
                                </TableHead>
                            ))}
                            {hasActions && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (hasActions ? 1 : 0)}
                                    className="text-center py-8"
                                >
                                    Memuat...
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + (hasActions ? 1 : 0)}
                                    className="text-center py-8 text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((row) => (
                                <TableRow key={row.id}>
                                    {columns.map((col) => (
                                        <TableCell key={col.key}>
                                            {renderCellContent(row, col)}
                                        </TableCell>
                                    ))}
                                    {hasActions && (
                                        <TableCell>
                                            {actions ? (
                                                actions(row)
                                            ) : (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
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
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// ==========================================
// Pagination Component
// ==========================================

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-center gap-2 mt-4">
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
            >
                Previous
            </Button>
            <span className="py-2 px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
            >
                Next
            </Button>
        </div>
    );
}
