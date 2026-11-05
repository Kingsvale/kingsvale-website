import type { TrackingSite } from "./trackingTypes";

type SiteNotes = Pick<TrackingSite, "privateNotes" | "mailingNotes">;
export const siteNotesMaxLength: 3000;
export function sharedSiteNotes(site: Partial<SiteNotes>, previous?: SiteNotes): SiteNotes;
