import type { ContactPriority, LetterRecipientMode } from "./trackingTypes";

export type LetterPreset = {
  id: string;
  name: string;
  templateName: string;
  templateUrl: string;
  recipientMode: LetterRecipientMode;
  createdAt: string;
};

export type StudioSettings = {
  letterPresets: LetterPreset[];
  defaultReminderDays: number;
  defaultContactPriority: ContactPriority;
  googleSheet: GoogleSheetSettings;
  updatedAt: string;
};

export type GoogleSheetSettings = {
  enabled: boolean;
  spreadsheetId: string;
  sheetName: string;
};

export const studioSettingsStorageKey = "kingsvale-studio-settings-v1";

const allowedRecipientModes = ["legal-owner", "title-owner", "plot-land"] as const;
const allowedPriorities = ["high", "medium", "low", "do-not-contact", "unknown"] as const;

export function defaultStudioSettings(): StudioSettings {
  return {
    letterPresets: [],
    defaultReminderDays: 14,
    defaultContactPriority: "unknown",
    googleSheet: defaultGoogleSheetSettings(),
    updatedAt: new Date().toISOString()
  };
}

export function normalizeStudioSettings(value: Partial<StudioSettings> | null | undefined): StudioSettings {
  const fallback = defaultStudioSettings();
  const defaultReminderDays = boundedReminderDays(value?.defaultReminderDays);
  return {
    letterPresets: Array.isArray(value?.letterPresets)
      ? value.letterPresets.map(normalizeLetterPreset).filter((preset): preset is LetterPreset => Boolean(preset))
      : [],
    defaultReminderDays,
    defaultContactPriority: allowedPriorities.includes(value?.defaultContactPriority as ContactPriority)
      ? value?.defaultContactPriority as ContactPriority
      : fallback.defaultContactPriority,
    googleSheet: normalizeGoogleSheetSettings(value?.googleSheet),
    updatedAt: typeof value?.updatedAt === "string" && value.updatedAt ? value.updatedAt : fallback.updatedAt
  };
}

export function loadLocalStudioSettings() {
  if (typeof window === "undefined") {
    return defaultStudioSettings();
  }

  try {
    return normalizeStudioSettings(JSON.parse(window.localStorage.getItem(studioSettingsStorageKey) ?? "null"));
  } catch {
    return defaultStudioSettings();
  }
}

export function saveLocalStudioSettings(settings: StudioSettings) {
  const normalized = normalizeStudioSettings({
    ...settings,
    updatedAt: new Date().toISOString()
  });
  window.localStorage.setItem(studioSettingsStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event("kingsvale-studio-settings-updated"));
  return normalized;
}

export function createLetterPresetId() {
  return `letter-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function boundedReminderDays(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(120, Math.max(1, Math.trunc(value))) : 14;
}

function normalizeLetterPreset(value: Partial<LetterPreset> | null | undefined) {
  const name = cleanText(value?.name).slice(0, 80);
  const templateName = cleanText(value?.templateName).slice(0, 160);
  const templateUrl = cleanText(value?.templateUrl);
  if (!name || !templateName || !isSafeLetterTemplateUrl(templateUrl)) {
    return null;
  }

  return {
    id: cleanText(value?.id).slice(0, 120) || createLetterPresetId(),
    name,
    templateName,
    templateUrl,
    recipientMode: allowedRecipientModes.includes(value?.recipientMode as LetterRecipientMode)
      ? value?.recipientMode as LetterRecipientMode
      : "legal-owner",
    createdAt: cleanText(value?.createdAt) || new Date().toISOString()
  };
}

function defaultGoogleSheetSettings(): GoogleSheetSettings {
  return {
    enabled: false,
    spreadsheetId: "",
    sheetName: "Letter reference"
  };
}

function normalizeGoogleSheetSettings(value: Partial<GoogleSheetSettings> | null | undefined): GoogleSheetSettings {
  const fallback = defaultGoogleSheetSettings();
  return {
    enabled: Boolean(value?.enabled),
    spreadsheetId: cleanText(value?.spreadsheetId).slice(0, 160),
    sheetName: cleanSheetName(value?.sheetName) || fallback.sheetName
  };
}

function isSafeLetterTemplateUrl(value: string) {
  if (value.startsWith("/media/")) {
    return /\.docx$/i.test(value);
  }

  return /^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanSheetName(value: unknown) {
  return cleanText(value).replace(/[\][*?/\\:]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}
