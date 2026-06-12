import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/developments",
  "/developments/ridings",
  "/design-build",
  "/vision-process",
  "/about",
  "/land-wanted",
  "/contact"
];

test("public routes render without horizontal overflow", async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator("#root")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${route} should not create horizontal overflow`).toBeLessThanOrEqual(2);
  }
});

test("logo mark and type sit inside the header lockup on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "Logo lockup type is intentionally simplified on the mobile breakpoint.");

  await page.goto("/");
  const lockup = await page.evaluate(() => {
    const logo = document.querySelector(".logo")?.getBoundingClientRect();
    const mark = document.querySelector(".logo-mark")?.getBoundingClientRect();
    const type = document.querySelector(".logo-type")?.getBoundingClientRect();
    if (!logo || !mark || !type) {
      return null;
    }

    const within = (child: DOMRect, parent: DOMRect) =>
      child.left >= parent.left - 1 &&
      child.right <= parent.right + 1 &&
      child.top >= parent.top - 1 &&
      child.bottom <= parent.bottom + 1;

    return {
      markInside: within(mark, logo),
      typeInside: within(type, logo),
      markWidth: mark.width,
      typeWidth: type.width
    };
  });

  expect(lockup).not.toBeNull();
  expect(lockup?.markInside).toBe(true);
  expect(lockup?.typeInside).toBe(true);
  expect(lockup?.markWidth).toBeGreaterThan(52);
  expect(lockup?.typeWidth).toBeGreaterThan(90);
});

test("public homepage does not preload the private studio chunk", async ({ page }) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Shaping exceptional communities/i })).toBeVisible();

  expect(requestedUrls.some((url) => /\/assets\/studio-[^/]+\.js/.test(url))).toBe(false);
});
