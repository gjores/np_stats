import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import * as XLSX from "xlsx";
import { writeJson, type DiscoveredAdmissionFile } from "./admissions-utils";

const DOWNLOADS_FILE = resolve(__dirname, "../data/generated/admissions-downloaded-files.json");
const OUT_FILE = resolve(__dirname, "../data/generated/admissions-gymnasium.json");
const REPORT_FILE = resolve(__dirname, "../docs/gymnasium-admissions-coverage-report.md");

interface DownloadedFile extends DiscoveredAdmissionFile {
  localPath: string;
  bytes: number;
  ok: boolean;
  error?: string;
}

interface DownloadPayload {
  files: DownloadedFile[];
}

interface AdmissionRow {
  year: number;
  sourceRegion: string;
  sourceFile: string;
  sourceUrl: string;
  admissionRound: "final" | "reserve" | "preliminary" | "unknown";
  school: string;
  skolenhetskod: string | null;
  municipality: string | null;
  programName: string;
  programCode: string | null;
  orientationName: string | null;
  places: number | null;
  admittedCount: number | null;
  firstChoiceAdmittedCount: number | null;
  reserveCount: number | null;
  admissionMeritMin: number | null;
  admissionMeritMean: number | null;
  admissionMeritMedian: number | null;
  parser: string;
  parserConfidence: "high" | "medium" | "low";
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "." || raw === "..") return null;
  if (/ingen antagen/i.test(raw)) return null;
  const cleaned = raw.replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseIntValue(value: unknown): number | null {
  const n = parseNumber(value);
  return n === null ? null : Math.trunc(n);
}

function parseProgramCode(studyPathCode: string | null): string | null {
  if (!studyPathCode) return null;
  const m = studyPathCode.match(/^([A-ZÅÄÖ]{2})/);
  return m?.[1] ?? null;
}

function parseStorsthlmWorkbook(file: DownloadedFile, absPath: string): AdmissionRow[] {
  const wb = XLSX.readFile(absPath);
  const rows: AdmissionRow[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null });
    for (const r of sheetRows) {
      const year = parseIntValue(r.Ar) ?? file.year ?? 2025;
      const studyPathCode = r.StudieVagKod ? String(r.StudieVagKod).trim() : null;
      rows.push({
        year,
        sourceRegion: file.sourceId,
        sourceFile: file.localPath,
        sourceUrl: file.url,
        admissionRound: file.round,
        school: String(r.Skola ?? "").trim(),
        skolenhetskod: null,
        municipality: String(r.Kommun ?? "").trim() || null,
        programName: String(r.Studievag ?? "").trim(),
        programCode: parseProgramCode(studyPathCode),
        orientationName: null,
        places: parseIntValue(r.AntalPlatser),
        admittedCount: parseIntValue(r.AntalAntagna),
        firstChoiceAdmittedCount: null,
        reserveCount: parseIntValue(r.AntalReserver),
        admissionMeritMin: parseNumber(r.Antagningsgrans),
        admissionMeritMean: null,
        admissionMeritMedian: parseNumber(r.Median),
        parser: "storsthlm-xlsx",
        parserConfidence: "high",
      });
    }
  }
  return rows.filter((r) => r.school && r.programName);
}

function pdfText(absPath: string): string {
  return execFileSync("pdftotext", ["-layout", absPath, "-"], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 20_000,
  });
}

function parseDexterPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  const trailingColumns = /(\d+)\s+(\d+)\s+(\d+)\s+([0-9]+(?:[.,]5)?)\s+([0-9]+(?:[.,]\d+)?)\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    const match = trimmed.match(trailingColumns);
    if (!match || match.index === undefined) continue;
    const prefix = trimmed.slice(0, match.index).trim();
    const parts = prefix.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const [studyPathCode, programName, ...schoolParts] = parts;
    const school = schoolParts.join(" ");
    const [, places, firstChoice, admitted, min, mean] = match;
    if (/^STAT|^Antal|^Studiev/.test(studyPathCode)) continue;
    if (!/[A-ZÅÄÖ]{2}/.test(studyPathCode)) continue;
    if (!/[A-Za-zÅÄÖåäö]/.test(programName) || !/[A-Za-zÅÄÖåäö]/.test(school)) continue;
    const minMerit = parseNumber(min);
    const meanMerit = parseNumber(mean);
    if ((minMerit === null || minMerit < 50) && (meanMerit === null || meanMerit < 50)) continue;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: school.trim(),
      skolenhetskod: null,
      municipality: null,
      programName: programName.trim(),
      programCode: parseProgramCode(studyPathCode),
      orientationName: null,
      places: parseIntValue(places),
      admittedCount: parseIntValue(admitted),
      firstChoiceAdmittedCount: parseIntValue(firstChoice),
      reserveCount: null,
      admissionMeritMin: minMerit,
      admissionMeritMean: meanMerit,
      admissionMeritMedian: null,
      parser: "dexter-pdf",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function parseGoteborgPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  const trailingNumbers = /([0-9]{2,3}(?:,[05])?)\s+([0-9]{2,3},[0-9]{2})\s*$/;
  for (const line of text.split(/\r?\n/)) {
    if (!trailingNumbers.test(line)) continue;
    const municipality = line.slice(0, 20).trim();
    if (!municipality || municipality !== municipality.toUpperCase()) continue;
    const school = line.slice(20, 75).trim();
    const programName = line.slice(75, 118).trim();
    const orientationName = line.slice(118, 154).trim() || null;
    const nums = line.match(trailingNumbers);
    if (!school || !programName || !nums) continue;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school,
      skolenhetskod: null,
      municipality,
      programName,
      programCode: parseProgramCode(programName),
      orientationName,
      places: null,
      admittedCount: null,
      firstChoiceAdmittedCount: null,
      reserveCount: null,
      admissionMeritMin: parseNumber(nums[1]),
      admissionMeritMean: parseNumber(nums[2]),
      admissionMeritMedian: null,
      parser: "goteborg-layout-pdf",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function parseSchoolHeaderPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  let currentSchool: string | null = null;
  let currentMunicipality: string | null = null;
  const fiveNumberRowRe = /^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9]+(?:[.,]\d+)?)\s+([0-9]+(?:[.,]\d+)?)\s*$/;
  const fourNumberRowRe = /^(.+?)\s+(\d+)\s+(\d+)\s+([0-9]+(?:[.,]\d+)?)\s+([0-9]+(?:[.,]\d+)?)\s*$/;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dexterHeader = trimmed.match(/Antagningsstatistik för gymnasieprogram,\s+(.+?)\s+\(/i);
    if (dexterHeader) {
      currentSchool = dexterHeader[1].trim();
      currentMunicipality = null;
      continue;
    }

    const hallandSchool = trimmed.match(/^([A-ZÅÄÖ][A-Za-zÅÄÖåäö -]+),\s+(.+)$/);
    if (hallandSchool && !/\d/.test(trimmed) && !/Program|Antagningsstatistik/.test(trimmed)) {
      currentMunicipality = hallandSchool[1].trim();
      currentSchool = hallandSchool[2].trim();
      continue;
    }

    const fiveNumberMatch = trimmed.match(fiveNumberRowRe);
    const fourNumberMatch = trimmed.match(fourNumberRowRe);
    if ((!fiveNumberMatch && !fourNumberMatch) || !currentSchool) continue;
    const row = fiveNumberMatch
      ? {
          programName: fiveNumberMatch[1],
          places: fiveNumberMatch[2],
          firstChoiceAdmitted: fiveNumberMatch[3],
          admitted: fiveNumberMatch[4],
          min: fiveNumberMatch[5],
          mean: fiveNumberMatch[6],
        }
      : {
          programName: fourNumberMatch![1],
          places: fourNumberMatch![2],
          firstChoiceAdmitted: null,
          admitted: fourNumberMatch![3],
          min: fourNumberMatch![4],
          mean: fourNumberMatch![5],
        };
    const { programName, places, firstChoiceAdmitted, admitted, min, mean } = row;
    if (!/[A-Za-zÅÄÖåäö]/.test(programName)) continue;
    const minMerit = parseNumber(min);
    const meanMerit = parseNumber(mean);
    if ((minMerit === null || minMerit < 50) && (meanMerit === null || meanMerit < 50)) continue;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: currentSchool,
      skolenhetskod: null,
      municipality: currentMunicipality,
      programName: programName.trim(),
      programCode: null,
      orientationName: null,
      places: parseIntValue(places),
      admittedCount: parseIntValue(admitted),
      firstChoiceAdmittedCount: firstChoiceAdmitted === null ? null : parseIntValue(firstChoiceAdmitted),
      reserveCount: null,
      admissionMeritMin: minMerit,
      admissionMeritMean: meanMerit,
      admissionMeritMedian: null,
      parser: "school-header-pdf",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function parsePdf(file: DownloadedFile, absPath: string): AdmissionRow[] {
  const text = pdfText(absPath);
  const dexter = parseDexterPdf(file, text);
  const goteborg = file.sourceId === "goteborgsregionen" ? parseGoteborgPdf(file, text) : [];
  const schoolHeader = parseSchoolHeaderPdf(file, text);
  return [goteborg, dexter, schoolHeader].sort((a, b) => b.length - a.length)[0];
}

function parseHtml(file: DownloadedFile, absPath: string): AdmissionRow[] {
  const text = readFileSync(absPath, "utf8");
  const rows: AdmissionRow[] = [];
  const tableRowRe = /<tr[\s\S]*?<\/tr>/gi;
  for (const tr of text.matchAll(tableRowRe)) {
    const cells = Array.from(tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) =>
      m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (cells.length < 5) continue;
    const joined = cells.join(" | ");
    if (!/merit|antag|program|skola/i.test(joined)) continue;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: cells[0] ?? "",
      skolenhetskod: null,
      municipality: null,
      programName: cells[1] ?? "",
      programCode: null,
      orientationName: null,
      places: null,
      admittedCount: null,
      firstChoiceAdmittedCount: null,
      reserveCount: null,
      admissionMeritMin: null,
      admissionMeritMean: null,
      admissionMeritMedian: null,
      parser: "html-placeholder",
      parserConfidence: "low",
    });
  }
  return rows.filter((r) => r.school && r.programName);
}

function parseFile(file: DownloadedFile): AdmissionRow[] {
  const absPath = resolve(__dirname, "..", file.localPath);
  if (!file.ok || !existsSync(absPath)) return [];
  if (/prel/i.test(file.localPath) || file.round === "preliminary") return [];
  const ext = extname(absPath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") return parseStorsthlmWorkbook(file, absPath);
  if (ext === ".pdf") {
    if (file.bytes > 5 * 1024 * 1024) {
      throw new Error(`Skipping large PDF (${Math.round(file.bytes / 1024 / 1024)} MB) until source-specific parser is available`);
    }
    return parsePdf(file, absPath);
  }
  if (ext === ".html") return parseHtml(file, absPath);
  return [];
}

function uniqueRows(rows: AdmissionRow[]): AdmissionRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      row.sourceRegion,
      row.sourceFile,
      row.school,
      row.programName,
      row.places,
      row.admittedCount,
      row.admissionMeritMin,
      row.admissionMeritMean,
      row.admissionMeritMedian,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function writeReport(rows: AdmissionRow[], files: DownloadedFile[]): void {
  const bySource = new Map<string, AdmissionRow[]>();
  for (const row of rows) bySource.set(row.sourceRegion, [...(bySource.get(row.sourceRegion) ?? []), row]);
  const downloadedBySource = new Map<string, number>();
  for (const file of files.filter((f) => f.ok)) {
    downloadedBySource.set(file.sourceId, (downloadedBySource.get(file.sourceId) ?? 0) + 1);
  }

  const sources = Array.from(new Set([...files.map((f) => f.sourceId), ...rows.map((r) => r.sourceRegion)])).sort();
  const lines = [
    "# Gymnasium Admissions Coverage Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Source | Downloaded files | Parsed rows | Rows with mean | Rows with admitted count | Parser confidence |",
    "|---|---:|---:|---:|---:|---|",
  ];
  for (const source of sources) {
    const sourceRows = bySource.get(source) ?? [];
    const confidence = Array.from(new Set(sourceRows.map((r) => r.parserConfidence))).join(", ") || "-";
    lines.push(
      `| ${source} | ${downloadedBySource.get(source) ?? 0} | ${sourceRows.length} | ${sourceRows.filter((r) => r.admissionMeritMean !== null).length} | ${sourceRows.filter((r) => r.admittedCount !== null).length} | ${confidence} |`
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Storsthlm's 2025 Excel file contains admission cutoff and median, but no mean merit value in the parsed columns.");
  lines.push("- Göteborgsregionen's antagningspoäng/medelvärde PDF contains mean merit but not admitted count in the same table.");
  lines.push("- Very small parsed row counts indicate partial extraction only; those sources still need source-specific parser work before statistical use.");
  lines.push("- PDF parsing is layout-based and should be audited source by source before final statistical claims.");
  writeFileSync(REPORT_FILE, `${lines.join("\n")}\n`);
}

function main() {
  const payload = JSON.parse(readFileSync(DOWNLOADS_FILE, "utf8")) as DownloadPayload;
  const parsed: AdmissionRow[] = [];
  const failures: { file: string; error: string }[] = [];
  for (const file of payload.files) {
    try {
      const rows = parseFile(file);
      console.log(`${file.sourceId}: ${rows.length} parsed rows from ${file.localPath}`);
      parsed.push(...rows);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`${file.localPath}: ${error}`);
      failures.push({ file: file.localPath, error });
    }
  }
  const rows = uniqueRows(parsed);
  writeJson(OUT_FILE, {
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    rows,
    failures,
  });
  writeReport(rows, payload.files);
  console.log(`Wrote ${rows.length} normalized rows to ${OUT_FILE}`);
  console.log(`Wrote coverage report to ${REPORT_FILE}`);
}

main();
