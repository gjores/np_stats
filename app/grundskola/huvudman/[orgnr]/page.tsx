import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDataset, loadAcadeMedia, loadStorkommuner } from "@/lib/dataset";
import { timeSeriesForHuvudman, nationalAggregate } from "@/lib/aggregate";
import { TrendChart } from "@/components/TrendChart";
import { PerTermSummary } from "@/components/PerTermSummary";
import { HuvudmanDetail } from "@/app/huvudman/[orgnr]/HuvudmanDetail";

interface Props {
  params: Promise<{ orgnr: string }>;
}

export default async function GrundHuvudmanPage({ params }: Props) {
  const { orgnr } = await params;
  const dataset = loadDataset("grundskola");
  const am = loadAcadeMedia();
  const sk = loadStorkommuner();

  const meta = dataset.huvudmanIndex[orgnr];
  if (!meta) notFound();

  const rows = dataset.rows.filter((r) => r.orgnr === orgnr);
  const series = timeSeriesForHuvudman(dataset.rows, orgnr, {}, dataset.terms);

  const nationalByTerm: Record<string, number | null> = {};
  for (const t of dataset.terms) {
    const agg = nationalAggregate(dataset.rows, { termKey: t.key, acadeMediaOnly: "all" });
    nationalByTerm[t.key] = agg.andelHogre;
  }

  const brand = am.brands[orgnr];
  const isAcadeMedia = am.orgnrs.includes(orgnr);
  const isStorkommun = sk.orgnrs.includes(orgnr);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-sky-700 hover:underline">← Tillbaka till grundskolerankning</Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{meta.huvudman}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Orgnr: <span className="tabular-nums">{orgnr}</span></span>
          <span>·</span>
          <span>Typ: {meta.typ}</span>
          {isAcadeMedia && (
            <span className="ml-2 inline-block text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
              AcadeMedia{brand ? ` — ${brand.brand}` : ""}
            </span>
          )}
          {isStorkommun && (
            <span className="ml-2 inline-block text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
              Storkommun
            </span>
          )}
        </div>
      </div>

      <PerTermSummary points={series} nationalByTerm={nationalByTerm} />

      <TrendChart points={series} nationalByTerm={nationalByTerm} />

      <HuvudmanDetail rows={rows} terms={dataset.terms} />
    </div>
  );
}

