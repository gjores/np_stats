import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface AdmissionSource {
  id: string;
  name: string;
  sourceUrl: string;
  preferredRound: "final" | "reserve" | "preliminary";
  format: string;
  parser: string;
  priority: number;
  status: string;
  coverageNote?: string;
}

export interface DiscoveredAdmissionFile {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  year: number | null;
  round: "final" | "reserve" | "preliminary" | "unknown";
  format: "pdf" | "xlsx" | "xls" | "csv" | "html" | "unknown";
  label: string;
  url: string;
  score: number;
  localPath?: string;
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

export function inferFormat(url: string, label = ""): DiscoveredAdmissionFile["format"] {
  const haystack = `${url} ${label}`.toLowerCase();
  if (haystack.includes(".xlsx")) return "xlsx";
  if (haystack.includes(".xls")) return "xls";
  if (haystack.includes(".csv")) return "csv";
  if (haystack.includes(".pdf")) return "pdf";
  if (/statistik|antagning|merit/.test(haystack)) return "html";
  return "unknown";
}

export function inferYear(url: string, label = ""): number | null {
  const urlName = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  const orderedHaystacks = [label, urlName, url];
  for (const haystack of orderedHaystacks) {
    const years = Array.from(haystack.matchAll(/\b(20\d{2})\b/g)).map((m) => parseInt(m[1], 10));
    const year = years.find((v) => v >= 2020 && v <= 2030);
    if (year) return year;

    const shortDates = Array.from(haystack.matchAll(/\b(2[0-9])(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])\b/g))
      .map((m) => 2000 + parseInt(m[1], 10));
    const shortYear = shortDates.find((v) => v >= 2020 && v <= 2030);
    if (shortYear) return shortYear;
  }
  return null;
}

export function inferRound(url: string, label = ""): DiscoveredAdmissionFile["round"] {
  const haystack = `${label} ${url}`.toLowerCase();
  if (/reserv|avslutad/.test(haystack)) return "reserve";
  if (/prelim|april/.test(haystack)) return "preliminary";
  if (/slut|slutlig|slutantag|final/.test(haystack)) return "final";
  if (/\b2[0-9](06|07)[0-3][0-9]\b/.test(haystack) && /antag|statistik|merit/.test(haystack)) return "final";
  return "unknown";
}

export function candidateScore(file: Omit<DiscoveredAdmissionFile, "score">): number {
  const haystack = `${file.label} ${file.url}`.toLowerCase();
  let score = 0;
  if (file.year === 2025) score += 30;
  if (file.round === "final") score += 30;
  if (file.round === "reserve") score += 10;
  if (file.format === "xlsx" || file.format === "xls") score += 12;
  if (file.format === "pdf") score += 8;
  if (/medel|medelvärde|merit|jämförelsetal/.test(haystack)) score += 10;
  if (/antagningspoäng|antagningsstatistik|statistik/.test(haystack)) score += 8;
  if (/prelim/.test(haystack)) score -= 15;
  if (/information|press|tidplan|guide/.test(haystack)) score -= 12;
  return score;
}

export function localRawPath(file: DiscoveredAdmissionFile): string {
  const ext = file.format === "unknown" || file.format === "html" ? "html" : file.format;
  const urlPath = new URL(file.url).pathname;
  const urlName = decodeURIComponent(urlPath.split("/").pop() || "");
  const safeUrlName = urlName
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  const hash = createHash("sha1").update(file.url).digest("hex").slice(0, 8);
  const year = file.year ?? "unknown-year";
  const round = file.round;
  const name = `${year}-${round}-${safeUrlName || file.sourceId}-${hash}.${ext}`;
  return join("data_admissions", "gymnasium", "raw", file.sourceId, name);
}
