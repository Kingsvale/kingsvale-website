export function formatPostcode(value) {
  const compact = String(value ?? "").replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return "";
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
export function mappedAddresses(elements, postcode) {
  const found = new Map();
  for (const { tags = {} } of (Array.isArray(elements) ? elements : []).slice(0, 200)) {
    if (formatPostcode(tags["addr:postcode"]) !== postcode) continue;
    const number = clean(tags["addr:housenumber"], 30);
    const house = clean(tags["addr:housename"], 70);
    const street = clean(tags["addr:street"] || tags["addr:place"], 70);
    if ((!number && !house) || !street) continue;
    const address = {
      line1: [number, house || street].filter(Boolean).join(" ").slice(0, 90),
      line2: house ? street : "",
      town: clean(tags["addr:city"] || tags["addr:town"] || tags["addr:village"], 70),
      county: clean(tags["addr:county"], 70), postcode
    };
    // Retain explicit unit numbers; never manufacture addresses from a range.
    if (tags["addr:flats"] && !tags["addr:unit"]) continue;
    const unit = clean(tags["addr:unit"], 30);
    if (unit) { address.line2 = [address.line1, address.line2].filter(Boolean).join(", ").slice(0, 90); address.line1 = `Unit ${unit}`; }
    const key = [address.line1, address.line2, postcode].join("|").toLowerCase();
    found.set(key, address);
  }
  return [...found.values()].sort((a, b) => a.line1.localeCompare(b.line1, "en", { numeric: true }));
}

export function createAddressLookup({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  let pending = false;
  let lastRequest = -Infinity;
  return async (value) => {
    const postcode = formatPostcode(value);
    if (!postcode) return { status: 400, error: "Enter a complete UK postcode, such as SL4 5HS." };
    const cached = cache.get(postcode);
    if (cached && cached.until > now()) return { status: 200, ...cached.result };
    if (pending || now() - lastRequest < 3000) return { status: 429, error: "Please wait a few seconds before searching again." };
    pending = true; lastRequest = now();
    try {
      const compact = postcode.replace(" ", "");
      const query = `[out:json][timeout:12];(nwr["addr:postcode"="${postcode}"];nwr["addr:postcode"="${compact}"];);out tags 200;`;
      const response = await fetchImpl("https://overpass-api.de/api/interpreter", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "KingsvaleStudio/1.0 (https://kingsvalehomes.co.uk)" },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error("Address source unavailable");
      const payload = await response.json();
      if (payload.remark || !Array.isArray(payload.elements)) throw new Error("Incomplete lookup");
      const result = { postcode, addresses: mappedAddresses(payload.elements, postcode), partial: true, source: "OpenStreetMap" };
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(postcode, { until: now() + 24 * 60 * 60 * 1000, result });
      return { status: 200, ...result };
    } catch {
      return { status: 503, error: "Open address search is temporarily unavailable. Use a saved address or enter the property manually." };
    } finally { pending = false; }
  };
}
