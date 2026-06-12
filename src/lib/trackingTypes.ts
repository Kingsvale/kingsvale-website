export type TrackingMilestoneState = "pending" | "active" | "complete" | "blocked";

export type TrackingStatus =
  | "planning"
  | "submitted"
  | "in-review"
  | "approved"
  | "construction"
  | "complete"
  | "on-hold";

export type CouncilSyncSettings = {
  mode: "none" | "configured";
  councilName: string;
  applicationReference: string;
  apiBaseUrl?: string;
  lastCheckedAt: string | null;
  lastSyncStatus: string;
};

export type TrackingQrStyle = {
  foreground: string;
  background: string;
  accent: string;
  dotRoundness: number;
  finderRoundness: number;
  frameRoundness: number;
  frameCut: number;
  frameLabel: string;
  includeLogo: boolean;
};

export type TrackingResourceType = "image" | "document" | "link";

export type ContactPriority = "high" | "medium" | "low" | "do-not-contact" | "unknown";

export type MailingStatus =
  | "not-mailed"
  | "ready-to-mail"
  | "mailed"
  | "delivered"
  | "responded"
  | "no-response"
  | "second-letter-needed"
  | "do-not-contact";

export type TrackingResource = {
  id: string;
  type: TrackingResourceType;
  title: string;
  url: string;
  note: string;
};

export type TrackingMilestone = {
  id: string;
  label: string;
  state: TrackingMilestoneState;
  date?: string;
  note?: string;
};

export type TrackingSite = {
  id: string;
  token: string;
  title: string;
  customerName: string;
  siteAddress: string;
  reference: string;
  ownerContactName: string;
  contactPriority: ContactPriority;
  summary: string;
  currentStatus: TrackingStatus;
  statusNote: string;
  milestones: TrackingMilestone[];
  resources: TrackingResource[];
  qrStyle: TrackingQrStyle;
  council: CouncilSyncSettings;
  mailingStatus: MailingStatus;
  firstMailedAt: string;
  lastMailedAt: string;
  royalMailTrackingNumber: string;
  trackingStatus: string;
  trackingLastCheckedAt: string | null;
  remailReminderDays: number;
  remailReminderDate: string;
  mailingNotes: string;
  mailingLastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export const trackingStatusLabels: Record<TrackingStatus, string> = {
  planning: "Planning",
  submitted: "Submitted",
  "in-review": "In review",
  approved: "Approved",
  construction: "Construction",
  complete: "Complete",
  "on-hold": "On hold"
};

export const trackingMilestoneLabels: Record<TrackingMilestoneState, string> = {
  pending: "Pending",
  active: "Active",
  complete: "Complete",
  blocked: "Blocked"
};

export const trackingResourceLabels: Record<TrackingResourceType, string> = {
  image: "Image",
  document: "Document",
  link: "Link"
};

export const contactPriorityLabels: Record<ContactPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  "do-not-contact": "Do not contact",
  unknown: "Unknown"
};

export const mailingStatusLabels: Record<MailingStatus, string> = {
  "not-mailed": "Not mailed",
  "ready-to-mail": "Ready to mail",
  mailed: "Mailed",
  delivered: "Delivered",
  responded: "Responded",
  "no-response": "No response",
  "second-letter-needed": "Second letter needed",
  "do-not-contact": "Do not contact"
};
