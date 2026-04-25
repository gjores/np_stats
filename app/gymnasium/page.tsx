import { loadDataset, loadAcadeMedia, loadStorkommuner } from "@/lib/dataset";
import { loadAdmissionsInsight } from "@/lib/admissionsInsight";
import { AdmissionsMeritInsight } from "@/components/AdmissionsMeritInsight";
import { Dashboard } from "../Dashboard";

export default function GymnasiumHome() {
  const dataset = loadDataset("gymnasium");
  const am = loadAcadeMedia();
  const sk = loadStorkommuner();
  const admissionsInsight = loadAdmissionsInsight();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Gymnasieskolor: betyg vs nationella prov</h1>
        <p className="mt-1 text-slate-600 text-sm max-w-3xl">
          Rangordning av gymnasiehuvudmän efter andelen elever med betyg <strong>högre</strong> än provresultatet. AcadeMedia-koncernen och de tre största kommunala huvudmännen (Stockholm, Göteborg, Malmö) är markerade för jämförelse.
        </p>
      </section>
      <AdmissionsMeritInsight insight={admissionsInsight} />
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">NP-resultat och driftsform</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">
            Den här delen är den ursprungliga dashboarden: huvudmän, driftsform, AcadeMedia och storkommuner baserat på NP/betygsdata.
          </p>
        </div>
        <Dashboard
          dataset={dataset}
          acadeMediaOrgnrs={am.orgnrs}
          storkommuner={sk.orgnrs.map((orgnr) => ({ orgnr, name: sk.names[orgnr] ?? orgnr }))}
          detailBasePath="/huvudman"
        />
      </section>
    </div>
  );
}
