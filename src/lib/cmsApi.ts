import type { ImageAsset, SiteContent } from "./contentTypes";
import { isAnalyticsVisit, loadLocalAnalyticsVisits, saveLocalAnalyticsVisits } from "./analytics";
import { buildAnalyticsSummary, type AnalyticsSummary } from "./analyticsSummary";
import type { TrackingSite } from "./trackingTypes";
import {
  archiveLocalTrackingSite,
  deleteLocalTrackingSite,
  loadLocalTrackingSites,
  normalizeTrackingSite,
  saveLocalTrackingSites,
  upsertLocalTrackingSite
} from "./trackingStorage";
import { isLocalDemoRuntime } from "./runtimeMode";
import { loadPublishedContent, savePublishedContent } from "./storage";
import { normalizeSiteContent } from "./contentNormalize";
import { validateSiteContent } from "./contentValidation";
import { validateTrackingSite } from "./trackingValidation";

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

export type TrackingStorageStatus = {
  mode: "checking" | "server" | "local" | "unavailable";
  label: string;
  detail: string;
};

const authTokenStorageKey = "kingsvale-studio-auth-token-v1";
const trackingStorageStatusEvent = "kingsvale-tracking-storage-status";
const backupSessionError = "Backup requires an active server session.";

let authToken = "";
authToken = readStoredAuthToken();
let trackingStorageStatus: TrackingStorageStatus = {
  mode: "checking",
  label: "Checking tracking storage",
  detail: "Studio has not checked where tracking pages are being saved yet."
};

export function getTrackingStorageStatus() {
  return trackingStorageStatus;
}

export function subscribeTrackingStorageStatus(listener: (status: TrackingStorageStatus) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    listener((event as CustomEvent<TrackingStorageStatus>).detail);
  };
  window.addEventListener(trackingStorageStatusEvent, handler);
  return () => window.removeEventListener(trackingStorageStatusEvent, handler);
}

export async function loginServerSession(passphrase: string, username = "kingsvale", mfaCode = "") {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password: passphrase, mfaCode })
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

export type UploadedLetterFile = {
  name: string;
  url: string;
  contentType: string;
  bytes: number;
};

export async function uploadLetterFile(file: File): Promise<UploadedLetterFile | null> {
  try {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/uploads/letters", {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders(),
      body: formData
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { file: UploadedLetterFile };
    return payload.file;
  } catch {
    return null;
  }
}

export async function generateLetterFromTemplate(
  site: TrackingSite,
  publicLink: string
): Promise<UploadedLetterFile | null> {
  try {
    const generationSite = {
      ...site,
      letterFileUrl: site.letterFileUrl.startsWith("data:") ? "" : site.letterFileUrl
    };
    const response = await fetch("/api/letters/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({
        site: generationSite,
        templateUrl: generationSite.letterTemplateUrl,
        publicLink
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { file: UploadedLetterFile };
    return payload.file;
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
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Tracking sites require the secure server API.");
      }
      markTrackingStorageLocal();
      return loadLocalTrackingSites();
    }

    const payload = (await response.json()) as { sites: TrackingSite[]; storage?: string };
    markTrackingStorageServer(payload.storage);
    return payload.sites.map(normalizeTrackingSite);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Tracking sites require the secure server API.");
    }
    markTrackingStorageLocal();
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
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Tracking site could not be saved to the secure server.");
      }
      markTrackingStorageLocal();
      return upsertLocalTrackingSite(site);
    }

    const payload = (await response.json()) as { site: TrackingSite; storage?: string };
    markTrackingStorageServer(payload.storage);
    return normalizeTrackingSite(payload.site);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Tracking site could not be saved to the secure server.");
    }
    markTrackingStorageLocal();
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
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Tracking site could not be archived on the secure server.");
      }
      markTrackingStorageLocal();
      return archiveLocalTrackingSite(id);
    }

    const payload = (await response.json()) as { site: TrackingSite; storage?: string };
    markTrackingStorageServer(payload.storage);
    return normalizeTrackingSite(payload.site);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Tracking site could not be archived on the secure server.");
    }
    markTrackingStorageLocal();
    return archiveLocalTrackingSite(id);
  }
}

export async function deleteTrackingSite(id: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      credentials: "same-origin",
      headers: authHeaders()
    });

    if (!response.ok) {
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Tracking site could not be deleted on the secure server.");
      }
      markTrackingStorageLocal();
      return deleteLocalTrackingSite(id);
    }

    const payload = (await response.json()) as { site: TrackingSite; storage?: string };
    markTrackingStorageServer(payload.storage);
    return normalizeTrackingSite(payload.site);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Tracking site could not be deleted on the secure server.");
    }
    markTrackingStorageLocal();
    return deleteLocalTrackingSite(id);
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
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Council sync requires the secure server API.");
      }
      markTrackingStorageLocal();
      return markLocalCouncilSyncAttempt(id);
    }

    const payload = (await response.json()) as { site: TrackingSite; storage?: string };
    markTrackingStorageServer(payload.storage);
    return normalizeTrackingSite(payload.site);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Council sync requires the secure server API.");
    }
    markTrackingStorageLocal();
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
      if (!isLocalDemoRuntime()) {
        markTrackingStorageUnavailable();
        throw new Error("Postal tracking sync requires the secure server API.");
      }
      markTrackingStorageLocal();
      return markLocalPostalSyncAttempt(id);
    }

    const payload = (await response.json()) as { site: TrackingSite; storage?: string };
    markTrackingStorageServer(payload.storage);
    return normalizeTrackingSite(payload.site);
  } catch {
    if (!isLocalDemoRuntime()) {
      markTrackingStorageUnavailable();
      throw new Error("Postal tracking sync requires the secure server API.");
    }
    markTrackingStorageLocal();
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
  if (isLocalDemoRuntime() && !authToken) {
    return buildLocalFullBackup();
  }

  try {
    const response = await fetch("/api/backup", {
      credentials: "same-origin",
      headers: authHeaders({ Accept: "application/json" })
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(backupSessionError);
    }

    if (response.ok && isJsonResponse(response)) {
      const payload = (await response.json()) as { backup: KingsvaleBackup };
      return payload.backup;
    }
  } catch (error) {
    if (isBackupSessionError(error)) {
      throw error;
    }
    if (!isLocalDemoRuntime()) {
      throw error;
    }
    return buildLocalFullBackup();
  }

  if (isLocalDemoRuntime()) {
    return buildLocalFullBackup();
  }

  throw new Error("Backup could not be exported.");
}

export async function importFullBackup(backup: KingsvaleBackup, mode: "replace" | "merge") {
  if (isLocalDemoRuntime() && !authToken) {
    return importLocalFullBackup(backup, mode);
  }

  try {
    const response = await fetch("/api/backup", {
      method: "PUT",
      credentials: "same-origin",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({ backup, mode })
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(backupSessionError);
    }

    if (response.ok && isJsonResponse(response)) {
      return (await response.json()) as { ok: true; importedAt: string; mode: "replace" | "merge" };
    }
  } catch (error) {
    if (isBackupSessionError(error)) {
      throw error;
    }
    if (!isLocalDemoRuntime()) {
      throw error;
    }
    return importLocalFullBackup(backup, mode);
  }

  if (isLocalDemoRuntime()) {
    return importLocalFullBackup(backup, mode);
  }

  throw new Error("Backup could not be imported.");
}

async function buildLocalFullBackup(): Promise<KingsvaleBackup> {
  const now = new Date().toISOString();
  const published = loadPublishedContent();
  const trackingSites = await listTrackingSites();

  return {
    kind: "kingsvale-full-backup",
    version: 1,
    exportedAt: now,
    stores: {
      cms: {
        published,
        draft: published,
        revisions: [],
        updatedAt: now
      },
      tracking: {
        sites: trackingSites,
        updatedAt: now
      },
      analytics: {
        visits: loadLocalAnalyticsVisits(),
        updatedAt: now
      },
      leads: {
        contact: "",
        newsletter: ""
      }
    }
  };
}

async function importLocalFullBackup(backup: KingsvaleBackup, mode: "replace" | "merge") {
  const content = extractBackupContent(backup);
  const importedSites = extractBackupTrackingSites(backup);
  const importedVisits = extractBackupAnalyticsVisits(backup);

  await importLocalTrackingBackup(backup, importedSites, mode);
  savePublishedContent(content);
  saveLocalAnalyticsVisits(
    mode === "merge"
      ? dedupeVisits([...importedVisits, ...loadLocalAnalyticsVisits()]).slice(0, 500)
      : importedVisits.slice(0, 500)
  );

  return { ok: true as const, importedAt: new Date().toISOString(), mode };
}

function extractBackupContent(backup: KingsvaleBackup) {
  const cms = backup.stores.cms as { published?: SiteContent | null; draft?: SiteContent | null } | null;
  const candidate = cms?.published ?? cms?.draft;
  if (!candidate) {
    throw new Error("Backup does not include website content.");
  }

  const normalized = normalizeSiteContent(candidate);
  const validation = validateSiteContent(normalized);
  if (!validation.valid) {
    throw new Error("Backup website content is invalid.");
  }
  return normalized;
}

function extractBackupTrackingSites(backup: KingsvaleBackup) {
  return backup.stores.tracking.sites
    .map(normalizeTrackingSite)
    .filter((site) => validateTrackingSite(site).valid);
}

function extractBackupAnalyticsVisits(backup: KingsvaleBackup) {
  const analytics = backup.stores.analytics as { visits?: unknown[] } | null;
  return Array.isArray(analytics?.visits) ? analytics.visits.filter(isAnalyticsVisit) : [];
}

async function importLocalTrackingBackup(
  backup: KingsvaleBackup,
  importedSites: TrackingSite[],
  mode: "replace" | "merge"
) {
  try {
    const response = await fetch("/api/backup", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ backup, mode })
    });

    if (response.ok && isJsonResponse(response)) {
      markTrackingStorageServer("dev-file");
      return;
    }
  } catch {
    // Fall through to browser-only storage when no development API is available.
  }

  const existingSites = loadLocalTrackingSites();
  const nextSites = mode === "merge"
    ? [
        ...importedSites,
        ...existingSites.filter((site) => !importedSites.some((imported) => imported.id === site.id))
      ]
    : importedSites;
  saveLocalTrackingSites(nextSites);
  markTrackingStorageLocal();
}

function dedupeVisits(visits: ReturnType<typeof loadLocalAnalyticsVisits>) {
  const seen = new Set<string>();
  return visits.filter((visit) => {
    if (seen.has(visit.id)) {
      return false;
    }
    seen.add(visit.id);
    return true;
  });
}

function isJsonResponse(response: Response) {
  return response.headers.get("content-type")?.includes("application/json") ?? false;
}

function isBackupSessionError(error: unknown) {
  return error instanceof Error && error.message === backupSessionError;
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

function markTrackingStorageServer(storage?: string) {
  setTrackingStorageStatus({
    mode: "server",
    label: storage === "dev-file" ? "Development server storage active" : "Server storage active",
    detail: storage === "dev-file"
      ? "Tracking pages are saved to this Vite dev server and are visible across browser sessions on this machine."
      : "Tracking pages are saved through the secure server API and are visible to anyone with the public link."
  });
}

function markTrackingStorageLocal() {
  setTrackingStorageStatus({
    mode: "local",
    label: "Local browser storage only",
    detail: "Tracking pages are only saved in this browser. Links will not work in incognito, another browser, or another device."
  });
}

function markTrackingStorageUnavailable() {
  setTrackingStorageStatus({
    mode: "unavailable",
    label: "Server storage unavailable",
    detail: "Studio could not reach the tracking storage API, so tracking pages were not saved server-side."
  });
}

function setTrackingStorageStatus(status: TrackingStorageStatus) {
  trackingStorageStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(trackingStorageStatusEvent, { detail: status }));
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
