import { createSign } from "node:crypto";

const sheetsApiBase = "https://sheets.googleapis.com/v4/spreadsheets";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const defaultSyncTimeoutMs = 8_000;

const sheetHeaders = [
  "Site ID",
  "Updated at",
  "Reference",
  "Legal / owner name",
  "Site title",
  "Address line 1",
  "Address line 2",
  "Town",
  "Council / county",
  "Postcode",
  "Full site address",
  "Owner address",
  "Title number",
  "Plot description",
  "Region",
  "Contact priority",
  "Mailing status",
  "Current status",
  "Public tracking link",
  "Google map link",
  "Searchland link",
  "Royal Mail tracking number",
  "Royal Mail status",
  "Letter recipient mode",
  "Private notes"
];

let cachedToken = null;

export async function syncTrackingSiteToGoogleSheet(site, googleSheetSettings, options = {}) {
  const settings = normalizeGoogleSheetSettings(googleSheetSettings);
  if (!settings.enabled) {
    return { status: "disabled", message: "Google Sheet sync is off." };
  }

  if (!settings.spreadsheetId) {
    return { status: "skipped", message: "Google Sheet ID is missing." };
  }

  const credentials = readServiceAccountCredentials();
  if (!credentials) {
    return { status: "skipped", message: "Google Sheets service-account credentials are not configured." };
  }

  const timeout = createTimeoutSignal(options.timeoutMs);
  try {
    const accessToken = await getAccessToken(credentials, timeout.signal);
    await ensureSheet(accessToken, settings, timeout.signal);
    await ensureHeaderRow(accessToken, settings, timeout.signal);
    const existingRow = await findExistingSiteRow(accessToken, settings, site.id, timeout.signal);
    const row = buildSiteRow(site, options.publicLink ?? "");

    if (existingRow) {
      await updateValues(accessToken, settings.spreadsheetId, rangeFor(settings.sheetName, `A${existingRow}:${columnName(sheetHeaders.length)}${existingRow}`), [row], timeout.signal);
      return {
        status: "synced",
        action: "updated",
        row: existingRow,
        spreadsheetId: settings.spreadsheetId,
        sheetName: settings.sheetName
      };
    }

    await appendValues(accessToken, settings.spreadsheetId, rangeFor(settings.sheetName, `A:${columnName(sheetHeaders.length)}`), [row], timeout.signal);
    return {
      status: "synced",
      action: "appended",
      spreadsheetId: settings.spreadsheetId,
      sheetName: settings.sheetName
    };
  } catch (error) {
    return {
      status: "failed",
      message: sanitizeErrorMessage(error)
    };
  } finally {
    timeout.clear();
  }
}

export function normalizeGoogleSheetSettings(value = {}) {
  const settings = value && typeof value === "object" ? value : {};
  return {
    enabled: Boolean(settings.enabled),
    spreadsheetId: cleanText(settings.spreadsheetId).slice(0, 160),
    sheetName: normalizeSheetName(settings.sheetName)
  };
}

function buildSiteRow(site, publicLink) {
  const parts = site.siteAddressParts ?? {};
  return [
    site.id,
    site.updatedAt,
    site.reference,
    site.customerName || site.ownerContactName,
    site.title,
    parts.line1,
    parts.line2,
    parts.town,
    parts.county,
    parts.postcode,
    site.siteAddress,
    site.ownerAddress,
    site.titleNumber,
    site.plotDescription,
    site.region,
    site.contactPriority,
    site.mailingStatus,
    site.currentStatus,
    publicLink,
    site.mapEmbedUrl,
    site.searchlandUrl,
    site.royalMailTrackingNumber,
    site.trackingStatus,
    site.letterRecipientMode,
    site.privateNotes
  ].map((value) => String(value ?? ""));
}

async function ensureSheet(accessToken, settings, signal) {
  const metadata = await googleFetch(
    accessToken,
    `${sheetsApiBase}/${encodeURIComponent(settings.spreadsheetId)}?fields=sheets.properties.title`,
    {},
    signal
  );
  const sheets = Array.isArray(metadata.sheets) ? metadata.sheets : [];
  if (sheets.some((sheet) => sheet?.properties?.title === settings.sheetName)) {
    return;
  }

  await googleFetch(
    accessToken,
    `${sheetsApiBase}/${encodeURIComponent(settings.spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: settings.sheetName
              }
            }
          }
        ]
      })
    },
    signal
  );
}

async function ensureHeaderRow(accessToken, settings, signal) {
  const headerRange = rangeFor(settings.sheetName, `A1:${columnName(sheetHeaders.length)}1`);
  const current = await getValues(accessToken, settings.spreadsheetId, headerRange, signal);
  const firstRow = current.values?.[0] ?? [];
  if (sheetHeaders.every((header, index) => firstRow[index] === header)) {
    return;
  }

  await updateValues(accessToken, settings.spreadsheetId, headerRange, [sheetHeaders], signal);
}

async function findExistingSiteRow(accessToken, settings, siteId, signal) {
  if (!siteId) {
    return null;
  }

  const current = await getValues(accessToken, settings.spreadsheetId, rangeFor(settings.sheetName, "A2:A"), signal);
  const values = current.values ?? [];
  const index = values.findIndex((row) => row[0] === siteId);
  return index === -1 ? null : index + 2;
}

async function getValues(accessToken, spreadsheetId, range, signal) {
  return googleFetch(accessToken, `${sheetsApiBase}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`, {}, signal);
}

async function updateValues(accessToken, spreadsheetId, range, values, signal) {
  return googleFetch(
    accessToken,
    `${sheetsApiBase}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values })
    },
    signal
  );
}

async function appendValues(accessToken, spreadsheetId, range, values, signal) {
  return googleFetch(
    accessToken,
    `${sheetsApiBase}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values })
    },
    signal
  );
}

async function googleFetch(accessToken, url, options = {}, signal) {
  const response = await fetch(url, {
    ...options,
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Google API returned ${response.status}.`);
  }
  return payload;
}

async function getAccessToken(credentials, signal) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken?.email === credentials.email && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const assertion = signJwt({
    iss: credentials.email,
    scope: sheetsScope,
    aud: oauthTokenUrl,
    exp: now + 3600,
    iat: now
  }, credentials.privateKey);

  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? "Google OAuth token exchange failed.");
  }

  cachedToken = {
    email: credentials.email,
    accessToken: payload.access_token,
    expiresAt: now + Number(payload.expires_in ?? 3600)
  };
  return cachedToken.accessToken;
}

function createTimeoutSignal(value) {
  const timeoutMs = clampNumber(value ?? process.env.GOOGLE_SHEETS_SYNC_TIMEOUT_MS, defaultSyncTimeoutMs, 1_000, 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

function signJwt(claims, privateKey) {
  const encodedHeader = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const encodedClaims = base64UrlJson(claims);
  const input = `${encodedHeader}.${encodedClaims}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey, "base64url");
  return `${input}.${signature}`;
}

function readServiceAccountCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed.client_email && parsed.private_key) {
        return normalizeCredentials(parsed.client_email, parsed.private_key);
      }
    } catch {
      return null;
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  return email && privateKey ? normalizeCredentials(email, privateKey) : null;
}

function normalizeCredentials(email, privateKey) {
  return {
    email: cleanText(email),
    privateKey: String(privateKey).replace(/\\n/g, "\n")
  };
}

function rangeFor(sheetName, a1Range) {
  return `${quoteSheetName(sheetName)}!${a1Range}`;
}

function quoteSheetName(sheetName) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function normalizeSheetName(value) {
  return cleanText(value)
    .replace(/[\][*?/\\:]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "Letter reference";
}

function columnName(index) {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function sanitizeErrorMessage(error) {
  if (error?.name === "AbortError") {
    return "Google Sheets sync timed out.";
  }
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 300);
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}
