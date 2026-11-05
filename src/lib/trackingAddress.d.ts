import type { TrackingAddressParts, TrackingSite } from "./trackingTypes";

export function parseTrackingAddress(value?: string): TrackingAddressParts;
export function publicTrackingAddress(site: Partial<TrackingSite>): {
  siteAddress: string;
  siteAddressParts: TrackingAddressParts | undefined;
};
