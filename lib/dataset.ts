import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset, AcadeMediaMap, StorkommunerMap } from "./types";

export type DatasetMode = "gymnasium" | "grundskola";

const datasetCache: Record<string, Dataset> = {};
let cachedAcadeMedia: AcadeMediaMap | null = null;
let cachedStorkommuner: StorkommunerMap | null = null;

function datasetPath(mode: DatasetMode): string {
  const file = mode === "gymnasium" ? "dataset.json" : "dataset-grund.json";
  return join(process.cwd(), "data", "generated", file);
}

export function loadDataset(mode: DatasetMode = "gymnasium"): Dataset {
  if (datasetCache[mode]) return datasetCache[mode];
  const raw = readFileSync(datasetPath(mode), "utf8");
  datasetCache[mode] = JSON.parse(raw) as Dataset;
  return datasetCache[mode];
}

export function loadAcadeMedia(): AcadeMediaMap {
  if (cachedAcadeMedia) return cachedAcadeMedia;
  const raw = readFileSync(join(process.cwd(), "data", "academedia.json"), "utf8");
  cachedAcadeMedia = JSON.parse(raw) as AcadeMediaMap;
  return cachedAcadeMedia;
}

export function loadStorkommuner(): StorkommunerMap {
  if (cachedStorkommuner) return cachedStorkommuner;
  const raw = readFileSync(join(process.cwd(), "data", "storkommuner.json"), "utf8");
  cachedStorkommuner = JSON.parse(raw) as StorkommunerMap;
  return cachedStorkommuner;
}
