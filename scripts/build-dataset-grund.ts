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

const DATA_DIR = resolve(__dirname, "../data_np/grund");
const OUT_DIR = resolve(__dirname, "../data/generated");
const OUT_FILE = join(OUT_DIR, "dataset-grund.json");

function parseLasarFromFilename(name: string): { endYear: number } | null {
  const m = name.match(/(\d{4})\s+Skolniv/);
  if (!m) return null;
  return { endYear: parseInt(m[1], 10) };
}

function parseSwedishNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const v = raw.trim();
  if (v === "" || v === "." || v === "..") return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const v = raw.trim();
  if (v === "" || v === "." || v === "..") return 0;
  const n = parseInt(v.replace(/\s+/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeType(raw: string): HuvudmanType {
  const t = raw.trim();
  if (t === "Kommunal" || t === "Enskild" || t === "Region" || t === "Skolverket") return t;
  return "Enskild";
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

const SUBJECTS: { name: string; group: ProvGroup; startCol: number }[] = [
  { name: "Svenska", group: "Svenska", startCol: 7 },
  { name: "Matematik", group: "Matematik", startCol: 11 },
  { name: "Engelska", group: "Engelska", startCol: 15 },
  { name: "Svenska som andraspråk", group: "Svenska som andraspråk", startCol: 19 },
];

function parseCsvFile(path: string): Row[] {
  const content = stripBom(readFileSync(path, "utf8"));
  const fileName = path.split("/").pop() ?? "";
  const year = parseLasarFromFilename(fileName);
  if (!year) throw new Error(`Kunde inte härleda läsår från filnamn: ${fileName}`);

  const startYear = year.endYear - 1;
  const termKey = `L${String(year.endYear).slice(-2)}`;
  const lines = content.split(/\r?\n/);

  const headerIdx = lines.findIndex((l) => l.startsWith("Skola;"));
  if (headerIdx === -1) throw new Error(`Header saknas i ${fileName}`);

  const rows: Row[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(";");
    if (parts.length < 23) continue;

    const [skola, skolenhetskod, kommun, kommunkod, typRaw, huvudman, orgnr] = parts;
    if (!skola || !huvudman || !orgnr) continue;

    const base = {
      termKey,
      termYear: startYear,
      termSemester: "HT" as Semester,
      skola: skola.trim(),
      skolenhetskod: skolenhetskod.trim(),
      kommun: kommun.trim(),
      kommunkod: kommunkod.trim(),
      typ: normalizeType(typRaw),
      huvudman: huvudman.trim(),
      orgnr: orgnr.trim(),
    };

    for (const s of SUBJECTS) {
      const antal = parseInteger(parts[s.startCol]);
      const lagre = parseSwedishNumber(parts[s.startCol + 1]);
      const lika = parseSwedishNumber(parts[s.startCol + 2]);
      const hogre = parseSwedishNumber(parts[s.startCol + 3]);
      if (antal === 0 && lagre === null && lika === null && hogre === null) continue;
      rows.push({
        ...base,
        prov: s.name,
        provGroup: s.group,
        antal,
        andelLagre: lagre,
        andelLika: lika,
        andelHogre: hogre,
      });
    }
  }
  return rows;
}

function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  console.log(`Hittade ${files.length} grundskola-CSV:er i ${DATA_DIR}`);

  const allRows: Row[] = [];
  for (const f of files) {
    const rows = parseCsvFile(join(DATA_DIR, f));
    console.log(`  ${f}: ${rows.length} unpivotade rader`);
    allRows.push(...rows);
  }

  const termSet = new Map<string, { year: number; semester: Semester; label: string }>();
  const provSet = new Set<string>();
  const huvudmanIndex: Record<string, { huvudman: string; typ: HuvudmanType }> = {};
  for (const r of allRows) {
    if (!termSet.has(r.termKey)) {
      const endYear = r.termYear + 1;
      termSet.set(r.termKey, {
        year: r.termYear,
        semester: r.termSemester,
        label: `Läsår ${r.termYear}/${String(endYear).slice(-2)}`,
      });
    }
    provSet.add(r.prov);
    if (!huvudmanIndex[r.orgnr]) {
      huvudmanIndex[r.orgnr] = { huvudman: r.huvudman, typ: r.typ };
    }
  }

  const terms = Array.from(termSet.entries())
    .map(([key, v]) => ({ key, year: v.year, semester: v.semester, label: v.label }))
    .sort((a, b) => a.year - b.year);

  const provs = Array.from(provSet).sort();
  const provGroups: ProvGroup[] = ["Svenska", "Matematik", "Engelska", "Svenska som andraspråk"];

  mkdirSync(OUT_DIR, { recursive: true });
  const dataset = { rows: allRows, terms, provs, provGroups, huvudmanIndex };
  writeFileSync(OUT_FILE, JSON.stringify(dataset));
  console.log(`Skrev ${allRows.length} rader, ${terms.length} läsår, ${provs.length} ämnen, ${Object.keys(huvudmanIndex).length} huvudmän till ${OUT_FILE}`);
}

main();
