import { expect, test, type Page } from "@playwright/test";
import { createTrackingSite } from "../../src/lib/trackingStorage";
import { defaultStudioSettings } from "../../src/lib/studioSettings";
import type { TrackingSite } from "../../src/lib/trackingTypes";

async function setup(page: Page) {
  let sites: TrackingSite[] = [
    { ...createTrackingSite(), id: "site-a", token: "abcdefghijklmnopqrstuvwx", title: "Petworth Court", reference: "KV0101", region: "Berkshire", siteAddress: "6 Petworth Court, Helston Lane, Windsor, Berkshire, SL4 5HS", siteAddressParts: { line1: "6 Petworth Court", line2: "Helston Lane", town: "Windsor", county: "Berkshire", postcode: "SL4 5HS" } },
    { ...createTrackingSite(), id: "site-b", token: "bcdefghijklmnopqrstuvwxy", title: "Oakley House", reference: "KV0102", region: "Hampshire", siteAddress: "72 Pardown, Oakley, Hampshire, RG23 7DZ", siteAddressParts: { line1: "72 Pardown", line2: "", town: "Oakley", county: "Hampshire", postcode: "RG23 7DZ" } }
  ];
  let settings = { ...defaultStudioSettings(), letterPresets: [{ id: "preset-a", name: "Follow Up Full Details", templateName: "Kingsvale Follow Up Title Deed.docx", templateUrl: "/templates/kingsvale-follow-up-letter-template.docx", recipientMode: "title-owner" as const, createdAt: new Date().toISOString() }] };
  const saves: TrackingSite[] = [];
  await page.route("**/api/tracking-sites", async (route) => {
    if (route.request().method() === "PUT") {
      const site = { ...route.request().postDataJSON().site, updatedAt: new Date().toISOString() };
      saves.push(site);
      await new Promise((resolve) => setTimeout(resolve, 250));
      sites = sites.map((item) => item.id === site.id ? site : item);
      await route.fulfill({ json: { site } });
    } else await route.fulfill({ json: { sites } });
  });
  await page.route("**/api/studio-settings", (route) => {
    if (route.request().method() === "PUT") settings = route.request().postDataJSON().settings;
    return route.fulfill({ json: { settings } });
  });
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await page.locator(".site-row").filter({ hasText: "Petworth Court" }).click();
  await expect(page.getByLabel("Site title", { exact: true })).toHaveValue("Petworth Court");
  return { saves, sites: () => sites };
}

test("Sites and Mailing autosave typing and flush pending edits before changing tabs", async ({ page }) => {
  const state = await setup(page);
  await page.getByLabel("Site title", { exact: true }).fill("Petworth Court land enquiry");
  await expect.poll(() => state.sites()[0].title).toBe("Petworth Court land enquiry");
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  await page.getByLabel("Legal owner / customer name", { exact: true }).fill("Alex Example");
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.getByLabel("Recipient name", { exact: true })).toHaveValue("Alex Example");
  await page.getByLabel("Notes", { exact: true }).fill("Call again next month");
  await expect.poll(() => state.sites()[0].mailingNotes).toBe("Call again next month");
  await page.getByLabel("Recipient name", { exact: true }).fill("Alex Changed");
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(page.getByLabel("Legal owner / customer name", { exact: true })).toHaveValue("Alex Changed");
  await page.getByLabel("Site title", { exact: true }).fill("");
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sites", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Site title", { exact: true }).fill("Petworth Court");
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
});

test("folders support bulk moves, rename, grouping, and manual address entry", async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.getByLabel("Select all shown", { exact: true }).check();
  await page.getByLabel("Move to folder", { exact: true }).fill("Thames Valley");
  await page.getByRole("button", { name: "Move selected", exact: true }).click();
  await expect.poll(() => state.sites().every((site) => site.region === "Thames Valley")).toBe(true);
  await page.getByLabel("Filter by folder").selectOption("Thames Valley");
  await page.getByRole("button", { name: "Rename folder", exact: true }).click();
  await page.getByLabel("New folder name").fill("Western region");
  await page.getByRole("button", { name: "Save folder name", exact: true }).click();
  await expect.poll(() => state.sites().every((site) => site.region === "Western region")).toBe(true);
  await page.getByLabel("Group locations by").selectOption("town");
  await expect(page.getByRole("button", { name: "Windsor 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(page.locator(".site-library__row")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await page.getByLabel("County", { exact: true }).fill("Berkshire updated");
  await expect.poll(() => state.sites()[0].siteAddressParts.county).toBe("Berkshire updated");
  expect(state.sites()[0].region).toBe("Western region");
  await page.getByLabel("Address line 1", { exact: true }).fill("8 Petworth Court");
  await expect(page.getByRole("button", { name: "Find addresses", exact: true })).toHaveCount(0);
  await expect.poll(() => state.sites()[0].siteAddressParts.line1).toBe("8 Petworth Court");
  await page.locator(".site-library").screenshot({ path: testInfo.outputPath("site-folders.png") });
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.getByLabel("Folder / region", { exact: true })).toHaveValue("Western region");
  await expect(page.getByLabel("Address line 1", { exact: true })).toHaveValue("8 Petworth Court");
  await expect(page.getByRole("button", { name: "Find addresses", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});

test("preset actions and Delete fit their card on desktop and mobile", async ({ page }, testInfo) => {
  await setup(page);
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  const card = page.locator(".settings-preset").first();
  const remove = card.getByRole("button", { name: "Delete Follow Up Full Details preset", exact: true });
  await expect(remove).toBeVisible();
  const dimensions = await remove.evaluate((button) => ({ width: button.getBoundingClientRect().width, overflow: button.scrollWidth - button.clientWidth }));
  expect(dimensions.width).toBeGreaterThan(75);
  expect(dimensions.overflow).toBeLessThanOrEqual(2);
  await card.screenshot({ path: testInfo.outputPath("preset-actions.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await remove.click();
  await expect(card).toHaveCount(0);
});
