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

export type TrackingQrDotStyle = "square" | "rounded" | "circle";
export type TrackingQrFinderStyle = "square" | "rounded" | "circle";
export type TrackingQrFrameStyle = "square" | "rounded" | "cut-corner";

export type TrackingQrStyle = {
  foreground: string;
  background: string;
  accent: string;
  dotStyle: TrackingQrDotStyle;
  finderStyle: TrackingQrFinderStyle;
  frameStyle: TrackingQrFrameStyle;
  dotRoundness: number;
  finderRoundness: number;
  frameRoundness: number;
  frameCut: number;
  frameLabel: string;
  includeLogo: boolean;
};

export type TrackingResourceType = "image" | "document" | "link";

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
  summary: string;
  currentStatus: TrackingStatus;
  statusNote: string;
  milestones: TrackingMilestone[];
  resources: TrackingResource[];
  qrStyle: TrackingQrStyle;
  council: CouncilSyncSettings;
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
