import { useEffect, useRef, useState } from "react";
import { loadLetterText, type LetterTextContent } from "../lib/cmsApi";

type LetterFile = { url: string; name: string };

export function AdminLetterEditor({ file, recipient, onClose, onSave }: {
  file: LetterFile;
  recipient: string;
  onClose: () => void;
  onSave: (version: string, changes: LetterTextContent["paragraphs"]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [original, setOriginal] = useState<LetterTextContent | null>(null);
  const [paragraphs, setParagraphs] = useState<LetterTextContent["paragraphs"]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const changes = paragraphs.filter((item) => item.text !== original?.paragraphs.find((saved) => saved.id === item.id)?.text);
  const greeting = original?.paragraphs.find((item) => /^Dear\s/i.test(item.text.trim()));

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (changes.length || saving) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [changes.length, saving]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    setError("");
    void loadLetterText(file.url).then((content) => {
      if (active) { setOriginal(content); setParagraphs(content.paragraphs); }
    }).catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "The letter could not be loaded."); });
    return () => { active = false; };
  }, [file.url, attempt]);

  function close() {
    if (saving) return;
    if (changes.length) setDiscarding(true);
    else onClose();
  }

  function update(id: number, text: string) {
    setParagraphs((current) => current.map((item) => item.id === id ? { ...item, text } : item));
    setDiscarding(false);
  }

  async function save() {
    if (!original || !changes.length || saving) return;
    setSaving(true);
    setError("");
    try { await onSave(original.version, changes); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your changes could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="letter-editor-dialog" aria-labelledby="letter-text-editor-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="letter-editor-dialog__heading">
      <div><h2 id="letter-text-editor-title">Edit letter</h2><p>{file.name}</p></div>
      <button className="admin-ghost" type="button" disabled={saving} onClick={close} autoFocus>Cancel</button>
    </header>
    <div className="letter-editor-dialog__body" aria-busy={!original && !error}>
      <p className="admin-note">Change the greeting, wording or sign-off below. Save to update this letter&apos;s Word and PDF files, then check the preview.</p>
      {!original && !error && <p role="status">Loading letter text…</p>}
      {!original && error && <button className="admin-open" type="button" onClick={() => setAttempt((value) => value + 1)}>Try loading again</button>}
      {greeting && recipient.trim() && <button className="admin-open letter-editor-dialog__personalise" type="button" disabled={saving}
        onClick={() => update(greeting.id, `Dear ${recipient.trim()},`)}>Use recipient name in greeting</button>}
      <fieldset disabled={saving} className="letter-editor-dialog__fields">
        {paragraphs.map((item, index) => {
          const before = original?.paragraphs.find((saved) => saved.id === item.id)?.text.trim() ?? "";
          const label = item.id === greeting?.id ? "Greeting" : /^(?:Yours (?:sincerely|faithfully)|Kind regards|Best regards)/i.test(before) ? "Sign-off" : `Text block ${index + 1}`;
          return <label className="admin-field" key={item.id}>
            <span className="admin-field__label">{label}</span>
            <textarea aria-label={label} value={item.text} maxLength={12000} rows={Math.max(1, Math.min(9, Math.ceil(item.text.length / 85) + item.text.split("\n").length - 1))}
              onChange={(event) => update(item.id, event.target.value)} />
          </label>;
        })}
      </fieldset>
    </div>
    <footer className="letter-editor-dialog__footer">
      {error && <p role="alert">{error}</p>}
      {discarding ? <div className="letter-editor-dialog__discard" role="alert">
        <span>Discard your unsaved changes?</span>
        <button className="admin-open" type="button" onClick={() => setDiscarding(false)}>Keep editing</button>
        <button className="admin-ghost" type="button" onClick={onClose}>Discard changes</button>
      </div> : <>
        <p role="status">{saving ? "Saving Word and PDF files…" : changes.length ? "Unsaved letter changes" : "Changes apply only to this letter."}</p>
        <button className="admin-save" type="button" disabled={!original || !changes.length || saving} onClick={save}>{saving ? "Saving…" : "Save changes & preview"}</button>
      </>}
    </footer>
  </dialog>;
}
