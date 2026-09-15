import { describe, expect, it } from "vitest";
import { defaultStudioSettings, normalizeStudioSettings } from "./studioSettings";

describe("studio settings", () => {
  it("keeps mailing preferences while dropping retired integration settings", () => {
    const legacy = { ...defaultStudioSettings(), defaultReminderDays: 21, googleSheet: { enabled: true, spreadsheetId: "old-sheet", sheetName: "Letters" } };
    const settings = normalizeStudioSettings(legacy);
    expect(settings.defaultReminderDays).toBe(21);
    expect(settings.letterPresets).toEqual(legacy.letterPresets);
    expect(settings).not.toHaveProperty("googleSheet");
  });
});
