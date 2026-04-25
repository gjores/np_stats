"use client";

import type { ProvGroup, Term } from "@/lib/types";

export type AcadeMode = "all" | "only" | "exclude";
export type Metric = "andelHogre" | "andelLika" | "andelLagre";

export const METRIC_LABEL: Record<Metric, string> = {
  andelHogre: "Andel högre",
  andelLika: "Andel lika",
  andelLagre: "Andel lägre",
};

export interface Filters {
  termKey: string | "all";
  provGroup: ProvGroup | "all";
  minElever: number;
  acadeMedia: AcadeMode;
  metric: Metric;
}

interface Props {
  terms: Term[];
  provGroups: ProvGroup[];
  value: Filters;
  onChange: (next: Filters) => void;
}

export function FilterBar({ terms, provGroups, value, onChange }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap gap-4">
      <label className="text-sm flex flex-col gap-1">
        <span className="text-slate-600">Termin</span>
        <select
          className="border border-slate-300 rounded px-2 py-1 bg-white"
          value={value.termKey}
          onChange={(e) => onChange({ ...value, termKey: e.target.value as Filters["termKey"] })}
        >
          <option value="all">Alla terminer</option>
          {terms.map((t) => (
            <option key={t.key} value={t.key}>{t.label ?? `${t.key} (${t.semester === "VT" ? "vår" : "höst"} ${t.year})`}</option>
          ))}
        </select>
      </label>

      <label className="text-sm flex flex-col gap-1">
        <span className="text-slate-600">Ämne</span>
        <select
          className="border border-slate-300 rounded px-2 py-1 bg-white"
          value={value.provGroup}
          onChange={(e) => onChange({ ...value, provGroup: e.target.value as Filters["provGroup"] })}
        >
          <option value="all">Alla ämnen</option>
          {provGroups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>

      <label className="text-sm flex flex-col gap-1 min-w-[220px]">
        <span className="text-slate-600">Minsta antal elever: <span className="font-medium text-slate-900">{value.minElever}</span></span>
        <input
          type="range"
          min={0}
          max={1000}
          step={25}
          value={value.minElever}
          onChange={(e) => onChange({ ...value, minElever: parseInt(e.target.value, 10) })}
        />
      </label>

      <label className="text-sm flex flex-col gap-1">
        <span className="text-slate-600">Mått</span>
        <select
          className="border border-slate-300 rounded px-2 py-1 bg-white"
          value={value.metric}
          onChange={(e) => onChange({ ...value, metric: e.target.value as Metric })}
        >
          <option value="andelHogre">Andel högre</option>
          <option value="andelLika">Andel lika</option>
          <option value="andelLagre">Andel lägre</option>
        </select>
      </label>

      <label className="text-sm flex flex-col gap-1">
        <span className="text-slate-600">AcadeMedia</span>
        <select
          className="border border-slate-300 rounded px-2 py-1 bg-white"
          value={value.acadeMedia}
          onChange={(e) => onChange({ ...value, acadeMedia: e.target.value as AcadeMode })}
        >
          <option value="all">Alla huvudmän</option>
          <option value="only">Endast AcadeMedia</option>
          <option value="exclude">Exkludera AcadeMedia</option>
        </select>
      </label>
    </div>
  );
}
