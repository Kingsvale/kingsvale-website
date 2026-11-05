import { expect, test } from "@playwright/test";
import { createTrackingSite } from "../../src/lib/trackingStorage";
import { defaultStudioSettings } from "../../src/lib/studioSettings";
import type { TrackingSite } from "../../src/lib/trackingTypes";

test("Mailing matches Sites order and remembers sorting and shared grouping across navigation and reload", async ({ page }, testInfo) => {
  let sites: TrackingSite[] = ([
    { ...createTrackingSite(), id: "alpha", title: "Alpha old high priority", reference: "KV0101", contactPriority: "high", updatedAt: "2026-11-01T12:00:00Z", mailingLastUpdatedAt: "2026-11-05T12:00:00Z", remailReminderDate: "2026-12-04" },
    { ...createTrackingSite(), id: "charlie", title: "Charlie tied medium priority", reference: "KV0103", contactPriority: "medium", updatedAt: "2026-11-03T12:00:00Z", mailingLastUpdatedAt: "2026-11-06T12:00:00Z", remailReminderDate: "2026-12-03" },
    { ...createTrackingSite(), id: "delta", title: "Delta tied high priority", reference: "KV0102", contactPriority: "high", updatedAt: "2026-11-03T12:00:00Z", mailingLastUpdatedAt: "2026-11-04T12:00:00Z", remailReminderDate: "" },
    { ...createTrackingSite(), id: "bravo", title: "Bravo latest low priority", reference: "KV0104", contactPriority: "low", updatedAt: "2026-11-04T12:00:00Z", mailingLastUpdatedAt: "2026-11-01T12:00:00Z", remailReminderDate: "2026-12-01" },
    { ...createTrackingSite(), id: "archived", title: "Archived site", reference: "KV0105", archived: true, updatedAt: "2026-11-07T12:00:00Z" }
  ] satisfies TrackingSite[]).map((site) => {
    const town = ["alpha", "delta"].includes(site.id) ? "Bath" : "York";
    const postcode = town === "Bath" ? "BA1 1AA" : "YO1 1AA";
    return { ...site, region: "Shared folder", siteAddress: `1 Example Road, ${town}, ${postcode}`,
      siteAddressParts: { line1: "1 Example Road", line2: "", town, county: "", postcode } };
  });
  let reads = 0;
  await page.route("**/api/tracking-sites", (route) => {
    if (route.request().method() === "PUT") {
      const saved = { ...route.request().postDataJSON().site, updatedAt: new Date().toISOString() };
      sites = sites.map((site) => site.id === saved.id ? saved : site);
      return route.fulfill({ json: { site: saved } });
    }
    // Matching timestamps must not depend on the response's insertion order.
    return route.fulfill({ json: { sites: ++reads % 2 ? sites : [...sites].reverse() } });
  });
  await page.route("**/api/studio-settings", (route) => route.fulfill({ json: { settings: defaultStudioSettings() } }));
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  const names = page.locator(".site-row__title");
  const byId = (ids: string[]) => ids.map((id) => sites.find((site) => site.id === id)!.title);
  const sitesOrder = byId(["bravo", "delta", "charlie", "alpha"]);

  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(names).toHaveText(sitesOrder);
  await page.locator(".site-row").filter({ hasText: sites[2].title }).click();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  const sort = page.getByLabel("Sort", { exact: true });
  await expect(sort).toHaveValue("sites");
  await expect(sort.locator("option")).toHaveText(["Same as Sites", "Priority", "Reminder date", "Last updated"]);
  await expect(names).toHaveText(sitesOrder);

  await sort.selectOption("priority");
  await expect(names).toHaveText(byId(["alpha", "delta", "charlie", "bravo"]));
  await expect(page.getByRole("heading", { name: sites[2].title, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(names).toHaveText(sitesOrder);
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(sort).toHaveValue("priority");
  await page.reload();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(sort).toHaveValue("priority");
  await expect(names).toHaveText(byId(["alpha", "delta", "charlie", "bravo"]));
  await sort.selectOption("updated");
  await expect(names).toHaveText(byId(["charlie", "alpha", "delta", "bravo"]));
  await sort.selectOption("reminder");
  await expect(names).toHaveText(byId(["bravo", "charlie", "alpha", "delta"]));
  await sort.selectOption("sites");

  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await page.getByLabel("Group locations by").selectOption("town");
  const townOrder = byId(["delta", "alpha", "bravo", "charlie"]);
  await expect(names).toHaveText(townOrder);
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(sort).toHaveValue("sites");
  await expect(page.getByLabel("Group locations by")).toHaveValue("town");
  await expect(names).toHaveText(townOrder);

  await page.locator(".site-row").filter({ hasText: sites[0].title }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Updated while using Sites order");
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(names).toHaveText(byId(["alpha", "delta", "bravo", "charlie"]));
  await expect(page.getByLabel("Private notes", { exact: true })).toHaveValue("Updated while using Sites order");
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(names).toHaveText(byId(["alpha", "delta", "bravo", "charlie"]));
  await page.reload();
  await page.getByRole("tab", { name: "Mailing", exact: true }).click();
  await expect(sort).toHaveValue("sites");
  await expect(page.getByLabel("Group locations by")).toHaveValue("town");
  await expect(names).toHaveText(byId(["alpha", "delta", "bravo", "charlie"]));
  await page.locator(".mailing-list").screenshot({ path: testInfo.outputPath("mailing-sites-order.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
