import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eye, Italic, Redo2, Undo2, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadLetterText, previewLetterChanges, refreshLetterLayout, type LetterTextContent } from "../lib/cmsApi";
import { LetterCanvas, letterCanvasShell, type CanvasState } from "../lib/letterCanvas";

type LetterFile = { url: string; name: string };
const emptyCanvas: CanvasState = { changes: [], canUndo: false, canRedo: false, active: false, bold: false, italic: false, underline: false, fontSize: 11, alignment: "left", pageCount: 0 };
const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export function AdminLetterEditor({ file, recipient, onClose, onSave }: {
  file: LetterFile;
  recipient: string;
  onClose: () => void;
  onSave: (version: string, changes: LetterTextContent["paragraphs"]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<LetterCanvas | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const zoomRef = useRef("fit");
  const [original, setOriginal] = useState<LetterTextContent | null>(null);
  const [state, setState] = useState<CanvasState>(emptyCanvas);
  const [frameReady, setFrameReady] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState("fit");
  const [previewing, setPreviewing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [renderedKey, setRenderedKey] = useState("[]");
  const [layoutTick, setLayoutTick] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const failedLayout = useRef("");
  const changesKey = JSON.stringify(state.changes);
  const latestKey = useRef(changesKey);
  latestKey.current = changesKey;
  const [printed, setPrinted] = useState<{ pages: string[]; pageCount: number } | null>(null);
  const greeting = original?.paragraphs.find((item) => /^Dear\s/i.test(item.text.trim()));
  const busy = saving || previewing;
  closeRef.current = close;
  zoomRef.current = zoom;

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (state.changes.length || busy) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [state.changes.length, busy]);

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { mounted.current = false; previous?.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    setError("");
    setOriginal(null);
    setCanvasReady(false);
    setState(emptyCanvas);
    setRenderedKey("[]");
    failedLayout.current = "";
    void loadLetterText(file.url).then((content) => {
      if (active) setOriginal(content);
    }).catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "The letter could not be loaded."); });
    return () => { active = false; };
  }, [file.url, attempt]);

  useEffect(() => {
    if (!original || !frameReady) return;
    let active = true;
    let resize: ResizeObserver | undefined;
    function render() {
      try {
        if (!original?.layout) throw new Error("The print layout could not load this letter. Please refresh and try again.");
        const doc = frame.current?.contentDocument;
        const pages = doc?.getElementById("pages");
        if (!active || !doc || !pages) return;
        pages.replaceChildren();
        canvas.current = new LetterCanvas(doc, pages, original, (next) => { if (active) setState(next); }, setError, () => closeRef.current());
        canvas.current.zoom(zoomRef.current);
        resize = new ResizeObserver(() => canvas.current?.zoom(zoomRef.current));
        if (frame.current) resize.observe(frame.current);
        setCanvasReady(true);
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "The page editor could not be loaded."); }
    }
    void render();
    return () => { active = false; resize?.disconnect(); canvas.current?.destroy(); canvas.current = null; };
  }, [original, frameReady]);

  useEffect(() => {
    if (!original || !canvasReady || busy || printed || changesKey === renderedKey || failedLayout.current === changesKey || inFlight.current) return;
    const timer = window.setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSyncing(true);
      try {
        const layout = await refreshLetterLayout(file.url, original.version, JSON.parse(changesKey));
        if (mounted.current && latestKey.current === changesKey) {
          canvas.current?.updateLayout(layout);
          canvas.current?.zoom(zoomRef.current);
          setRenderedKey(changesKey);
          failedLayout.current = "";
        }
      } catch (failure) {
        if (mounted.current && latestKey.current === changesKey) {
          failedLayout.current = changesKey;
          setError(failure instanceof Error ? failure.message : "The layout could not refresh. Your edits are still here.");
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) { setSyncing(false); setLayoutTick((value) => value + 1); }
      }
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [original, canvasReady, changesKey, renderedKey, busy, printed, file.url, layoutTick]);

  useEffect(() => { canvas.current?.setLocked(busy || !!printed); }, [busy, printed, canvasReady]);
  useEffect(() => { if (!printed) canvas.current?.zoom(zoom); }, [zoom, canvasReady, printed]);

  function close() {
    if (busy) return;
    if (state.changes.length) setDiscarding(true);
    else onClose();
  }

  async function preview() {
    if (!original || busy || syncing) return;
    setPreviewing(true);
    setError("");
    try { setPrinted(await previewLetterChanges(file.url, original.version, state.changes)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The print preview could not be prepared. Your edits are still here."); }
    finally { setPreviewing(false); }
  }

  async function save() {
    if (!original || !state.changes.length || busy || syncing) return;
    setSaving(true);
    setError("");
    try { await onSave(original.version, state.changes); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your changes could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="letter-editor-dialog" aria-labelledby="letter-text-editor-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="letter-editor-dialog__heading">
      <div><h2 id="letter-text-editor-title">Edit letter</h2><p>{file.name}</p></div>
      <div className="letter-editor-dialog__header-actions">
        {printed ? <button className="admin-open" type="button" disabled={busy} onClick={() => setPrinted(null)}>Back to editing</button>
          : <button className="admin-open" type="button" disabled={!canvasReady || busy || syncing} onClick={preview}><Eye aria-hidden="true" />{previewing ? "Preparing preview…" : "Preview print layout"}</button>}
        <button className="admin-ghost" type="button" disabled={busy} onClick={close} autoFocus>Cancel</button>
      </div>
    </header>
    {!printed && <div className="letter-editor-toolbar" role="toolbar" aria-label="Letter formatting">
      <div className="letter-editor-toolbar__group">
        <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!state.canUndo || busy} onMouseDown={(event) => event.preventDefault()} onClick={() => canvas.current?.undo()}><Undo2 /></button>
        <button type="button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!state.canRedo || busy} onMouseDown={(event) => event.preventDefault()} onClick={() => canvas.current?.undo(true)}><Redo2 /></button>
      </div>
      <div className="letter-editor-toolbar__group">
        {([["bold", "Bold", Bold], ["italic", "Italic", Italic], ["underline", "Underline", Underline]] as const).map(([command, label, Icon]) =>
          <button key={command} type="button" aria-label={label} title={label} aria-pressed={state[command]} disabled={!state.active || busy}
            onMouseDown={(event) => event.preventDefault()} onClick={() => canvas.current?.command(command)}><Icon /></button>)}
        <label className="sr-only" htmlFor="letter-font-size">Font size</label>
        <select id="letter-font-size" aria-label="Font size" disabled={!state.active || busy} value={state.fontSize} onChange={(event) => canvas.current?.command("fontSize", event.target.value)}>
          {!sizes.includes(state.fontSize) && <option value={state.fontSize}>{state.fontSize} pt</option>}
          {sizes.map((size) => <option key={size} value={size}>{size} pt</option>)}
        </select>
      </div>
      <div className="letter-editor-toolbar__group">
        {([["left", "Align left", AlignLeft], ["center", "Align centre", AlignCenter], ["right", "Align right", AlignRight], ["both", "Justify text", AlignJustify]] as const).map(([alignment, label, Icon]) =>
          <button key={alignment} type="button" aria-label={label} title={label} aria-pressed={state.alignment === alignment} disabled={!state.active || busy}
            onMouseDown={(event) => event.preventDefault()} onClick={() => canvas.current?.command("alignment", alignment)}><Icon /></button>)}
      </div>
      <div className="letter-editor-toolbar__group letter-editor-toolbar__zoom">
        <label htmlFor="letter-zoom">Zoom</label>
        <select id="letter-zoom" value={zoom} onChange={(event) => setZoom(event.target.value)}><option value="fit">Fit page</option><option value="width">Fit width</option>{[50, 75, 100, 125, 150].map((value) => <option key={value} value={value}>{value}%</option>)}</select>
      </div>
    </div>}
    <div className="letter-editor-dialog__hint">
      <span>{printed ? "Print layout preview · Your edits are not saved yet." : "Click text to edit. The page layout updates automatically as you work."}</span>
      {!printed && greeting && recipient.trim() && <button className="admin-small" type="button" disabled={!canvasReady || busy}
        onClick={() => canvas.current?.personalise(greeting.id, `Dear ${recipient.trim()},`)}>Use recipient name in greeting</button>}
    </div>
    <div className="letter-editor-dialog__workspace" aria-busy={!canvasReady && !error || previewing}>
      {!canvasReady && !error && <p className="letter-editor-dialog__loading" role="status">Opening your letter…</p>}
      {!canvasReady && error && <div className="letter-editor-dialog__loading"><button className="admin-open" type="button" onClick={() => setAttempt((value) => value + 1)}>Try loading again</button></div>}
      {previewing && <div className="letter-editor-dialog__veil" role="status">Preparing print layout…</div>}
      <iframe ref={frame} title="Letter editor page" sandbox="allow-same-origin" srcDoc={letterCanvasShell} onLoad={() => setFrameReady((value) => value + 1)} hidden={!!printed || !canvasReady} />
      {printed && <div className="letter-editor-dialog__print-pages">{printed.pages.map((page, index) => <figure key={index}><img src={page} alt={`Edited letter page ${index + 1}`} /><figcaption>Page {index + 1} of {printed.pageCount}</figcaption></figure>)}</div>}
    </div>
    <footer className="letter-editor-dialog__footer">
      {error && <p role="alert">{error}</p>}
      {discarding ? <div className="letter-editor-dialog__discard" role="alert">
        <span>Discard your unsaved changes?</span>
        <button className="admin-open" type="button" onClick={() => setDiscarding(false)}>Keep editing</button>
        <button className="admin-ghost" type="button" onClick={onClose}>Discard changes</button>
      </div> : <>
        <p role="status">{saving ? "Saving Word and PDF files…" : syncing ? "Updating page layout…" : state.changes.length ? "Unsaved letter changes" : "Changes apply only to this letter."}{canvasReady && !busy && <span className="letter-editor-dialog__page-count">{printed?.pageCount || state.pageCount} {(printed?.pageCount || state.pageCount) === 1 ? "page" : "pages"}</span>}</p>
        {failedLayout.current === changesKey && <button className="admin-open" type="button" onClick={() => { failedLayout.current = ""; setError(""); setLayoutTick((value) => value + 1); }}>Refresh layout</button>}
        <button className="admin-save" type="button" disabled={!canvasReady || !state.changes.length || busy || syncing} onClick={save}>{saving ? "Saving…" : "Save changes & preview"}</button>
      </>}
    </footer>
  </dialog>;
}
