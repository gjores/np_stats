import type { Aggregate, Term } from "@/lib/types";

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(1)} %`;
}

function fmtInt(n: number): string {
  return n.toLocaleString("sv-SE");
}

interface Props {
  points: { term: Term; agg: Aggregate }[];
  nationalByTerm?: Record<string, number | null>;
}

export function PerTermSummary({ points, nationalByTerm }: Props) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Ingen data att visa per termin.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Termin</th>
            <th className="px-3 py-2 text-right font-medium">Elever</th>
            <th className="px-3 py-2 text-right font-medium">Andel lägre</th>
            <th className="px-3 py-2 text-right font-medium">Andel lika</th>
            <th className="px-3 py-2 text-right font-medium bg-amber-50">Andel högre</th>
            {nationalByTerm && (
              <th className="px-3 py-2 text-right font-medium">Nat. snitt högre</th>
            )}
            {nationalByTerm && (
              <th className="px-3 py-2 text-right font-medium">Diff</th>
            )}
          </tr>
        </thead>
        <tbody>
          {points.map(({ term, agg }) => {
            const nat = nationalByTerm?.[term.key] ?? null;
            const d = agg.andelHogre !== null && nat !== null ? agg.andelHogre - nat : null;
            return (
              <tr key={term.key} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{term.label ?? term.key}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtInt(agg.antal)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtPct(agg.andelLagre)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtPct(agg.andelLika)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold bg-amber-50/50">{fmtPct(agg.andelHogre)}</td>
                {nationalByTerm && (
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtPct(nat)}</td>
                )}
                {nationalByTerm && (
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${d === null ? "text-slate-400" : d > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {d === null ? "–" : `${d > 0 ? "+" : ""}${d.toFixed(1)} pp`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
