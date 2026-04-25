"use client";

import { useMemo, useState } from "react";
import type { Row, Term } from "@/lib/types";

interface Props {
  rows: Row[];
  terms: Term[];
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "maskerat";
  return `${n.toFixed(1)} %`;
}

export function HuvudmanDetail({ rows, terms }: Props) {
  const [termKey, setTermKey] = useState<string>(terms[terms.length - 1]?.key ?? "");

  const filtered = useMemo(() => {
    const f = rows.filter((r) => r.termKey === termKey);
    f.sort((a, b) => a.skola.localeCompare(b.skola, "sv") || a.prov.localeCompare(b.prov, "sv"));
    return f;
  }, [rows, termKey]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="text-sm font-medium text-slate-700">Per skola × prov</div>
        <select
          className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          value={termKey}
          onChange={(e) => setTermKey(e.target.value)}
        >
          {terms.map((t) => (
            <option key={t.key} value={t.key}>{t.key}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Skola</th>
              <th className="px-3 py-2 text-left font-medium">Prov</th>
              <th className="px-3 py-2 text-right font-medium">Elever</th>
              <th className="px-3 py-2 text-right font-medium">Lägre</th>
              <th className="px-3 py-2 text-right font-medium">Lika</th>
              <th className="px-3 py-2 text-right font-medium">Högre</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.skolenhetskod}-${r.prov}-${i}`} className="border-t border-slate-100">
                <td className="px-3 py-2">{r.skola}</td>
                <td className="px-3 py-2 text-slate-600">{r.prov}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.antal.toLocaleString("sv-SE")}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.andelLagre === null ? "text-slate-400 italic" : ""}`}>{fmtPct(r.andelLagre)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.andelLika === null ? "text-slate-400 italic" : ""}`}>{fmtPct(r.andelLika)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.andelHogre === null ? "text-slate-400 italic font-normal" : ""}`}>{fmtPct(r.andelHogre)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Ingen data för vald termin.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
