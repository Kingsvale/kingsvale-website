import { test, expect } from "@playwright/test";
import { defaultContent } from "../../src/data/defaultContent";

test("homepage selection is usable on desktop and mobile", async ({ page }, testInfo) => {
  const content = structuredClone(defaultContent);
  content.developments = Array.from({ length: 8 }, (_, index) => ({ ...content.developments[0], id: `project-${index}`, title: `Project ${index}`, ctaHref: `/developments/project-${index}` }));
  await page.addInitScript((value) => localStorage.setItem("kingsvale-site-content-v1", JSON.stringify(value)), content);
  await page.goto("/studio");
  await page.getByLabel("Studio passphrase").fill("KV-3D0pKUxlx2yC");
  await page.getByRole("button", { name: "Unlock studio" }).click();
  await page.getByRole("tab", { name: "Our developments", exact: true }).click();
  const selection = page.getByRole("group", { name: "Homepage selection · 6 / 6" });
  await expect(selection).toBeVisible();
  await expect(selection.getByRole("checkbox", { name: /Project 6/ })).toBeDisabled();
  await selection.getByRole("checkbox", { name: /Project 0/ }).uncheck();
  await page.getByRole("checkbox", { name: /Project 6/ }).check();
  await expect(selection.getByRole("checkbox", { name: /Project 0/ })).toBeDisabled();
  await selection.screenshot({ path: `test-results/homepage-selection-${testInfo.project.name}.png` });
  await expect(selection).toBeInViewport();
});
