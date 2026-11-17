import { useEffect, useRef, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";

export function useDraftHistory(draft: SiteContent, setDraft: (draft: SiteContent) => void) {
  const past = useRef<SiteContent[]>([]), future = useRef<SiteContent[]>([]);
  const previous = useRef(draft), changedAt = useRef(0), skip = useRef(false);
  const [, redraw] = useState(0);
  useEffect(() => {
    if (draft === previous.current) return;
    if (skip.current) skip.current = false;
    else {
      if (Date.now() - changedAt.current > 700 || !past.current.length) past.current = [...past.current.slice(-29), previous.current];
      future.current = [];
      changedAt.current = Date.now();
    }
    previous.current = draft; redraw(count => count + 1);
  }, [draft]);
  function move(back: boolean) {
    const source = back ? past : future, destination = back ? future : past;
    const next = source.current.at(-1); if (!next) return;
    source.current = source.current.slice(0, -1); destination.current = [...destination.current, draft];
    skip.current = true; changedAt.current = 0; setDraft(next);
  }
  function reset(next: SiteContent) { past.current = []; future.current = []; previous.current = next; skip.current = false; changedAt.current = 0; setDraft(next); redraw(count => count + 1); }
  return { undo: () => move(true), redo: () => move(false), canUndo: Boolean(past.current.length), canRedo: Boolean(future.current.length), reset };
}
