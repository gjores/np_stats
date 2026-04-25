import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Row } from "../lib/types";

const ADMISSIONS_FILE = resolve(__dirname, "../data/generated/admissions-gymnasium.json");
const DATASET_FILE = resolve(__dirname, "../data/generated/dataset.json");
const SOURCES_FILE = resolve(__dirname, "../data/admissions-sources.json");
const REPORT_FILE = resolve(__dirname, "../docs/gymnasium-admissions-analysis-report.md");

interface AdmissionRow {
  year: number;
  sourceRegion: string;
  school: string;
  municipality: string | null;
  admittedCount: number | null;
  admissionMeritMean: number | null;
  admissionMeritMedian: number | null;
}

interface AdmissionPayload {
  rows: AdmissionRow[];
}

interface DatasetPayload {
  rows: Row[];
}

type SourceManifest = { id: string; name: string }[];

interface SchoolAdmissionAggregate {
  sourceRegions: Set<string>;
  school: string;
  municipality: string | null;
  admittedCount: number;
  programRows: number;
  weightedMean: number | null;
  unweightedMean: number | null;
  weightedMedian: number | null;
}

interface SchoolNpAggregate {
  school: string;
  municipality: string;
  antal: number;
  andelHogre: number | null;
  andelLagre: number | null;
  netDeviation: number | null;
}

interface JoinedSchool {
  admission: SchoolAdmissionAggregate;
  np: SchoolNpAggregate;
  merit: number | null;
  matchMethod: "exact" | "unique-school-name";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function key(school: string, municipality: string | null | undefined): string {
  return `${normalize(school)}|${normalize(municipality)}`;
}

function weightedAverage(values: { value: number | null; weight: number | null }[], opts: { fallbackWeight?: boolean } = {}): number | null {
  let sum = 0;
  let weight = 0;
  for (const item of values) {
    if (item.value === null) continue;
    if ((!item.weight || item.weight <= 0) && !opts.fallbackWeight) continue;
    const w = item.weight && item.weight > 0 ? item.weight : 1;
    sum += item.value * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

function aggregateAdmissions(rows: AdmissionRow[]): Map<string, SchoolAdmissionAggregate> {
  const bySchool = new Map<string, AdmissionRow[]>();
  for (const row of rows) {
    if (!row.school) continue;
    const k = key(row.school, row.municipality);
    bySchool.set(k, [...(bySchool.get(k) ?? []), row]);
  }

  const out = new Map<string, SchoolAdmissionAggregate>();
  for (const [k, group] of bySchool) {
    const admittedCount = group.reduce((sum, row) => sum + (row.admittedCount ?? 0), 0);
    out.set(k, {
      sourceRegions: new Set(group.map((row) => row.sourceRegion)),
      school: group[0].school,
      municipality: group[0].municipality,
      admittedCount,
      programRows: group.length,
      weightedMean: weightedAverage(group.map((row) => ({ value: row.admissionMeritMean, weight: row.admittedCount }))),
      unweightedMean: weightedAverage(group.map((row) => ({ value: row.admissionMeritMean, weight: 1 })), { fallbackWeight: true }),
      weightedMedian: weightedAverage(group.map((row) => ({ value: row.admissionMeritMedian, weight: row.admittedCount }))),
    });
  }
  return out;
}

function aggregateNp(rows: Row[]): Map<string, SchoolNpAggregate> {
  const bySchool = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.termYear !== 2025) continue;
    const k = key(row.skola, row.kommun);
    bySchool.set(k, [...(bySchool.get(k) ?? []), row]);
  }

  const out = new Map<string, SchoolNpAggregate>();
  for (const [k, group] of bySchool) {
    let antal = 0;
    let sumHogre = 0;
    let wHogre = 0;
    let sumLagre = 0;
    let wLagre = 0;
    for (const row of group) {
      antal += row.antal;
      if (row.andelHogre !== null) {
        sumHogre += row.andelHogre * row.antal;
        wHogre += row.antal;
      }
      if (row.andelLagre !== null) {
        sumLagre += row.andelLagre * row.antal;
        wLagre += row.antal;
      }
    }
    const andelHogre = wHogre > 0 ? sumHogre / wHogre : null;
    const andelLagre = wLagre > 0 ? sumLagre / wLagre : null;
    out.set(k, {
      school: group[0].skola,
      municipality: group[0].kommun,
      antal,
      andelHogre,
      andelLagre,
      netDeviation: andelHogre !== null && andelLagre !== null ? andelHogre - andelLagre : null,
    });
  }
  return out;
}

function buildUniqueNpSchoolNameIndex(npBySchool: Map<string, SchoolNpAggregate>): Map<string, SchoolNpAggregate> {
  const byName = new Map<string, SchoolNpAggregate[]>();
  for (const np of npBySchool.values()) {
    const name = normalize(np.school);
    byName.set(name, [...(byName.get(name) ?? []), np]);
  }

  const unique = new Map<string, SchoolNpAggregate>();
  for (const [name, rows] of byName) {
    if (rows.length === 1) unique.set(name, rows[0]);
  }
  return unique;
}

function pearson(points: { x: number | null; y: number | null }[]): number | null {
  const clean = points.filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
  if (clean.length < 3) return null;
  const meanX = clean.reduce((sum, p) => sum + p.x, 0) / clean.length;
  const meanY = clean.reduce((sum, p) => sum + p.y, 0) / clean.length;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const p of clean) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  return varX > 0 && varY > 0 ? cov / Math.sqrt(varX * varY) : null;
}

function fmt(n: number | null, digits = 3): string {
  return n === null || !Number.isFinite(n) ? "-" : n.toFixed(digits);
}

function main() {
  const admissions = JSON.parse(readFileSync(ADMISSIONS_FILE, "utf8")) as AdmissionPayload;
  const dataset = JSON.parse(readFileSync(DATASET_FILE, "utf8")) as DatasetPayload;
  const sourceManifest = JSON.parse(readFileSync(SOURCES_FILE, "utf8")) as SourceManifest;

  const admissionBySchool = aggregateAdmissions(admissions.rows);
  const npBySchool = aggregateNp(dataset.rows);
  const uniqueNpBySchoolName = buildUniqueNpSchoolNameIndex(npBySchool);
  const joined: JoinedSchool[] = [];
  for (const [k, admission] of admissionBySchool) {
    const exactNp = npBySchool.get(k);
    const fallbackNp = exactNp ? null : uniqueNpBySchoolName.get(normalize(admission.school));
    const np = exactNp ?? fallbackNp;
    if (!np) continue;
    const merit = admission.weightedMean ?? admission.unweightedMean ?? admission.weightedMedian;
    joined.push({ admission, np, merit, matchMethod: exactNp ? "exact" : "unique-school-name" });
  }

  const pointsHogre = joined.map((j) => ({ x: j.merit, y: j.np.andelHogre }));
  const pointsNet = joined.map((j) => ({ x: j.merit, y: j.np.netDeviation }));
  const bySource = new Map<string, typeof joined>();
  for (const item of joined) {
    for (const source of item.admission.sourceRegions) {
      bySource.set(source, [...(bySource.get(source) ?? []), item]);
    }
  }
  const parsedRowsBySource = new Map<string, number>();
  for (const row of admissions.rows) {
    parsedRowsBySource.set(row.sourceRegion, (parsedRowsBySource.get(row.sourceRegion) ?? 0) + 1);
  }

  const lines = [
    "# Gymnasium Admissions Analysis Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "This report joins parsed 2025 final-admission merit data to the existing 2025 gymnasium national-test/grade deviation dataset by exact normalized school name and municipality.",
    "When the admission source lacks municipality, the report also allows a conservative fallback match if the normalized school name is unique in the 2025 NP dataset.",
    "",
    "## Overall",
    "",
    `- Parsed admission school aggregates: ${admissionBySchool.size}`,
    `- NP school aggregates for 2025 terms: ${npBySchool.size}`,
    `- Exact school+municipality matches: ${joined.filter((j) => j.matchMethod === "exact").length}`,
    `- Unique school-name fallback matches: ${joined.filter((j) => j.matchMethod === "unique-school-name").length}`,
    `- Total matched schools: ${joined.length}`,
    `- Pearson r, admission merit vs andel högre: ${fmt(pearson(pointsHogre))}`,
    `- Pearson r, admission merit vs nettoavvikelse (högre-lägre): ${fmt(pearson(pointsNet))}`,
    "",
    "## Source Match Coverage",
    "",
    "| Source | Parsed rows | School aggregates | Matched schools | Status |",
    "|---|---:|---:|---:|---|",
  ];
  for (const source of sourceManifest) {
    const schoolAggregates = Array.from(admissionBySchool.values()).filter((row) => row.sourceRegions.has(source.id)).length;
    const matchedSchools = bySource.get(source.id)?.length ?? 0;
    const parsedRows = parsedRowsBySource.get(source.id) ?? 0;
    const status = matchedSchools > 0 ? "matched" : parsedRows > 0 ? "parsed, unmatched" : "parser/source gap";
    lines.push(`| ${source.id} | ${parsedRows} | ${schoolAggregates} | ${matchedSchools} | ${status} |`);
  }

  lines.push(
    "",
    "## By Source",
    "",
    "| Source | Matched schools | r merit vs högre | r merit vs netto | Merit metric used |",
    "|---|---:|---:|---:|---|",
  );
  for (const [source, rows] of Array.from(bySource.entries()).sort()) {
    const metricKinds = new Set(rows.map((r) => r.admission.weightedMean !== null ? "weighted mean" : r.admission.unweightedMean !== null ? "unweighted mean" : "weighted median"));
    lines.push(`| ${source} | ${rows.length} | ${fmt(pearson(rows.map((r) => ({ x: r.merit, y: r.np.andelHogre }))))} | ${fmt(pearson(rows.map((r) => ({ x: r.merit, y: r.np.netDeviation }))))} | ${Array.from(metricKinds).join(", ")} |`);
  }

  lines.push("");
  lines.push("## Highest Matched Net Deviations");
  lines.push("");
  lines.push("| School | Municipality | Admission merit | Andel högre | Andel lägre | Netto | Source |");
  lines.push("|---|---|---:|---:|---:|---:|---|");
  for (const item of [...joined].filter((j) => j.np.netDeviation !== null).sort((a, b) => (b.np.netDeviation ?? 0) - (a.np.netDeviation ?? 0)).slice(0, 20)) {
    lines.push(`| ${item.np.school} | ${item.np.municipality} | ${fmt(item.merit, 1)} | ${fmt(item.np.andelHogre, 1)} | ${fmt(item.np.andelLagre, 1)} | ${fmt(item.np.netDeviation, 1)} | ${Array.from(item.admission.sourceRegions).join(", ")} |`);
  }

  lines.push("");
  lines.push("## Caveats");
  lines.push("");
  lines.push("- Matching is exact normalized school+municipality first, then unique normalized school-name fallback only when no exact match exists. It does not yet use skolenhetskod matching or fuzzy matching.");
  lines.push("- Storsthlm currently contributes median admission merit, because the downloaded 2025 file exposes median rather than mean.");
  lines.push("- Göteborgsregionen contributes unweighted mean across programs because the mean-merit PDF does not include admitted count.");
  lines.push("- Several regional sources are discovered/downloaded but still need source-specific parsers before they should influence conclusions.");

  writeFileSync(REPORT_FILE, `${lines.join("\n")}\n`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main();
