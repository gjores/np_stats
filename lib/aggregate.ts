import type {
  Row,
  Aggregate,
  HuvudmanAggregate,
  ProvGroup,
  Term,
} from "./types";
import { sortableTerm } from "./types";

export interface RowFilter {
  termKey?: string | null;
  provGroup?: ProvGroup | null;
  prov?: string | null;
  acadeMediaOnly?: "all" | "only" | "exclude";
  acadeMediaSet?: Set<string>;
}

export function matchesFilter(row: Row, filter: RowFilter): boolean {
  if (filter.termKey && row.termKey !== filter.termKey) return false;
  if (filter.provGroup && row.provGroup !== filter.provGroup) return false;
  if (filter.prov && row.prov !== filter.prov) return false;
  const amMode = filter.acadeMediaOnly ?? "all";
  if (amMode !== "all" && filter.acadeMediaSet) {
    const isAM = filter.acadeMediaSet.has(row.orgnr);
    if (amMode === "only" && !isAM) return false;
    if (amMode === "exclude" && isAM) return false;
  }
  return true;
}

export function weightedAgg(rows: Row[]): Aggregate {
  let totalAntal = 0;
  let sumLagre = 0;
  let wLagre = 0;
  let sumLika = 0;
  let wLika = 0;
  let sumHogre = 0;
  let wHogre = 0;
  let included = 0;
  let excluded = 0;

  for (const r of rows) {
    totalAntal += r.antal;
    const hasAny = r.andelLagre !== null || r.andelLika !== null || r.andelHogre !== null;
    if (!hasAny) {
      excluded++;
      continue;
    }
    included++;
    if (r.andelLagre !== null) {
      sumLagre += r.andelLagre * r.antal;
      wLagre += r.antal;
    }
    if (r.andelLika !== null) {
      sumLika += r.andelLika * r.antal;
      wLika += r.antal;
    }
    if (r.andelHogre !== null) {
      sumHogre += r.andelHogre * r.antal;
      wHogre += r.antal;
    }
  }

  return {
    antal: totalAntal,
    andelLagre: wLagre > 0 ? sumLagre / wLagre : null,
    andelLika: wLika > 0 ? sumLika / wLika : null,
    andelHogre: wHogre > 0 ? sumHogre / wHogre : null,
    includedRows: included,
    excludedRows: excluded,
  };
}

export function aggregateByHuvudman(
  rows: Row[],
  filter: RowFilter,
  huvudmanIndex: Record<string, { huvudman: string; typ: Row["typ"] }>,
  acadeMediaSet: Set<string>,
  storkommunerSet: Set<string>,
  opts: { minElever?: number } = {}
): HuvudmanAggregate[] {
  const filtered = rows.filter((r) => matchesFilter(r, filter));
  const byOrg = new Map<string, Row[]>();
  for (const r of filtered) {
    let arr = byOrg.get(r.orgnr);
    if (!arr) {
      arr = [];
      byOrg.set(r.orgnr, arr);
    }
    arr.push(r);
  }
  const minElever = opts.minElever ?? 0;
  const out: HuvudmanAggregate[] = [];
  for (const [orgnr, group] of byOrg) {
    const agg = weightedAgg(group);
    if (agg.antal < minElever) continue;
    const skolorSet = new Set(group.map((r) => r.skolenhetskod));
    const meta = huvudmanIndex[orgnr] ?? { huvudman: group[0].huvudman, typ: group[0].typ };
    out.push({
      orgnr,
      huvudman: meta.huvudman,
      typ: meta.typ,
      skolor: skolorSet.size,
      isAcadeMedia: acadeMediaSet.has(orgnr),
      isStorkommun: storkommunerSet.has(orgnr),
      ...agg,
    });
  }
  return out;
}

export function rank(
  aggs: HuvudmanAggregate[],
  by: "andelHogre" | "andelLagre" | "andelLika" = "andelHogre",
  direction: "desc" | "asc" = "desc"
): HuvudmanAggregate[] {
  const copy = [...aggs];
  copy.sort((a, b) => {
    const av = a[by];
    const bv = b[by];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return direction === "desc" ? bv - av : av - bv;
  });
  return copy;
}

export interface TimePoint {
  term: Term;
  agg: Aggregate;
}

export function timeSeriesForHuvudman(
  rows: Row[],
  orgnr: string,
  filter: Pick<RowFilter, "provGroup" | "prov"> = {},
  terms: Term[]
): TimePoint[] {
  const subset = rows.filter((r) => {
    if (r.orgnr !== orgnr) return false;
    if (filter.provGroup && r.provGroup !== filter.provGroup) return false;
    if (filter.prov && r.prov !== filter.prov) return false;
    return true;
  });
  const byTerm = new Map<string, Row[]>();
  for (const r of subset) {
    let arr = byTerm.get(r.termKey);
    if (!arr) {
      arr = [];
      byTerm.set(r.termKey, arr);
    }
    arr.push(r);
  }
  return terms
    .filter((t) => byTerm.has(t.key))
    .map((t) => ({ term: t, agg: weightedAgg(byTerm.get(t.key)!) }))
    .sort((a, b) => sortableTerm(a.term) - sortableTerm(b.term));
}

export function nationalAggregate(rows: Row[], filter: RowFilter): Aggregate {
  return weightedAgg(rows.filter((r) => matchesFilter(r, filter)));
}
