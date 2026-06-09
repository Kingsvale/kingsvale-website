import type {
  TrackingMilestone,
  TrackingMilestoneState,
  TrackingSite,
  TrackingStatus
} from "./trackingTypes";

export type TrackingValidationError = {
  path: string;
  message: string;
};

export type TrackingValidationResult = {
  valid: boolean;
  errors: TrackingValidationError[];
};

export const trackingFieldLimits = {
  token: 40,
  title: 72,
  customerName: 80,
  siteAddress: 160,
  reference: 64,
  summary: 240,
  statusNote: 320,
  councilName: 90,
  applicationReference: 80,
  apiBaseUrl: 180,
  milestoneLabel: 72,
  milestoneNote: 180
} as const;

const trackingStatuses: TrackingStatus[] = [
  "planning",
  "submitted",
  "in-review",
  "approved",
  "construction",
  "complete",
  "on-hold"
];

const milestoneStates: TrackingMilestoneState[] = ["pending", "active", "complete", "blocked"];

export function validateTrackingSite(site: TrackingSite): TrackingValidationResult {
  const errors: TrackingValidationError[] = [];

  if (!site || typeof site !== "object") {
    return { valid: false, errors: [{ path: "site", message: "Tracking site is required." }] };
  }

  addTokenError(errors, site.token);
  addRequiredTextError(errors, "title", site.title, "Site title", trackingFieldLimits.title);
  addOptionalTextError(
    errors,
    "customerName",
    site.customerName,
    "Customer name",
    trackingFieldLimits.customerName
  );
  addRequiredTextError(
    errors,
    "siteAddress",
    site.siteAddress,
    "Site address",
    trackingFieldLimits.siteAddress
  );
  addOptionalTextError(errors, "reference", site.reference, "Reference", trackingFieldLimits.reference);
  addOptionalTextError(errors, "summary", site.summary, "Summary", trackingFieldLimits.summary);
  addRequiredTextError(
    errors,
    "statusNote",
    site.statusNote,
    "Status note",
    trackingFieldLimits.statusNote
  );

  if (!trackingStatuses.includes(site.currentStatus)) {
    errors.push({ path: "currentStatus", message: "Choose an approved status." });
  }

  if (!Array.isArray(site.milestones) || site.milestones.length < 1 || site.milestones.length > 8) {
    errors.push({ path: "milestones", message: "Use between one and eight milestones." });
  } else {
    site.milestones.forEach((milestone, index) =>
      addMilestoneErrors(errors, milestone, index)
    );
  }

  if (site.council.mode !== "none" && site.council.mode !== "configured") {
    errors.push({ path: "council.mode", message: "Choose a council sync mode." });
  }

  addOptionalTextError(
    errors,
    "council.councilName",
    site.council.councilName,
    "Council name",
    trackingFieldLimits.councilName
  );
  addOptionalTextError(
    errors,
    "council.applicationReference",
    site.council.applicationReference,
    "Application reference",
    trackingFieldLimits.applicationReference
  );

  if (site.council.mode === "configured") {
    addRequiredTextError(
      errors,
      "council.councilName",
      site.council.councilName,
      "Council name",
      trackingFieldLimits.councilName
    );
    addRequiredTextError(
      errors,
      "council.applicationReference",
      site.council.applicationReference,
      "Application reference",
      trackingFieldLimits.applicationReference
    );
  }

  if (site.council.apiBaseUrl && !isValidHttpUrl(site.council.apiBaseUrl)) {
    errors.push({ path: "council.apiBaseUrl", message: "Council API URL must be an HTTP URL." });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function addMilestoneErrors(
  errors: TrackingValidationError[],
  milestone: TrackingMilestone,
  index: number
) {
  const path = `milestones.${index}`;
  addRequiredTextError(
    errors,
    `${path}.label`,
    milestone.label,
    "Milestone label",
    trackingFieldLimits.milestoneLabel
  );
  addOptionalTextError(
    errors,
    `${path}.note`,
    milestone.note ?? "",
    "Milestone note",
    trackingFieldLimits.milestoneNote
  );

  if (!milestoneStates.includes(milestone.state)) {
    errors.push({ path: `${path}.state`, message: "Choose an approved milestone state." });
  }
}

function addTokenError(errors: TrackingValidationError[], token: string) {
  if (!/^[a-zA-Z0-9_-]{16,40}$/.test(token)) {
    errors.push({
      path: "token",
      message: "Tracking token must be an unguessable URL-safe value."
    });
  }
}

function addRequiredTextError(
  errors: TrackingValidationError[],
  path: string,
  value: string | undefined,
  label: string,
  limit: number
) {
  const text = value?.trim() ?? "";

  if (!text) {
    errors.push({ path, message: `${label} is required.` });
    return;
  }

  if (text.length > limit) {
    errors.push({ path, message: `${label} must be ${limit} characters or fewer.` });
  }
}

function addOptionalTextError(
  errors: TrackingValidationError[],
  path: string,
  value: string | undefined,
  label: string,
  limit: number
) {
  const text = value?.trim() ?? "";
  if (text.length > limit) {
    errors.push({ path, message: `${label} must be ${limit} characters or fewer.` });
  }
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
