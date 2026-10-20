"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = {
  primary: "#0A3D4A",
  accent: "#4FB8B4",
  grid: "#D6E5E1",
  tooltipBorder: "#B8D9D3",
};

interface RegistrationTrendProps {
  data: { date: string; count: number }[];
}

export function RegistrationTrendChart({ data }: RegistrationTrendProps) {
  return (
    <div className="h-[215px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="registration-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND.accent} stopOpacity={0.32} />
              <stop offset="95%" stopColor={BRAND.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#3D5C63" }}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#3D5C63" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={34}
          />
          <Tooltip
            cursor={{ stroke: BRAND.grid }}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${BRAND.tooltipBorder}`,
              boxShadow: "0 8px 24px rgba(4,34,43,0.08)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#3D5C63", marginBottom: 2 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={BRAND.primary}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#registration-trend-fill)"
            name="Pendaftar"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatusDistributionProps {
  data: { name: string; value: number; color: string }[];
}

export function StatusDistributionChart({ data }: StatusDistributionProps) {
  const hasData = data.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-[215px] items-center justify-center rounded-lg border border-dashed border-line/80 text-center text-xs text-muted-foreground">
        Belum ada data status pendaftaran
      </div>
    );
  }

  return (
    <div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: `1px solid ${BRAND.tooltipBorder}`,
                boxShadow: "0 8px 24px rgba(4,34,43,0.08)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((item) => (
          <span key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.name}
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
