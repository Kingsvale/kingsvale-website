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
