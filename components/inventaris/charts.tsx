"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Types for API response
interface CategoryDistributionItem {
    name: string;
    value: number;
    color: string;
}

interface ConditionBreakdownItem {
    name: string;
    value: number;
    color: string;
}

// Lazy load Recharts components
const PieChart = dynamic(
    () => import("recharts").then((mod) => mod.PieChart),
    { ssr: false }
);
const Pie = dynamic(
    () => import("recharts").then((mod) => mod.Pie),
    { ssr: false }
);
const Cell = dynamic(
    () => import("recharts").then((mod) => mod.Cell),
    { ssr: false }
);
const ResponsiveContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer),
    { ssr: false }
);
const Tooltip = dynamic(
    () => import("recharts").then((mod) => mod.Tooltip),
    { ssr: false }
);
const Legend = dynamic(
    () => import("recharts").then((mod) => mod.Legend),
    { ssr: false }
);

// ==========================================
// Category Distribution Chart (Pie)
// ==========================================

export function CategoryChart() {
    const [data, setData] = useState<CategoryDistributionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/inventaris/data?type=category-distribution");
                if (res.ok) {
                    const dist = await res.json();
                    setData(dist);
                }
            } catch {
                // Fail silently
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Kategori Aset</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const hasData = data.length > 0;

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Distribusi Kategori</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Belum ada data aset</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={data as any}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }: any) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                                labelLine={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                }}
                                formatter={(value: any) => [`${value} jenis`, 'Jumlah']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ==========================================
// Condition Breakdown Chart (Donut)
// ==========================================

export function ConditionChart() {
    const [data, setData] = useState<ConditionBreakdownItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/inventaris/data?type=condition-breakdown");
                if (res.ok) {
                    const breakdown = await res.json();
                    setData(breakdown);
                }
            } catch {
                // Fail silently
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Kondisi Aset</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const hasData = data.length > 0;
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Kondisi Barang</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Belum ada data kondisi</p>
                    </div>
                ) : (
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={data as any}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255,255,255,0.95)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                    }}
                                    formatter={(value: any) => [`${value} unit`, 'Jumlah']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-2xl font-bold">{total}</p>
                                <p className="text-xs text-muted-foreground">Total Unit</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
