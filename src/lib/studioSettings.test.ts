import { describe, expect, it } from "vitest";
import { defaultStudioSettings, normalizeStudioSettings } from "./studioSettings";

describe("studio settings", () => {
  it("defaults Google Sheet sync off with the letter reference tab", () => {
    expect(defaultStudioSettings().googleSheet).toEqual({
      enabled: false,
      spreadsheetId: "",
      sheetName: "Letter reference"
    });
  });

  it("normalizes Google Sheet configuration safely", () => {
    const settings = normalizeStudioSettings({
      googleSheet: {
        enabled: true,
        spreadsheetId: "sheet_123",
        sheetName: "Letter: Reference / 2026"
      }
    });

    expect(settings.googleSheet).toEqual({
      enabled: true,
      spreadsheetId: "sheet_123",
      sheetName: "Letter Reference 2026"
    });
  });
});
