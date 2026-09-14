import { ImagePlus, RotateCcw, UploadCloud } from "lucide-react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { AdminRangeInput, AdminTextInput } from "../components/AdminFields";
import { uploadCmsImage } from "../lib/cmsApi";
import type { ImageAsset } from "../lib/contentTypes";
import { imageStatus } from "../lib/imageInventory";

export const ImageUploadContext = createContext<(delta: number) => void>(() => undefined);

export function ImageEditor({ title, image, onChange, error }: {
  title: string; image: ImageAsset; onChange: (image: ImageAsset) => void; error?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
  const [broken, setBroken] = useState(false);
  const [previous, setPrevious] = useState<ImageAsset | null>(null);
  const [shape, setShape] = useState("16 / 9");
  const [url, setUrl] = useState(image.src);
  const inputId = useId();
  const changePending = useContext(ImageUploadContext);
  const inFlight = useRef(false);
  const latest = useRef({ image, onChange });
  latest.current = { image, onChange };
  useEffect(() => { setBroken(false); setUrl(image.src); }, [image.src]);
  const [x, y] = (image.focalPoint ?? "50% 50%").split(" ").map((part) => Number.parseInt(part) || 0);

  async function upload(files: FileList | File[]) {
    if (!files.length || inFlight.current) return;
    if (files.length > 1) { setFileError("Choose one cover image. Add multiple photographs in the project gallery."); return; }
    inFlight.current = true;
    setUploading(true); changePending(1); setFileError(""); setMessage("Uploading and preparing image sizes…");
    const original = latest.current.image;
    try {
      const uploaded = await uploadCmsImage(files[0]);
      setPrevious(original);
      latest.current.onChange(uploaded);
      setMessage(uploaded.src.startsWith("/media/") ? "Uploaded to the backend. Save your draft or publish when ready." : "Embedded in this local draft. Save or publish to keep it.");
    } catch (error) {
      setMessage(""); setFileError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally { inFlight.current = false; setUploading(false); changePending(-1); }
  }

  return <section className={`studio-image ${dragging ? "studio-image--dragging" : ""}`} aria-label={title} aria-busy={uploading}
    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }}>
    <div className="studio-image__heading"><h3>{title}</h3><span className={`image-badge ${imageStatus(image) === "Placeholder" ? "image-badge--placeholder" : ""}`}>{imageStatus(image)}</span></div>
    <div className="studio-image__canvas" style={{ aspectRatio: shape, maxWidth: shape === "3 / 4" ? "240px" : undefined, marginInline: "auto" }}>
      {!broken ? <img src={image.src} alt={image.alt} style={{ objectPosition: image.focalPoint }} onError={() => setBroken(true)} />
        : <div className="studio-image__missing"><ImagePlus aria-hidden="true" /><span>Image unavailable. Upload a replacement below.</span></div>}
      {uploading && <div className="studio-image__loading">Preparing your image…</div>}
    </div>
    <div className="studio-image__shapes" role="group" aria-label={`${title} crop preview`}>
      {[["16 / 9", "Wide"], ["4 / 3", "Card"], ["3 / 4", "Phone"]].map(([value, label]) => <button type="button" key={value} aria-pressed={shape === value} onClick={() => setShape(value)}>{label}</button>)}
      {image.width && <small>{image.width} × {image.height} px</small>}
    </div>
    <label className="studio-image__drop" htmlFor={inputId}>
      <UploadCloud aria-hidden="true" /><strong>{uploading ? "Uploading…" : "Choose image or drop it here"}</strong>
      <span>JPEG, PNG, WebP or AVIF · up to 12 MB</span>
      <input id={inputId} className="sr-only" aria-label={`Upload ${title}`} type="file" disabled={uploading}
        data-testid={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-upload`}
        accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { if (event.target.files) void upload(event.target.files); event.target.value = ""; }} />
    </label>
    <p className="studio-image__hint">Use a landscape photo, ideally 2,400 px wide. Check the crop on each device before publishing.</p>
    <details className="studio-image__details">
      <summary>Image description (optional)</summary>
      <AdminTextInput label={`${title} alt text`} value={image.alt ?? ""} onChange={(alt) => onChange({ ...image, alt })} maxLength={150}
        helper="Optional description for screen readers. Leave blank if you do not need one; it will not prevent publishing." />
    </details>
    <details className="studio-image__details">
      <summary>Adjust crop & focal point</summary>
      <p>Move the photograph within its frame. The same focal point follows it across screen sizes.</p>
      <AdminRangeInput label={`${title} horizontal position`} value={x} onChange={(value) => onChange({ ...image, focalPoint: `${value}% ${y}%` })} />
      <AdminRangeInput label={`${title} vertical position`} value={y} onChange={(value) => onChange({ ...image, focalPoint: `${x}% ${value}%` })} />
      <button className="admin-small" type="button" onClick={() => onChange({ ...image, focalPoint: "50% 50%" })}>Centre image</button>
    </details>
    <details className="studio-image__details"><summary>Image link</summary>
      <AdminTextInput label={`${title} URL`} value={url} onChange={setUrl} maxLength={9000} helper="Uploads are saved on the backend and included in backups. External links are not copied into backups." />
      <button type="button" className="admin-small" disabled={url === image.src || uploading} onClick={() => {
        const src = url.trim();
        if (!/^\/(?!\/)[a-zA-Z0-9/_.,-]+$/.test(src) && !/^https:\/\/images\.unsplash\.com\//.test(src)) { setFileError("Use a local image path or an Unsplash URL. Upload other images to store them safely."); return; }
        setPrevious(image); setFileError(""); onChange({ src, alt: image.alt, focalPoint: "50% 50%" });
      }}>Use image link</button>
    </details>
    {previous && <button type="button" className="admin-ghost" disabled={uploading} onClick={() => { onChange(previous); setPrevious(null); setMessage("Previous image restored in the draft."); }}><RotateCcw aria-hidden="true" />Undo replacement</button>}
    {message && <p className="studio-image__hint" role="status">{message}</p>}
    {(fileError || error) && <p className="admin-field__error" role="alert">{fileError || error}</p>}
  </section>;
}
