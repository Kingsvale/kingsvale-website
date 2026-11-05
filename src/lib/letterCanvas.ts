import type { LetterParagraph, LetterPrintLayout, LetterTextContent, LetterTextRun } from "./cmsApi";

export type CanvasState = { changes: LetterParagraph[]; canUndo: boolean; canRedo: boolean; active: boolean; bold: boolean; italic: boolean; underline: boolean; fontSize: number; alignment: string; pageCount: number };
type Snapshot = Array<{ id: number; html: string; style: string; rich: boolean }>;

// The canvas lives in a script-free iframe. Only marked text paragraphs can be
// edited; the document's images, QR artwork, headers and page setup stay intact.
export class LetterCanvas {
  private elements = new Map<number, HTMLElement>();
  private baseline = new Map<number, string>();
  private formatted = new Set<number>();
  private history: Snapshot[] = [];
  private position = 0;
  private selection: Range | null = null;
  private activeId: number | null = null;
  private lastInput = 0;
  private lastInputId: number | null = null;
  private locked = false;
  private cleanup: Array<() => void> = [];
  private affixes = new Map<number, { prefix: string; suffix: string }>();
  private rendered = new Map<number, string>();

  constructor(private doc: Document, private root: HTMLElement, content: LetterTextContent,
    private onState: (state: CanvasState) => void, private onError: (message: string) => void, private onCancel: () => void) {
    mountPrintLayout(doc, root, content.layout);
    for (const block of content.layout.blocks) this.affixes.set(block.id, { prefix: block.prefix, suffix: block.suffix });
    const names = new Map(content.paragraphs.map((item, index) => [item.id,
      /^Dear\s/i.test(item.text.trim()) ? "Greeting" : /^(Yours (sincerely|faithfully)|Kind regards|Best regards)/i.test(item.text.trim()) ? "Sign-off" : `Letter text ${index + 1}`]));
    for (const marker of root.querySelectorAll<HTMLElement>('[id^="KV_EDIT_"]')) {
      const id = Number(marker.id.replace("KV_EDIT_", ""));
      const paragraph = marker.closest("p");
      if (!paragraph || !names.has(id) || paragraph.querySelector("img,svg,object,iframe")) continue;
      marker.remove();
      paragraph.dataset.letterId = String(id);
      paragraph.contentEditable = "true";
      paragraph.setAttribute("role", "textbox");
      paragraph.setAttribute("aria-label", names.get(id)!);
      paragraph.setAttribute("aria-multiline", "true");
      paragraph.spellcheck = true;
      this.elements.set(id, paragraph);
    }
    if (!this.elements.size) throw new Error("This letter's text could not be opened on the page.");
    root.querySelectorAll("a").forEach((link) => { link.removeAttribute("href"); link.removeAttribute("target"); });
    root.querySelectorAll("img,svg").forEach((item) => item.setAttribute("draggable", "false"));
    for (const [id, element] of this.elements) {
      const value = JSON.stringify(this.readParagraph(id, element));
      this.baseline.set(id, value);
      this.rendered.set(id, value);
    }
    this.history = [this.snapshot()];
    this.listen(doc, "selectionchange", () => this.selectionChanged());
    this.listen(doc, "focusin", (event) => {
      const element = this.findParagraph(event.target as Node);
      if (element) this.activeId = Number(element.dataset.letterId);
      this.emit();
    });
    this.listen(doc, "beforeinput", (event) => {
      const input = event as InputEvent;
      if (!this.findParagraph(event.target as Node)) return;
      if (this.locked) { event.preventDefault(); return; }
      if (input.inputType === "insertParagraph") { event.preventDefault(); doc.execCommand("insertLineBreak"); }
      if (input.inputType === "historyUndo" || input.inputType === "historyRedo") { event.preventDefault(); this.undo(input.inputType === "historyRedo"); }
    });
    this.listen(doc, "input", () => this.capture());
    this.listen(doc, "paste", (event) => {
      if (!this.findParagraph(event.target as Node)) return;
      event.preventDefault();
      if (!this.locked) doc.execCommand("insertText", false, (event as ClipboardEvent).clipboardData?.getData("text/plain") || "");
    });
    this.listen(doc, "drop", (event) => { event.preventDefault(); });
    this.listen(doc, "keydown", (event) => {
      const key = event as KeyboardEvent;
      if (key.key === "Escape") { event.preventDefault(); this.onCancel(); return; }
      if (!this.findParagraph(event.target as Node)) return;
      if ((key.ctrlKey || key.metaKey) && !key.altKey) {
        const action = key.key.toLowerCase();
        if (action === "z" || action === "y") { event.preventDefault(); this.undo(action === "y" || key.shiftKey); }
        if (["b", "i", "u"].includes(action)) { event.preventDefault(); this.command(action === "b" ? "bold" : action === "i" ? "italic" : "underline"); }
      }
    });
    this.emit();
  }

  destroy() { this.cleanup.forEach((remove) => remove()); }

  setLocked(locked: boolean) {
    this.locked = locked;
    this.elements.forEach((element) => { element.contentEditable = String(!locked); });
  }

  updateLayout(layout: LetterPrintLayout) {
    // Move the existing text elements rather than rebuilding them. This keeps
    // selection, typed text and undo history while the exact PDF layout refreshes.
    mountPrintLayout(this.doc, this.root, layout, this.elements);
    for (const [id, element] of this.elements) {
      this.rendered.set(id, JSON.stringify(this.readParagraph(id, element)));
      element.parentElement?.removeAttribute("data-pending");
    }
    this.emit();
  }

  zoom(value: string) {
    const sheet = this.root.querySelector<HTMLElement>("section.docx");
    if (!sheet) return;
    const width = (this.doc.documentElement.clientWidth - 40) / sheet.offsetWidth;
    const height = (this.doc.documentElement.clientHeight - 40) / sheet.offsetHeight;
    const ratio = value === "fit" ? Math.max(0.15, Math.min(1.15, width, height)) : value === "width" ? Math.max(0.15, Math.min(1.15, width)) : Number(value) / 100;
    this.root.style.setProperty("zoom", String(ratio));
  }

  personalise(id: number, text: string) {
    if (this.locked) return;
    const element = this.elements.get(id);
    if (!element) return;
    element.focus();
    const range = this.doc.createRange();
    range.selectNodeContents(element);
    this.doc.getSelection()?.removeAllRanges();
    this.doc.getSelection()?.addRange(range);
    this.activeId = id;
    this.doc.execCommand("insertText", false, text);
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    this.capture(true);
  }

  command(command: "bold" | "italic" | "underline" | "fontSize" | "alignment", value?: string) {
    if (this.locked || this.activeId === null) return;
    const element = this.elements.get(this.activeId)!;
    this.lastInput = 0;
    if (command !== "alignment") this.formatted.add(this.activeId);
    element.focus({ preventScroll: true });
    if (this.selection && element.contains(this.selection.commonAncestorContainer)) {
      this.doc.getSelection()?.removeAllRanges();
      this.doc.getSelection()?.addRange(this.selection);
    }
    if (command === "alignment") element.style.textAlign = value === "both" ? "justify" : value!;
    else if (command === "fontSize") {
      this.doc.execCommand("fontSize", false, "7");
      const spans: HTMLElement[] = [];
      for (const font of element.querySelectorAll('font[size="7"]')) {
        const span = this.doc.createElement("span");
        span.style.fontSize = `${value}pt`;
        span.append(...font.childNodes);
        font.replaceWith(span);
        spans.push(span);
      }
      if (spans.length) {
        const range = this.doc.createRange();
        range.setStart(spans[0], 0);
        range.setEnd(spans[spans.length - 1], spans[spans.length - 1].childNodes.length);
        this.doc.getSelection()?.removeAllRanges();
        this.doc.getSelection()?.addRange(range);
      }
    } else this.doc.execCommand(command);
    this.capture(true);
    this.selectionChanged();
  }

  undo(redo = false) {
    if (this.locked) return;
    const next = this.position + (redo ? 1 : -1);
    if (next < 0 || next >= this.history.length) return;
    this.position = next;
    this.apply(this.history[next]);
    this.lastInput = 0;
    this.selection = null;
    this.emit();
  }

  private listen(target: EventTarget, name: string, listener: EventListener) {
    target.addEventListener(name, listener);
    this.cleanup.push(() => target.removeEventListener(name, listener));
  }

  private findParagraph(node: Node | null) {
    const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
    return element?.closest<HTMLElement>("[data-letter-id]") ?? null;
  }

  private selectionChanged() {
    const selection = this.doc.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const start = this.findParagraph(range.startContainer);
    const end = this.findParagraph(range.endContainer);
    if (start && start === end) { this.selection = range.cloneRange(); this.activeId = Number(start.dataset.letterId); }
    else if (this.doc.activeElement === this.doc.body) { this.selection = null; this.activeId = null; }
    this.emit();
  }

  private snapshot(): Snapshot {
    return [...this.elements].map(([id, element]) => ({ id, html: element.innerHTML, style: element.getAttribute("style") || "", rich: this.formatted.has(id) }));
  }

  private apply(snapshot: Snapshot) {
    for (const item of snapshot) {
      const element = this.elements.get(item.id)!;
      element.innerHTML = item.html;
      element.setAttribute("style", item.style);
      if (item.rich) this.formatted.add(item.id);
      else this.formatted.delete(item.id);
    }
  }

  private capture(force = false) {
    const state = this.snapshot();
    if (JSON.stringify(state) === JSON.stringify(this.history[this.position])) { if (force) this.lastInput = 0; this.emit(); return; }
    const paragraphs = [...this.elements].map(([id, element]) => this.readParagraph(id, element));
    if (paragraphs.some((item) => item.text.length > 12000) || paragraphs.reduce((total, item) => total + item.text.length, 0) > 100000) {
      this.apply(this.history[this.position]);
      this.onError("That text is too long for this letter. Please shorten it before saving.");
      return;
    }
    this.history = this.history.slice(0, this.position + 1);
    const now = Date.now();
    if (!force && this.position > 0 && now - this.lastInput < 650 && this.lastInputId === this.activeId) this.history[this.position] = state;
    else { this.history.push(state); this.position++; }
    if (this.history.length > 80) { this.history.shift(); this.position--; }
    this.lastInput = force ? 0 : now;
    this.lastInputId = this.activeId;
    for (const [id, element] of this.elements) element.parentElement?.toggleAttribute("data-pending", JSON.stringify(this.readParagraph(id, element)) !== this.rendered.get(id));
    this.emit();
  }

  private readParagraph(id: number, element: HTMLElement): LetterParagraph {
    const runs: LetterTextRun[] = [];
    const view = this.doc.defaultView!;
    const append = (text: string, parent: HTMLElement) => {
      if (!text) return;
      const style = view.getComputedStyle(parent);
      const color = style.color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Math.round(Number(value)).toString(16).padStart(2, "0")).join("") || "000000";
      let underline = false;
      for (let current: HTMLElement | null = parent; current; current = current === element ? null : current.parentElement) {
        underline ||= view.getComputedStyle(current).textDecorationLine.includes("underline");
      }
      const run: LetterTextRun = { text: text.replace(/\r\n?/g, "\n"), bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
        italic: style.fontStyle === "italic" || style.fontStyle === "oblique", underline,
        fontSize: Math.min(72, Math.max(6, Math.round(parseFloat(style.fontSize) * 0.75 * 2) / 2)) || 11,
        fontFamily: style.fontFamily.split(",")[0].replace(/^['"]|['"]$/g, "").slice(0, 80) || "Calibri", color: `#${color}` };
      const previous = runs.at(-1);
      if (previous && JSON.stringify({ ...previous, text: "" }) === JSON.stringify({ ...run, text: "" })) previous.text += run.text;
      else runs.push(run);
    };
    const walk = (node: Node) => {
      if (node.nodeType === 3) { append(node.textContent || "", node.parentElement as HTMLElement); return; }
      if (node.nodeType !== 1) return;
      const child = node as HTMLElement;
      if (child.tagName === "BR") { append("\n", child.parentElement!); return; }
      if (child.classList.contains("docx-tab-stop")) { append("\t", child); return; }
      if (["IMG", "SVG", "SCRIPT", "STYLE"].includes(child.tagName)) return;
      if (["DIV", "P"].includes(child.tagName) && child !== element && child.previousSibling) append("\n", child);
      child.childNodes.forEach(walk);
    };
    append(this.affixes.get(id)?.prefix || "", element);
    walk(element);
    append(this.affixes.get(id)?.suffix || "", element);
    const alignment = view.getComputedStyle(element).textAlign;
    return { id, text: runs.map((run) => run.text).join(""), runs,
      alignment: alignment === "justify" ? "both" : ["left", "center", "right"].includes(alignment) ? alignment as "left" | "center" | "right" : "left" };
  }

  private emit() {
    const paragraphs = [...this.elements].map(([id, element]) => this.readParagraph(id, element));
    for (const item of paragraphs) this.elements.get(item.id)?.parentElement?.toggleAttribute("data-pending", JSON.stringify(item) !== this.rendered.get(item.id));
    const changes = paragraphs.filter((item) => JSON.stringify(item) !== this.baseline.get(item.id)).map((item) => {
      const before = JSON.parse(this.baseline.get(item.id)! ) as LetterParagraph;
      // Plain wording edits retain the original Word runs, including theme fonts
      // the browser may not resolve. Export rich runs only after a format action.
      return { id: item.id, text: item.text, ...(this.formatted.has(item.id) ? { runs: item.runs } : {}),
        ...(item.alignment !== before.alignment ? { alignment: item.alignment } : {}) };
    });
    const selection = this.doc.getSelection();
    const anchor = selection?.anchorNode?.nodeType === 1 ? selection.anchorNode as Element : selection?.anchorNode?.parentElement;
    const style = anchor && this.doc.defaultView?.getComputedStyle(anchor);
    this.onState({ changes, canUndo: this.position > 0, canRedo: this.position < this.history.length - 1, active: this.activeId !== null,
      bold: this.activeId !== null && this.doc.queryCommandState("bold"), italic: this.activeId !== null && this.doc.queryCommandState("italic"), underline: this.activeId !== null && this.doc.queryCommandState("underline"),
      fontSize: this.activeId !== null && style ? Math.round(parseFloat(style.fontSize) * 0.75 * 2) / 2 : 11,
      alignment: this.activeId === null ? "left" : this.readParagraph(this.activeId, this.elements.get(this.activeId)!).alignment || "left",
      pageCount: this.root.querySelectorAll("section.docx").length });
  }
}

function mountPrintLayout(doc: Document, root: HTMLElement, layout: LetterPrintLayout, existing?: Map<number, HTMLElement>) {
  if (!layout?.pages?.length || !layout.blocks?.length) throw new Error("The print layout could not be loaded. Please try again.");
  const oldSheets = [...root.querySelectorAll<HTMLElement>("section.docx")];
  const sheets = layout.pages.map((page, index) => {
    if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(page.image) || !(page.width > 0 && page.height > 0)) throw new Error("Invalid letter page");
    const sheet = oldSheets[index] || doc.createElement("section");
    sheet.className = "docx letter-print-page";
    sheet.style.width = `${page.width}pt`;
    sheet.style.height = `${page.height}pt`;
    let background = sheet.querySelector<HTMLImageElement>(".letter-page-image");
    if (!background) { background = doc.createElement("img"); background.className = "letter-page-image"; sheet.prepend(background); }
    if (background.src !== page.image) background.src = page.image;
    background.alt = `Letter page ${index + 1}`;
    background.draggable = false;
    if (!sheet.parentElement) root.append(sheet);
    sheet.querySelectorAll(".letter-fragment-target").forEach((item) => item.remove());
    return sheet;
  });
  const paragraphs = new Map(existing || []);
  for (const block of layout.blocks) {
    const page = layout.pages[block.page], sheet = sheets[block.page];
    if (!sheet || !block.runs.length) continue;
    const margin = Math.max(18, Math.min(...layout.blocks.filter((item) => item.page === block.page).map((item) => item.x)));
    const isRight = block.x > page.width * .6;
    const isCentre = !isRight && block.x > page.width * .25 && block.width < page.width * .5;
    const x = isRight || isCentre ? margin : block.x;
    const width = isRight ? block.x + block.width - x : isCentre ? (block.x + block.width / 2 - x) * 2 : Math.max(block.width, page.width - margin - x);
    let paragraph = paragraphs.get(block.id);
    let region = paragraph?.parentElement;
    if (!paragraph || !region) {
      region = doc.createElement("div");
      region.className = "letter-edit-hitbox";
      paragraph = doc.createElement("p");
      const marker = doc.createElement("span");
      marker.id = `KV_EDIT_${block.id}`;
      paragraph.append(marker);
      const style = block.runs[0];
      paragraph.style.fontFamily = style.fontFamily;
      paragraph.style.fontSize = `${style.fontSize}pt`;
      paragraph.style.color = style.color;
      paragraph.style.textAlign = isRight ? "right" : isCentre ? "center" : "left";
      paragraph.style.lineHeight = `${block.lineHeight}pt`;
      for (const run of block.runs) {
        const span = doc.createElement("span");
        span.textContent = run.text;
        span.style.fontFamily = run.fontFamily;
        span.style.fontSize = `${run.fontSize}pt`;
        span.style.fontWeight = run.bold ? "700" : "400";
        span.style.fontStyle = run.italic ? "italic" : "normal";
        span.style.textDecoration = run.underline ? "underline" : "none";
        span.style.color = run.color;
        paragraph.append(span);
      }
      region.append(paragraph);
      paragraphs.set(block.id, paragraph);
    }
    region.style.left = `${x}pt`;
    region.style.top = `${block.y}pt`;
    region.style.width = `${width}pt`;
    region.style.minHeight = `${block.height}pt`;
    let mask = region.querySelector<HTMLElement>(".letter-original-mask");
    if (!mask) { mask = doc.createElement("div"); mask.className = "letter-original-mask"; region.prepend(mask); }
    mask.style.left = `${block.x - x - .7}pt`;
    mask.style.top = "-.7pt";
    mask.style.width = `${block.width + 1.4}pt`;
    mask.style.height = `${block.height + 1.4}pt`;
    if (region.parentElement !== sheet) sheet.append(region);
    for (const fragment of block.fragments.slice(1)) {
      const target = doc.createElement("button");
      target.type = "button";
      target.className = "letter-fragment-target";
      target.setAttribute("aria-label", "Edit continued paragraph");
      Object.assign(target.style, { left: `${fragment.x}pt`, top: `${fragment.y}pt`, width: `${fragment.width}pt`, height: `${fragment.height}pt` });
      target.addEventListener("click", () => { paragraph!.focus(); paragraph!.scrollIntoView({ block: "center" }); });
      sheets[fragment.page]?.append(target);
    }
  }
  // A cleared paragraph keeps a small editable target until this edit session
  // closes, so it can still be restored with Undo or by typing.
  for (const sheet of oldSheets.slice(sheets.length)) {
    for (const element of existing?.values() || []) if (sheet.contains(element)) sheets.at(-1)?.append(element.parentElement!);
    sheet.remove();
  }
}

export const letterCanvasShell = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>
html,body{margin:0;min-height:100%;background:#e5e8e3}#pages{display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px;width:max-content;min-width:100%;box-sizing:border-box}.letter-print-page{position:relative;flex:none;overflow:visible;background:white;box-shadow:0 3px 18px #18332626}.letter-page-image{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;user-select:none}.letter-edit-hitbox{position:absolute;z-index:1;outline:1px solid transparent;outline-offset:2px}.letter-edit-hitbox:hover{outline-color:#6a9b7866}.letter-edit-hitbox:focus-within{z-index:3;outline:2px solid #33805b;outline-offset:3px}.letter-edit-hitbox p{position:relative;z-index:1;margin:0;padding:0;min-height:1em;border:0;outline:0;white-space:pre-wrap;overflow-wrap:break-word;opacity:0;cursor:text}.letter-edit-hitbox:focus-within p,.letter-edit-hitbox[data-pending] p{opacity:1}.letter-edit-hitbox p span{background:white;box-decoration-break:clone;-webkit-box-decoration-break:clone}.letter-original-mask{position:absolute;background:white;display:none;pointer-events:none}.letter-edit-hitbox:focus-within .letter-original-mask,.letter-edit-hitbox[data-pending] .letter-original-mask{display:block}.letter-fragment-target{position:absolute;z-index:1;border:0;background:transparent;cursor:text}.letter-fragment-target:hover{outline:1px solid #33805b}::selection{background:#b5d6c1}
</style></head><body><div id="pages"></div></body></html>`;
