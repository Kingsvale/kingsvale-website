import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createTrackingSite } from "../../src/lib/trackingStorage";

test("KML points can be deleted, cancelled and undone", async ({ page, context }) => {
  let stored = { ...createTrackingSite(), title: "Land map workflow test", reference: "KV-MAP-TEST" };
  if (process.env.PLAYWRIGHT_BASE_URL) {
    // Exercise compiled client routes with the production app shell, including Studio's preview iframe.
    await context.route("**/*", (route) => route.request().resourceType() === "document"
      ? route.fulfill({ path: resolve("dist/app.html"), contentType: "text/html" }) : route.fallback());
  }
  // Isolated API fixture: never create or modify a real customer site during browser checks.
  await context.route("**/api/tracking-sites**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") stored = { ...request.postDataJSON().site, updatedAt: new Date().toISOString() };
    const listing = new URL(request.url()).pathname === "/api/tracking-sites";
    await route.fulfill({ json: request.method() === "PUT" ? { site: stored } : listing ? { sites: [stored], storage: "dev-file" } : { site: stored } });
  });
  await context.route("https://api.postcodes.io/**", (route) => route.fulfill({ json: { result: { latitude: 51.5005, longitude: 0.1005 } } }));
  const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
  await context.route(/https:\/\/(server\.arcgisonline\.com|tile\.openstreetmap\.org)\//, (route) => route.fulfill({ contentType: "image/png", body: tile }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  const editor = page.getByRole("region", { name: "Land map", exact: true });
  await expect(editor.getByRole("button", { name: "Draw area", exact: true })).toBeEnabled();
  await editor.getByLabel("Find a postcode").fill("SW1A 1AA");
  await editor.getByRole("button", { name: "Find", exact: true }).click();
  await editor.getByLabel("Upload plot KML").setInputFiles(resolve("tests/fixtures/plot.kml"));
  await expect(editor.getByRole("status")).toContainText("Imported 1 area");
  await expect(editor.locator("path[fill='#ef4444']")).toHaveCount(1);
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect(editor.getByRole("status")).toContainText("Saved.");
  const imported = structuredClone(stored.landMap!);


  await editor.getByRole("button", { name: "Delete points", exact: true }).click();
  const corners = editor.locator(".marker-icon:not(.marker-icon-middle)");
  await expect(corners).toHaveCount(4);
  await expect(editor.locator(".marker-icon-middle")).toHaveCount(0);
  await corners.first().click();
  await expect(corners).toHaveCount(3);
  await corners.first().click();
  await expect(corners).toHaveCount(3);
  await editor.getByRole("button", { name: "Cancel editing" }).click();
  await editor.getByRole("button", { name: "Delete points", exact: true }).click();
  await expect(corners).toHaveCount(4);
  await corners.first().click();
  await editor.getByRole("button", { name: "Finish editing" }).click();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => stored.landMap?.selection[0].coordinates[0].length).toBe(4);
  expect(stored.landMap?.boundary).toEqual(imported.boundary);
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => stored.landMap?.selection).toEqual(imported.selection);

  expect(errors).toEqual([]);
});
