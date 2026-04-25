import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Semester = "VT" | "HT";
type ProvGroup = "Matematik" | "Svenska" | "Svenska som andraspråk" | "Engelska" | "Annat";
type HuvudmanType = "Kommunal" | "Enskild" | "Region" | "Skolverket";

interface Row {
  termKey: string;
  termYear: number;
  termSemester: Semester;
  skola: string;
  skolenhetskod: string;
  kommun: string;
  kommunkod: string;
  typ: HuvudmanType;
  huvudman: string;
  orgnr: string;
  prov: string;
  provGroup: ProvGroup;
  antal: number;
  andelLagre: number | null;
  andelLika: number | null;
  andelHogre: number | null;
}

const DATA_DIR = resolve(__dirname, "../data_np");
const OUT_DIR = resolve(__dirname, "../data/generated");
const OUT_FILE = join(OUT_DIR, "dataset.json");

function parseTermFromFilename(name: string): { year: number; semester: Semester } | null {
  const m = name.match(/(VT|HT)(\d{2})/);
  if (!m) return null;
  return { semester: m[1] as Semester, year: 2000 + parseInt(m[2], 10) };
}

function parseSwedishNumber(raw: string): number | null {
  const v = raw.trim();
  if (v === "" || v === "." || v === "..") return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(raw: string): number {
  const v = raw.trim();
  if (v === "" || v === "." || v === "..") return 0;
  const n = parseInt(v.replace(/\s+/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProv(raw: string): { prov: string; group: ProvGroup } {
  const trimmed = raw.trim();
  let canonical = trimmed;
  const cleaned = trimmed
    .replace(/\/\s*Nivå\s*\d+[A-Za-z]?\s*/i, "")
    .replace(/\/\s*Forts\.\s*nivå\s*\d+[A-Za-z]?\s*/i, "")
    .trim();
  if (cleaned) canonical = cleaned;

  let group: ProvGroup = "Annat";
  if (/^Matematik/i.test(canonical)) group = "Matematik";
  else if (/^Svenska som andraspråk/i.test(canonical)) group = "Svenska som andraspråk";
  else if (/^Svenska/i.test(canonical)) group = "Svenska";
  else if (/^Engelska/i.test(canonical)) group = "Engelska";

  return { prov: canonical, group };
}

function normalizeType(raw: string): HuvudmanType {
  const t = raw.trim();
  if (t === "Kommunal" || t === "Enskild" || t === "Region" || t === "Skolverket") return t;
  return "Enskild";
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCsvFile(path: string): Row[] {
  const content = stripBom(readFileSync(path, "utf8"));
  const fileName = path.split("/").pop() ?? "";
  const term = parseTermFromFilename(fileName);
  if (!term) throw new Error(`Kunde inte härleda termin från filnamn: ${fileName}`);

  const termKey = `${term.semester}${String(term.year).slice(-2)}`;
  const lines = content.split(/\r?\n/);

  const headerIdx = lines.findIndex((l) => l.startsWith("Skola;"));
  if (headerIdx === -1) throw new Error(`Header saknas i ${fileName}`);

  const rows: Row[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(";");
    if (parts.length < 12) continue;

    const [skola, skolenhetskod, kommun, kommunkod, typRaw, huvudman, orgnr, provRaw, antalRaw, lagreRaw, likaRaw, hogreRaw] = parts;
    if (!skola || !huvudman || !orgnr || !provRaw) continue;

    const { prov, group } = normalizeProv(provRaw);

    rows.push({
      termKey,
      termYear: term.year,
      termSemester: term.semester,
      skola: skola.trim(),
      skolenhetskod: skolenhetskod.trim(),
      kommun: kommun.trim(),
      kommunkod: kommunkod.trim(),
      typ: normalizeType(typRaw),
      huvudman: huvudman.trim(),
      orgnr: orgnr.trim(),
      prov,
      provGroup: group,
      antal: parseInteger(antalRaw),
      andelLagre: parseSwedishNumber(lagreRaw),
      andelLika: parseSwedishNumber(likaRaw),
      andelHogre: parseSwedishNumber(hogreRaw),
    });
  }
  return rows;
}

function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  console.log(`Hittade ${files.length} CSV-filer i ${DATA_DIR}`);

  const allRows: Row[] = [];
  for (const f of files) {
    const rows = parseCsvFile(join(DATA_DIR, f));
    console.log(`  ${f}: ${rows.length} rader`);
    allRows.push(...rows);
  }

  const termSet = new Map<string, { year: number; semester: Semester }>();
  const provSet = new Set<string>();
  const huvudmanIndex: Record<string, { huvudman: string; typ: HuvudmanType }> = {};
  for (const r of allRows) {
    termSet.set(r.termKey, { year: r.termYear, semester: r.termSemester });
    provSet.add(r.prov);
    if (!huvudmanIndex[r.orgnr]) {
      huvudmanIndex[r.orgnr] = { huvudman: r.huvudman, typ: r.typ };
    }
  }

  const terms = Array.from(termSet.entries())
    .map(([key, v]) => ({ key, year: v.year, semester: v.semester }))
    .sort((a, b) => a.year * 10 + (a.semester === "VT" ? 0 : 1) - (b.year * 10 + (b.semester === "VT" ? 0 : 1)));

  const provs = Array.from(provSet).sort();
  const provGroups: ProvGroup[] = ["Matematik", "Svenska", "Svenska som andraspråk", "Engelska", "Annat"];

  mkdirSync(OUT_DIR, { recursive: true });
  const dataset = { rows: allRows, terms, provs, provGroups, huvudmanIndex };
  writeFileSync(OUT_FILE, JSON.stringify(dataset));
  console.log(`Skrev ${allRows.length} rader, ${terms.length} terminer, ${provs.length} unika prov, ${Object.keys(huvudmanIndex).length} huvudmän till ${OUT_FILE}`);
}

main();
