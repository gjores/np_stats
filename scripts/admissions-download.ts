import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  ensureDir,
  localRawPath,
  writeJson,
  type DiscoveredAdmissionFile,
} from "./admissions-utils";

const DISCOVERED_FILE = resolve(__dirname, "../data/generated/admissions-discovered-files.json");
const OUT_FILE = resolve(__dirname, "../data/generated/admissions-downloaded-files.json");

interface DiscoveredPayload {
  candidates: DiscoveredAdmissionFile[];
}

function selectDownloads(candidates: DiscoveredAdmissionFile[]): DiscoveredAdmissionFile[] {
  const bySource = new Map<string, DiscoveredAdmissionFile[]>();
  for (const c of candidates) {
    if (c.year !== 2025) continue;
    if (c.round !== "final" && !(c.round === "unknown" && c.score >= 35)) continue;
    if (!["pdf", "xlsx", "xls", "csv", "html"].includes(c.format)) continue;
    if (/information|press|tidplan|guide|överklaga|beslut/i.test(c.label)) continue;
    const arr = bySource.get(c.sourceId) ?? [];
    arr.push(c);
    bySource.set(c.sourceId, arr);
  }

  const selected: DiscoveredAdmissionFile[] = [];
  for (const [, files] of bySource) {
    files.sort(
      (a, b) =>
        formatPriority(b.format) - formatPriority(a.format) ||
        b.score - a.score ||
        a.label.localeCompare(b.label, "sv")
    );
    selected.push(...files.slice(0, 16));
  }
  return selected;
}

function formatPriority(format: DiscoveredAdmissionFile["format"]): number {
  if (format === "xlsx" || format === "xls") return 4;
  if (format === "pdf") return 3;
  if (format === "csv") return 2;
  if (format === "html") return 1;
  return 0;
}

async function download(file: DiscoveredAdmissionFile): Promise<DiscoveredAdmissionFile & { bytes: number; ok: boolean; error?: string }> {
  const localPath = localRawPath(file);
  try {
    const res = await fetch(file.url, {
      headers: {
        "user-agent": "np-stats-admissions-research/0.1",
        accept: "*/*",
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    ensureDir(dirname(resolve(__dirname, "..", localPath)));
    writeFileSync(resolve(__dirname, "..", localPath), buffer);
    return { ...file, localPath, bytes: buffer.length, ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ...file, localPath, bytes: 0, ok: false, error };
  }
}

async function main() {
  const payload = JSON.parse(readFileSync(DISCOVERED_FILE, "utf8")) as DiscoveredPayload;
  const selected = selectDownloads(payload.candidates);
  const results = [];
  for (const file of selected) {
    const result = await download(file);
    console.log(`${result.ok ? "ok" : "fail"} ${file.sourceId} ${file.label} -> ${result.localPath}`);
    results.push(result);
  }
  writeJson(OUT_FILE, {
    generatedAt: new Date().toISOString(),
    selectedCount: selected.length,
    downloadedCount: results.filter((r) => r.ok).length,
    files: results,
  });
  console.log(`Wrote download report to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
