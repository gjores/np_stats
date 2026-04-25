import { readFileSync } from "node:fs";
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
  type AdmissionSource,
  type DiscoveredAdmissionFile,
} from "./admissions-utils";

const SOURCES_FILE = resolve(__dirname, "../data/admissions-sources.json");
const OUT_FILE = resolve(__dirname, "../data/generated/admissions-discovered-files.json");

function extractLinks(html: string, baseUrl: string): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const rawHref = decodeHtmlEntities(match[1]);
    const url = absoluteUrl(rawHref, baseUrl);
    if (!url) continue;
    const label = stripTags(match[2]) || url;
    links.push({ label, url });
  }

  const urlRe = /https?:\/\/[^\s"'<>]+/gi;
  for (const match of html.matchAll(urlRe)) {
    const url = decodeHtmlEntities(match[0]).replace(/[),.;]+$/, "");
    if (!links.some((l) => l.url === url)) {
      links.push({ label: url, url });
    }
  }
  return links;
}

function toCandidate(source: AdmissionSource, link: { label: string; url: string }): DiscoveredAdmissionFile | null {
  const format = inferFormat(link.url, link.label);
  const haystack = `${link.label} ${link.url}`.toLowerCase();
  if (format === "unknown" && !/statistik|antagning|merit|slut|reserv|prelim/.test(haystack)) return null;
  const isDirectSource = link.url === source.sourceUrl;
  const inferredYear = inferYear(link.url, link.label);
  const inferredRound = inferRound(link.url, link.label);

  const base = {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.sourceUrl,
    year: inferredYear ?? (isDirectSource && /2025/.test(source.coverageNote ?? "") ? 2025 : null),
    round: inferredRound === "unknown" && isDirectSource ? source.preferredRound : inferredRound,
    format,
    label: link.label,
    url: link.url,
  };
  return { ...base, score: candidateScore(base) };
}

async function fetchSource(source: AdmissionSource): Promise<string> {
  const res = await fetch(source.sourceUrl, {
    headers: {
      "user-agent": "np-stats-admissions-research/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`${source.id}: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES_FILE, "utf8")) as AdmissionSource[];
  const allCandidates: DiscoveredAdmissionFile[] = [];
  const errors: { sourceId: string; message: string }[] = [];

  for (const source of sources) {
    try {
      const html = await fetchSource(source);
      const directCandidate = toCandidate(source, { label: source.name, url: source.sourceUrl });
      const candidates = [
        ...(directCandidate ? [directCandidate] : []),
        ...extractLinks(html, source.sourceUrl)
        .map((link) => toCandidate(source, link))
        .filter((v): v is DiscoveredAdmissionFile => v !== null),
      ]
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "sv"));
      console.log(`${source.id}: ${candidates.length} candidate links`);
      allCandidates.push(...candidates.slice(0, 20));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${source.id}: ${message}`);
      errors.push({ sourceId: source.id, message });
    }
  }

  allCandidates.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || b.score - a.score);
  writeJson(OUT_FILE, {
    generatedAt: new Date().toISOString(),
    candidateCount: allCandidates.length,
    candidates: allCandidates,
    errors,
  });
  console.log(`Wrote ${allCandidates.length} candidates to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
