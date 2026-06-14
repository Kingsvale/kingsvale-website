import { useEffect, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { loadPublishedContent } from "../lib/storage";
import { fetchServerContent } from "../lib/serverContent";
import {
  isStudioPreviewRequest,
  loadStudioPreviewContent,
  normalizeStudioPreviewContent,
  studioPreviewMessageType,
  type StudioPreviewMessage
} from "../lib/studioPreview";

export function useSiteContent() {
  const [content, setContent] = useState<SiteContent>(() => loadStudioPreviewContent() ?? loadPublishedContent());

  useEffect(() => {
    let active = true;
    const isPreview = isStudioPreviewRequest();

    if (isPreview) {
      const handlePreviewMessage = (event: MessageEvent<StudioPreviewMessage>) => {
        if (event.origin !== window.location.origin || event.data?.type !== studioPreviewMessageType) {
          return;
        }

        try {
          const previewContent = normalizeStudioPreviewContent(event.data.content);
          setContent(previewContent);
        } catch {
          // Ignore malformed preview messages; the Studio keeps the last good draft visible.
        }
      };

      window.addEventListener("message", handlePreviewMessage);
      return () => {
        active = false;
        window.removeEventListener("message", handlePreviewMessage);
      };
    }

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
