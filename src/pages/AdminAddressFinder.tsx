import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { lookupPropertyAddresses } from "../lib/cmsApi";
import type { TrackingAddressParts, TrackingSite } from "../lib/trackingTypes";
import { buildAddressFromParts } from "../lib/trackingNormalize";

const compact = (value: string) => value.toUpperCase().replace(/\s/g, "");
export function AdminAddressFinder({ postcode, sites, onApply }: {
  postcode: string; sites: TrackingSite[]; onApply: (address: TrackingAddressParts) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(postcode);
  useEffect(() => setQuery(postcode), [postcode]);
  const [results, setResults] = useState<TrackingAddressParts[]>([]);
  const [resultPostcode, setResultPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState("");
  const request = useRef<AbortController | null>(null);
  const normalized = compact(query);
  const valid = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normalized);
  useEffect(() => {
    request.current?.abort(); setResults([]); setResultPostcode(""); setMessage(""); setSelection(""); setBusy(false);
    return () => request.current?.abort();
  }, [normalized]);
  const addresses = new Map<string, { address: TrackingAddressParts; saved: boolean }>();
  for (const address of resultPostcode === normalized ? results : []) addresses.set(buildAddressFromParts(address).toLowerCase(), { address, saved: false });
  for (const site of sites) if (valid && compact(site.siteAddressParts.postcode) === normalized) {
    addresses.set(buildAddressFromParts(site.siteAddressParts).toLowerCase(), { address: site.siteAddressParts, saved: true });
  }
  const choices = [...addresses.entries()].sort(([, a], [, b]) => a.address.line1.localeCompare(b.address.line1, "en", { numeric: true }));
  async function search() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage(""); setSelection("");
    try {
      const result = await lookupPropertyAddresses(query, controller.signal);
      if (controller.signal.aborted) return;
      setResults(result.addresses); setResultPostcode(normalized);
      setMessage(result.addresses.length ? "Choose a property below, then check its postal details." : "No extra mapped properties were found. Choose a saved address below or enter the property manually.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Address search is unavailable.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="address-finder">
    <div className="address-finder__title"><MapPin aria-hidden="true" /><strong>Find a property by postcode</strong><span>Free suggestions</span></div>
    <div className="address-finder__search"><label className="admin-field" htmlFor={id}><span className="admin-field__label">Postcode to search</span><input id={id} aria-label="Postcode to search" value={query} placeholder="e.g. SL4 5HS" maxLength={12} autoComplete="postal-code" onChange={(event) => setQuery(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (valid && !busy) void search(); } }} /></label>
      <button type="button" className="admin-small" disabled={!valid || busy} onClick={() => void search()}><Search aria-hidden="true" />{busy ? "Searching…" : "Find addresses"}</button></div>
    {choices.length > 0 && <div className="address-finder__choose"><label className="admin-field"><span className="admin-field__label">Known property addresses ({choices.length})</span><select aria-label="Choose a property address" value={selection} onChange={(event) => setSelection(event.target.value)}><option value="">Choose an address</option>{choices.map(([key, item]) => <option value={key} key={key}>{buildAddressFromParts(item.address)}{item.saved ? " — saved in Studio" : " — mapped address"}</option>)}</select></label>
      <button type="button" className="admin-small" disabled={!addresses.has(selection)} onClick={() => { const selected = addresses.get(selection); if (selected) { onApply({ ...selected.address }); setMessage("Address filled. Check the details and complete any empty fields."); } }}>Use this address</button></div>}
    {message && <p role="status">{message}</p>}
    <small>Suggestions use your saved addresses and available <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> data. Coverage is incomplete; this is not a list of every property. You can always enter an address below.</small>
  </div>;
}
