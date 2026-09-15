import { useEffect, useRef, useState } from "react";
import { previewLetterDocument } from "../lib/cmsApi";
import { isLocalDemoRuntime } from "../lib/runtimeMode";

type DocumentFile = { url: string; name: string };

// Keep uploaded Word styles and links isolated from Studio. No third-party viewer
// receives the document or its recipient details.
const previewShell = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>body{margin:0;background:#e9e7e2}#pages{transform-origin:top left}.docx-wrapper{padding:24px!important}section.docx{box-shadow:0 2px 12px #0001!important}a{pointer-events:none}</style></head><body><div id="pages"></div></body></html>`;

export function AdminDocumentPreview({ file, onClose }: { file: DocumentFile; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading preview…");
  const [failed, setFailed] = useState(false);
  const [renderedPages, setRenderedPages] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const isDocx = /\.docx$/i.test(file.name) || file.url.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const isPdf = /\.pdf$/i.test(file.name);
  const isImage = /\.(png|jpe?g|webp)$/i.test(file.name);
  const safeUrl = file.url.startsWith("/media/") || file.url.startsWith("/templates/") || /^data:(application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/pdf|image\/(png|jpeg|webp));base64,/.test(file.url);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);

  useEffect(() => {
    if (!ready || (!isDocx && !isPdf) || !safeUrl) return;
    const controller = new AbortController();
    let active = true;
    let resize: ResizeObserver | undefined;
    async function render() {
      try {
        try {
          const preview = await previewLetterDocument(file.url);
          if (active) {
            setRenderedPages(preview.pages);
            setStatus(`${preview.pageCount} ${preview.pageCount === 1 ? "page" : "pages"} · Print layout preview`);
          }
          return;
        } catch (error) {
          if (!isLocalDemoRuntime() || isPdf) throw error;
        }
        const [response, { renderAsync }] = await Promise.all([
          fetch(file.url, { credentials: "same-origin", signal: controller.signal }),
          import("docx-preview")
        ]);
        if (!response.ok) throw new Error("Document unavailable");
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 12_000_000) throw new Error("Document too large");
        const doc = frame.current?.contentDocument;
        const pages = doc?.getElementById("pages");
        if (!active || !doc || !pages) return;
        await renderAsync(buffer, pages, doc.head, {
          useBase64URL: true, ignoreFonts: true, renderAltChunks: false,
          renderHeaders: true, renderFooters: true, ignoreLastRenderedPageBreak: false
        });
        if (!active) return;
        // Disable document navigation, including links embedded in templates.
        pages.querySelectorAll("a").forEach((link) => link.removeAttribute("href"));
        const fit = () => {
          const sheet = pages.querySelector<HTMLElement>("section.docx");
          if (!sheet || !frame.current) return;
          const width = sheet.offsetWidth + 48;
          const scale = Math.min(1, frame.current.clientWidth / width);
          pages.style.width = `${width}px`;
          pages.style.transform = `scale(${scale})`;
          doc.body.style.height = `${pages.offsetHeight * scale}px`;
          doc.body.style.overflowX = "hidden";
        };
        fit();
        resize = new ResizeObserver(fit);
        if (frame.current) resize.observe(frame.current);
        setStatus("Preview ready · Simplified local preview. Word shapes and pagination may differ; the deployed Studio uses a server-rendered print preview.");
      } catch (error) {
        if (active) { setFailed(true); setStatus(error instanceof Error && /preview|document/i.test(error.message) ? error.message : "This document could not be previewed. You can still download it."); }
      }
    }
    void render();
    return () => { active = false; controller.abort(); resize?.disconnect(); };
  }, [file.url, isDocx, isPdf, ready, safeUrl, attempt]);

  return <dialog ref={dialog} className="document-preview" aria-labelledby="document-preview-title" onCancel={onClose}>
    <header className="document-preview__bar">
      <div><h2 id="document-preview-title">{file.name}</h2><p>Document preview</p></div>
      <div className="document-preview__actions">
        {safeUrl && isPdf && <a className="admin-save" href={file.url} target="_blank" rel="noopener noreferrer">Open PDF / Print</a>}
        {safeUrl && <a className="admin-open" href={file.url} download={file.name}>Download</a>}
        <button type="button" className="admin-ghost" onClick={onClose} autoFocus>Close preview</button>
      </div>
    </header>
    {safeUrl && (isDocx || isPdf) ? <>
      <p className="document-preview__status" role={failed ? "alert" : "status"}>{status}</p>
      {failed && <button type="button" className="admin-small" onClick={() => { setFailed(false); setStatus("Loading preview…"); setAttempt((value) => value + 1); }}>Retry preview</button>}
      {renderedPages.length ? <div className="document-preview__pages">{renderedPages.map((page, index) => <figure key={index}><img src={page} alt={`Document page ${index + 1}`} /><figcaption>Page {index + 1} of {renderedPages.length}</figcaption></figure>)}</div>
        : <iframe ref={frame} title="Letter document" sandbox="allow-same-origin" srcDoc={previewShell} onLoad={() => setReady(true)} />}
    </>
      : safeUrl && isImage ? <div className="document-preview__image"><img src={file.url} alt="Document preview" /></div>
      : <p className="document-preview__status">Preview is available for DOCX, PDF and images. Download this file to open it.</p>}
  </dialog>;
}
