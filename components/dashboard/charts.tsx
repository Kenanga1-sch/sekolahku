"use client";

import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Colors for charts
const COLORS = {
    primary: "#3b82f6",
    secondary: "#64748b",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#06b6d4",
};

const STATUS_COLORS = {
    pending: "#f59e0b",
    verified: "#3b82f6",
    accepted: "#22c55e",
    rejected: "#ef4444",
};

interface RegistrationTrendProps {
    data: { date: string; count: number }[];
}

export function RegistrationTrendChart({ data }: RegistrationTrendProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Tren Pendaftaran</CardTitle>
                <CardDescription>Jumlah pendaftar per hari dalam 7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke={COLORS.primary}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorCount)"
                                name="Pendaftar"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

interface StatusDistributionProps {
    data: { name: string; value: number; color: string }[];
}

export function StatusDistributionChart({ data }: StatusDistributionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Distribusi Status</CardTitle>
                <CardDescription>Persentase status pendaftaran</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb"
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

interface ZoneDistributionProps {
    data: { name: string; inZone: number; outZone: number }[];
}

export function ZoneDistributionChart({ data }: ZoneDistributionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Statistik Zonasi</CardTitle>
                <CardDescription>Perbandingan pendaftar dalam dan luar zona per minggu</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: "#e5e7eb" }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb"
                                }}
                            />
                            <Legend />
                            <Bar
                                dataKey="inZone"
                                name="Dalam Zona"
                                fill={COLORS.success}
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="outZone"
                                name="Luar Zona"
                                fill={COLORS.secondary}
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// Export colors for use elsewhere
export { COLORS, STATUS_COLORS };
