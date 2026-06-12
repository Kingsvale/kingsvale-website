import { createMilestone } from "./trackingStorage";
import type { TrackingSite, TrackingStatus } from "./trackingTypes";

export type TrackingTemplateId =
  | "planning-application"
  | "construction"
  | "snagging-handover";

export type TrackingStatusTemplate = {
  id: TrackingTemplateId;
  label: string;
  status: TrackingStatus;
  summary: string;
  statusNote: string;
  milestones: Array<{
    label: string;
    state: "pending" | "active" | "complete" | "blocked";
  }>;
};

export const trackingStatusTemplates: TrackingStatusTemplate[] = [
  {
    id: "planning-application",
    label: "Planning application",
    status: "submitted",
    summary: "Track planning submission, council review and the next decision point.",
    statusNote: "The planning application has been submitted and is waiting for council review.",
    milestones: [
      { label: "Planning pack prepared", state: "complete" },
      { label: "Application submitted", state: "active" },
      { label: "Council validation", state: "pending" },
      { label: "Public consultation", state: "pending" },
      { label: "Decision issued", state: "pending" }
    ]
  },
  {
    id: "construction",
    label: "Construction",
    status: "construction",
    summary: "Follow the build from site setup through structure, services, finishes and handover.",
    statusNote: "Construction is underway and the Kingsvale team is progressing the next build stage.",
    milestones: [
      { label: "Site setup", state: "complete" },
      { label: "Groundworks", state: "active" },
      { label: "Structure and roof", state: "pending" },
      { label: "Services and interiors", state: "pending" },
      { label: "Final inspection", state: "pending" }
    ]
  },
  {
    id: "snagging-handover",
    label: "Snagging and handover",
    status: "approved",
    summary: "Track final quality checks, documentation and handover preparation.",
    statusNote: "The project is moving through final checks before customer handover.",
    milestones: [
      { label: "Practical completion review", state: "active" },
      { label: "Snagging list agreed", state: "pending" },
      { label: "Final works complete", state: "pending" },
      { label: "Documents prepared", state: "pending" },
      { label: "Handover appointment", state: "pending" }
    ]
  }
];

export function applyTrackingStatusTemplate(
  site: TrackingSite,
  template: TrackingStatusTemplate
): TrackingSite {
  return {
    ...site,
    currentStatus: template.status,
    summary: template.summary,
    statusNote: template.statusNote,
    milestones: template.milestones.map((milestone) =>
      createMilestone(milestone.label, milestone.state)
    )
  };
}
