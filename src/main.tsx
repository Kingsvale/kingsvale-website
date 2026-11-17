import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./project-images.css";
import { readContentBootstrap, setInitialContent } from "./lib/contentBootstrap";
import { fetchServerContent } from "./lib/serverContent";
import { isStudioPreviewRequest } from "./lib/studioPreview";

const rootElement = document.getElementById("root")!;
async function start() {
  const bootstrap = readContentBootstrap();
  setInitialContent(bootstrap?.content ?? (bootstrap ? null : await fetchServerContent()));
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  if (rootElement.hasChildNodes() && !isStudioPreviewRequest()) {
    hydrateRoot(rootElement, app);
  } else {
    createRoot(rootElement).render(app);
  }
}
void start();
