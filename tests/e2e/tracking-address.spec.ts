import { expect, test, type Page } from "@playwright/test";
import { createTrackingSite } from "../../src/lib/trackingStorage";
import { defaultStudioSettings } from "../../src/lib/studioSettings";

async function setup(page: Page) {
  let site = {
    ...createTrackingSite(), id: "address-fixture", token: "abcdefghijklmnopqrstuvwx",
    title: "Newnham Lane land", reference: "KV0114", region: "Hampshire",
    siteAddress: "5 Brailsford Road, London, SW2 2TB",
    siteAddressParts: { line1: "5 Brailsford Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" }
  };
  await page.route("**/api/tracking-sites", async (route) => {
    if (route.request().method() === "PUT") {
      site = { ...route.request().postDataJSON().site, updatedAt: new Date().toISOString() };
      await route.fulfill({ json: { site } });
    } else await route.fulfill({ json: { sites: [site] } });
  });
  await page.route(`**/api/tracking-sites/${site.token}`, (route) => route.fulfill({ json: { site } }));
  await page.route("**/api/studio-settings", (route) => route.fulfill({ json: { settings: defaultStudioSettings() } }));
  return { site: () => site };
}

test("pasted letter details and a separate land address save independently across Sites, Mailing and QR pages", async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  const siteAddress = page.getByLabel("Site address (if different)", { exact: true });
  await expect(siteAddress).toHaveValue("");
  await expect(page.getByText("QR page site address:").locator("..")).toContainText("5 Brailsford Road");

  await page.getByLabel("Paste full letter address", { exact: true }).fill("LAND ADJACENT TO 5, NEWNHAM LANE, OLD BASING, rg247at");
  await expect(page.getByLabel("Address line 1", { exact: true })).toHaveValue("LAND ADJACENT TO 5");
  await expect(page.getByLabel("Address line 2", { exact: true })).toHaveValue("NEWNHAM LANE");
  await expect(page.getByLabel("Town / city", { exact: true })).toHaveValue("OLD BASING");
  await expect(page.getByLabel("County", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Postcode", { exact: true })).toHaveValue("RG24 7AT");
  // The split fields remain editable after paste, including corrections to town/county.
  await page.getByLabel("Town / city", { exact: true }).fill("Old Basing");
  await page.getByLabel("County", { exact: true }).fill("Hampshire");
  await expect.poll(() => state.site().siteAddressParts.county).toBe("Hampshire");
  expect(state.site().region).toBe("Hampshire");

  // Now use the owner's correspondence address for the actual mailing.
  await page.getByLabel("Paste full letter address", { exact: true }).fill("5 Brailsford Road\nLondon\nsw22tb");
  const land = "Land adjacent to 5, Newnham Lane, Old Basing, RG24 7AT";
  await siteAddress.fill(land);
  await expect(page.locator("#land-map-postcode")).toHaveValue("RG24 7AT");
  await expect.poll(() => state.site().landAddress).toBe(land);
  expect(state.site().siteAddressParts.postcode).toBe("SW2 2TB");
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(page.getByLabel("Address line 1", { exact: true })).toHaveValue("5 Brailsford Road");
  await expect(page.getByLabel("Postcode", { exact: true })).toHaveValue("SW2 2TB");
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(siteAddress).toHaveValue(land);

  await siteAddress.fill("");
  await expect(page.getByText("QR page site address:").locator("..")).toContainText("5 Brailsford Road");
  await expect(page.locator("#land-map-postcode")).toHaveValue("SW2 2TB");
  await expect.poll(() => state.site().landAddress).toBe("");
  await siteAddress.fill(land);
  await expect.poll(() => state.site().landAddress).toBe(land);
  await page.locator(".site-editor").screenshot({ path: testInfo.outputPath("separate-address-editor.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);

  await page.goto(`/track/${state.site().token}`);
  await expect(page.getByRole("heading", { name: "Newnham Lane land" })).toBeVisible();
  await expect(page.locator(".tracking-facts")).toContainText(land);
  await expect(page.locator(".tracking-facts")).not.toContainText("Brailsford");
  await expect(page.locator(".tracking-facts")).not.toContainText("SW2 2TB");
});

test("QR pages default to the letter address when no land address is supplied", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/track/${state.site().token}`);
  await expect(page.locator(".tracking-facts")).toContainText("5 Brailsford Road, London, SW2 2TB");
});
