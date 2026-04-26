"use client";

import { useMemo, useState } from "react";
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
  const [selectedTermKey, setSelectedTermKey] = useState(insight.defaultTermKey);
  const comparison = useMemo(
    () =>
      insight.termComparisons.find((term) => term.termKey === selectedTermKey) ??
      insight.termComparisons[0],
    [insight.termComparisons, selectedTermKey]
  );
  const points = comparison?.points ?? insight.points;
  const bands = comparison?.bands ?? insight.bands;
  const matchedSchools = comparison?.matchedSchools ?? insight.matchedSchools;
  const termLabel = comparison?.termLabel ?? "VT25";
  const categoryCorrelations = comparison?.categoryCorrelations ?? insight.categoryCorrelations;
  const pearsonHogre = comparison?.pearsonHogre ?? insight.pearsonHogre;
  const pearsonNet = comparison?.pearsonNet ?? insight.pearsonNet;
  const lowerLift =
    comparison?.lowMeritAvgHogre !== null && comparison?.highMeritAvgHogre !== null
      ? (comparison?.lowMeritAvgHogre ?? 0) - (comparison?.highMeritAvgHogre ?? 0)
      : null;
  const topSources = insight.sourceSummaries.slice(0, 10);
  const acadeMediaPoints = points.filter((point) => point.schoolCategory === "academedia");
  const otherIndependentPoints = points.filter((point) => point.schoolCategory === "other-independent");
  const publicPoints = points.filter((point) => point.schoolCategory === "public");

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Matchning mot NP-avvikelse</h2>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Detta är en separat analysvy där meritunderlaget ovan matchas mot vald vårtermins NP/betygsavvikelse per skola.
              Färgerna visar skolgrupp för orientering; sambandet beräknas på skolpunkterna utan driftsformsjustering.
            </p>
          </div>
          <label className="flex min-w-[190px] flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">NP-vårtermin</span>
            <select
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              value={selectedTermKey}
              onChange={(event) => setSelectedTermKey(event.target.value)}
            >
              {insight.termComparisons.map((term) => (
                <option key={term.termKey} value={term.termKey}>
                  {term.termLabel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Analysbara skolor"
            value={matchedSchools.toLocaleString("sv-SE")}
            sub={`${termLabel}, av ${insight.parsedSchoolAggregates.toLocaleString("sv-SE")} antagningsskolor`}
          />
          <Kpi label="Merit vs högre betyg" value={fmt(pearsonHogre, 3)} sub={`Pearson r för ${termLabel}`} />
          <Kpi label="Merit vs netto" value={fmt(pearsonNet, 3)} sub="Högre minus lägre betyg än NP" />
          <Kpi label="Lägsta kvartilen" value={pp(lowerLift)} sub="Mer andel högre än högsta meritkvartilen" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-sky-50/60 p-4 text-sm text-slate-700">
          <div className="text-sm font-medium text-slate-900">Hypotesen som testas</div>
          <p className="mt-1 leading-relaxed">
            <strong>H1 (meritavvikelse-hypotesen):</strong> skolor med lägre antagningsmerit
            kompenserar systematiskt genom att sätta kursbetyg som ligger över elevens
            NP-resultat — dvs. &quot;glädjebetyg&quot; som rörlig variabel. Det skulle synas
            som ett tydligt negativt Pearson r mellan antagningsmerit och andel betyg över NP.
            <br />
            <strong>H0 (nollhypotes):</strong> antagningsmeriten säger ingenting om hur stor
            andel av skolans betyg som hamnar över provresultatet.
          </p>
          <p className="mt-2 leading-relaxed">
            <strong>Så här kan H1 motbevisas i den här vyn:</strong>
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>r ligger stabilt nära noll (|r| ≲ 0,1) i en grupp över flera vårterminer.</li>
            <li>r byter tecken mellan terminer eller mellan delgrupper utan tydlig förklaring.</li>
            <li>
              Sambandet försvinner när vi delar upp på driftsform (Simpson-effekt) — ett
              negativt poolat r kan i praktiken bero på gruppmedelvärden, inte på inom-gruppsmönster.
            </li>
          </ul>
          <p className="mt-2 leading-relaxed">
            <strong>H1 styrks (men bevisas inte) av:</strong> ett konsekvent negativt r i
            samma riktning över terminer och driftsformer, av tillräcklig storlek för att inte
            försvinna när små eller brusiga regioner exkluderas.
          </p>
          <p className="mt-2 leading-relaxed text-xs text-slate-600">
            Korrelationen ger en första indikation, men <em>kan inte ensamt avgöra</em> om låg merit
            <em>orsakar</em> glädjebetyg. Konkurrerande förklaringar finns: NP är ett endags-prov
            på ett begränsat kursavsnitt och kan systematiskt underskatta elever från
            yrkesprogram eller skolor med annan profil; lärartäthet, programmix och social
            bakgrund kan påverka både merit och betygsavvikelse oberoende av varandra.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-amber-50/60 p-4 text-sm text-slate-700">
          <div className="text-sm font-medium text-slate-900">Så läser du Pearson r</div>
          <p className="mt-1 leading-relaxed">
            Pearson r mäter hur starkt två variabler rör sig linjärt tillsammans.
            Värdet ligger mellan <strong>−1</strong> och <strong>+1</strong>: 0 betyder inget linjärt samband, +1 betyder att de följs åt
            perfekt, −1 att de går åt motsatt håll. En tumregel är att |r| ≈ 0,1 är svagt, ≈ 0,3 är måttligt och ≥ 0,5 är starkt
            — men på samhällsdata tenderar även måttliga värden vara meningsfulla.
          </p>
          <p className="mt-2 leading-relaxed">
            Här är det specifikt sambandet mellan <em>antagningsmerit</em> (x-axeln) och <em>andel betyg över NP</em> (y-axeln).
            Ett <strong>negativt r</strong> betyder alltså att skolor med lägre antagningsmerit tenderar att ge en större andel
            betyg över NP-resultatet — vilket är hypotesen sidan undersöker. Ett r nära noll betyder att meriten inte säger något
            om avvikelsen inom gruppen.
          </p>
          <p className="mt-2 leading-relaxed text-xs text-slate-500">
            Viktigt: r mäter linjär association, inte orsakssamband. Ett extremvärde kan dra siffran kraftigt, och ett pooled r över
            alla driftsformer kan dölja motsatta mönster i delgrupperna — därför redovisar vi även r per driftsform under scattern.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-800">Lägre merit tenderar att ligga högre på avvikelseaxeln</div>
              <div className="text-xs text-slate-500">X: antagningsmerit. Y: andel elever med högre kursbetyg än NP-resultat, {termLabel}.</div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-700" />Kommunala/region</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Övriga fristående</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-600" />AcadeMedia</span>
              </div>
            </div>
            <div className="text-right text-xs tabular-nums text-slate-500">
              n={matchedSchools}<br />
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
                  {categoryCorrelations.map((row) => (
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
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{matchedSchools}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">–</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">–</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(pearsonHogre, 3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(pearsonNet, 3)}</td>
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
                <BarChart data={bands} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
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
              {bands.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2">
                  <span className="font-medium text-slate-700">Merit {row.label}</span>
                  <span className="tabular-nums text-slate-500">{row.count} skolor</span>
                  <span className="tabular-nums text-slate-900">{pct(row.avgAndelHogre)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 text-sm text-slate-700">
          <div className="text-sm font-medium text-slate-900">Var försiktig när du tolkar siffrorna</div>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 leading-relaxed">
            <li>
              <strong>Inte hela landet.</strong> Endast regioner där en parser är klar bidrar — Storsthlm, Skåne och Göteborgsregionen
              dominerar urvalet, medan flera län bara har en handfull skolor. Resultatet är en bekvämlighetsurval, inte en
              folkräkning, så Pearson r reflekterar de regioner som råkat vara billigast att skrapa.
            </li>
            <li>
              <strong>Mått som inte är helt jämförbara.</strong> Storsthlm publicerar antagningsgrans + median men inget medel,
              Göteborgsregionen tvärtom medel men inget antal antagna, Örebro median i stället för medel. Vi tar första
              tillgängliga av <em>weighted mean → unweighted mean → weighted median</em>; rader är därför inte exakt jämförbara mellan källor.
            </li>
            <li>
              <strong>Skolnamns-matchningen kan tappa skolor.</strong> Cirka hälften av antagningsskolorna med meritdata har en
              motsvarighet i NP-datasetet. De som faller bort är inte slumpmässiga — Västernorrland och Sjuhärad är blindfläckar
              just nu, vilket kan snedvrida r för specifika driftsformer.
            </li>
            <li>
              <strong>NP är ett dagstillfälle.</strong> Andelen &quot;betyg över NP&quot; är inte synonym med glädjebetyg. Det kan
              också vara att provet inte täcker hela kursinnehållet, eller att vissa elevgrupper presterar systematiskt sämre på
              skarpa prov av icke-betygsmässiga skäl.
            </li>
            <li>
              <strong>Ett enskilt r är osäkert.</strong> Termer rör sig — VT23/24/25 kan ge motstridiga signaler i samma grupp,
              och små grupper (n &lt; 30) ger orimligt instabila r. Använd termväljaren för att se om mönstret är robust innan du
              påstår något.
            </li>
            <li>
              <strong>Korrelation ≠ kausalitet.</strong> Antagningsmerit, programmix, lärartäthet och social bakgrund är alla
              förknippade. Att skolor med låg antagningsmerit har högre andel betyg över NP är förenligt med flera olika historier —
              den här vyn kan inte ensam välja mellan dem.
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Punkterna visar association, inte kausalitet. Jämförelsen använder NP-data från {termLabel}; byt termin för att se hur stabilt mönstret är.
          </p>
        </div>
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
