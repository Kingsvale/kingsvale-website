import { previewReadyMessage, previewEditMessage, previewModeMessage, previewScrollMessage, previewSelectMessage } from "../lib/siteEditing";
import "../studio-inline.css";

export function enableInlineEditing() {
  let enabled = true;
  let editing: HTMLElement | null = null;
  let original = "";
  document.documentElement.dataset.studioInline = "true";
  const send = (type: string, detail: object) => window.parent.postMessage({ type, ...detail }, window.location.origin);

  function finish(cancel = false) {
    if (!editing) return;
    const element = editing;
    editing = null;
    const value = cancel ? original : (element.innerText || element.textContent || "").trim();
    element.textContent = value;
    element.removeAttribute("contenteditable");
    element.removeAttribute("role");
    element.removeAttribute("aria-label");
    if (!cancel && value !== original) send(previewEditMessage, { path: element.dataset.cmsText, value });
  }

  function click(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    if (!enabled) {
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (link) {
        const url = new URL(link.href, window.location.href);
        if (url.origin === window.location.origin) {
          event.preventDefault();
          url.searchParams.set("studio-preview", new URLSearchParams(window.location.search).get("studio-preview") ?? "1");
          window.location.href = url.href;
        } else event.preventDefault();
      }
      return;
    }
    const text = event.target.closest<HTMLElement>("[data-cms-text]");
    const photo = event.target.closest<HTMLElement>("[data-cms-image]") ?? (event.target.matches(".hero__overlay,.hero,.inner-hero,.hero__content,.inner-hero__content") ? event.target.closest("section")?.querySelector<HTMLElement>("[data-cms-image]") : null);
    if (text) {
      event.preventDefault(); event.stopPropagation();
      if (editing === text) return;
      finish(); editing = text; original = text.textContent ?? "";
      text.setAttribute("contenteditable", "plaintext-only"); text.setAttribute("role", "textbox");
      text.setAttribute("aria-label", "Edit website text"); text.focus();
      const selection = window.getSelection(); const range = document.createRange();
      range.selectNodeContents(text); selection?.removeAllRanges(); selection?.addRange(range);
      send(previewSelectMessage, { path: text.dataset.cmsText, kind: "text", value: original });
    } else if (photo) {
      event.preventDefault(); event.stopPropagation(); finish();
      send(previewSelectMessage, { path: photo.dataset.cmsImage, kind: "image", src: photo.getAttribute("src"), alt: photo.getAttribute("alt") });
    } else if (event.target.closest("a")) { event.preventDefault(); }
  }
  function keydown(event: KeyboardEvent) {
    if (!editing) return;
    if (event.key === "Escape") { event.preventDefault(); finish(true); }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); finish(); }
  }
  function blur(event: FocusEvent) { if (event.target === editing) finish(); }
  function submit(event: SubmitEvent) { event.preventDefault(); }
  function receive(event: MessageEvent) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type === previewModeMessage) {
      finish(); enabled = Boolean(event.data.enabled); document.documentElement.dataset.studioInline = String(enabled);
    }
    if (event.data?.type === previewScrollMessage && typeof event.data.id === "string") document.getElementById(event.data.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("focusout", blur, true);
  document.addEventListener("submit", submit, true);
  window.addEventListener("message", receive);
  send(previewReadyMessage, {});
  return () => {
    finish(); delete document.documentElement.dataset.studioInline;
    document.removeEventListener("click", click, true); document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("focusout", blur, true); document.removeEventListener("submit", submit, true);
    window.removeEventListener("message", receive);
  };
}
