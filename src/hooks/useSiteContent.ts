import { useEffect, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { loadPublishedContent } from "../lib/storage";
import { fetchServerContent } from "../lib/serverContent";

export function useSiteContent() {
  const [content, setContent] = useState<SiteContent>(() => loadPublishedContent());

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const serverContent = await fetchServerContent();
      if (!active) {
        return;
      }
      setContent(serverContent ?? loadPublishedContent());
    };

    const handleUpdate = () => {
      void refresh();
    };

    void refresh();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("kingsvale-content-updated", handleUpdate);
    return () => {
      active = false;
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("kingsvale-content-updated", handleUpdate);
    };
  }, []);

  return content;
}
