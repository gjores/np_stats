import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AdmissionSource } from "./admissions-utils";

const API_BASE = "https://antagningskanslier.skolverket.se/api";
const SKOLVERKET_REGISTER_URL =
  "https://www.skolverket.se/styrning-och-ansvar/regler-och-ansvar/stod-for-gymnasieantagning/antagningskanslier";
const SOURCES_FILE = resolve(__dirname, "../data/admissions-sources.json");
const OUT_FILE = resolve(__dirname, "../data/admission-boards-skolverket.json");
const REPORT_FILE = resolve(__dirname, "../docs/gymnasium-admissions-board-coverage.md");

interface BoardSummary {
  id: string;
  name: string;
}

interface Municipality {
  code: string;
  name: string;
}

interface SchoolUnit {
  code: string;
}

interface BoardDetail {
  name: string;
  email: string | null;
  phone: string | null;
  web: string | null;
  municipalities?: Municipality[];
  schoolUnits?: SchoolUnit[];
}

interface BoardCoverage {
  id: string;
  name: string;
  web: string | null;
  email: string | null;
  phone: string | null;
  municipalityCount: number;
  municipalities: Municipality[];
  schoolUnitCount: number;
  statisticsSourceId: string | null;
  statisticsSourceName: string | null;
  statisticsSourceUrl: string | null;
  statisticsCoverageStatus: "statistics-source-linked" | "statistics-source-missing";
}

const STATISTICS_SOURCE_BY_BOARD_NAME: Record<string, string> = {
  "Antagning Fyrbodal": "fyrbodal",
  "Antagning gymnasieskola Uppsala": "uppsala",
  "Antagningsenheten Sjuhärad": "sjuharad",
  "Antagningskansliet för Karlshamn, Olofström och Ronneby": "skanegy",
  "Antagningskansliet i Nyköping": "nykoping",
  "Antagningskansliet Torsås": "torsas-korr",
  "Antagningskansliet Värmland": "varmland",
  "Antagningskansliet Växjö": "kronoberg",
  "Gymnasieantagningen för Dalarna och Gävleborg": "dalarna-gavleborg",
  "Gymnasieantagningen för Västerbottens län": "vasterbotten",
  "Gymnasieantagningen Gotland": "gotland",
  "Gymnasieantagningen Göteborgsregionen": "goteborgsregionen",
  "Gymnasieantagningen i Helsingborg": "skanegy",
  "Gymnasieantagningen Kristianstad": "skanegy",
  "Gymnasieantagningen i Linköping": "ostergotland",
  "Gymnasieantagningen i Örebro län": "orebro",
  "Gymnasieantagningen i Östra samverkansområdet": "ostergotland",
  "Gymnasieantagningen Jönköping": "jonkoping",
  "Gymnasieantagningen Kalmarsunds gymnasieförbund": "kalmarsund",
  "Gymnasieantagningen Karlskrona": "karlskrona",
  "Gymnasieantagningen Lund": "skanegy",
  "Gymnasieantagningen Malmö": "skanegy",
  "Gymnasieantagningen Storsthlm": "storsthlm",
  "Gymnasieantagningen Trelleborg": "skanegy",
  "Gymnasieantagningen Västernorrland": "vasternorrland",
  "Gymnasieantagning Halland": "halland",
  "Skaraborgs Kommunalförbund, Utbildning Skaraborg": "skaraborg",
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "np-stats-admissions-research/0.1",
    },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function markdownEscape(value: string | null): string {
  return (value ?? "-").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildReport(boards: BoardCoverage[]): string {
  const linked = boards.filter((board) => board.statisticsCoverageStatus === "statistics-source-linked").length;
  const missing = boards.length - linked;
  const lines = [
    "# Gymnasium Admissions Board Coverage",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Canonical board registry: ${SKOLVERKET_REGISTER_URL}`,
    "",
    "Skolverket's register is the canonical list of gymnasial admission boards. The project keeps admission statistics sources separately, because not every board publishes final-admission merit statistics in the same place or format.",
    "",
    "## Summary",
    "",
    `- Admission boards in Skolverket register: ${boards.length}`,
    `- Boards linked to a current statistics source: ${linked}`,
    `- Boards still missing a statistics source/parser path: ${missing}`,
    "",
    "## Board Coverage",
    "",
    "| Board | Municipalities | School units | Statistics source | Status |",
    "|---|---:|---:|---|---|",
  ];

  for (const board of boards) {
    const source = board.statisticsSourceId
      ? `${board.statisticsSourceId} (${board.statisticsSourceName ?? "unknown"})`
      : "-";
    lines.push(
      `| ${markdownEscape(board.name)} | ${board.municipalityCount} | ${board.schoolUnitCount} | ${markdownEscape(source)} | ${board.statisticsCoverageStatus} |`
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- A linked statistics source means the board is represented in the current scraping/parsing pipeline, not that parsing is complete or analytically usable.");
  lines.push("- Skolverket notes that some schools have their own admission rather than a board connection; those school-unit-level cases need a separate pass through the school-units endpoint.");
  lines.push("- The previous 12-source set is now treated as a partial statistics-source layer over this 49-board canonical registry.");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES_FILE, "utf8")) as AdmissionSource[];
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const summaries = await fetchJson<BoardSummary[]>(`${API_BASE}/admission-boards?name=`);
  const boards: BoardCoverage[] = [];

  for (const summary of summaries) {
    const detail = await fetchJson<BoardDetail>(`${API_BASE}/admission-boards/${summary.id}`);
    const sourceId = STATISTICS_SOURCE_BY_BOARD_NAME[summary.name] ?? null;
    const source = sourceId ? sourcesById.get(sourceId) ?? null : null;
    boards.push({
      id: summary.id,
      name: summary.name,
      web: detail.web,
      email: detail.email,
      phone: detail.phone,
      municipalityCount: detail.municipalities?.length ?? 0,
      municipalities: detail.municipalities ?? [],
      schoolUnitCount: detail.schoolUnits?.length ?? 0,
      statisticsSourceId: sourceId,
      statisticsSourceName: source?.name ?? null,
      statisticsSourceUrl: source?.sourceUrl ?? null,
      statisticsCoverageStatus: sourceId ? "statistics-source-linked" : "statistics-source-missing",
    });
  }

  boards.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  writeFileSync(
    OUT_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        canonicalSource: SKOLVERKET_REGISTER_URL,
        apiBase: API_BASE,
        boardCount: boards.length,
        boards,
      },
      null,
      2
    )}\n`
  );
  writeFileSync(REPORT_FILE, buildReport(boards));
  console.log(`Wrote ${boards.length} boards to ${OUT_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
