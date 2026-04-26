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
  const groupLabel =
    point.schoolCategory === "academedia"
      ? "AcadeMedia"
      : point.schoolCategory === "other-independent"
        ? "Annan fristående"
        : point.huvudmanType;
  return (
    <div className="max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-slate-900">{point.school}</div>
      <div className="text-slate-500">{point.municipality} · {point.source}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
        <span className="text-slate-500">Grupp</span><span className="text-right text-slate-900">{groupLabel}</span>
        <span className="text-slate-500">Huvudman</span><span className="text-right text-slate-900">{point.huvudman}</span>
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
  const topSources = insight.sourceSummaries.slice(0, 10);
  const acadeMediaPoints = insight.points.filter((point) => point.schoolCategory === "academedia");
  const otherIndependentPoints = insight.points.filter((point) => point.schoolCategory === "other-independent");
  const publicPoints = insight.points.filter((point) => point.schoolCategory === "public");

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Antagningsdata 2025</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">
            Detta är det separata meritunderlaget från slutantagningen. Här visas inte nationella prov eller driftsform,
            utan bara hur det insamlade antagningsmaterialet ser ut.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Parserade rader" value={insight.parsedRows.toLocaleString("sv-SE")} sub="Programrader från källfilerna" />
          <Kpi label="Skolaggregat" value={insight.parsedSchoolAggregates.toLocaleString("sv-SE")} sub="Skolor efter sammanvägning" />
          <Kpi label="Källor med data" value={insight.sourceSummaries.length.toLocaleString("sv-SE")} sub="Identifierade och parsade källor" />
          <Kpi
            label="Elever i antagningen"
            value={insight.sourceSummaries.reduce((sum, row) => sum + row.admittedCount, 0).toLocaleString("sv-SE")}
            sub="Summerat där antagna redovisas"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-medium text-slate-800">Meritfördelning i antagningsunderlaget</div>
              <div className="text-xs text-slate-500">Antal skolaggregat per meritintervall, utan NP-matchning.</div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer>
                <BarChart data={insight.admissionBands} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      typeof value === "number" ? value.toLocaleString("sv-SE") : value,
                      name === "count" ? "Skolor" : "Antagna",
                    ]}
                    labelFormatter={(label) => `Merit ${label}`}
                  />
                  <Bar dataKey="count" name="Skolor" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {insight.admissionBands.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2">
                  <span className="font-medium text-slate-700">Merit {row.label}</span>
                  <span className="tabular-nums text-slate-500">{row.count} skolor</span>
                  <span className="tabular-nums text-slate-900">{fmt(row.avgMerit)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-medium text-slate-800">Största parsade antagningskällor</div>
              <div className="text-xs text-slate-500">Rader och skolaggregat i meritunderlaget, före NP-matchning.</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Källa</th>
                    <th className="px-3 py-2 text-right font-medium">Rader</th>
                    <th className="px-3 py-2 text-right font-medium">Skolor</th>
                    <th className="px-3 py-2 text-right font-medium">Snittmerit</th>
                  </tr>
                </thead>
                <tbody>
                  {topSources.map((row) => (
                    <tr key={row.source} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.source}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.parsedRows.toLocaleString("sv-SE")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.schoolAggregates.toLocaleString("sv-SE")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmt(row.avgMerit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Matchning mot NP-avvikelse</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">
            Detta är en separat analysvy där meritunderlaget ovan matchas mot 2025 års NP/betygsavvikelse per skola.
            Färgerna visar skolgrupp för orientering; sambandet beräknas på skolpunkterna utan driftsformsjustering.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Analysbara skolor"
            value={insight.matchedSchools.toLocaleString("sv-SE")}
            sub={`Av ${insight.parsedSchoolAggregates.toLocaleString("sv-SE")} skolaggregat med antagningsdata`}
          />
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
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-700" />Kommunala/region</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Övriga fristående</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-600" />AcadeMedia</span>
              </div>
            </div>
            <div className="text-right text-xs tabular-nums text-slate-500">
              n={insight.matchedSchools}<br />
              {publicPoints.length} offentlig · {otherIndependentPoints.length} övr. fri · {acadeMediaPoints.length} AcadeMedia
            </div>
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
                <Scatter name="Kommunala/region" data={publicPoints} fill="#0369a1" fillOpacity={0.7} />
                <Scatter name="Övriga fristående" data={otherIndependentPoints} fill="#059669" fillOpacity={0.76} />
                <Scatter name="AcadeMedia" data={acadeMediaPoints} fill="#9333ea" fillOpacity={0.92} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-slate-800">Pearson r per driftsform</div>
            <div className="text-xs text-slate-500 mb-2">
              Hur starkt är sambandet inom varje grupp? Negativa värden = lägre antagningsmerit hänger ihop med högre andel betyg över NP.
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Driftsform</th>
                    <th className="px-3 py-2 text-right font-medium">n</th>
                    <th className="px-3 py-2 text-right font-medium">Snittmerit</th>
                    <th className="px-3 py-2 text-right font-medium">Snitt andel högre</th>
                    <th className="px-3 py-2 text-right font-medium">r (merit · högre)</th>
                    <th className="px-3 py-2 text-right font-medium">r (merit · netto)</th>
                  </tr>
                </thead>
                <tbody>
                  {insight.categoryCorrelations.map((row) => (
                    <tr key={row.category} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                row.category === "academedia"
                                  ? "#9333ea"
                                  : row.category === "other-independent"
                                    ? "#059669"
                                    : "#0369a1",
                            }}
                          />
                          {row.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmt(row.avgMerit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{pct(row.avgAndelHogre)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmt(row.pearsonHogre, 3)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmt(row.pearsonNet, 3)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-800">Alla</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{insight.matchedSchools}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">–</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">–</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(insight.pearsonHogre, 3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(insight.pearsonNet, 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-medium text-slate-800">NP-avvikelse per meritintervall</div>
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
    </div>
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
