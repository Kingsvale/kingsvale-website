import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { createTrackingSite, upsertLocalTrackingSite } from "../lib/trackingStorage";
import { TrackingPage } from "./TrackingPage";

describe("TrackingPage", () => {
  it("renders a public plot map page by secret token", async () => {
    const site = upsertLocalTrackingSite({
      ...createTrackingSite(),
      title: "Oakdene land interest",
      customerName: "Avery Stone",
      siteAddress: "12 Meadow Lane",
      reference: "KV-2401",
      statusNote: "Kingsvale is reviewing this land interest opportunity.",
      mapEmbedUrl: "https://www.google.com/maps/d/embed?mid=abc123&basemap=satellite",
      resources: [
        {
          id: "resource-plan",
          type: "document",
          title: "Title plan",
          url: "https://example.com/title-plan.pdf",
          note: "Reference title document."
        }
      ]
    });

    render(<TrackingPage content={defaultContent} token={site.token} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Oakdene land interest" })).toBeVisible();
    });
    expect(screen.getByText("12 Meadow Lane")).toBeVisible();
    expect(screen.getByRole("heading", { name: /View the area Kingsvale is interested in/i })).toBeVisible();
    expect(screen.getByText(/land interest opportunity/i)).toBeVisible();
    expect(screen.getByTitle("Oakdene land interest map")).toHaveAttribute(
      "src",
      "https://www.google.com/maps/d/embed?mid=abc123&basemap=satellite"
    );
    expect(screen.getByRole("heading", { name: "Supporting information" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Title plan" })).toBeVisible();
  });
});
