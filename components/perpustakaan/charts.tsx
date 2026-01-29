"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Types for API response
interface LoanTrendData {
    date: string;
    pinjam: number;
    kembali: number;
}

interface CategoryDistribution {
    name: string;
    value: number;
    color: string;
}

// Lazy load Recharts components
// Using 'any' type for dynamic imports to avoid complex type conflicts with Recharts
/* eslint-disable @typescript-eslint/no-explicit-any */
const BarChart = dynamic(
    () => import("recharts").then((mod) => mod.BarChart as any),
    { ssr: false }
) as any;
const Bar = dynamic(
    () => import("recharts").then((mod) => mod.Bar as any),
    { ssr: false }
) as any;
const XAxis = dynamic(
    () => import("recharts").then((mod) => mod.XAxis as any),
    { ssr: false }
) as any;
const YAxis = dynamic(
    () => import("recharts").then((mod) => mod.YAxis as any),
    { ssr: false }
) as any;
const CartesianGrid = dynamic(
    () => import("recharts").then((mod) => mod.CartesianGrid as any),
    { ssr: false }
) as any;
const Tooltip = dynamic(
    () => import("recharts").then((mod) => mod.Tooltip as any),
    { ssr: false }
) as any;
const Legend = dynamic(
    () => import("recharts").then((mod) => mod.Legend as any),
    { ssr: false }
) as any;
const ResponsiveContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer as any),
    { ssr: false }
) as any;
const PieChart = dynamic(
    () => import("recharts").then((mod) => mod.PieChart as any),
    { ssr: false }
) as any;
const Pie = dynamic(
    () => import("recharts").then((mod) => mod.Pie as any),
    { ssr: false }
) as any;
const Cell = dynamic(
    () => import("recharts").then((mod) => mod.Cell as any),
    { ssr: false }
) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ==========================================
// Loan Trend Chart (Bar Chart)
// ==========================================

export function LoanTrendChart() {
    const [data, setData] = useState<LoanTrendData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/perpustakaan/data?type=loan-trend");
                if (res.ok) {
                    const trend = await res.json();
                    setData(trend);
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
                    <CardTitle className="text-lg">Aktivitas Peminjaman</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const hasData = data.some(d => d.pinjam > 0 || d.kembali > 0);

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Aktivitas 7 Hari Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Belum ada data peminjaman</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis 
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                }}
                            />
                            <Legend />
                            <Bar 
                                dataKey="pinjam" 
                                name="Dipinjam" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar 
                                dataKey="kembali" 
                                name="Dikembalikan" 
                                fill="#22c55e" 
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ==========================================
// Category Distribution Chart (Pie Chart)
// ==========================================

export function CategoryChart() {
    const [data, setData] = useState<CategoryDistribution[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/perpustakaan/data?type=category-distribution");
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
                    <CardTitle className="text-lg">Kategori Buku</CardTitle>
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
                        <p>Belum ada koleksi buku</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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
                                formatter={(value: number) => [`${value} buku`, 'Jumlah']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
