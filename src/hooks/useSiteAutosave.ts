import { useCallback, useEffect, useRef, useState } from "react";
import { saveTrackingSiteWithResult } from "../lib/cmsApi";
import { registerWorkflowGuard, rememberWorkflowSite } from "../lib/workflowNavigation";
import type { TrackingSite } from "../lib/trackingTypes";

export function siteFingerprint(site: TrackingSite | null | undefined) {
  return site ? JSON.stringify({ ...site, updatedAt: "", mailingLastUpdatedAt: "" }) : "";
}

type Options = {
  draft: TrackingSite | null;
  saved: TrackingSite | undefined;
  valid: boolean;
  blocked: boolean;
  onSaved: (saved: TrackingSite, snapshot: TrackingSite) => void;
};

export function useSiteAutosave(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const pending = useRef<Promise<boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const acknowledgedSite = useRef<TrackingSite | null>(null);
  const fingerprint = siteFingerprint(options.draft);
  const dirty = fingerprint !== siteFingerprint(options.saved);
  useEffect(() => { if (options.draft) rememberWorkflowSite(options.draft.id); }, [options.draft?.id]);

  const flush = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    const run = async () => {
      let acknowledged = siteFingerprint(latest.current.saved);
      let acknowledgedTimestamp = latest.current.saved?.updatedAt;
      while (latest.current.draft && siteFingerprint(latest.current.draft) !== acknowledged) {
        const current = latest.current;
        if (!current.valid) {
          if (mounted.current) setError("Complete the highlighted details to save your changes.");
          return false;
        }
        const snapshot = structuredClone(current.draft!);
        if (acknowledgedTimestamp) snapshot.updatedAt = acknowledgedTimestamp;
        if (mounted.current) { setSaving(true); setError(""); }
        try {
          const { site } = await saveTrackingSiteWithResult(snapshot);
          acknowledged = siteFingerprint(snapshot);
          acknowledgedTimestamp = site.updatedAt;
          acknowledgedSite.current = site;
          if (mounted.current) latest.current.onSaved(site, snapshot);
          // Don't let a response for one site replace another selected site.
          if (latest.current.draft?.id !== snapshot.id) return true;
        } catch (error) {
          if (mounted.current) setError(error instanceof Error ? `Could not save. ${error.message} Your changes are still here.` : "Could not save. Your changes are still here. Check your connection and retry.");
          return false;
        }
      }
      return true;
    };
    pending.current = run().finally(() => {
      pending.current = null;
      if (mounted.current) setSaving(false);
    });
    return pending.current;
  }, []);

  useEffect(() => {
    if (!dirty || options.blocked || !options.valid) return;
    const timer = window.setTimeout(() => { void flush(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [fingerprint, dirty, options.blocked, options.valid, flush]);

  useEffect(() => {
    mounted.current = true;
    const unregister = registerWorkflowGuard(async () => {
      if (latest.current.blocked) {
        setError("Please wait for the current upload or letter operation to finish.");
        return false;
      }
      return flush();
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current || latest.current.blocked || siteFingerprint(latest.current.draft) !== siteFingerprint(latest.current.saved)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { mounted.current = false; unregister(); window.removeEventListener("beforeunload", beforeUnload); };
  }, [flush]);

  async function savedSnapshot() {
    if (!await flush()) return null;
    const current = latest.current;
    const acknowledged = acknowledgedSite.current?.id === current.draft?.id ? acknowledgedSite.current : null;
    const saved = acknowledged && (!current.saved || acknowledged.updatedAt >= current.saved.updatedAt) ? acknowledged : current.saved;
    return saved ? structuredClone(saved) : null;
  }
  return { dirty, saving, error, flush, savedSnapshot, label: saving ? "Saving changes…" : options.blocked ? "Finishing the current operation…" : dirty ? error || (options.valid ? "Changes will save automatically…" : "Complete the highlighted details to save") : "All changes saved" };
}
