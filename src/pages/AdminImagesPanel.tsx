import { ImageIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { imageSlots, imageStatus, replaceImageSlot } from "../lib/imageInventory";
import { ImageEditor } from "./AdminImageEditor";
import { ProjectGallery } from "./AdminProjectGallery";

export function AdminImagesPanel({ content, updateContent, onPreview }: {
  content: SiteContent; updateContent: (recipe: (content: SiteContent) => void) => void; onPreview: (route: string) => void;
}) {
  const slots = useMemo(() => imageSlots(content), [content]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All images");
  const [browsing, setBrowsing] = useState(true);
  const [selectedPath, setSelectedPath] = useState(slots.find((slot) => slot.path.startsWith("developments."))?.path ?? slots[0].path);
  const selected = slots.find((slot) => slot.path === selectedPath) ?? slots[0];
  const placeholders = slots.filter((slot) => imageStatus(slot.image) === "Placeholder").length;
  const filtered = slots.filter((slot) => (filter === "All images" || (filter === "Placeholders" ? imageStatus(slot.image) === "Placeholder" : slot.group === filter))
    && `${slot.title} ${slot.group}`.toLowerCase().includes(query.toLowerCase()));
  const projectIndex = selected.path.startsWith("developments.") ? Number(selected.path.split(".")[1]) : -1;
  const project = content.developments[projectIndex];

  return <section className="image-workspace" id="editor-panel-images" role="tabpanel" aria-label="Website image library">
    <div className="image-workspace__intro"><p className="eyebrow">Make it Kingsvale</p><h2>Your project photographs, in place.</h2>
      <p>Replace each sample image with your own photography. Select a space below, upload a photo and check it in the live preview.</p>
      <div className="image-workspace__counts"><strong>{slots.length - placeholders}<small>images in place</small></strong><strong>{placeholders}<small>placeholders to replace</small></strong><strong>{content.developments.length}<small>projects</small></strong></div>
    </div>
    <details className="image-library-browser" open={browsing} onToggle={(event) => setBrowsing(event.currentTarget.open)}><summary>Choose an image to edit <span>{selected.title}</span></summary>
    <div className="image-workspace__filters">
      <label className="image-search"><Search aria-hidden="true" /><input type="search" aria-label="Search website images" placeholder="Find a project or page…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="sr-only" htmlFor="image-group">Filter images</label><select id="image-group" value={filter} onChange={(event) => setFilter(event.target.value)}>
        {["All images", "Placeholders", ...new Set(slots.map((slot) => slot.group))].map((group) => <option key={group}>{group}</option>)}
      </select>
    </div>
    <div className="image-slot-grid" aria-label="Image spaces">
      {filtered.map((slot) => <button key={slot.path} type="button" className="image-slot" aria-pressed={selected.path === slot.path} onClick={() => { setSelectedPath(slot.path); onPreview(slot.route); setBrowsing(false); }}>
        <div className="image-slot__photo"><ImageIcon aria-hidden="true" /><img src={slot.image.src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} style={{ objectPosition: slot.image.focalPoint }} /></div>
        <span className={`image-badge ${imageStatus(slot.image) === "Placeholder" ? "image-badge--placeholder" : ""}`}>{imageStatus(slot.image)}</span>
        <strong>{slot.title}</strong>
      </button>)}
      {!filtered.length && <p>No images match. Try a different project name or filter.</p>}
    </div>
    </details>
    <div className="image-workspace__selection">
      <div className="studio-image__heading"><p className="eyebrow">Selected image</p><button className="admin-small" type="button" onClick={() => onPreview(selected.route)}>Preview this page</button></div>
      <ImageEditor key={selected.path} title={selected.title} image={selected.image} onChange={(image) => updateContent((next) => replaceImageSlot(next, selected.path, image))} />
      {project && selected.path.endsWith(".image") && <ProjectGallery key={project.id} title={project.title} images={project.gallery ?? []} onChange={(images) => updateContent((next) => { next.developments[projectIndex].gallery = images; })} />}
    </div>
    <p className="studio-image__hint">Uploaded photographs and their web sizes are included in full backups. Sample photographs and other external image links remain links.</p>
  </section>;
}
