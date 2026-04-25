export function SuppressionNote() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Om datan</p>
      <p className="mt-1">
        Skolverket maskerar andelar med <code className="px-1 bg-white border rounded">.</code> eller <code className="px-1 bg-white border rounded">..</code> när gruppen är för liten (integritetsskydd). Dessa rader räknas inte in i aggregaten men syns i detaljerade tabeller som <em>maskerat</em>.
      </p>
      <p className="mt-2">
        Huvudman-aggregatet är ett viktat medel: varje andel vägs med radens elevantal. Stora skolor/prov väger mer än små.
      </p>
    </div>
  );
}
