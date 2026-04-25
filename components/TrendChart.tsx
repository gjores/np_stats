"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import type { TimePoint } from "@/lib/aggregate";

interface Props {
  points: TimePoint[];
  nationalByTerm?: Record<string, number | null>;
}

export function TrendChart({ points, nationalByTerm }: Props) {
  const data = points.map((p) => ({
    term: p.term.key,
    lagre: p.agg.andelLagre,
    lika: p.agg.andelLika,
    hogre: p.agg.andelHogre,
    nationalHogre: nationalByTerm?.[p.term.key] ?? null,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-700 mb-2">Utveckling över terminer</div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="term" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip
              formatter={(v) => {
                const n = typeof v === "number" ? v : null;
                return n === null ? "–" : `${n.toFixed(1)} %`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="hogre" name="Andel högre" stroke="#b45309" strokeWidth={2} dot />
            <Line type="monotone" dataKey="lika" name="Andel lika" stroke="#0369a1" strokeWidth={1.5} dot />
            <Line type="monotone" dataKey="lagre" name="Andel lägre" stroke="#475569" strokeWidth={1.5} dot />
            {nationalByTerm && (
              <Line
                type="monotone"
                dataKey="nationalHogre"
                name="Nat. snitt högre"
                stroke="#b45309"
                strokeDasharray="4 3"
                strokeWidth={1}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
