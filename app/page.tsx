import { loadDataset, loadAcadeMedia, loadStorkommuner } from "@/lib/dataset";
import { Dashboard } from "./Dashboard";

export default function Home() {
  const dataset = loadDataset("grundskola");
  const am = loadAcadeMedia();
  const sk = loadStorkommuner();

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Grundskola årskurs 9: slutbetyg vs nationella prov</h1>
        <p className="mt-1 text-slate-600 text-sm max-w-3xl">
          Rangordning av grundskolehuvudmän efter andelen elever med slutbetyg <strong>högre</strong> än provbetyget i svenska, matematik, engelska och svenska som andraspråk. AcadeMedia-koncernen och Stockholm/Göteborg/Malmö är markerade för jämförelse.
        </p>
      </section>
      <Dashboard
        dataset={dataset}
        acadeMediaOrgnrs={am.orgnrs}
        storkommuner={sk.orgnrs.map((orgnr) => ({ orgnr, name: sk.names[orgnr] ?? orgnr }))}
        detailBasePath="/grundskola/huvudman"
      />
    </div>
  );
}
