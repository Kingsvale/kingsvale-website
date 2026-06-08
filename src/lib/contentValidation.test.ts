import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { cloneContent } from "./storage";
import {
  fieldLimits,
  isValidHref,
  validateSiteContent
} from "./contentValidation";

describe("content validation", () => {
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
