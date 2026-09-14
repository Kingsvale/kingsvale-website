import { ChevronLeft, ChevronRight, Pause, Play, X, Expand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Development } from "../lib/contentTypes";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { isStudioPreviewRequest } from "../lib/studioPreview";
import { ResponsiveImage } from "./ResponsiveImage";
import { SiteText } from "./SiteText";


export function projectImages(project: Development) {
  const seen = new Set<string>();
  return [project.image, ...(project.gallery ?? [])].map((image, index) => ({ image, suffix: index === 0 ? "image" : `gallery.${index - 1}` }))
    .filter(({ image }) => { if (seen.has(image.src)) return false; seen.add(image.src); return true; });
}

export function ProjectCarousel({ project, index, children }: { project: Development; index: number; children?: React.ReactNode }) {
  const images = projectImages(project);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const current = active % images.length;
  const editing = isStudioPreviewRequest();
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (images.length < 2 || paused || hovering || !visible || !pageVisible || reducedMotion || editing) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % images.length), 6000 + index * 350);
    return () => window.clearInterval(timer);
  }, [images.length, paused, hovering, visible, pageVisible, reducedMotion, editing, index]);
  function move(delta: number) { setPaused(true); setActive((value) => (value + delta + images.length) % images.length); }
  return <div ref={root} className="development-card__media project-carousel" aria-label={`${project.title} photographs`}
    onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
    onFocusCapture={() => setHovering(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHovering(false); }}>
    <a href={`${project.ctaHref.split("#")[0]}#gallery`} aria-label={`View ${project.title} gallery`}>
      <ResponsiveImage key={images[current].image.src} image={images[current].image} field={`developments.${index}.${images[current].suffix}`} className="project-carousel__image"
        sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw" widthHint={960} />
    </a>
    {children}
    {images.length > 1 && <div className="project-carousel__controls">
      <button type="button" aria-label={`Previous ${project.title} photograph`} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
      <span aria-live="off">{current + 1} / {images.length}</span>
      <button type="button" aria-label={`Next ${project.title} photograph`} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      {!reducedMotion && !editing && <button type="button" aria-label={`${paused ? "Play" : "Pause"} ${project.title} slideshow`} onClick={() => setPaused(!paused)}>{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</button>}
    </div>}
  </div>;
}

export function ProjectGallery({ project, index }: { project: Development; index: number }) {
  const images = projectImages(project);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const scrollTarget = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const current = active % images.length;
  function go(next: number) {
    const selected = (next + images.length) % images.length;
    setActive(selected);
    scrollTarget.current = selected;
    const target = strip.current?.children[selected] as HTMLElement | undefined;
    if (target && strip.current) strip.current.scrollTo({ left: target.offsetLeft - (strip.current.children[0] as HTMLElement).offsetLeft, behavior: reducedMotion ? "instant" : "smooth" });
  }
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); opener.current?.focus(); }
  }, [expanded]);
  return <section className="project-gallery-public" id="gallery" aria-label={`${project.title} image gallery`}>
    <div className="project-gallery-public__toolbar"><div><p className="eyebrow"><SiteText copy="gallery_heading">Project gallery</SiteText></p><p><SiteText copy="gallery_instructions">Swipe or scroll to explore the photographs.</SiteText></p></div>
      <div className="project-gallery-public__arrows"><button type="button" aria-label="Previous gallery photograph" onClick={() => go(current - 1)} disabled={images.length < 2}><ChevronLeft aria-hidden="true" /></button><span aria-live="polite">{current + 1} / {images.length}</span><button type="button" aria-label="Next gallery photograph" onClick={() => go(current + 1)} disabled={images.length < 2}><ChevronRight aria-hidden="true" /></button></div>
    </div>
    <div className="project-gallery-public__strip" ref={strip} tabIndex={0} role="region" aria-label="Scrollable project photographs"
      onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); go(current + (event.key === "ArrowRight" ? 1 : -1)); } }}
      onPointerDown={() => { scrollTarget.current = null; }} onWheel={() => { scrollTarget.current = null; }}
      onScroll={() => { if (strip.current) { const width = strip.current.clientWidth; if (width) { const next = Math.min(images.length - 1, Math.round(strip.current.scrollLeft / width)); if (scrollTarget.current !== null) { if (Math.abs(strip.current.scrollLeft - scrollTarget.current * width) < 2) scrollTarget.current = null; else return; } setActive(next); } } }}>
      {images.map(({ image, suffix }, i) => <figure key={image.src}>
        <ResponsiveImage image={image} field={`developments.${index}.${suffix}`} widthHint={1600} sizes="(max-width: 800px) 100vw, 90vw" />
        <figcaption>{image.alt}</figcaption>
        <button className="project-gallery-public__expand" type="button" aria-label={`Enlarge photograph ${i + 1}`} onClick={(event) => { opener.current = event.currentTarget; setActive(i); setExpanded(true); }}><Expand aria-hidden="true" /></button>
      </figure>)}
    </div>
    <div className="project-gallery-public__thumbs" aria-label="Choose gallery photograph">
      {images.map(({ image }, i) => <button key={image.src} type="button" aria-label={`Show photograph ${i + 1}: ${image.alt}`} aria-pressed={current === i} onClick={() => go(i)}><img src={image.variants?.[0]?.src ?? image.src} alt="" loading="lazy" /></button>)}
    </div>
    <dialog ref={dialog} className="project-lightbox" aria-label={`${project.title} enlarged photograph`} onCancel={() => setExpanded(false)} onClose={() => { setExpanded(false); opener.current?.focus(); }}
      onKeyDown={(event) => { if (event.key === "ArrowRight") go(current + 1); if (event.key === "ArrowLeft") go(current - 1); }}>
      <button className="project-lightbox__close" type="button" aria-label="Close enlarged photograph" onClick={() => setExpanded(false)}><X aria-hidden="true" /></button>
      {expanded && <><ResponsiveImage image={images[current].image} field={`developments.${index}.${images[current].suffix}`} widthHint={2000} sizes="100vw" priority /><p>{images[current].image.alt}</p><div className="project-gallery-public__arrows"><button type="button" aria-label="Previous enlarged photograph" onClick={() => go(current - 1)}><ChevronLeft aria-hidden="true" /></button><span>{current + 1} / {images.length}</span><button type="button" aria-label="Next enlarged photograph" onClick={() => go(current + 1)}><ChevronRight aria-hidden="true" /></button></div></>}
    </dialog>
  </section>;
}
