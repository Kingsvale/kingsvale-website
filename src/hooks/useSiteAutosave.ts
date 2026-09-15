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
  const fingerprint = siteFingerprint(options.draft);
  const dirty = fingerprint !== siteFingerprint(options.saved);
  useEffect(() => { if (options.draft) rememberWorkflowSite(options.draft.id); }, [options.draft?.id]);

  const flush = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    const run = async () => {
      let acknowledged = siteFingerprint(latest.current.saved);
      while (latest.current.draft && siteFingerprint(latest.current.draft) !== acknowledged) {
        const current = latest.current;
        if (!current.valid) {
          if (mounted.current) setError("Complete the highlighted details to save your changes.");
          return false;
        }
        const snapshot = structuredClone(current.draft!);
        if (mounted.current) { setSaving(true); setError(""); }
        try {
          const { site } = await saveTrackingSiteWithResult(snapshot);
          acknowledged = siteFingerprint(snapshot);
          if (mounted.current) latest.current.onSaved(site, snapshot);
          // Don't let a response for one site replace another selected site.
          if (latest.current.draft?.id !== snapshot.id) return true;
        } catch {
          if (mounted.current) setError("Could not save. Your changes are still here. Check your connection and retry.");
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

  return { dirty, saving, error, flush, label: saving ? "Saving changes…" : options.blocked ? "Finishing the current operation…" : dirty ? error || (options.valid ? "Changes will save automatically…" : "Complete the highlighted details to save") : "All changes saved" };
}
