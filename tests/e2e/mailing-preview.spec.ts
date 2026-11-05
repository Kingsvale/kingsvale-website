import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createTrackingSite } from "../../src/lib/trackingStorage";
import { defaultStudioSettings } from "../../src/lib/studioSettings";
// @ts-expect-error Production document generator is runtime ESM.
import { createTrackingQrPng, generateLetterDocx, editLetterParagraphs, extractLetterParagraphs } from "../../server/letter-generator.mjs";
// @ts-expect-error Production document editor is runtime ESM.
import { letterContent } from "../../server/letter-editor.mjs";

test("mailing preserves edits when sorting and previews a generated branded letter", async ({ page, context }, testInfo) => {
  let site = { ...createTrackingSite(), title: "Oakley letter test", reference: "KV-TEST-042", customerName: "Test Owner",
    siteAddress: "72 Pardown, Oakley, Hampshire, RG23 7DZ", siteAddressParts: { line1: "72 Pardown", line2: "", town: "Oakley", county: "Hampshire", postcode: "RG23 7DZ" } };
  let generated: Buffer;
  let serverPreview = false;
  let failEdit = false;
  let failLoad = false;
  let savedChanges: Array<{ id: number; text: string; runs?: Array<{ bold: boolean; italic: boolean; underline: boolean; fontSize: number }>; alignment?: string }> = [];
  await context.route("**/api/letters/preview", (route) => serverPreview
    ? route.fulfill({ json: { pageCount: 1, pages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="] } })
    : route.fulfill({ status: 404, json: { error: "Local renderer unavailable" } }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/api/studio-settings", (route) => route.fulfill({ json: { settings: { ...defaultStudioSettings(), letterPresets: [
    { id: "initial", name: "Initial Full Details", templateName: "Initial.docx", templateUrl: "/templates/kingsvale-initial-letter-template.docx", recipientMode: "title-owner", stage: "initial", createdAt: "2026-09-15" },
    { id: "follow-up", name: "Follow Up Full Details", templateName: "Follow Up.docx", templateUrl: "/templates/kingsvale-follow-up-letter-template.docx", recipientMode: "title-owner", stage: "follow-up", createdAt: "2026-09-15" }
  ] } } }));
  await context.route("**/api/tracking-sites", (route) => {
    if (route.request().method() === "PUT") site = route.request().postDataJSON().site;
    return route.fulfill({ json: route.request().method() === "PUT" ? { site } : { sites: [site], storage: "dev-file" } });
  });
  await context.route("**/api/letters/generate", async (route) => {
    const data = route.request().postDataJSON();
    const qr = await createTrackingQrPng(data.publicLink, data.site.qrStyle, data.site.title);
    generated = generateLetterDocx(await readFile(`public${data.templateUrl}`), data.site, data.publicLink, qr);
    expect(data.stage).toBe(site.initialLetterGeneratedAt ? "follow-up" : "initial");
    serverPreview = true;
    const documents = [{ kind: "letter-pdf", url: "/media/test-letter.pdf", name: "Oakley letter.pdf" },
      ...(data.stage === "initial" ? [{ kind: "envelope-docx", url: "/media/test-envelope.docx", name: "Oakley envelope.docx" }, { kind: "envelope-pdf", url: "/media/test-envelope.pdf", name: "Oakley envelope.pdf" }] : [])];
    await route.fulfill({ json: { file: { url: "/media/test-generated.docx", name: "Oakley letter.docx", documents } } });
  });
  await context.route("**/media/test-generated.docx", (route) => route.fulfill({ body: generated, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  await context.route("**/media/test-edited.docx", (route) => route.fulfill({ body: generated, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  await context.route("**/api/letters/draft-preview", (route) => {
    const data = route.request().postDataJSON();
    expect(data.changes.some((item: { text: string }) => item.text === "Dear Alex Example,")).toBe(true);
    return route.fulfill({ json: { pageCount: 1, pages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="] } });
  });
  await context.route("**/api/letters/content", (route) => failLoad
    ? route.fulfill({ status: 422, json: { error: "Letter text could not be loaded." } })
    : route.fulfill({ json: letterContent(generated) }));
  await context.route("**/api/letters/edit", (route) => {
    if (failEdit) return route.fulfill({ status: 422, json: { error: "The PDF could not be prepared. Please try again." } });
    const data = route.request().postDataJSON();
    expect(data.url).toBe(site.letterFileUrl);
    expect(data.version).toBe(letterContent(generated).version);
    savedChanges = data.changes;
    generated = editLetterParagraphs(generated, data.changes);
    return route.fulfill({ status: 201, json: { file: { url: "/media/test-edited.docx", name: "Oakley letter.docx", documents: [{ kind: "letter-pdf", url: "/media/test-edited.pdf", name: "Oakley letter.pdf" }] } } });
  });
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await page.getByLabel("Site title", { exact: true }).fill("Oakley land enquiry");
  await page.getByRole("button", { name: "Mailing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Oakley land enquiry", exact: true })).toBeVisible();
  expect(site.title).toBe("Oakley land enquiry");
  await page.getByLabel("Recipient name", { exact: true }).fill("Alex Example");
  await page.getByLabel("Sort", { exact: true }).selectOption("updated");
  await expect(page.getByLabel("Recipient name", { exact: true })).toHaveValue("Alex Example");
  await expect(page.getByLabel("Letter stage", { exact: true })).toHaveValue("initial");
  await expect(page.getByLabel("Letter stage", { exact: true }).locator("option")).toHaveCount(1);
  await expect(page.getByLabel("Letter preset", { exact: true }).locator("option")).toHaveText(["Choose a template", "Initial Full Details"]);
  await page.getByLabel("Letter preset", { exact: true }).selectOption("initial");
  await page.getByLabel("Address letter to", { exact: true }).selectOption("title-owner");
  await page.getByRole("button", { name: "Generate & preview letter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const canvasPage = page.frameLocator('iframe[title="Letter editor page"]');
  await expect(dialog.getByRole("status")).toContainText("Print layout preview");
  await expect(dialog.getByRole("link", { name: "Open PDF / Print" })).toHaveAttribute("href", "/media/test-letter.pdf");
  await page.keyboard.press("Escape");
  await expect(page.locator('.mailing-print-files .letter-upload')).toHaveCount(3);
  await expect(page.locator('.mailing-print-files').getByRole("link", { name: "Open PDF / Print" })).toHaveCount(2);
  serverPreview = false;
  await page.getByRole("button", { name: "Preview letter", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Preview ready", { timeout: 20000 });
  const document = page.frameLocator('iframe[title="Letter document"]');
  await expect(document.locator("body")).toContainText("Alex Example");
  await expect(document.locator("body")).toContainText("RG23 7DZ");
  await expect(document.locator("body")).not.toContainText("{{legal_name}}");
  await expect(document.locator("img").first()).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath("letter-preview.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const envelopes = site.letterDocuments?.filter((item) => item.kind !== "letter-pdf");
  failLoad = true;
  await page.getByRole("button", { name: "Edit letter", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be loaded");
  failLoad = false;
  await dialog.getByRole("button", { name: "Try loading again" }).click();
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Sir/Madam,");
  await expect(canvasPage.locator("section.docx")).toBeVisible();
  await expect(canvasPage.locator("img").first()).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath("graphical-letter-full-page.png") });
  await dialog.getByRole("button", { name: "Use recipient name in greeting" }).click();
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Alex Example,");
  // Locate by the saved value rather than relying on a template's paragraph order.
  const bodyName = await canvasPage.getByRole("textbox").filter({ hasText: /^I am writing/ }).getAttribute("aria-label");
  const body = canvasPage.getByRole("textbox", { name: bodyName!, exact: true });
  await body.fill("A personal note about your land.\nPlease contact us when convenient.");
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(body).toContainText("I am writing");
  await dialog.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(body).toHaveJSProperty("innerText", "A personal note about your land.\nPlease contact us when convenient.");
  await canvasPage.getByLabel("Greeting", { exact: true }).click();
  await canvasPage.getByLabel("Greeting", { exact: true }).press("Control+a");
  await dialog.getByRole("button", { name: "Bold", exact: true }).click();
  await dialog.getByRole("button", { name: "Italic", exact: true }).click();
  await dialog.getByRole("button", { name: "Underline", exact: true }).click();
  await dialog.getByLabel("Font size", { exact: true }).selectOption("14");
  await dialog.getByRole("button", { name: "Align centre", exact: true }).click();
  await dialog.getByLabel("Zoom", { exact: true }).selectOption("100");
  await dialog.getByLabel("Zoom", { exact: true }).selectOption("fit");
  await dialog.screenshot({ path: testInfo.outputPath("graphical-letter-editor.png") });
  const beforePreviewUrl = site.letterFileUrl;
  await dialog.getByRole("button", { name: "Preview print layout", exact: true }).click();
  await expect(dialog.getByRole("img", { name: "Edited letter page 1", exact: true })).toBeVisible();
  expect(site.letterFileUrl).toBe(beforePreviewUrl);
  await dialog.getByRole("button", { name: "Back to editing", exact: true }).click();
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Alex Example,");
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Discard your unsaved changes?", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  failEdit = true;
  await dialog.getByRole("button", { name: "Save changes & preview" }).click();
  await expect(dialog.getByRole("alert")).toContainText("PDF could not be prepared");
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Alex Example,");
  expect(site.letterFileUrl).toBe("/media/test-generated.docx");
  await dialog.screenshot({ path: testInfo.outputPath("letter-editor.png") });
  failEdit = false;
  serverPreview = true;
  await dialog.getByRole("button", { name: "Save changes & preview" }).click();
  await expect(dialog.getByRole("status")).toContainText("Print layout preview");
  await expect(dialog.getByRole("link", { name: "Open PDF / Print" })).toHaveAttribute("href", "/media/test-edited.pdf");
  await page.keyboard.press("Escape");
  expect(site.letterFileUrl).toBe("/media/test-edited.docx");
  const savedGreeting = savedChanges.find((item) => item.text === "Dear Alex Example,");
  expect(savedGreeting?.alignment).toBe("center");
  expect(savedGreeting?.runs?.some((run) => run.bold && run.italic && run.underline && run.fontSize === 14)).toBe(true);
  expect(savedChanges.find((item) => item.text.startsWith("A personal note"))?.runs).toBeUndefined();
  expect(site.letterDocuments?.filter((item) => item.kind !== "letter-pdf")).toEqual(envelopes);
  expect(extractLetterParagraphs(generated).some((item: { text: string }) => item.text === "Dear Alex Example,")).toBe(true);
  expect(extractLetterParagraphs(generated).some((item: { text: string }) => item.text === "A personal note about your land.\nPlease contact us when convenient.")).toBe(true);
  await page.getByRole("button", { name: "Edit letter", exact: true }).click();
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Alex Example,");
  await canvasPage.getByLabel("Greeting", { exact: true }).fill("Do not save this");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(extractLetterParagraphs(generated).some((item: { text: string }) => item.text === "Do not save this")).toBe(false);
  await page.reload();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await page.getByRole("button", { name: "Edit letter", exact: true }).click();
  await expect(canvasPage.getByLabel("Greeting", { exact: true })).toHaveText("Dear Alex Example,");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(site.initialLetterGeneratedAt).toBeTruthy();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.getByLabel("Letter stage", { exact: true })).toHaveValue("follow-up");
  await expect(page.getByLabel("Letter preset", { exact: true }).locator("option")).toHaveText(["Choose a template", "Follow Up Full Details"]);
  await page.getByLabel("Letter preset", { exact: true }).selectOption("follow-up");
  await page.getByRole("button", { name: "Generate & preview letter", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Print layout preview", { timeout: 20000 });
  await page.keyboard.press("Escape");
  expect(site.letterDocuments?.map((document) => document.kind).sort()).toEqual(["envelope-docx", "envelope-pdf", "letter-pdf"]);
  await page.locator('.mailing-print-files').screenshot({ path: testInfo.outputPath("print-files.png") });
  await page.getByRole("button", { name: "Mark posted today", exact: true }).click();
  await page.getByRole("button", { name: "Save mailing", exact: true }).click();
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  expect(site.lastMailedAt).not.toBe("");
  expect(site.remailReminderDate > site.lastMailedAt).toBe(true);
  serverPreview = true;
  await page.getByRole("button", { name: "Preview letter", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Print layout preview");
  await expect(page.getByRole("img", { name: "Document page 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("lookup and service cards have readable typography and fit the viewport", async ({ page }, testInfo) => {
  await page.goto("/plot-lookup");
  await expect(page.getByLabel("Reference number", { exact: true })).toBeVisible();
  await page.locator(".lookup-panel").screenshot({ path: testInfo.outputPath("lookup.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await page.goto("/design-build");
  await page.locator(".process-grid").scrollIntoViewIfNeeded();
  await expect(page.locator(".process-card").first()).toBeVisible();
  const body = page.locator(".process-card p span").first();
  await expect(body).toHaveCSS("font-weight", "400");
  await expect(body).toHaveCSS("color", "rgb(91, 96, 86)");
  for (const card of await page.locator(".process-card").all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS("opacity", "1");
  }
  await page.locator(".process-grid").screenshot({ path: testInfo.outputPath("cards.png") });
});
