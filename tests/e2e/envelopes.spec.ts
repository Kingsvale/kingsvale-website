import { expect, test } from "@playwright/test";
import { createTrackingSite } from "../../src/lib/trackingStorage";
import { defaultStudioSettings } from "../../src/lib/studioSettings";

for (const legacy of [false, true]) test(`regenerate ${legacy ? "missing legacy" : "old"} envelopes without replacing the letter`, async ({ page, context }, testInfo) => {
  let site = { ...createTrackingSite(), title: "Envelope renewal test", reference: "KV-ENV-1", customerName: "Original Owner", letterRecipientMode: "title-owner" as const,
    letterFileName: "personal-letter.docx", letterFileUrl: "/media/personal-letter.docx", firstMailedAt: "2026-11-01", lastMailedAt: "2026-11-03", remailReminderDate: "2026-11-17",
    letterDocuments: legacy ? undefined : [
      { kind: "letter-pdf" as const, name: "personal-letter.pdf", url: "/media/personal-letter.pdf" },
      { kind: "envelope-docx" as const, name: "old-envelope.docx", url: "/media/old-envelope.docx" },
      { kind: "envelope-pdf" as const, name: "old-envelope.pdf", url: "/media/old-envelope.pdf" }
    ] };
  const before = structuredClone(site);
  let fail = true;
  await context.route("**/api/studio-settings", (route) => route.fulfill({ json: { settings: defaultStudioSettings() } }));
  await context.route("**/api/tracking-sites", (route) => {
    if (route.request().method() === "PUT") site = route.request().postDataJSON().site;
    return route.fulfill({ json: route.request().method() === "PUT" ? { site } : { sites: [site], storage: "dev-file" } });
  });
  await context.route("**/api/letters/envelopes", (route) => {
    expect(route.request().postDataJSON()).toEqual({ siteId: site.id });
    expect(site.customerName).toBe("Updated Owner");
    expect(site.siteAddressParts.line1).toBe("12 Updated Road");
    if (fail) return route.fulfill({ status: 422, json: { error: "Envelopes could not be prepared. Please try again." } });
    return route.fulfill({ status: 201, json: { documents: [
      { kind: "envelope-docx", name: "KV-ENV-1-envelope.docx", url: "/media/new-envelope.docx" },
      { kind: "envelope-pdf", name: "KV-ENV-1-envelope.pdf", url: "/media/new-envelope.pdf" }
    ] } });
  });
  await context.route("**/api/letters/preview", (route) => route.fulfill({ json: { pageCount: 1, pages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="] } }));
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await page.getByLabel("Recipient name", { exact: true }).fill("Updated Owner");
  await page.getByLabel("Address line 1", { exact: true }).fill("12 Updated Road");
  await page.getByRole("button", { name: "Regenerate envelopes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Envelopes could not be prepared" })).toBeVisible();
  expect(site.letterDocuments).toEqual(before.letterDocuments);
  fail = false;
  await page.getByRole("button", { name: "Regenerate envelopes", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toContainText("1 page");
  await expect(dialog.getByRole("link", { name: "Open PDF / Print", exact: true })).toHaveAttribute("href", "/media/new-envelope.pdf");
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  expect(site.letterFileName).toBe(before.letterFileName);
  expect(site.letterFileUrl).toBe(before.letterFileUrl);
  expect(site.letterDocuments?.find((document) => document.kind === "letter-pdf")).toEqual(before.letterDocuments?.find((document) => document.kind === "letter-pdf"));
  expect(site.letterDocuments?.filter((document) => document.kind.startsWith("envelope-")).map((document) => document.url)).toEqual(["/media/new-envelope.docx", "/media/new-envelope.pdf"]);
  expect(site.firstMailedAt).toBe(before.firstMailedAt);
  expect(site.lastMailedAt).toBe(before.lastMailedAt);
  expect(site.remailReminderDate).toBe(before.remailReminderDate);
  await page.locator(".mailing-print-files").screenshot({ path: testInfo.outputPath("regenerate-envelopes.png") });
  await page.reload();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.locator(".mailing-print-files").getByRole("link", { name: "Open PDF / Print", exact: true }).filter({ hasText: "Open PDF" }).last()).toHaveAttribute("href", "/media/new-envelope.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
