"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { HuvudmanAggregate } from "@/lib/types";
import type { Metric } from "./FilterBar";

type SortKey = "andelHogre" | "andelLika" | "andelLagre" | "antal" | "huvudman";

interface Props {
  rows: HuvudmanAggregate[];
  initialSort?: SortKey;
  detailBasePath: string;
  metric?: Metric;
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(1)} %`;
}

function fmtInt(n: number): string {
  return n.toLocaleString("sv-SE");
}

export function RankingTable({ rows, initialSort = "andelHogre", detailBasePath, metric }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(metric ?? initialSort);
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (metric) {
      setSortKey(metric);
      setDirection("desc");
    }
  }, [metric]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return direction === "desc" ? bv.localeCompare(av, "sv") : av.localeCompare(bv, "sv");
      }
      const an = (av as number | null) ?? -Infinity;
      const bn = (bv as number | null) ?? -Infinity;
      return direction === "desc" ? bn - an : an - bn;
    });
    return copy;
  }, [rows, sortKey, direction]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection(direction === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setDirection(key === "huvudman" ? "asc" : "desc");
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (direction === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium w-10">#</th>
            <th className="px-3 py-2 text-left font-medium cursor-pointer" onClick={() => handleSort("huvudman")}>
              Huvudman{arrow("huvudman")}
            </th>
            <th className="px-3 py-2 text-left font-medium">Typ</th>
            <th className="px-3 py-2 text-right font-medium">Skolor</th>
            <th className="px-3 py-2 text-right font-medium cursor-pointer" onClick={() => handleSort("antal")}>
              Elever{arrow("antal")}
            </th>
            <th className={`px-3 py-2 text-right font-medium cursor-pointer ${metric === "andelLagre" ? "bg-amber-50" : ""}`} onClick={() => handleSort("andelLagre")}>
              Lägre{arrow("andelLagre")}
            </th>
            <th className={`px-3 py-2 text-right font-medium cursor-pointer ${metric === "andelLika" ? "bg-amber-50" : ""}`} onClick={() => handleSort("andelLika")}>
              Lika{arrow("andelLika")}
            </th>
            <th className={`px-3 py-2 text-right font-medium cursor-pointer ${metric === "andelHogre" || !metric ? "bg-amber-50" : ""}`} onClick={() => handleSort("andelHogre")}>
              Högre{arrow("andelHogre")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.orgnr} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">
                <Link href={`${detailBasePath}/${r.orgnr}`} className="text-sky-700 hover:underline font-medium">
                  {r.huvudman}
                </Link>
                {r.isAcadeMedia && (
                  <span className="ml-2 inline-block text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                    AcadeMedia
                  </span>
                )}
                {r.isStorkommun && (
                  <span className="ml-2 inline-block text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                    Storkommun
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">{r.typ}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.skolor}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.antal)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${metric === "andelLagre" ? "font-semibold bg-amber-50/50 text-slate-900" : "text-slate-600"}`}>{fmtPct(r.andelLagre)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${metric === "andelLika" ? "font-semibold bg-amber-50/50 text-slate-900" : "text-slate-600"}`}>{fmtPct(r.andelLika)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${metric === "andelHogre" || !metric ? "font-semibold bg-amber-50/50 text-slate-900" : "text-slate-600"}`}>{fmtPct(r.andelHogre)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-slate-500">Inga huvudmän matchar filtren.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
