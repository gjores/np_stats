import type { Aggregate, HuvudmanAggregate } from "@/lib/types";
import { METRIC_LABEL, type Metric } from "./FilterBar";

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(1)} %`;
}

function fmtInt(n: number): string {
  return n.toLocaleString("sv-SE");
}

export interface NamedAggregate {
  orgnr: string;
  name: string;
  agg: Aggregate;
}

interface Props {
  metric: Metric;
  national: Aggregate;
  academedia: Aggregate;
  fristaende: Aggregate;
  kommunal: Aggregate;
  storkommuner: NamedAggregate[];
  top?: HuvudmanAggregate;
  bottom?: HuvudmanAggregate;
  huvudmanCount: number;
}

export function SummaryCards({ metric, national, academedia, fristaende, kommunal, storkommuner, top, bottom, huvudmanCount }: Props) {
  const metricLabel = METRIC_LABEL[metric];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card
          label={`Nationellt snitt · ${metricLabel}`}
          value={fmtPct(national[metric])}
          sub={`${fmtInt(national.antal)} elever · ${fmtInt(huvudmanCount)} huvudmän i urval`}
        />
        <Card
          label={`AcadeMedia-snitt · ${metricLabel}`}
          value={fmtPct(academedia[metric])}
          sub={`${fmtInt(academedia.antal)} elever`}
          accent="academedia"
          diff={diff(academedia[metric], national[metric])}
        />
        <Card
          label={`Övriga fristående · ${metricLabel}`}
          value={fmtPct(fristaende[metric])}
          sub={`${fmtInt(fristaende.antal)} elever`}
          accent="fristaende"
          diff={diff(fristaende[metric], national[metric])}
        />
        <Card
          label={`Kommunala · ${metricLabel}`}
          value={fmtPct(kommunal[metric])}
          sub={`${fmtInt(kommunal.antal)} elever`}
          accent="kommunal"
          diff={diff(kommunal[metric], national[metric])}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {storkommuner.map((s) => (
          <Card
            key={s.orgnr}
            label={s.name}
            value={fmtPct(s.agg[metric])}
            sub={`${fmtInt(s.agg.antal)} elever`}
            accent="storkommun"
            diff={diff(s.agg[metric], national[metric])}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          label={`Störst ${metricLabel.toLowerCase()} i tabellen`}
          value={top ? fmtPct(top[metric]) : "–"}
          sub={top?.huvudman ?? ""}
        />
        <Card
          label={`Minst ${metricLabel.toLowerCase()} i tabellen`}
          value={bottom ? fmtPct(bottom[metric]) : "–"}
          sub={bottom?.huvudman ?? ""}
        />
      </div>
    </div>
  );
}

function diff(a: number | null, b: number | null): string | undefined {
  if (a === null || b === null) return undefined;
  const d = a - b;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)} pp mot nationellt`;
}

type Accent = "academedia" | "storkommun" | "fristaende" | "kommunal";

function Card({ label, value, sub, accent, diff }: { label: string; value: string; sub?: string; accent?: Accent; diff?: string }) {
  const border =
    accent === "academedia" ? "border-purple-300"
      : accent === "storkommun" ? "border-sky-300"
      : accent === "fristaende" ? "border-emerald-300"
      : accent === "kommunal" ? "border-amber-300"
      : "border-slate-200";
  return (
    <div className={`rounded-lg border ${border} bg-white p-4`}>
      <div className="text-xs text-slate-500 truncate" title={label}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500 truncate">{sub}</div>}
      {diff && <div className="mt-1 text-xs font-medium text-slate-700 tabular-nums">{diff}</div>}
    </div>
  );
}
