import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { createTrackingSite, upsertLocalTrackingSite } from "../lib/trackingStorage";
import { TrackingPage } from "./TrackingPage";

describe("TrackingPage", () => {
  it("renders a public tracking page by secret token", async () => {
    const site = upsertLocalTrackingSite({
      ...createTrackingSite(),
      title: "Oakdene planning tracker",
      customerName: "Avery Stone",
      siteAddress: "12 Meadow Lane",
      reference: "KV-2401",
      currentStatus: "submitted",
      statusNote: "The planning application has been submitted for council review."
    });

    render(<TrackingPage content={defaultContent} token={site.token} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Oakdene planning tracker" })).toBeVisible();
    });
    expect(screen.getByText("12 Meadow Lane")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Submitted" })).toBeVisible();
    expect(screen.getByText(/planning application has been submitted/i)).toBeVisible();
  });
});
