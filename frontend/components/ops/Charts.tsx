"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { lakhs, rupees } from "@/lib/format";

const tooltipStyle = { borderRadius: 14, border: "1px solid #e3e7ef", boxShadow: "0 8px 24px -12px rgba(28,27,43,.25)", fontSize: 12 };

export function RevenueChart({ data, height = 220 }: { data: { date: string; revenue: number; payouts: number; refunds: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Revenue and payouts over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b5cf0" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7b5cf0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f08a6c" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#f08a6c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => lakhs(v)} width={56} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => rupees(Number(v))} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="revenue" name="Payments in" stroke="#7b5cf0" strokeWidth={2.5} fill="url(#rev)" />
          <Area type="monotone" dataKey="payouts" name="Vendor payouts" stroke="#f08a6c" strokeWidth={2} fill="url(#pay)" />
          <Area type="monotone" dataKey="refunds" name="Refunds" stroke="#2f6fbf" strokeWidth={1.5} fillOpacity={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, dataKey, nameKey, color = "#7b5cf0", height = 220, money }: { data: Record<string, string | number>[]; dataKey: string; nameKey: string; color?: string; height?: number; money?: boolean }) {
  return (
    <div style={{ height }} role="img" aria-label={`${dataKey} by ${nameKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} width={money ? 56 : 32} tickFormatter={(v: number) => (money ? lakhs(v) : String(v))} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => (money ? rupees(Number(v)) : String(v))} cursor={{ fill: "#f5f1e8" }} />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VendorHistoryChart({ data }: { data: { month: string; bookings: number; declines: number; replyMin: number }[] }) {
  return (
    <div style={{ height: 220 }} role="img" aria-label="Vendor bookings and declines by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#625f78" }} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f1e8" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="bookings" name="Bookings" fill="#7b5cf0" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="declines" name="Declines" fill="#f08a6c" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
