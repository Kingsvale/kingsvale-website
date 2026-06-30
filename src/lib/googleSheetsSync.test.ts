/// <reference types="node" />

import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalGoogleEnv = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON,
  GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY
};

describe("Google Sheets sync", () => {
  beforeEach(() => {
    for (const key of Object.keys(originalGoogleEnv) as Array<keyof typeof originalGoogleEnv>) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(originalGoogleEnv)) {
      if (value === undefined) {
        delete process.env[key as keyof NodeJS.ProcessEnv];
      } else {
        process.env[key as keyof NodeJS.ProcessEnv] = value;
      }
    }
  });

  it("uses RAW writes so user-provided text cannot execute as spreadsheet formulas", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets-sync@example.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = String(privateKey.export({ type: "pkcs8", format: "pem" }));

    const calls: Array<{ url: string; method: string; body: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: String(init?.body ?? "") });

      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "test-access-token", expires_in: 3600 });
      }

      if (url.includes("?fields=sheets.properties.title")) {
        return jsonResponse({ sheets: [{ properties: { title: "Letter reference" } }] });
      }

      if (method === "GET" && url.includes("/values/")) {
        return jsonResponse({});
      }

      return jsonResponse({});
    }));

    // @ts-expect-error server helper is runtime ESM without a TypeScript declaration file.
    const { syncTrackingSiteToGoogleSheet } = await import("../../server/google-sheets-sync.mjs");
    const result = await syncTrackingSiteToGoogleSheet(
      {
        id: "site-1",
        updatedAt: "2026-06-30T12:00:00.000Z",
        reference: "REF-001",
        customerName: "Legal Owner",
        ownerContactName: "Legal Owner",
        title: "Formula regression",
        siteAddressParts: { line1: "1 Plot Road", line2: "", town: "Town", county: "Council", postcode: "AB1 2CD" },
        siteAddress: "1 Plot Road, Town, AB1 2CD",
        ownerAddress: "Owner address",
        titleNumber: "AB123456",
        plotDescription: "Plot",
        region: "South",
        contactPriority: "high",
        mailingStatus: "not-mailed",
        currentStatus: "planning",
        mapEmbedUrl: "",
        searchlandUrl: "",
        royalMailTrackingNumber: "",
        trackingStatus: "",
        letterRecipientMode: "legal-owner",
        privateNotes: '=IMPORTXML("https://example.invalid","//x")'
      },
      { enabled: true, spreadsheetId: "spreadsheet-id", sheetName: "Letter reference" },
      { publicLink: "https://example.test/track/site-1" }
    );

    expect(result.status).toBe("synced");
    const writes = calls.filter((call) => call.method === "PUT" || call.method === "POST");
    expect(writes.map((call) => call.url)).toEqual(expect.arrayContaining([expect.stringContaining("valueInputOption=RAW")]));
    expect(writes.some((call) => call.url.includes("valueInputOption=USER_ENTERED"))).toBe(false);
    expect(writes.at(-1)?.body).toContain("=IMPORTXML");
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
