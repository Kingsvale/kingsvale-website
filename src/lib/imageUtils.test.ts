import { describe, expect, it } from "vitest";
import { getOptimizedImageUrl, getResponsiveSrcSet } from "./imageUtils";

describe("image utilities", () => {
  it("adds responsive optimization parameters to Unsplash images", () => {
    const optimized = getOptimizedImageUrl(
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
      960
    );

    expect(optimized).toContain("auto=format");
    expect(optimized).toContain("fit=crop");
    expect(optimized).toContain("q=74");
    expect(optimized).toContain("w=960");
  });

  it("does not generate srcset values for uploaded data images", () => {
    expect(getResponsiveSrcSet("data:image/png;base64,abc")).toBeUndefined();
  });

  it("does not generate duplicate srcset values for non-optimizable images", () => {
    expect(getResponsiveSrcSet("/favicon.svg")).toBeUndefined();
  });
});
