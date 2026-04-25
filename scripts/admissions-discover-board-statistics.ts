import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  absoluteUrl,
  candidateScore,
  decodeHtmlEntities,
  inferFormat,
  inferRound,
  inferYear,
  stripTags,
  writeJson,
  type DiscoveredAdmissionFile,
} from "./admissions-utils";

const BOARDS_FILE = resolve(__dirname, "../data/admission-boards-skolverket.json");
const OUT_FILE = resolve(__dirname, "../data/generated/admission-board-statistics-candidates.json");
const REPORT_FILE = resolve(__dirname, "../docs/gymnasium-admissions-board-statistics-candidates.md");

interface BoardRegistry {
  generatedAt: string;
  canonicalSource: string;
  boards: BoardCoverage[];
}

interface BoardCoverage {
  id: string;
  name: string;
  web: string | null;
  statisticsSourceId: string | null;
  statisticsCoverageStatus: "statistics-source-linked" | "statistics-source-missing";
}

interface BoardCandidate extends DiscoveredAdmissionFile {
  boardId: string;
  boardName: string;
  boardWeb: string | null;
  existingStatisticsSourceId: string | null;
}

interface BoardError {
  boardId: string;
  boardName: string;
  web: string | null;
  message: string;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractLinks(html: string, baseUrl: string): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const rawHref = decodeHtmlEntities(match[1]);
    const url = absoluteUrl(rawHref, baseUrl);
    if (!url || !/^https?:\/\//.test(url)) continue;
    const label = stripTags(match[2]) || url;
    links.push({ label, url });
  }

  const urlRe = /https?:\/\/[^\s"'<>]+/gi;
  for (const match of html.matchAll(urlRe)) {
    const url = decodeHtmlEntities(match[0]).replace(/[),.;]+$/, "");
    if (!links.some((link) => link.url === url)) links.push({ label: url, url });
  }
  return links;
}

function toCandidate(board: BoardCoverage, link: { label: string; url: string }): BoardCandidate | null {
  const format = inferFormat(link.url, link.label);
  const url = new URL(link.url);
  const relevanceHaystack = `${link.label} ${decodeURIComponent(url.pathname)} ${decodeURIComponent(url.search)}`.toLowerCase();
  if (!/statistik|antagningsstatistik|antagningspo|merit|jämförelsetal|jamforelsetal|slutlig|slutliga|slutantag|reservantag|prelim/.test(relevanceHaystack)) {
    return null;
  }
  if (/överklaga|overklaga|manual|glömt|glomt|lösenord|losenord|inlogg|ansökan|ansokan|frikvot|utländska betyg|tidplan|programnämnd/.test(relevanceHaystack)) {
    return null;
  }

  const base = {
    sourceId: board.statisticsSourceId ?? `board-${slug(board.name)}`,
    sourceName: board.name,
    sourceUrl: board.web ?? "",
    year: inferYear(link.url, link.label),
    round: inferRound(link.url, link.label),
    format,
    label: link.label,
    url: link.url,
  };
  const candidate = {
    ...base,
    score: candidateScore(base),
    boardId: board.id,
    boardName: board.name,
    boardWeb: board.web,
    existingStatisticsSourceId: board.statisticsSourceId,
  };
  return candidate.score > 0 ? candidate : null;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "np-stats-admissions-research/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function markdownEscape(value: string | null): string {
  return (value ?? "-").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatCandidate(candidate: BoardCandidate | null): string {
  if (!candidate) return "-";
  const label = candidate.label.length > 80 ? `${candidate.label.slice(0, 77)}...` : candidate.label;
  return `[${markdownEscape(label)}](${candidate.url})`;
}

function writeReport(boards: BoardCoverage[], candidates: BoardCandidate[], errors: BoardError[]): void {
  const candidatesByBoard = new Map<string, BoardCandidate[]>();
  for (const candidate of candidates) {
    candidatesByBoard.set(candidate.boardId, [...(candidatesByBoard.get(candidate.boardId) ?? []), candidate]);
  }

  const missingBoards = boards.filter((board) => board.statisticsCoverageStatus === "statistics-source-missing");
  const missingWithCandidate = missingBoards.filter((board) => (candidatesByBoard.get(board.id) ?? []).length > 0).length;
  const lines = [
    "# Gymnasium Board Statistics Candidate Discovery",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "This report scans each Skolverket admission board website for likely final-admission statistics links. It is a discovery aid: candidates still need source-specific verification and parser wiring.",
    "",
    "## Summary",
    "",
    `- Admission boards scanned: ${boards.length}`,
    `- Candidate links found: ${candidates.length}`,
    `- Boards missing a statistics source: ${missingBoards.length}`,
    `- Missing-source boards with at least one candidate link: ${missingWithCandidate}`,
    `- Fetch errors: ${errors.length}`,
    "",
    "## Missing Source Leads",
    "",
    "| Board | Web | Candidate count | Best candidate | Best score |",
    "|---|---|---:|---|---:|",
  ];

  for (const board of missingBoards) {
    const boardCandidates = (candidatesByBoard.get(board.id) ?? []).sort((a, b) => b.score - a.score);
    const best = boardCandidates[0] ?? null;
    lines.push(
      `| ${markdownEscape(board.name)} | ${board.web ? `[web](${board.web})` : "-"} | ${boardCandidates.length} | ${formatCandidate(best)} | ${best?.score ?? 0} |`
    );
  }

  lines.push("");
  lines.push("## Existing Source Cross-Check");
  lines.push("");
  lines.push("| Board | Existing source | Candidate count | Best candidate | Best score |");
  lines.push("|---|---|---:|---|---:|");
  for (const board of boards.filter((b) => b.statisticsCoverageStatus === "statistics-source-linked")) {
    const boardCandidates = (candidatesByBoard.get(board.id) ?? []).sort((a, b) => b.score - a.score);
    const best = boardCandidates[0] ?? null;
    lines.push(
      `| ${markdownEscape(board.name)} | ${board.statisticsSourceId} | ${boardCandidates.length} | ${formatCandidate(best)} | ${best?.score ?? 0} |`
    );
  }

  if (errors.length > 0) {
    lines.push("");
    lines.push("## Fetch Errors");
    lines.push("");
    lines.push("| Board | Web | Error |");
    lines.push("|---|---|---|");
    for (const error of errors) {
      lines.push(`| ${markdownEscape(error.boardName)} | ${error.web ? `[web](${error.web})` : "-"} | ${markdownEscape(error.message)} |`);
    }
  }

  writeFileSync(REPORT_FILE, `${lines.join("\n")}\n`);
}

async function main() {
  const registry = JSON.parse(readFileSync(BOARDS_FILE, "utf8")) as BoardRegistry;
  const candidates: BoardCandidate[] = [];
  const errors: BoardError[] = [];

  for (const board of registry.boards) {
    if (!board.web) {
      errors.push({ boardId: board.id, boardName: board.name, web: board.web, message: "No board web URL in Skolverket register" });
      continue;
    }
    try {
      const html = await fetchHtml(board.web);
      const boardCandidates = extractLinks(html, board.web)
        .map((link) => toCandidate(board, link))
        .filter((candidate): candidate is BoardCandidate => candidate !== null)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "sv"))
        .slice(0, 25);
      candidates.push(...boardCandidates);
      console.log(`${board.name}: ${boardCandidates.length} candidates`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ boardId: board.id, boardName: board.name, web: board.web, message });
      console.warn(`${board.name}: ${message}`);
    }
  }

  candidates.sort((a, b) => a.boardName.localeCompare(b.boardName, "sv") || b.score - a.score);
  writeJson(OUT_FILE, {
    generatedAt: new Date().toISOString(),
    boardCount: registry.boards.length,
    candidateCount: candidates.length,
    candidates,
    errors,
  });
  writeReport(registry.boards, candidates, errors);
  console.log(`Wrote ${candidates.length} candidates to ${OUT_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
