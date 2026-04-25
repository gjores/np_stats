"use client";

import { useMemo, useState } from "react";
import type { Dataset, ProvGroup } from "@/lib/types";
import { aggregateByHuvudman, nationalAggregate, rank, matchesFilter, weightedAgg } from "@/lib/aggregate";
import { FilterBar, type Filters } from "@/components/FilterBar";
import { RankingTable } from "@/components/RankingTable";
import { SummaryCards, type NamedAggregate } from "@/components/SummaryCards";
import { SuppressionNote } from "@/components/SuppressionNote";

interface Props {
  dataset: Dataset;
  acadeMediaOrgnrs: string[];
  storkommuner: { orgnr: string; name: string }[];
  detailBasePath: string;
}

function defaultTermKey(terms: Dataset["terms"]): string {
  const ht = [...terms].filter((t) => t.semester === "HT").sort((a, b) => b.year - a.year)[0];
  if (ht) return ht.key;
  const latest = [...terms].sort((a, b) => (b.year * 10 + (b.semester === "VT" ? 0 : 1)) - (a.year * 10 + (a.semester === "VT" ? 0 : 1)))[0];
  return latest?.key ?? "all";
}

export function Dashboard({ dataset, acadeMediaOrgnrs, storkommuner: storkommunerInput, detailBasePath }: Props) {
  const [filters, setFilters] = useState<Filters>(() => ({
    termKey: defaultTermKey(dataset.terms),
    provGroup: "all",
    minElever: 100,
    acadeMedia: "all",
    metric: "andelHogre",
  }));

  const amSet = useMemo(() => new Set(acadeMediaOrgnrs), [acadeMediaOrgnrs]);
  const skSet = useMemo(() => new Set(storkommunerInput.map((s) => s.orgnr)), [storkommunerInput]);

  const { aggs, national, academedia, fristaende, kommunal, storkommunerCards } = useMemo(() => {
    const filter = {
      termKey: filters.termKey === "all" ? null : filters.termKey,
      provGroup: filters.provGroup === "all" ? null : (filters.provGroup as ProvGroup),
      acadeMediaOnly: filters.acadeMedia,
      acadeMediaSet: amSet,
    };
    const aggs = aggregateByHuvudman(
      dataset.rows,
      filter,
      dataset.huvudmanIndex,
      amSet,
      skSet,
      { minElever: filters.minElever }
    );
    const ranked = rank(aggs, filters.metric, "desc");
    const baseFilter = {
      termKey: filter.termKey,
      provGroup: filter.provGroup,
      acadeMediaOnly: "all" as const,
    };
    const national = nationalAggregate(dataset.rows, baseFilter);
    const academedia = weightedAgg(dataset.rows.filter((r) => amSet.has(r.orgnr) && matchesFilter(r, baseFilter)));
    const fristaende = weightedAgg(
      dataset.rows.filter((r) => r.typ === "Enskild" && !amSet.has(r.orgnr) && matchesFilter(r, baseFilter))
    );
    const kommunal = weightedAgg(
      dataset.rows.filter((r) => r.typ === "Kommunal" && matchesFilter(r, baseFilter))
    );
    const storkommunerCards: NamedAggregate[] = storkommunerInput.map((s) => ({
      orgnr: s.orgnr,
      name: s.name,
      agg: weightedAgg(dataset.rows.filter((r) => r.orgnr === s.orgnr && matchesFilter(r, baseFilter))),
    }));
    return { aggs: ranked, national, academedia, fristaende, kommunal, storkommunerCards };
  }, [dataset, amSet, skSet, storkommunerInput, filters]);

  const top = aggs.find((a) => a[filters.metric] !== null);
  const bottom = [...aggs].reverse().find((a) => a[filters.metric] !== null);

  return (
    <div className="space-y-6">
      <FilterBar
        terms={dataset.terms}
        provGroups={dataset.provGroups}
        value={filters}
        onChange={setFilters}
      />
      <SummaryCards
        metric={filters.metric}
        national={national}
        academedia={academedia}
        fristaende={fristaende}
        kommunal={kommunal}
        storkommuner={storkommunerCards}
        top={top}
        bottom={bottom}
        huvudmanCount={aggs.length}
      />
      <RankingTable rows={aggs} detailBasePath={detailBasePath} metric={filters.metric} />
      <SuppressionNote />
    </div>
  );
}
