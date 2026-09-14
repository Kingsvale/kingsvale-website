import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseKml } from "./kmlImport";
import { cleanLandMap, publicLandMap, validateLandMap } from "./landMap";
import { normalizePublicTrackingSite } from "./trackingLocalRead";

const fixture = readFileSync("tests/fixtures/plot.kml", "utf8");

describe("KML land maps", () => {
  it("imports a Searchland-style polygon despite fill being disabled, preserving its coordinates", () => {
    const result = parseKml(fixture);
    expect(result.titleNumber).toBe("TEST-PLOT-001");
    expect(result.map.selection).toEqual(result.map.boundary);
    expect(result.map.selection[0].coordinates[0][0]).toEqual([0.1, 51.5]);
    expect(validateLandMap(result.map)).toBeNull();
    expect(normalizePublicTrackingSite({ landMap: result.map }).landMap?.selection).toEqual(result.map.selection);
  });

  it("preserves multiple polygons and holes with namespaced XML", () => {
    const ring = "0,51 1,51 1,52 0,51";
    const xml = `<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Placemark><k:MultiGeometry>${[1, 2].map(() => `<k:Polygon><k:outerBoundaryIs><k:LinearRing><k:coordinates>${ring}</k:coordinates></k:LinearRing></k:outerBoundaryIs><k:innerBoundaryIs><k:LinearRing><k:coordinates>0.6,51.1 0.8,51.1 0.8,51.2 0.6,51.1</k:coordinates></k:LinearRing></k:innerBoundaryIs></k:Polygon>`).join("")}</k:MultiGeometry></k:Placemark></k:kml>`;
    const { map } = parseKml(xml);
    expect(map.selection).toHaveLength(2);
    expect(map.selection[0].coordinates).toHaveLength(2);
  });

  it.each([
    "<kml>", "<html></html>", "<kml><Point><coordinates>1,51</coordinates></Point></kml>",
    '<!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml/>',
    fixture.replace("0.1,51.5", "NaN,51.5"),
    fixture.replace("0.1,51.5", "999,51.5")
  ])("rejects malformed or unsafe KML without producing a replacement map", (xml) => {
    expect(() => parseKml(xml)).toThrow();
  });

  it("validates stored geometry and strips all embedded metadata from public data", () => {
    const { map } = parseKml(fixture);
    const dirty = { ...map, privateNotes: "secret", selection: map.selection.map((p) => ({ ...p, properties: { html: "<script>" } })) };
    expect(cleanLandMap(dirty)).toEqual(map);
    expect(publicLandMap(dirty)?.boundary).toEqual([]);
    expect(publicLandMap({ ...map, showBoundary: true })?.boundary).toEqual(map.boundary);
    expect(validateLandMap({ ...map, selection: [] })).toBeTruthy();
    expect(validateLandMap({ ...map, selection: Array(101).fill(map.selection[0]) })).toBeTruthy();
    expect(validateLandMap({ ...map, selection: [{ type: "Polygon", coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]] }] })).toBeTruthy();
  });
});
