import { test } from "node:test";
import assert from "node:assert/strict";
import { createAddressLookup, formatPostcode, mappedAddresses } from "../../server/address-lookup.mjs";
const property = { tags: { "addr:postcode": "SL4 5HS", "addr:housenumber": "6", "addr:street": "Petworth Court", "addr:city": "Windsor" } };
test("normalizes postcodes and rejects injected or partial queries", () => {
  assert.equal(formatPostcode("sl4 5hs"), "SL4 5HS");
  assert.equal(formatPostcode('SL4";out;'), "");
  assert.equal(formatPostcode("SL4"), "");
});
test("only returns matching, explicitly mapped properties and deduplicates them", () => {
  const addresses = mappedAddresses([property, property, { tags: { "addr:postcode": "SL4 5HS", "addr:street": "Helston Lane" } }, { tags: { ...property.tags, "addr:postcode": "RG23 7DZ" } }], "SL4 5HS");
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].line1, "6 Petworth Court");
  assert.equal(addresses[0].county, "");
});
test("caches successful postcode searches and declares incomplete coverage", async () => {
  let calls = 0;
  const lookup = createAddressLookup({ fetchImpl: async (_url, options) => {
    calls++;
    assert.ok(String(options.body).includes("SL4"));
    return Response.json({ elements: [property] });
  } });
  const result = await lookup("sl45hs");
  assert.equal(result.status, 200);
  assert.equal(result.partial, true);
  await lookup("SL4 5HS");
  assert.equal(calls, 1);
});
test("rate limits uncached searches and reports upstream outages without inventing data", async () => {
  const lookup = createAddressLookup({ fetchImpl: async () => { throw new Error("upstream"); } });
  assert.equal((await lookup("invalid")).status, 400);
  assert.equal((await lookup("SL4 5HS")).status, 503);
  assert.equal((await lookup("RG23 7DZ")).status, 429);
});
