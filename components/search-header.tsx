"use client";

import { ReactNode } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

// ==========================================
// Types
// ==========================================

export interface FilterOption {
    value: string;
    label: string;
}

export interface SearchHeaderProps {
    searchPlaceholder?: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    filters?: {
        value: string;
        onChange: (value: string) => void;
        options: FilterOption[];
        placeholder?: string;
    }[];
    children?: ReactNode;
}

// ==========================================
// SearchHeader Component
// ==========================================

export function SearchHeader({
    searchPlaceholder = "Cari...",
    searchValue,
    onSearchChange,
    filters = [],
    children,
}: SearchHeaderProps) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Filters */}
                    {filters.map((filter, idx) => (
                        <Select
                            key={idx}
                            value={filter.value}
                            onValueChange={filter.onChange}
                        >
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder={filter.placeholder || "Filter"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filter.options.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ))}

                    {/* Additional children (e.g., action buttons) */}
                    {children}
                </div>
            </CardContent>
        </Card>
    );
}
