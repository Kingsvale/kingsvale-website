import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { createTrackingSite, upsertLocalTrackingSite } from "../lib/trackingStorage";
import { TrackingPage } from "./TrackingPage";

describe("TrackingPage", () => {
<<<<<<< HEAD
  it("renders a public land interest map page by secret token", async () => {
    const site = upsertLocalTrackingSite({
      ...createTrackingSite(),
      title: "Oakdene title area",
      customerName: "Avery Stone",
      siteAddress: "12 Meadow Lane",
      reference: "KV2401",
      statusNote: "The shaded outline shows the land area Kingsvale would like to discuss.",
      mapEmbedUrl: "https://www.google.com/maps/d/embed?mid=example-map-id",
      resources: [
        {
          id: "resource-title",
          type: "document",
          title: "Title plan",
          url: "https://example.com/title-plan.pdf",
          note: "Reference document for the outlined area."
=======
  it("renders a public tracking page by secret token", async () => {
    const site = upsertLocalTrackingSite({
      ...createTrackingSite(),
      title: "Oakdene planning tracker",
      customerName: "Avery Stone",
      siteAddress: "12 Meadow Lane",
      reference: "KV-2401",
      currentStatus: "submitted",
      statusNote: "The planning application has been submitted for council review.",
      resources: [
        {
          id: "resource-plan",
          type: "document",
          title: "Planning pack",
          url: "https://example.com/planning-pack.pdf",
          note: "Latest shared planning document."
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
        }
      ]
    });

    render(<TrackingPage content={defaultContent} token={site.token} />);

    await waitFor(() => {
<<<<<<< HEAD
      expect(screen.getByRole("heading", { name: "Oakdene title area" })).toBeVisible();
    });
    expect(screen.getByText("12 Meadow Lane")).toBeVisible();
    expect(screen.getByText("Quote reference KV2401")).toBeVisible();
    expect(screen.getByRole("link", { name: /Call .*Quote reference KV2401/ })).toHaveAttribute("href", "tel:01252123456");
    expect(screen.getByRole("heading", { name: "View the area Kingsvale is interested in." })).toBeVisible();
    expect(screen.getByTitle("Oakdene title area map")).toHaveAttribute("src", site.mapEmbedUrl);
    expect(screen.getByRole("heading", { name: "Supporting information" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Title plan" })).toBeVisible();
=======
      expect(screen.getByRole("heading", { name: "Oakdene planning tracker" })).toBeVisible();
    });
    expect(screen.getByText("12 Meadow Lane")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Submitted" })).toBeVisible();
    expect(screen.getByText(/planning application has been submitted/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Images and documents" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Planning pack" })).toBeVisible();
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  });
});
