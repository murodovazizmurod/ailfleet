"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthCost = {
  month: string; // "Mar 2026"
  fuel: number;
  service: number;
  other: number;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function axisMoney(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v}`;
}

export function CostsChart({ data }: { data: MonthCost[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#1c2634" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#7e8ca0" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 12, fill: "#7e8ca0" }}
            tickFormatter={axisMoney}
          />
          <Tooltip
            cursor={{ fill: "#18202c" }}
            formatter={(value) => currency.format(Number(value))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #232d3d", background: "#111827", color: "#e5ecf5",
              fontSize: 12,
              boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="fuel" name="Fuel" stackId="cost" fill="#a3e635" stroke="#0b0f14" strokeWidth={1} />
          <Bar dataKey="service" name="Service" stackId="cost" fill="#60a5fa" stroke="#0b0f14" strokeWidth={1} />
          <Bar
            dataKey="other"
            name="Other"
            stackId="cost"
            fill="#fbbf24"
            stroke="#0b0f14"
            strokeWidth={1}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
