import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HuvudmanType, Row } from "./types";

interface AdmissionRow {
  sourceRegion: string;
  school: string;
  municipality: string | null;
  admittedCount: number | null;
  admissionMeritMean: number | null;
  admissionMeritMedian: number | null;
}

interface AdmissionsPayload {
  rows: AdmissionRow[];
}

interface DatasetPayload {
  rows: Row[];
}

interface AcadeMediaPayload {
  orgnrs: string[];
}

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
  orgnr: string;
  huvudman: string;
  huvudmanType: HuvudmanType;
  antal: number;
  andelHogre: number | null;
  andelLagre: number | null;
  netDeviation: number | null;
}

export interface AdmissionsScatterPoint {
  school: string;
  municipality: string;
  source: string;
  merit: number;
  andelHogre: number;
  andelLagre: number;
  netDeviation: number;
  npStudents: number;
  admittedCount: number;
  programRows: number;
  matchMethod: "exact" | "unique-school-name";
  meritMetric: "mean" | "median";
  orgnr: string;
  huvudman: string;
  huvudmanType: HuvudmanType;
  isAcadeMedia: boolean;
  schoolCategory: "academedia" | "other-independent" | "public";
}

export interface MeritBandSummary {
  label: string;
  min: number;
  max: number;
  count: number;
  avgMerit: number | null;
  avgAndelHogre: number | null;
  avgNetDeviation: number | null;
}

export interface AdmissionMeritBandSummary {
  label: string;
  min: number;
  max: number;
  count: number;
  avgMerit: number | null;
  admittedCount: number;
}

export interface AdmissionSourceSummary {
  source: string;
  parsedRows: number;
  schoolAggregates: number;
  admittedCount: number;
  avgMerit: number | null;
}

export interface AdmissionsInsight {
  points: AdmissionsScatterPoint[];
  bands: MeritBandSummary[];
  admissionBands: AdmissionMeritBandSummary[];
  sourceSummaries: AdmissionSourceSummary[];
  parsedRows: number;
  matchedSchools: number;
  parsedSchoolAggregates: number;
  pearsonHogre: number | null;
  pearsonNet: number | null;
  lowMeritAvgHogre: number | null;
  highMeritAvgHogre: number | null;
  lowMeritAvgNet: number | null;
  highMeritAvgNet: number | null;
}

let cache: AdmissionsInsight | null = null;

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

function weightedAverage(values: { value: number | null; weight: number | null }[], fallbackWeight = false): number | null {
  let sum = 0;
  let weight = 0;
  for (const item of values) {
    if (item.value === null) continue;
    if ((!item.weight || item.weight <= 0) && !fallbackWeight) continue;
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
    out.set(k, {
      sourceRegions: new Set(group.map((row) => row.sourceRegion)),
      school: group[0].school,
      municipality: group[0].municipality,
      admittedCount: group.reduce((sum, row) => sum + (row.admittedCount ?? 0), 0),
      programRows: group.length,
      weightedMean: weightedAverage(group.map((row) => ({ value: row.admissionMeritMean, weight: row.admittedCount }))),
      unweightedMean: weightedAverage(group.map((row) => ({ value: row.admissionMeritMean, weight: 1 })), true),
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
      orgnr: group[0].orgnr,
      huvudman: group[0].huvudman,
      huvudmanType: group[0].typ,
      antal,
      andelHogre,
      andelLagre,
      netDeviation: andelHogre !== null && andelLagre !== null ? andelHogre - andelLagre : null,
    });
  }
  return out;
}

function uniqueNpByName(npBySchool: Map<string, SchoolNpAggregate>): Map<string, SchoolNpAggregate> {
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

function pearson(points: { x: number; y: number }[]): number | null {
  if (points.length < 3) return null;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  return varX > 0 && varY > 0 ? cov / Math.sqrt(varX * varY) : null;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function band(points: AdmissionsScatterPoint[], label: string, min: number, max: number): MeritBandSummary {
  const rows = points.filter((point) => point.merit >= min && point.merit < max);
  return {
    label,
    min,
    max,
    count: rows.length,
    avgMerit: average(rows.map((point) => point.merit)),
    avgAndelHogre: average(rows.map((point) => point.andelHogre)),
    avgNetDeviation: average(rows.map((point) => point.netDeviation)),
  };
}

function admissionMerit(admission: SchoolAdmissionAggregate): number | null {
  return admission.weightedMean ?? admission.unweightedMean ?? admission.weightedMedian;
}

function admissionBand(admissions: SchoolAdmissionAggregate[], label: string, min: number, max: number): AdmissionMeritBandSummary {
  const rows = admissions.filter((admission) => {
    const merit = admissionMerit(admission);
    return merit !== null && merit >= min && merit < max;
  });
  return {
    label,
    min,
    max,
    count: rows.length,
    avgMerit: average(rows.map((row) => admissionMerit(row)).filter((value): value is number => value !== null)),
    admittedCount: rows.reduce((sum, row) => sum + row.admittedCount, 0),
  };
}

export function loadAdmissionsInsight(): AdmissionsInsight {
  if (cache) return cache;
  const admissions = JSON.parse(readFileSync(join(process.cwd(), "data", "generated", "admissions-gymnasium.json"), "utf8")) as AdmissionsPayload;
  const dataset = JSON.parse(readFileSync(join(process.cwd(), "data", "generated", "dataset.json"), "utf8")) as DatasetPayload;
  const acadeMedia = JSON.parse(readFileSync(join(process.cwd(), "data", "academedia.json"), "utf8")) as AcadeMediaPayload;
  const acadeMediaOrgnrs = new Set(acadeMedia.orgnrs);

  const admissionBySchool = aggregateAdmissions(admissions.rows);
  const admissionAggregates = Array.from(admissionBySchool.values());
  const npBySchool = aggregateNp(dataset.rows);
  const uniqueByName = uniqueNpByName(npBySchool);
  const points: AdmissionsScatterPoint[] = [];

  for (const [k, admission] of admissionBySchool) {
    const exactNp = npBySchool.get(k);
    const fallbackNp = exactNp ? null : uniqueByName.get(normalize(admission.school));
    const np = exactNp ?? fallbackNp;
    const merit = admission.weightedMean ?? admission.unweightedMean ?? admission.weightedMedian;
    if (!np || merit === null || np.andelHogre === null || np.andelLagre === null || np.netDeviation === null) continue;
    points.push({
      school: np.school,
      municipality: np.municipality,
      source: Array.from(admission.sourceRegions).join(", "),
      merit,
      andelHogre: np.andelHogre,
      andelLagre: np.andelLagre,
      netDeviation: np.netDeviation,
      npStudents: np.antal,
      admittedCount: admission.admittedCount,
      programRows: admission.programRows,
      matchMethod: exactNp ? "exact" : "unique-school-name",
      meritMetric: admission.weightedMean !== null || admission.unweightedMean !== null ? "mean" : "median",
      orgnr: np.orgnr,
      huvudman: np.huvudman,
      huvudmanType: np.huvudmanType,
      isAcadeMedia: acadeMediaOrgnrs.has(np.orgnr),
      schoolCategory: acadeMediaOrgnrs.has(np.orgnr)
        ? "academedia"
        : np.huvudmanType === "Enskild"
          ? "other-independent"
          : "public",
    });
  }

  const sorted = [...points].sort((a, b) => a.merit - b.merit);
  const low = sorted.slice(0, Math.ceil(sorted.length / 4));
  const high = sorted.slice(Math.floor(sorted.length * 0.75));
  const parsedRowsBySource = new Map<string, number>();
  for (const row of admissions.rows) {
    parsedRowsBySource.set(row.sourceRegion, (parsedRowsBySource.get(row.sourceRegion) ?? 0) + 1);
  }
  const sourceSummaries = Array.from(parsedRowsBySource.entries())
    .map(([source, parsedRows]) => {
      const schoolRows = admissionAggregates.filter((row) => row.sourceRegions.has(source));
      return {
        source,
        parsedRows,
        schoolAggregates: schoolRows.length,
        admittedCount: schoolRows.reduce((sum, row) => sum + row.admittedCount, 0),
        avgMerit: average(schoolRows.map((row) => admissionMerit(row)).filter((value): value is number => value !== null)),
      };
    })
    .sort((a, b) => b.parsedRows - a.parsedRows || a.source.localeCompare(b.source, "sv"));

  cache = {
    points,
    bands: [
      band(points, "<160", 0, 160),
      band(points, "160-199", 160, 200),
      band(points, "200-239", 200, 240),
      band(points, "240+", 240, 500),
    ],
    admissionBands: [
      admissionBand(admissionAggregates, "<160", 0, 160),
      admissionBand(admissionAggregates, "160-199", 160, 200),
      admissionBand(admissionAggregates, "200-239", 200, 240),
      admissionBand(admissionAggregates, "240+", 240, 500),
    ],
    sourceSummaries,
    parsedRows: admissions.rows.length,
    matchedSchools: points.length,
    parsedSchoolAggregates: admissionBySchool.size,
    pearsonHogre: pearson(points.map((point) => ({ x: point.merit, y: point.andelHogre }))),
    pearsonNet: pearson(points.map((point) => ({ x: point.merit, y: point.netDeviation }))),
    lowMeritAvgHogre: average(low.map((point) => point.andelHogre)),
    highMeritAvgHogre: average(high.map((point) => point.andelHogre)),
    lowMeritAvgNet: average(low.map((point) => point.netDeviation)),
    highMeritAvgNet: average(high.map((point) => point.netDeviation)),
  };
  return cache;
}
