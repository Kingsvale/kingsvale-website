import type { Dispatch, SetStateAction } from "react";
import { listTrackingSites, saveTrackingSite } from "../lib/cmsApi";
import type { TrackingSite } from "../lib/trackingTypes";

export function useSiteFolders({ flush, setBusy, setSites, setDraft, setStatus }: {
  flush: () => Promise<boolean>; setBusy: Dispatch<SetStateAction<boolean>>;
  setSites: Dispatch<SetStateAction<TrackingSite[]>>; setDraft: Dispatch<SetStateAction<TrackingSite | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
}) {
  return async (ids: string[], folder: string) => {
    if (!await flush()) return false;
    setBusy(true);
    let moved = 0;
    try {
      // Read after flushing so moving a folder never writes an older draft.
      const latest = await listTrackingSites();
      for (const site of latest.filter((item) => ids.includes(item.id))) {
        const saved = await saveTrackingSite({ ...site, region: folder });
        moved++;
        setSites((current) => current.map((item) => item.id === saved.id ? saved : item));
        setDraft((current) => current?.id === saved.id ? { ...current, region: saved.region, updatedAt: saved.updatedAt } : current);
      }
      setStatus(`${moved} ${moved === 1 ? "site moved" : "sites moved"} to ${folder}.`);
      return true;
    } catch {
      setStatus(`Moved ${moved} of ${ids.length} sites. The remaining records could not be saved; please retry.`);
      return false;
    } finally { setBusy(false); }
  };
}
