import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { cloneContent } from "./storage";
import {
  fieldLimits,
  isValidHref,
  validateSiteContent
} from "./contentValidation";

describe("content validation", () => {
  it("allows publishing images without descriptions and still limits supplied descriptions", () => {
    const content = cloneContent(defaultContent);
    content.hero.image.alt = "";
    content.developments[0].gallery = [{ ...content.developments[0].image, alt: "" }];
    expect(validateSiteContent(content).valid).toBe(true);
    content.hero.image.alt = "x".repeat(151);
    expect(validateSiteContent(content).errors.some((error) => error.path === "hero.image.alt")).toBe(true);
  });
  it("accepts the default Kingsvale content", () => {
    expect(validateSiteContent(defaultContent).valid).toBe(true);
  });

  it("blocks hero titles that would break the designed hero", () => {
    const content = cloneContent(defaultContent);
    content.hero.title = "A".repeat(fieldLimits.heroTitle + 1);

    const result = validateSiteContent(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "hero.title",
        message: expect.stringContaining(`${fieldLimits.heroTitle}`)
      })
    );
  });

  it("requires exactly four feature-strip items", () => {
    const content = cloneContent(defaultContent);
    content.features = content.features.slice(0, 3);

    const result = validateSiteContent(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "features",
        message: "The feature strip must contain exactly four feature items."
      })
    );
  });

  it("allows curated link formats used by the site editor", () => {
    expect(isValidHref("#developments")).toBe(true);
    expect(isValidHref("/admin")).toBe(true);
    expect(isValidHref("mailto:hello@example.com")).toBe(true);
    expect(isValidHref("tel:01252123456")).toBe(true);
    expect(isValidHref("javascript:alert(1)")).toBe(false);
  });
});

it("requires distinct project addresses without breaking stable project IDs", () => {
  const content = cloneContent(defaultContent);
  content.developments[0].ctaHref = "/developments/amber-grove";
  expect(validateSiteContent(content).valid).toBe(true);
  content.developments[1].ctaHref = content.developments[0].ctaHref;
  expect(validateSiteContent(content).valid).toBe(false);
  content.developments[1].ctaHref = "/developments/ridings";
  expect(validateSiteContent(content).valid).toBe(false);
  content.developments[1].ctaHref = "/contact";
  expect(validateSiteContent(content).valid).toBe(false);
});
