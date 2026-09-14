import { ArrowDown, ArrowUp, Trash2, UploadCloud } from "lucide-react";
import { useContext, useRef, useState } from "react";
import type { ImageAsset } from "../lib/contentTypes";
import { uploadCmsImage } from "../lib/cmsApi";
import { ImageEditor, ImageUploadContext } from "./AdminImageEditor";

export function ProjectGallery({ title, images, onChange }: { title: string; images: ImageAsset[]; onChange: (images: ImageAsset[]) => void }) {
  const [selected, setSelected] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pending = useContext(ImageUploadContext);
  const latest = useRef({ images, onChange });
  latest.current = { images, onChange };
  const inFlight = useRef(false);
  const index = Math.min(selected, images.length - 1);

  async function addFiles(files: FileList) {
    if (inFlight.current || !files.length) return;
    if (files.length + images.length > 12) { setError(`There is space for ${12 - images.length} more images. Each gallery can hold 12.`); return; }
    inFlight.current = true; setBusy(true); pending(1); setError("");
    const failures: string[] = [];
    let added = 0;
    try {
      for (const [i, file] of Array.from(files).entries()) {
        setStatus(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        try {
          const image = await uploadCmsImage(file);
          const next = [...latest.current.images, image];
          latest.current.images = next;
          latest.current.onChange(next);
          added++;
        } catch (error) { failures.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`); }
      }
      setStatus(`${added} ${added === 1 ? "image" : "images"} added to the gallery. Save your draft or publish when ready.`);
      if (failures.length) setError(failures.join(" "));
      if (added) setSelected(latest.current.images.length - added);
    } finally { inFlight.current = false; setBusy(false); pending(-1); }
  }

  function move(direction: number) {
    const next = [...images];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next); setSelected(index + direction);
  }

  return <section className="project-gallery" aria-label={`${title} gallery`}>
    <div className="studio-image__heading"><h3>Project gallery</h3><span>{images.length} / 12 images</span></div>
    <p className="studio-image__hint">Photographs appear in this order on the development page. Add several at once, then select a thumbnail to adjust it.</p>
    <div className="gallery-thumbnails" aria-label="Gallery photographs">
      {images.map((image, i) => <button key={i} type="button" disabled={busy} aria-pressed={index === i} aria-label={`Edit ${title} gallery image ${i + 1}`} onClick={() => setSelected(i)}>
        <img src={image.src} alt="" /><span>{i + 1}</span>
      </button>)}
    </div>
    <label className="studio-image__drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>
      <UploadCloud aria-hidden="true" /><strong>{busy ? "Uploading gallery…" : "Add gallery images"}</strong><span>Choose or drop multiple images · up to 12 MB each</span>
      <input className="sr-only" type="file" aria-label={`Add ${title} gallery images`} accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={busy || images.length >= 12}
        onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
    </label>
    {status && <p role="status" className="studio-image__hint">{status}</p>}
    {error && <p role="alert" className="admin-field__error">{error}</p>}
    {images[index] ? <fieldset className="gallery-selection" disabled={busy}>
      <div className="gallery-actions">
        <button className="admin-small" type="button" disabled={index === 0} onClick={() => move(-1)}><ArrowUp aria-hidden="true" />Move earlier</button>
        <button className="admin-small" type="button" disabled={index === images.length - 1} onClick={() => move(1)}><ArrowDown aria-hidden="true" />Move later</button>
        <button className="admin-danger" type="button" onClick={() => { onChange(images.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)); }}><Trash2 aria-hidden="true" />Remove from gallery</button>
      </div>
      <ImageEditor title={`${title} gallery image ${index + 1}`} image={images[index]} onChange={(image) => onChange(images.map((current, i) => i === index ? image : current))} />
    </fieldset> : <p className="studio-image__hint">{images.length ? "Select a photograph above to edit its description, crop or position in the gallery." : "Your gallery is ready for project photographs. The cover image is used until you add more."}</p>}
  </section>;
}
