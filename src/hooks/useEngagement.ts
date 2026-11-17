import { useCallback, useEffect, useState } from "react";
import { studioRequest } from "../lib/cmsApi";

export type QrEngagement = { siteId: string; title: string; reference: string; archived: boolean; viewed: boolean; uniqueNetworks: number; views: number; firstViewedAt: string | null; lastViewedAt: string | null; viewedLatestUpdate: boolean };
export type EngagementData = { sites: QrEngagement[]; settings: { retentionDays: number; addressReliable: boolean; addressSource: string; currentNetworkExcluded: boolean; exclusions: { id: string; label: string; automatic: boolean; createdAt: string }[] } };
export function useEngagement() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try { setData(await studioRequest<EngagementData>("engagement")); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "QR views unavailable."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  return { data, error, busy, refresh, bySite: new Map(data?.sites.map(site => [site.siteId, site]) ?? []) };
}
