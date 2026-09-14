import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { applyTextEdit, contentBindings, copyKey, readField } from "./siteEditing";
import { validateSiteContent } from "./contentValidation";

describe("live website editing", () => {
  it("updates structured copy and preserves stable overrides across serialization", () => {
    const content = structuredClone(defaultContent);
    expect(applyTextEdit(content, "about.body", "We have over 25 years of experience.")).toBe(true);
    const path = `textOverrides.${copyKey("Our approach", "/about")}`;
    expect(applyTextEdit(content, path, "Homes made with care")).toBe(true);
    const restored = JSON.parse(JSON.stringify(content));
    expect(readField(restored, path)).toBe("Homes made with care");
    expect(restored.about.body).toBe("We have over 25 years of experience.");
    expect(validateSiteContent(restored).valid).toBe(true);
    expect(contentBindings(content).images.get(content.about.image)).toBe("about.image");
  });
  it("rejects unknown fields, links, prototype keys and oversized copy", () => {
    const content = structuredClone(defaultContent);
    for (const path of ["hero.href", "navLinks.0.href", "missing.text", "textOverrides.__proto__", "textOverrides.constructor", "textOverrides.prototype"]) {
      expect(applyTextEdit(content, path, "unwanted")).toBe(false);
    }
    expect(applyTextEdit(content, "about.body", "x".repeat(2401))).toBe(false);
    expect(readField(content, "constructor")).toBeUndefined();
  });
  it("validates persisted extra page images and copy", () => {
    const content = structuredClone(defaultContent);
    content.imageOverrides = { logo: { src: "/media/logo.webp", alt: "Kingsvale" } };
    expect(validateSiteContent(content).valid).toBe(true);
    content.textOverrides = JSON.parse('{"__proto__":"invalid"}');
    expect(validateSiteContent(content).valid).toBe(false);
  });
});
