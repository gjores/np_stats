export type Semester = "VT" | "HT";

export interface Term {
  year: number;
  semester: Semester;
  key: string;
  label?: string;
}

export function termKey(year: number, semester: Semester): string {
  return `${semester}${String(year).slice(-2)}`;
}

export function sortableTerm(t: Term): number {
  return t.year * 10 + (t.semester === "VT" ? 0 : 1);
}

export type HuvudmanType = "Kommunal" | "Enskild" | "Region" | "Skolverket";

export interface Row {
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

export type ProvGroup = "Matematik" | "Svenska" | "Svenska som andraspråk" | "Engelska" | "Annat";

export interface Aggregate {
  antal: number;
  andelLagre: number | null;
  andelLika: number | null;
  andelHogre: number | null;
  includedRows: number;
  excludedRows: number;
}

export interface HuvudmanAggregate extends Aggregate {
  orgnr: string;
  huvudman: string;
  typ: HuvudmanType;
  skolor: number;
  isAcadeMedia: boolean;
  isStorkommun: boolean;
}

export interface Dataset {
  rows: Row[];
  terms: Term[];
  provs: string[];
  provGroups: ProvGroup[];
  huvudmanIndex: Record<string, { huvudman: string; typ: HuvudmanType }>;
}

export interface AcadeMediaMap {
  orgnrs: string[];
  brands: Record<string, { name: string; brand: string }>;
}

export interface StorkommunerMap {
  orgnrs: string[];
  names: Record<string, string>;
}
