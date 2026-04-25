import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, closeSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import * as XLSX from "xlsx";
import { writeJson, type DiscoveredAdmissionFile } from "./admissions-utils";

const OCR_CACHE = resolve(__dirname, "../.ocr-cache");

const JAMTLAND_SCHOOL_BY_CODE: Record<string, string> = {
  AGY: "Jämtlands Gymnasium Anpassad gymnasieskola",
  ARE: "Jämtlands Gymnasium Åre",
  "BG-1": "Jämtlands Gymnasium Berg",
  BGY: "Jämtlands Gymnasium Bräcke",
  DILLE: "Dille Gård naturbruksgymnasium",
  HA: "Härjedalens Gymnasium",
  HJS: "Hjalmar Strömerskolan",
  JGO: "Jämtlands Gymnasium Östersund",
  OG: "Östersunds Gymnasium",
  RAG: "Jämtlands Gymnasium Bispgården",
  STG: "Storsjögymnasiet",
  Torsta: "Jämtlands Gymnasium Torsta",
  Wangen: "Jämtlands Gymnasium Wången",
};

function jamtlandSchoolFromPath(localPath: string): string | null {
  const m = basename(localPath).match(/-(BG-1|AGY|ARE|BGY|DILLE|HA|HJS|JGO|OG|RAG|STG|Torsta|Wangen)-/);
  return m ? JAMTLAND_SCHOOL_BY_CODE[m[1]] ?? null : null;
}

function sniffMagic(absPath: string): "pdf" | "zip" | "other" {
  let fd: number | null = null;
  try {
    fd = openSync(absPath, "r");
    const buf = Buffer.alloc(8);
    readSync(fd, buf, 0, 8, 0);
    if (buf.slice(0, 4).toString("ascii") === "%PDF") return "pdf";
    if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
    return "other";
  } catch {
    return "other";
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

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

function pdfTextOcr(absPath: string, opts: { psm?: number } = {}): string {
  const psm = opts.psm ?? 6;
  const cacheKey = `${basename(absPath, ".pdf")}-psm${psm}`;
  const cacheDir = join(OCR_CACHE, cacheKey);
  const cachedText = join(cacheDir, "text.txt");
  if (existsSync(cachedText)) return readFileSync(cachedText, "utf8");
  mkdirSync(cacheDir, { recursive: true });
  try {
    execFileSync("pdftoppm", ["-r", "200", "-gray", "-png", absPath, join(cacheDir, "page")], {
      timeout: 120_000,
    });
    const pages = readdirSync(cacheDir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const parts: string[] = [];
    for (const page of pages) {
      const pngPath = join(cacheDir, page);
      const txtBase = pngPath.replace(/\.png$/, "");
      execFileSync(
        "tesseract",
        [pngPath, txtBase, "-l", "swe", "--psm", String(psm), "-c", "preserve_interword_spaces=1"],
        { timeout: 60_000, stdio: ["ignore", "ignore", "ignore"] }
      );
      parts.push(readFileSync(`${txtBase}.txt`, "utf8"));
    }
    const combined = parts.join("\n\n--PAGE--\n\n");
    writeFileSync(cachedText, combined);
    return combined;
  } catch (err) {
    rmSync(cacheDir, { recursive: true, force: true });
    throw err;
  }
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

function parseOrebroMedianPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  let currentSchool: string | null = null;
  let currentMunicipality: string | null = null;
  let awaitingMunicipality = false;
  const schoolHeaderRe = /^Slutlig antagningsstatistik för\s+(.+)$/i;
  const municipalityRe = /^(.+?)\s+\((\d{4})\)\s+period\s+\d+/i;
  const rowRe = /^(.+?)\s+([A-ZÅÄÖ]{1,5})\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+([0-9]+(?:[.,]\d+)?)\s+([0-9]+(?:[.,]\d+)?))?\s+(\d+)\s*$/;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const schoolHeader = trimmed.match(schoolHeaderRe);
    if (schoolHeader) {
      currentSchool = schoolHeader[1].trim();
      currentMunicipality = null;
      awaitingMunicipality = true;
      continue;
    }

    if (awaitingMunicipality) {
      const municipality = trimmed.match(municipalityRe);
      if (municipality) {
        currentMunicipality = municipality[1].trim();
        awaitingMunicipality = false;
        continue;
      }
    }

    const match = trimmed.match(rowRe);
    if (!match || !currentSchool) continue;
    const [, programName, programCode, places, firstChoice, admitted, min, median, reserve] = match;
    const minMerit = parseNumber(min ?? "");
    const medianMerit = parseNumber(median ?? "");
    if (minMerit === null || medianMerit === null) continue;
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
      programCode,
      orientationName: null,
      places: parseIntValue(places),
      admittedCount: parseIntValue(admitted),
      firstChoiceAdmittedCount: parseIntValue(firstChoice),
      reserveCount: parseIntValue(reserve),
      admissionMeritMin: minMerit,
      admissionMeritMean: null,
      admissionMeritMedian: medianMerit,
      parser: "orebro-median-pdf",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function findMeritWindow(values: number[]): { min: number | null; mean: number | null; median: number | null } {
  const isMerit = (value: number) => value >= 50 && value <= 500;
  for (let i = values.length - 3; i >= 0; i--) {
    if (isMerit(values[i]) && isMerit(values[i + 1]) && isMerit(values[i + 2])) {
      return { min: values[i], mean: values[i + 1], median: values[i + 2] };
    }
  }
  for (let i = values.length - 2; i >= 0; i--) {
    if (isMerit(values[i]) && isMerit(values[i + 1])) {
      return { min: values[i], mean: values[i + 1], median: null };
    }
  }
  return { min: null, mean: null, median: null };
}

function parseProgramCodeParenthesesPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  const rowRe = /^(.+?)\s+\(([A-ZÅÄÖ0-9-]+)\)\s+(\d+)\s+(\d+)(?:\s+([0-9]+(?:[.,]\d+)?)\s+([0-9]+(?:[.,]\d+)?)\s+([0-9]+(?:[.,]\d+)?))?\s*$/;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(rowRe);
    if (!match) continue;
    const [, programName, studyPathCode, places, admitted, min, mean, median] = match;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: file.sourceName,
      skolenhetskod: null,
      municipality: null,
      programName: programName.trim(),
      programCode: parseProgramCode(studyPathCode),
      orientationName: null,
      places: parseIntValue(places),
      admittedCount: parseIntValue(admitted),
      firstChoiceAdmittedCount: null,
      reserveCount: null,
      admissionMeritMin: parseNumber(min),
      admissionMeritMean: parseNumber(mean),
      admissionMeritMedian: parseNumber(median),
      parser: "program-code-parentheses-pdf",
      parserConfidence: "high",
    });
  }

  return rows.filter((row) => row.programName && (row.admittedCount ?? 0) > 0);
}

function parseIstSummaryPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  let currentMunicipality: string | null = null;
  let expectMunicipalityCode = false;
  let pendingValuesBeforeCode: number[] | null = null;
  let pending:
    | {
        studyPathCode: string;
        values: number[];
        meritOverride?: { min: number | null; mean: number | null; median: number | null };
      }
    | null = null;

  function flushPending(programName?: string): void {
    if (!pending || !currentMunicipality) return;
    const merits = pending.meritOverride ?? findMeritWindow(pending.values);
    if (merits.min === null && merits.mean === null && merits.median === null) {
      pending = null;
      return;
    }
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: currentMunicipality,
      skolenhetskod: null,
      municipality: currentMunicipality,
      programName: programName?.trim() || pending.studyPathCode,
      programCode: parseProgramCode(pending.studyPathCode),
      orientationName: null,
      places: parseIntValue(pending.values[0]),
      admittedCount: parseIntValue(pending.values[1]),
      firstChoiceAdmittedCount: null,
      reserveCount: parseIntValue(pending.values[2]),
      admissionMeritMin: merits.min,
      admissionMeritMean: merits.mean,
      admissionMeritMedian: merits.median,
      parser: "ist-summary-pdf",
      parserConfidence: programName ? "medium" : "low",
    });
    pending = null;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = trimmed.match(/Antagningsstatistik för gymnasieprogram,\s*([^,(]+)\s*\(/i);
    if (header) {
      flushPending();
      currentMunicipality = header[1].trim();
      continue;
    }

    if (/^Sökt kommun$/i.test(trimmed)) {
      expectMunicipalityCode = true;
      continue;
    }

    if (expectMunicipalityCode) {
      const municipality = trimmed.match(/^\d{4}\s+(.+)$/);
      if (municipality) currentMunicipality = municipality[1].trim();
      expectMunicipalityCode = false;
      continue;
    }

    const numericValues = Array.from(trimmed.matchAll(/[0-9]+(?:[.,][0-9]+)?/g))
      .map((m) => parseNumber(m[0]))
      .filter((value): value is number => value !== null);
    if (/^\d/.test(trimmed) && numericValues.length >= 5) {
      pendingValuesBeforeCode = numericValues;
      continue;
    }

    const codeLine = trimmed.match(/^([A-ZÅÄÖ][A-ZÅÄÖ0-9-]{1,12})\s+(.+)$/);
    if (codeLine && /\d/.test(codeLine[2])) {
      flushPending();
      const codeLineValues = Array.from(codeLine[2].matchAll(/[0-9]+(?:[.,][0-9]+)?/g))
        .map((m) => parseNumber(m[0]))
        .filter((value): value is number => value !== null);
      const valuesBeforeCode = pendingValuesBeforeCode;
      const values = [...(valuesBeforeCode ?? []), ...codeLineValues];
      const meritOverride = valuesBeforeCode
        ? {
            min: [...valuesBeforeCode].reverse().find((value) => value >= 50 && value <= 500) ?? null,
            mean: codeLineValues.find((value) => value >= 50 && value <= 500) ?? null,
            median: null,
          }
        : undefined;
      pendingValuesBeforeCode = null;
      if (values.length >= 5) {
        pending = {
          studyPathCode: codeLine[1],
          values,
          meritOverride,
        };
      }
      continue;
    }

    if (pending && /[A-Za-zÅÄÖåäö]/.test(trimmed) && !/\d/.test(trimmed)) {
      flushPending(trimmed);
    }
  }
  flushPending();

  return rows;
}

function parseGotlandPdf(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  let currentSchool: string | null = null;
  const headerRe = /Slutlig antagning\s+\d{4}\s*-\s*(.+?)\s*$/;
  const meritTrailRe = /^([A-ZÅÄÖ0-9-]{2,8})\s+(.+?,\s+Gotland)\s+([KFL])\s+(.+?)([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+(?:[.,][0-9]+)?)(?:\s+\d+)?\s*$/;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^Summa\b/i.test(trimmed)) continue;
    const header = trimmed.match(headerRe);
    if (header) {
      currentSchool = header[1].trim();
      continue;
    }
    const m = trimmed.match(meritTrailRe);
    if (!m || !currentSchool) continue;
    const [, programCode, , huvudman, middle, minStr, meanStr] = m;
    const minMerit = parseNumber(minStr);
    const meanMerit = parseNumber(meanStr);
    if ((minMerit === null || minMerit < 50) && (meanMerit === null || meanMerit < 50)) continue;
    const numbers = Array.from(middle.matchAll(/\d+/g)).map((x) => parseIntValue(x[0]));
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: currentSchool,
      skolenhetskod: null,
      municipality: "Gotland",
      programName: programCode,
      programCode: parseProgramCode(programCode),
      orientationName: huvudman === "F" ? "Fristående" : huvudman === "K" ? "Kommunal" : null,
      places: numbers[0] ?? null,
      admittedCount: numbers[7] ?? null,
      firstChoiceAdmittedCount: null,
      reserveCount: null,
      admissionMeritMin: minMerit,
      admissionMeritMean: meanMerit,
      admissionMeritMedian: null,
      parser: "gotland-layout-pdf",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function uppsalaContextFromFilename(localPath: string): { context: "kommunala" | "fristående"; municipality: string | null } {
  const name = basename(localPath).toLowerCase();
  if (/frist/.test(name)) return { context: "fristående", municipality: null };
  if (/knivsta/.test(name)) return { context: "kommunala", municipality: "Knivsta" };
  if (/tierp/.test(name)) return { context: "kommunala", municipality: "Tierp" };
  if (/sthammar/.test(name)) return { context: "kommunala", municipality: "Östhammar" };
  if (/uppsala/.test(name)) return { context: "kommunala", municipality: "Uppsala" };
  return { context: "kommunala", municipality: null };
}

function parseUppsalaOcr(file: DownloadedFile, text: string): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  const { context, municipality } = uppsalaContextFromFilename(file.localPath);
  const trailingRe = /^(.+?)\s{2,}(.+?)\s{2,}(\d{1,3})\s+(\d{1,3})\s+(\d{2,3}(?:[.,]\d+)?)\s+(\d{2,3}(?:[.,]\d+)?)\s+(\d{2,3}(?:[.,]\d+)?)\s+(\d{1,3})\s*$/;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*[a-zåäöA-ZÅÄÖ0-9]\s+/, (m) => (/^\s+\D\s+/.test(m) ? "" : m));
    const trimmed = line.replace(/\s+$/, "");
    if (!trimmed.trim()) continue;
    if (/Antagningsstatistik|Studieväg|Antal\s+antagna|Sida\s+\d|Uppsala\s+kommun|antagna\s+reserver|Lägst\s+Medel|Antagningspoäng/i.test(trimmed)) continue;
    const m = trimmed.match(trailingRe);
    if (!m) continue;
    const [, programName, school, , , min, mean, median] = m;
    const minMerit = parseNumber(min);
    const meanMerit = parseNumber(mean);
    const medianMerit = parseNumber(median);
    if ((minMerit === null || minMerit < 50) && (meanMerit === null || meanMerit < 50)) continue;
    if (!school || school.length > 80 || !programName || programName.length > 100) continue;
    if (/^\d+\s*$/.test(school) || /^\d+\s*$/.test(programName)) continue;
    rows.push({
      year: file.year ?? 2025,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: file.round,
      school: school.trim(),
      skolenhetskod: null,
      municipality: municipality,
      programName: programName.trim(),
      programCode: null,
      orientationName: context === "fristående" ? "Fristående" : "Kommunal",
      places: null,
      admittedCount: parseIntValue(m[3]),
      firstChoiceAdmittedCount: null,
      reserveCount: parseIntValue(m[4]),
      admissionMeritMin: minMerit,
      admissionMeritMean: meanMerit,
      admissionMeritMedian: medianMerit,
      parser: "uppsala-ocr",
      parserConfidence: "medium",
    });
  }
  return rows;
}

function parsePdf(file: DownloadedFile, absPath: string): AdmissionRow[] {
  let text = pdfText(absPath);
  if (text.replace(/\s/g, "").length < 200 && (file.sourceId === "uppsala" || file.sourceId === "nykoping")) {
    try {
      const psm = file.sourceId === "nykoping" ? 1 : 6;
      text = pdfTextOcr(absPath, { psm });
    } catch (err) {
      console.warn(`OCR failed for ${file.localPath}: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
  const programCodeParentheses = parseProgramCodeParenthesesPdf(file, text);
  const istSummary = parseIstSummaryPdf(file, text);
  const dexter = parseDexterPdf(file, text);
  const goteborg = file.sourceId === "goteborgsregionen" ? parseGoteborgPdf(file, text) : [];
  const schoolHeader = parseSchoolHeaderPdf(file, text);
  const orebro = parseOrebroMedianPdf(file, text);
  const gotland = file.sourceId === "gotland" ? parseGotlandPdf(file, text) : [];
  const uppsala = file.sourceId === "uppsala" ? parseUppsalaOcr(file, text) : [];
  return [goteborg, gotland, uppsala, programCodeParentheses, istSummary, dexter, schoolHeader, orebro].sort((a, b) => b.length - a.length)[0];
}

interface SkanegyMeritRow {
  year: string;
  municipality: string;
  school: string;
  program: string;
  program_code: string;
  preliminary_lowest_merit: string | number;
  preliminary_average_merit: string | number;
  final_lowest_merit: string | number;
  final_average_merit: string | number;
  reserved_lowest_merit: string | number;
  reserved_average_merit: string | number;
}

function parseSkanegyJson(file: DownloadedFile, absPath: string): AdmissionRow[] {
  const raw = JSON.parse(readFileSync(absPath, "utf8")) as SkanegyMeritRow[];
  const rows: AdmissionRow[] = [];
  for (const r of raw) {
    const year = parseIntValue(r.year);
    if (year !== 2025) continue;
    const finalMin = parseNumber(r.final_lowest_merit);
    const finalMean = parseNumber(r.final_average_merit);
    const reservedMin = parseNumber(r.reserved_lowest_merit);
    const reservedMean = parseNumber(r.reserved_average_merit);
    const min = finalMin ?? reservedMin;
    const mean = finalMean ?? reservedMean;
    if (min === null && mean === null) continue;
    const round: AdmissionRow["admissionRound"] =
      finalMin !== null || finalMean !== null ? "final" : "reserve";
    rows.push({
      year,
      sourceRegion: file.sourceId,
      sourceFile: file.localPath,
      sourceUrl: file.url,
      admissionRound: round,
      school: (r.school ?? "").trim(),
      skolenhetskod: null,
      municipality: (r.municipality ?? "").trim() || null,
      programName: (r.program ?? "").trim(),
      programCode: parseProgramCode(r.program_code ?? null),
      orientationName: null,
      places: null,
      admittedCount: null,
      firstChoiceAdmittedCount: null,
      reserveCount: null,
      admissionMeritMin: min,
      admissionMeritMean: mean,
      admissionMeritMedian: null,
      parser: "skanegy-json",
      parserConfidence: "high",
    });
  }
  return rows.filter((r) => r.school && r.programName);
}

function parseGymnasiestuderaHtml(file: DownloadedFile, absPath: string): AdmissionRow[] {
  const text = readFileSync(absPath, "utf8");
  const rows: AdmissionRow[] = [];
  const stripHtml = (s: string) =>
    s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const decodeEnt = (s: string) =>
    s
      .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(parseInt(c, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
      .replace(/&amp;/g, "&")
      .replace(/&aring;/g, "å")
      .replace(/&auml;/g, "ä")
      .replace(/&ouml;/g, "ö")
      .replace(/&Aring;/g, "Å")
      .replace(/&Auml;/g, "Ä")
      .replace(/&Ouml;/g, "Ö");
  const sectionSplit = text.split(/<h3[^>]*>/);
  for (let i = 1; i < sectionSplit.length; i++) {
    const section = sectionSplit[i];
    const closeIdx = section.indexOf("</h3>");
    if (closeIdx < 0) continue;
    const school = decodeEnt(stripHtml(section.slice(0, closeIdx)));
    if (!school || school.length > 100) continue;
    const body = section.slice(closeIdx + 5);
    const programRe = /<button[^>]*class="accordion-header"[^>]*>([\s\S]*?)<\/button>([\s\S]*?)(?=<button[^>]*class="accordion-header"|<h3|<h2|$)/g;
    for (const pm of body.matchAll(programRe)) {
      const programName = decodeEnt(stripHtml(pm[1]));
      if (!programName) continue;
      const block = pm[2];
      const pair = block.match(
        /Meritvärde\s*\(lägst\)[\s\S]*?<p[^>]*class="lead"[^>]*>([\s\S]*?)<\/p>[\s\S]*?Meritvärde\s*\(medel\)[\s\S]*?<p[^>]*class="lead"[^>]*>([\s\S]*?)<\/p>/
      );
      if (!pair) continue;
      const min = parseNumber(stripHtml(pair[1]));
      const mean = parseNumber(stripHtml(pair[2]));
      if ((min === null || min < 50) && (mean === null || mean < 50)) continue;
      rows.push({
        year: file.year ?? 2025,
        sourceRegion: file.sourceId,
        sourceFile: file.localPath,
        sourceUrl: file.url,
        admissionRound: file.round,
        school,
        skolenhetskod: null,
        municipality: null,
        programName,
        programCode: null,
        orientationName: null,
        places: null,
        admittedCount: null,
        firstChoiceAdmittedCount: null,
        reserveCount: null,
        admissionMeritMin: min,
        admissionMeritMean: mean,
        admissionMeritMedian: null,
        parser: "gymnasiestudera-html",
        parserConfidence: "high",
      });
    }
  }
  return rows;
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

function vasternorrlandSchoolFromPath(localPath: string): { school: string; municipality: string | null } | null {
  const name = basename(localPath).replace(/^\d{4}-(?:final|reserve|preliminary|unknown)-/, "").replace(/-[0-9a-f]{8}\.pdf$/, "");
  if (!name || /personuppgift/i.test(name)) return null;
  const decoded = name
    .replace(/-/g, " ")
    .replace(/\bH rn sand\b/i, "Härnösand")
    .replace(/\bSollefte\b/i, "Sollefteå")
    .replace(/\bTimr\b/i, "Timrå")
    .replace(/\bnge\b/i, "Ånge")
    .replace(/\brnsk ldsvik\b/gi, "Örnsköldsvik")
    .replace(/\bH ga Kusten\b/i, "Höga Kusten")
    .trim();
  const municipalities = ["Härnösand", "Kramfors", "Sollefteå", "Sundsvall", "Timrå", "Ånge", "Örnsköldsvik"];
  const muni = municipalities.find((m) => decoded.toLowerCase().startsWith(m.toLowerCase())) ?? null;
  return { school: decoded, municipality: muni };
}

function parseFile(file: DownloadedFile): AdmissionRow[] {
  const absPath = resolve(__dirname, "..", file.localPath);
  if (!file.ok || !existsSync(absPath)) return [];
  if (/prel/i.test(file.localPath) || file.round === "preliminary") return [];
  const ext = extname(absPath).toLowerCase();
  const magic = sniffMagic(absPath);
  const effectiveExt = magic === "pdf" ? ".pdf" : ext;
  let rows: AdmissionRow[];
  if (effectiveExt === ".xlsx" || effectiveExt === ".xls") {
    rows = parseStorsthlmWorkbook(file, absPath);
  } else if (effectiveExt === ".pdf") {
    if (file.bytes > 5 * 1024 * 1024) {
      throw new Error(`Skipping large PDF (${Math.round(file.bytes / 1024 / 1024)} MB) until source-specific parser is available`);
    }
    rows = parsePdf(file, absPath);
  } else if (effectiveExt === ".json" && file.sourceId === "skanegy") {
    rows = parseSkanegyJson(file, absPath);
  } else if (effectiveExt === ".html" && file.sourceId === "ostergotland") {
    rows = parseGymnasiestuderaHtml(file, absPath);
  } else if (effectiveExt === ".html") {
    rows = parseHtml(file, absPath);
  } else {
    rows = [];
  }
  if (file.sourceId === "jamtland") {
    const school = jamtlandSchoolFromPath(file.localPath);
    if (school) {
      rows = rows.map((r) => ({ ...r, school, municipality: r.municipality ?? r.school }));
    }
  }
  if (file.sourceId === "vasternorrland") {
    const meta = vasternorrlandSchoolFromPath(file.localPath);
    if (meta) {
      rows = rows.map((r) => ({
        ...r,
        school: meta.school,
        municipality: meta.municipality ?? r.municipality,
      }));
    }
  }
  return rows;
}

function uniqueRows(rows: AdmissionRow[]): AdmissionRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      row.sourceRegion,
      row.admissionRound,
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
