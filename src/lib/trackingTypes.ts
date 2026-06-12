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
<<<<<<< HEAD
  mapEmbedUrl: string;
  searchlandUrl: string;
  privateNotes: string;
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  currentStatus: TrackingStatus;
  statusNote: string;
  milestones: TrackingMilestone[];
  resources: TrackingResource[];
  qrStyle: TrackingQrStyle;
  council: CouncilSyncSettings;
<<<<<<< HEAD
  localAuthority: string;
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
