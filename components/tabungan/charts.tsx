"use client";

// Force HMR update - Clean module verification


import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Types for API response
interface TransactionTrendItem {
    date: string;
    setor: number;
    tarik: number;
}

interface SaldoByKelasItem {
    name: string;
    value: number;
    color: string;
}

// Lazy load Recharts
const BarChart = dynamic(
    () => import("recharts").then((mod) => mod.BarChart),
    { ssr: false }
);
const Bar = dynamic(
    () => import("recharts").then((mod) => mod.Bar),
    { ssr: false }
);
const XAxis = dynamic(
    () => import("recharts").then((mod) => mod.XAxis),
    { ssr: false }
);
const YAxis = dynamic(
    () => import("recharts").then((mod) => mod.YAxis),
    { ssr: false }
);
const CartesianGrid = dynamic(
    () => import("recharts").then((mod) => mod.CartesianGrid),
    { ssr: false }
);
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

function formatRupiah(amount: number): string {
    if (amount >= 1000000) {
        return `Rp${(amount / 1000000).toFixed(1)}jt`;
    }
    if (amount >= 1000) {
        return `Rp${(amount / 1000).toFixed(0)}rb`;
    }
    return `Rp${amount}`;
}

// ==========================================
// Transaction Trend Chart (Bar)
// ==========================================

export function TransactionTrendChart() {
    const [data, setData] = useState<TransactionTrendItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/tabungan/data?type=trend");
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
                    <CardTitle className="text-lg">Trend Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const hasData = data.some(d => d.setor > 0 || d.tarik > 0);

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Trend Transaksi 7 Hari</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Belum ada transaksi minggu ini</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={formatRupiah} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                }}
                                formatter={(value: any) => [formatRupiah(value), '']}
                            />
                            <Legend />
                            <Bar dataKey="setor" name="Setoran" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="tarik" name="Penarikan" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ==========================================
// Class Balance Chart (Pie)
// ==========================================

export function ClassBalanceChart() {
    const [data, setData] = useState<SaldoByKelasItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/tabungan/data?type=saldo-by-kelas");
                if (res.ok) {
                    const saldo = await res.json();
                    setData(saldo);
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
                    <CardTitle className="text-lg">Saldo per Kelas</CardTitle>
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
                <CardTitle className="text-lg font-semibold">Distribusi Saldo per Kelas</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Belum ada data saldo</p>
                    </div>
                ) : (
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={data as any}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={90}
                                    paddingAngle={2}
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
                                    formatter={(value: any) => [formatRupiah(value), 'Saldo']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-lg font-bold">{formatRupiah(total)}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
