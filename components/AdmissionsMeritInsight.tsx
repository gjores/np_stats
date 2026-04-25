"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdmissionsInsight, AdmissionsScatterPoint } from "@/lib/admissionsInsight";

interface Props {
  insight: AdmissionsInsight;
}

function fmt(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "–";
  return n.toFixed(digits);
}

function pct(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "–" : `${n.toFixed(1)} %`;
}

function pp(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "–";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)} pp`;
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: { payload: AdmissionsScatterPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-slate-900">{point.school}</div>
      <div className="text-slate-500">{point.municipality} · {point.source}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
        <span className="text-slate-500">Merit</span><span className="text-right text-slate-900">{fmt(point.merit)}</span>
        <span className="text-slate-500">Högre</span><span className="text-right text-slate-900">{pct(point.andelHogre)}</span>
        <span className="text-slate-500">Netto</span><span className="text-right text-slate-900">{pp(point.netDeviation)}</span>
        <span className="text-slate-500">NP-elever</span><span className="text-right text-slate-900">{point.npStudents.toLocaleString("sv-SE")}</span>
      </div>
    </div>
  );
}

export function AdmissionsMeritInsight({ insight }: Props) {
  const lowerLift =
    insight.lowMeritAvgHogre !== null && insight.highMeritAvgHogre !== null
      ? insight.lowMeritAvgHogre - insight.highMeritAvgHogre
      : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Antagningsmerit och betygsavvikelse</h2>
        <p className="mt-1 max-w-4xl text-sm text-slate-600">
          Varje punkt är en gymnasieskola där 2025 års antagningsstatistik har kunnat matchas mot nationella prov.
          Sambandet går åt det håll du beskrev: lägre ingångsmerit hänger ihop med högre andel betyg över provresultat.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Matchade skolor" value={insight.matchedSchools.toLocaleString("sv-SE")} sub={`${insight.parsedSchoolAggregates.toLocaleString("sv-SE")} skolaggregat i antagningsdata`} />
        <Kpi label="Merit vs högre betyg" value={fmt(insight.pearsonHogre, 3)} sub="Pearson r, negativt stödjer hypotesen" />
        <Kpi label="Merit vs netto" value={fmt(insight.pearsonNet, 3)} sub="Högre minus lägre betyg än NP" />
        <Kpi label="Lägsta kvartilen" value={pp(lowerLift)} sub="Mer andel högre än högsta meritkvartilen" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-800">Lägre merit tenderar att ligga högre på avvikelseaxeln</div>
              <div className="text-xs text-slate-500">X: antagningsmerit. Y: andel elever med högre kursbetyg än NP-resultat.</div>
            </div>
            <div className="text-xs tabular-nums text-slate-500">n={insight.matchedSchools}</div>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 18, bottom: 12, left: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="merit"
                  name="Antagningsmerit"
                  domain={["dataMin - 10", "dataMax + 10"]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => fmt(Number(value), 0)}
                />
                <YAxis
                  type="number"
                  dataKey="andelHogre"
                  name="Andel högre"
                  domain={[0, "dataMax + 8"]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${fmt(Number(value), 0)} %`}
                />
                <Tooltip content={<ScatterTooltip />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
                <Scatter data={insight.points} fill="#0f766e" fillOpacity={0.72} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-sm font-medium text-slate-800">Avvikelse per meritintervall</div>
            <div className="text-xs text-slate-500">Medelvärde för matchade skolor i varje meritband.</div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <BarChart data={insight.bands} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${fmt(Number(value), 0)} %`} />
                <Tooltip
                  formatter={(value, name) => [
                    typeof value === "number" ? pct(value) : value,
                    name === "avgAndelHogre" ? "Andel högre" : "Netto",
                  ]}
                  labelFormatter={(label) => `Merit ${label}`}
                />
                <Bar dataKey="avgAndelHogre" name="Andel högre" fill="#b45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 divide-y divide-slate-100 text-xs">
            {insight.bands.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2">
                <span className="font-medium text-slate-700">Merit {row.label}</span>
                <span className="tabular-nums text-slate-500">{row.count} skolor</span>
                <span className="tabular-nums text-slate-900">{pct(row.avgAndelHogre)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Tolkning: punkterna visar association, inte kausalitet. Matchningen domineras fortfarande av de regioner där parsern är klar,
        och vissa källor bidrar med median i stället för medelmerit.
      </p>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="truncate text-xs text-slate-500" title={label}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
