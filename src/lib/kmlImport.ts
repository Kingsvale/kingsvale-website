import { validateLandMap, type LandMap, type LandPolygon, type MapPosition } from "./landMap";

export const MAX_KML_BYTES = 5_000_000;

export function parseKml(text: string): { map: LandMap; titleNumber: string; address: string } {
  if (new TextEncoder().encode(text).length > MAX_KML_BYTES) throw new Error("Choose a KML file smaller than 5 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("This KML contains unsupported XML declarations.");
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length || xml.documentElement.localName !== "kml") {
    throw new Error("This file is not valid KML. Export the plot as a .kml file and try again.");
  }
  const descendants = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS("*", name));
  const polygons: LandPolygon[] = descendants(xml, "Polygon").map((polygon) => {
    const outer = descendants(polygon, "outerBoundaryIs");
    if (outer.length !== 1) throw new Error("A polygon in this KML has no valid outer boundary.");
    const rings = [...outer, ...descendants(polygon, "innerBoundaryIs")].map((boundary) => {
      const raw = descendants(boundary, "coordinates")[0]?.textContent?.trim();
      if (!raw) throw new Error("A polygon in this KML has no coordinates.");
      const ring: MapPosition[] = raw.split(/\s+/).map((tuple) => {
        const parts = tuple.split(",");
        if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) throw new Error("The KML contains an incomplete coordinate.");
        return [Number(parts[0]), Number(parts[1])];
      });
      const first = ring[0], last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([...first]);
      return ring;
    });
    return { type: "Polygon", coordinates: rings };
  });
  if (!polygons.length) throw new Error("No plot boundaries found. Export a KML containing a polygon, rather than a pin or link.");
  const map: LandMap = { version: 1, basemap: "satellite", showBoundary: false, boundary: polygons, selection: structuredClone(polygons) };
  const error = validateLandMap(map);
  if (error) throw new Error(error);
  const field = (name: string) => {
    const simple = descendants(xml, "SimpleData").find((el) => el.getAttribute("name") === name);
    const data = descendants(xml, "Data").find((el) => el.getAttribute("name") === name);
    return (simple?.textContent ?? (data ? descendants(data, "value")[0]?.textContent : "") ?? "").trim();
  };
  return { map, titleNumber: field("title_number").slice(0, 80), address: field("address").slice(0, 160) };
}
