import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createTrackingSite } from "../../src/lib/trackingStorage";

test("KML import, drawing, editing, undo and the same QR page share the saved selection", async ({ page, context }, testInfo) => {
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
  const qrLink = await page.getByTestId("generated-tracking-link").inputValue();

  await editor.getByLabel("Upload plot KML").setInputFiles({ name: "broken.kml", mimeType: "text/xml", buffer: Buffer.from("<kml>broken") });
  await expect(editor.getByRole("alert")).toContainText("not valid KML");
  await expect(editor.locator("path[fill='#ef4444']")).toHaveCount(1);

  await editor.getByRole("button", { name: "Draw a replacement area" }).click();
  await expect(editor.getByRole("button", { name: "Save map to QR page" })).toBeDisabled();
  const canvas = editor.getByRole("region", { name: "Land map drawing canvas" });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[.30, .32], [.66, .32], [.60, .67], [.30, .32]]) {
    await canvas.click({ position: { x: box.width * x, y: box.height * y } });
  }
  await expect(editor.getByRole("button", { name: "Save map to QR page" })).toBeEnabled();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => stored.landMap?.selection[0].coordinates[0].length).toBe(4);
  expect(stored.landMap?.selection).not.toEqual(imported.selection);
  const drawn = structuredClone(stored.landMap!);
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => stored.landMap?.selection).toEqual(imported.selection);

  await editor.getByRole("button", { name: "Edit corners", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Save map to QR page" })).toBeDisabled();
  const handle = editor.locator(".marker-icon:not(.marker-icon-middle)").first();
  await canvas.scrollIntoViewIfNeeded();
  await expect(handle).toBeVisible();
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 30, handleBox.y + 20, { steps: 5 });
  await page.mouse.up();
  await editor.getByRole("button", { name: "Finish editing" }).click();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => JSON.stringify(stored.landMap?.selection)).not.toBe(JSON.stringify(imported.selection));
  const edited = structuredClone(stored.landMap!);

  await editor.getByRole("button", { name: "Edit corners", exact: true }).click();
  const secondHandle = editor.locator(".marker-icon:not(.marker-icon-middle)").first();
  await canvas.scrollIntoViewIfNeeded();
  await expect(secondHandle).toBeVisible();
  const secondBox = (await secondHandle.boundingBox())!;
  await page.mouse.move(secondBox.x + 5, secondBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + 20, secondBox.y + 15, { steps: 5 });
  await page.mouse.up();
  await editor.getByRole("button", { name: "Cancel editing" }).click();
  await editor.getByRole("button", { name: "Save map to QR page" }).click();
  await expect.poll(() => stored.landMap?.selection).toEqual(edited.selection);
  await editor.screenshot({ path: testInfo.outputPath("land-map-editor.png") });

  await page.reload();
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(page.getByRole("region", { name: "Land map", exact: true }).locator("path[fill='#ef4444']")).toHaveCount(1);
  const customer = await context.newPage();
  await customer.goto(qrLink);
  await expect(customer.getByRole("region", { name: "Area Kingsvale is interested in" })).toBeVisible();
  await expect(customer.locator("path[fill='#ef4444']")).toHaveCount(1);
  await expect(customer.getByRole("button", { name: "Edit corners" })).toHaveCount(0);
  await expect(customer.locator("iframe")).toHaveCount(0);
  expect(stored.landMap?.selection).toEqual(edited.selection);
  // Same printed link sees a later save when opened again.
  stored = { ...stored, landMap: drawn };
  await customer.reload();
  await expect(customer.locator("path[fill='#ef4444']")).toHaveCount(1);
  await customer.screenshot({ path: testInfo.outputPath("customer-land-map.png") });
  expect(errors).toEqual([]);
});
