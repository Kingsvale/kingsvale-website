import type { TrackingSite } from "./trackingTypes";

export type MailingSortMode = "sites" | "priority" | "reminder" | "updated";
export type SiteGroupMode = "folder" | "town" | "postcode";

const mailingSortKey = "kingsvale-mailing-sort-v1";
const siteGroupKey = "kingsvale-site-group-v1";

export function loadMailingSortMode() {
  return readPreference<MailingSortMode>(mailingSortKey, ["sites", "priority", "reminder", "updated"], "sites");
}

export function rememberMailingSortMode(mode: MailingSortMode) {
  rememberPreference(mailingSortKey, mode);
}

export function loadSiteGroupMode() {
  return readPreference<SiteGroupMode>(siteGroupKey, ["folder", "town", "postcode"], "folder");
}

export function rememberSiteGroupMode(mode: SiteGroupMode) {
  rememberPreference(siteGroupKey, mode);
}

// Use one order in both lists, including a consistent order for imported sites
// whose update timestamps are identical.
export function sortSites(sites: TrackingSite[]) {
  return [...sites].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)
    || left.reference.localeCompare(right.reference, undefined, { numeric: true })
    || left.id.localeCompare(right.id));
}

function readPreference<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return choices.includes(value as T) ? value as T : fallback;
  } catch { return fallback; }
}

function rememberPreference(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Lists still work when browser storage is unavailable. */ }
}
