import type { ImageAsset, SiteContent } from "./contentTypes";
import { loadLocalAnalyticsVisits } from "./analytics";
import { buildAnalyticsSummary, type AnalyticsSummary } from "./analyticsSummary";
import type { TrackingSite } from "./trackingTypes";
import {
  archiveLocalTrackingSite,
  loadLocalTrackingSites,
  normalizeTrackingSite,
  upsertLocalTrackingSite
} from "./trackingStorage";

type StudioSession = {
  authenticated: boolean;
  user: { name: string; role: string };
  authToken?: string;
  expiresAt: string;
};

type RevisionSummary = {
  id: string;
  createdAt: string;
  user: string;
  title: string;
};

const authTokenStorageKey = "kingsvale-studio-auth-token-v1";

let authToken = "";
authToken = readStoredAuthToken();

export async function loginServerSession(passphrase: string, username = "kingsvale") {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password: passphrase })
    });

    if (!response.ok) {
      clearStoredAuthToken();
      return null;
    }

    const session = (await response.json()) as StudioSession;
    if (session.authToken) {
      storeAuthToken(session.authToken, session.expiresAt);
    }
    return session;
  } catch {
    clearStoredAuthToken();
    return null;
  }
}

export async function getServerSession() {
  if (!authToken) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: authHeaders({ Accept: "application/json" })
    });

    if (!response.ok) {
      clearStoredAuthToken();
      return null;
    }

    const session = (await response.json()) as StudioSession;
    return session;
  } catch {
    clearStoredAuthToken();
    return null;
  }
}

export async function logoutServerSession() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders()
    });
  } finally {
    clearStoredAuthToken();
  }
}

export async function fetchCmsDraft() {
  const response = await fetch("/api/cms/draft", {
    credentials: "same-origin",
    headers: authHeaders({ Accept: "application/json" })
  });
  if (!response.ok) {
    throw new Error("CMS draft could not be loaded.");
  }
  return (await response.json()) as {
    draft: SiteContent | null;
    published: SiteContent | null;
    updatedAt: string | null;
  };
}

export async function saveCmsDraft(content: SiteContent) {
  const response = await fetch("/api/cms/draft", {
    method: "PUT",
    credentials: "same-origin",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    throw new Error("CMS draft could not be saved.");
  }
}

export async function publishCmsContent(content: SiteContent) {
  const response = await fetch("/api/cms/publish", {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    throw new Error("CMS content could not be published.");
  }
}

export async function listCmsRevisions() {
  const response = await fetch("/api/cms/revisions", {
    credentials: "same-origin",
    headers: authHeaders({ Accept: "application/json" })
  });
  if (!response.ok) {
    return [] as RevisionSummary[];
  }
  const payload = (await response.json()) as { revisions: RevisionSummary[] };
  return payload.revisions;
}

export async function restoreCmsRevision(id: string) {
  const response = await fetch(`/api/cms/revisions/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("Revision could not be restored.");
  }
  return (await response.json()) as { content: SiteContent };
}

export async function uploadCmsImage(file: File): Promise<ImageAsset | null> {
  try {
    const formData = new FormData();
    formData.set("image", file);
    const response = await fetch("/api/uploads/images", {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders(),
      body: formData
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { image: ImageAsset };
    return payload.image;
  } catch {
    return null;
  }
}

export async function listTrackingSites(): Promise<TrackingSite[]> {
  try {
    const response = await fetch("/api/tracking-sites", {
      credentials: "same-origin",
      headers: authHeaders({ Accept: "application/json" })
    });

    if (!response.ok) {
      return loadLocalTrackingSites();
    }

    const payload = (await response.json()) as { sites: TrackingSite[] };
    return payload.sites.map(normalizeTrackingSite);
  } catch {
    return loadLocalTrackingSites();
  }
}

export async function saveTrackingSite(site: TrackingSite): Promise<TrackingSite> {
  try {
    const response = await fetch("/api/tracking-sites", {
      method: "PUT",
      credentials: "same-origin",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ site })
    });

    if (!response.ok) {
      return upsertLocalTrackingSite(site);
    }

    const payload = (await response.json()) as { site: TrackingSite };
    return normalizeTrackingSite(payload.site);
  } catch {
    return upsertLocalTrackingSite(site);
  }
}

export async function archiveTrackingSite(id: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders()
    });

    if (!response.ok) {
      return archiveLocalTrackingSite(id);
    }

    const payload = (await response.json()) as { site: TrackingSite };
    return normalizeTrackingSite(payload.site);
  } catch {
    return archiveLocalTrackingSite(id);
  }
}

export async function checkTrackingCouncilStatus(id: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(id)}/sync`, {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders()
    });

    if (!response.ok) {
      return markLocalCouncilSyncAttempt(id);
    }

    const payload = (await response.json()) as { site: TrackingSite };
    return normalizeTrackingSite(payload.site);
  } catch {
    return markLocalCouncilSyncAttempt(id);
  }
}

export async function checkMailingTrackingStatus(id: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(id)}/postal-sync`, {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders()
    });

    if (!response.ok) {
      return markLocalPostalSyncAttempt(id);
    }

    const payload = (await response.json()) as { site: TrackingSite };
    return normalizeTrackingSite(payload.site);
  } catch {
    return markLocalPostalSyncAttempt(id);
  }
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  try {
    const response = await fetch("/api/analytics/summary", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return buildAnalyticsSummary(loadLocalAnalyticsVisits());
    }

    const payload = (await response.json()) as { summary: AnalyticsSummary };
    return payload.summary;
  } catch {
    return buildAnalyticsSummary(loadLocalAnalyticsVisits());
  }
}

export type KingsvaleBackup = {
  kind: "kingsvale-full-backup";
  version: number;
  exportedAt: string;
  stores: {
    cms: unknown;
    tracking: { sites: TrackingSite[]; updatedAt: string | null };
    analytics: unknown;
    leads: { contact: string; newsletter: string };
  };
};

export async function exportFullBackup(): Promise<KingsvaleBackup> {
  const response = await fetch("/api/backup", {
    credentials: "same-origin",
    headers: authHeaders({ Accept: "application/json" })
  });
  if (!response.ok) {
    throw new Error("Backup could not be exported.");
  }
  const payload = (await response.json()) as { backup: KingsvaleBackup };
  return payload.backup;
}

export async function importFullBackup(backup: KingsvaleBackup, mode: "replace" | "merge") {
  const response = await fetch("/api/backup", {
    method: "PUT",
    credentials: "same-origin",
    headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify({ backup, mode })
  });
  if (!response.ok) {
    throw new Error("Backup could not be imported.");
  }
  return (await response.json()) as { ok: true; importedAt: string; mode: "replace" | "merge" };
}

function authHeaders(headers: Record<string, string> = {}) {
  return authToken
    ? { ...headers, Authorization: `Bearer ${authToken}` }
    : headers;
}

function readStoredAuthToken() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(authTokenStorageKey) ?? "null") as {
      token?: string;
      expiresAt?: string;
    } | null;
    if (!stored?.token || !stored.expiresAt || new Date(stored.expiresAt).getTime() <= Date.now()) {
      clearStoredAuthToken();
      return "";
    }
    return stored.token;
  } catch {
    clearStoredAuthToken();
    return "";
  }
}

function storeAuthToken(token: string, expiresAt: string) {
  authToken = token;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(authTokenStorageKey, JSON.stringify({ token, expiresAt }));
  }
}

function clearStoredAuthToken() {
  authToken = "";
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(authTokenStorageKey);
  }
}

function markLocalCouncilSyncAttempt(id: string) {
  const site = loadLocalTrackingSites().find((item) => item.id === id);
  if (!site) {
    return null;
  }

  return upsertLocalTrackingSite({
    ...site,
    council: {
      ...site.council,
      lastCheckedAt: new Date().toISOString(),
      lastSyncStatus: "Connector shell only. Configure a council API to automate updates."
    }
  });
}

function markLocalPostalSyncAttempt(id: string) {
  const site = loadLocalTrackingSites().find((item) => item.id === id);
  if (!site) {
    return null;
  }

  return upsertLocalTrackingSite({
    ...site,
    trackingStatus: site.royalMailTrackingNumber ? "Tracking API not configured" : "No Royal Mail tracking number",
    trackingLastCheckedAt: new Date().toISOString(),
    mailingLastUpdatedAt: new Date().toISOString()
  });
}
