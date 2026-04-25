import Link from "next/link";

export const metadata = {
  title: "Om datan — Betyg vs nationella prov",
};

const GYM_FILES = [
  { name: "Gymnasieskola — VT23 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov VT23 Skolnivå.csv" },
  { name: "Gymnasieskola — HT23 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov HT23 Skolnivå.csv" },
  { name: "Gymnasieskola — VT24 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov VT24 Skolnivå.csv" },
  { name: "Gymnasieskola — HT24 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov HT24 Skolnivå.csv" },
  { name: "Gymnasieskola — VT25 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov VT25 Skolnivå.csv" },
  { name: "Gymnasieskola — HT25 (Skolnivå)", file: "Gymnasieskola - Relationen mellan betyg och nationella prov HT25 Skolnivå.csv" },
];

const GRUND_FILES = [
  { name: "Grundskola åk 9 — läsår 2022/23 (Skolnivå)", file: "Grundskola - Relationen mellan nationella prov och slutbetyg årskurs 9, svenska_svenska som andraspråk, matematik och engelska 2023 Skolnivå.csv" },
  { name: "Grundskola åk 9 — läsår 2023/24 (Skolnivå)", file: "Grundskola - Relationen mellan nationella prov och slutbetyg årskurs 9, svenska_svenska som andraspråk, matematik och engelska 2024 Skolnivå.csv" },
  { name: "Grundskola åk 9 — läsår 2024/25 (Skolnivå)", file: "Grundskola - Relationen mellan nationella prov och slutbetyg årskurs 9, svenska_svenska som andraspråk, matematik och engelska 2025 Skolnivå.csv" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-1">{title}</h2>
      <div className="space-y-3 text-slate-700 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function FileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} download className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 fill-current">
        <path d="M10 2a.75.75 0 0 1 .75.75v8.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V2.75A.75.75 0 0 1 10 2Zm-7 13.5a.75.75 0 0 1 .75.75v.25c0 .138.112.25.25.25h12a.25.25 0 0 0 .25-.25v-.25a.75.75 0 0 1 1.5 0v.25A1.75 1.75 0 0 1 16 18.25H4A1.75 1.75 0 0 1 2.25 16.5v-.25A.75.75 0 0 1 3 15.5Z" />
      </svg>
      <span>{children}</span>
    </a>
  );
}

export default function OmPage() {
  return (
    <article className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Om datan</h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          Den här sidan visar hur elevers betyg förhåller sig till deras resultat på nationella
          prov, aggregerat på huvudmannanivå. Syftet är att synliggöra systematiska avvikelser —
          särskilt andelen elever med <strong>betyg högre än</strong> provresultatet.
        </p>
      </header>

      <Section title="Datakälla">
        <p>
          All rådata kommer från <strong>Skolverkets statistikdatabas</strong>{" "}
          (<a className="text-sky-700 hover:underline" href="https://www.skolverket.se/skolutveckling/statistik" target="_blank" rel="noopener noreferrer">skolverket.se/skolutveckling/statistik</a>),
          närmare bestämt rapporterna &quot;Relationen mellan betyg och nationella prov&quot; på{" "}
          <em>skolnivå</em>. Skolverket redovisar, per skolenhet och prov, andelen elever vars
          slutbetyg/kursbetyg är <em>lägre</em>, <em>lika</em> eller <em>högre</em> än provbetyget.
        </p>
        <p>
          Skolverket maskerar små grupper med <code className="px-1 bg-slate-100 rounded">.</code> eller{" "}
          <code className="px-1 bg-slate-100 rounded">..</code> av integritetsskäl. Dessa rader
          exkluderas från beräknade aggregat men räknas fortfarande i det totala elevantalet.
        </p>
      </Section>

      <Section title="Råfiler (CSV)">
        <p className="text-slate-600">
          Semikolon-separerade, UTF-8 med BOM, svenskt decimaltecken (komma).
        </p>

        <h3 className="font-semibold text-slate-900 mt-4">Gymnasium — terminsvis</h3>
        <ul className="space-y-1.5">
          {GYM_FILES.map((f) => (
            <li key={f.file}>
              <FileLink href={`/data_np/${encodeURI(f.file)}`}>{f.name}</FileLink>
            </li>
          ))}
        </ul>

        <h3 className="font-semibold text-slate-900 mt-4">Grundskola åk 9 — läsårsvis</h3>
        <ul className="space-y-1.5">
          {GRUND_FILES.map((f) => (
            <li key={f.file}>
              <FileLink href={`/data_np/grund/${encodeURI(f.file)}`}>{f.name}</FileLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bearbetning">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>CSV-parsning vid byggtid</strong> — Filerna läses av ett Node-skript
            (<code className="px-1 bg-slate-100 rounded">scripts/build-dataset.ts</code> för gymnasium och{" "}
            <code className="px-1 bg-slate-100 rounded">scripts/build-dataset-grund.ts</code> för grundskola)
            som skriver en JSON-fil per dataset. Ingen runtime-parsning sker; appen läser in genererad JSON.
          </li>
          <li>
            <strong>Normalisering</strong> — UTF-8 BOM och semikolon hanteras. Svenska decimaltecken
            (komma) konverteras till punkt. Maskerade värden
            (<code className="px-1 bg-slate-100 rounded">.</code>,{" "}
            <code className="px-1 bg-slate-100 rounded">..</code>) mappas till{" "}
            <code className="px-1 bg-slate-100 rounded">null</code>. Gymnasie-filerna bytte från och
            med VT25 benämning på vissa prov (t.ex. <em>Matematik 3C</em> vs{" "}
            <em>Matematik 3C/Forts. nivå 1C</em>); dessa mappas till en gemensam kanonisk nyckel.
          </li>
          <li>
            <strong>Grundskolan — wide → long</strong> — Grundskolefilerna har fyra ämnen per rad
            (svenska, svenska som andraspråk, matematik, engelska). Dessa vecklas ut till en rad per
            ämne så att datastrukturen matchar gymnasiet.
          </li>
          <li>
            <strong>Aggregat per huvudman</strong> — beräknas som <em>viktat medelvärde</em> på
            elevantal:
            <div className="mt-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded p-2">
              andel = Σ (andel<sub>i</sub> × antal<sub>i</sub>) / Σ antal<sub>i</sub>
            </div>
            över alla skolenheter och prov inom en huvudman, för vald termin och ämnesfilter. Rader
            där andelen är maskerad utesluts ur summeringen (både täljare och nämnare).
          </li>
          <li>
            <strong>Termin/läsår</strong> — härleds från filnamnet. Gymnasiet redovisas per
            VT/HT-termin; grundskolan per läsår (redovisas som höstterminen året efter läsårets
            avslut, t.ex. läsår 2024/25 → HT25).
          </li>
        </ol>
      </Section>

      <Section title="Koncern- och kommunmappning">
        <p>Skolverket publicerar inte koncerntillhörighet. Därför underhålls två handkurerade listor i repot:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <code className="px-1 bg-slate-100 rounded">data/academedia.json</code> — juridiska enheter
            (orgnr) som tillhör AcadeMedia-koncernen, med varumärke. Listan utgår från{" "}
            <a className="text-sky-700 hover:underline" href="https://www.academedia.se/vara-verksamheter/" target="_blank" rel="noopener noreferrer">
              AcadeMedias officiella varumärkeslista
            </a>{" "}
            och matchas mot unika huvudmannanamn i datasetet. Osäkra kandidater lämnas som kommentar i filen.
          </li>
          <li>
            <code className="px-1 bg-slate-100 rounded">data/storkommuner.json</code> — de tre största
            kommunala huvudmännen (Stockholms stad, Göteborgs stad, Malmö stad) särredovisas som
            jämförelse mot AcadeMedia.
          </li>
        </ul>
      </Section>

      <Section title="Urval och filter i appen">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Termin</strong> — default är senaste höstterminen där data finns.</li>
          <li><strong>Ämne</strong> — filter på ämnesgrupp (Matematik, Svenska, Engelska, Svenska som andraspråk).</li>
          <li><strong>Mått</strong> — välj om rangordningen ska baseras på andel högre, lika eller lägre.</li>
          <li><strong>Minsta antal elever</strong> — filtrerar bort huvudmän med få elever i urvalet (default 100).</li>
          <li><strong>AcadeMedia-toggle</strong> — visa alla, endast AcadeMedia, eller exkludera AcadeMedia.</li>
        </ul>
      </Section>

      <Section title="Begränsningar och tolkning">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Hög andel &quot;högre&quot; är inte per automatik bevis på &quot;glädjebetyg&quot; —
            det kan också bero på att provet inte täcker hela kursinnehållet eller att provresultatet
            påverkats av dagsform. Avvikelsen är dock den indikator som Skolverket och IFAU lyft
            fram som politiskt relevant.
          </li>
          <li>
            Jämförelser mellan skolor/huvudmän bör göras med försiktighet när elevantalet är litet.
            Använd filtret <em>Minsta antal elever</em> för att exkludera brus.
          </li>
          <li>
            Maskerade rader innebär att verklig andel kan avvika från det beräknade aggregatet,
            framför allt för små huvudmän.
          </li>
        </ul>
      </Section>

      <Section title="Kod">
        <p>
          Källkoden är en liten Next.js-app utan databas. De relevanta filerna för parsning och
          aggregat är <code className="px-1 bg-slate-100 rounded">scripts/build-dataset.ts</code>,{" "}
          <code className="px-1 bg-slate-100 rounded">scripts/build-dataset-grund.ts</code> och{" "}
          <code className="px-1 bg-slate-100 rounded">lib/aggregate.ts</code>.
        </p>
      </Section>

      <p>
        <Link href="/" className="text-sky-700 hover:underline text-sm">← Tillbaka till grundskolerankningen</Link>
      </p>
    </article>
  );
}
