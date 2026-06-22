import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { AdminPage } from "./AdminPage";
import { AdminSitesPanel } from "./AdminSitesPanel";
import { storageKey } from "../lib/storage";
import { studioPreviewStorageKey } from "../lib/studioPreview";

const tinyPng = new File(
  [
    Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0,
      0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73,
      68, 65, 84, 120, 156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 160, 186,
      251, 191, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ])
  ],
  "hero.png",
  { type: "image/png" }
);

describe("AdminPage", () => {
  it("exposes Website, Sites, Mailing, Analytics and Backup studio tabs", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    expect(screen.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sites" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mailing" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Backup" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Content editor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Mailing" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Postal contact workflow" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Website analytics" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Backup" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Backup and restore" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Export full backup/i })).toBeInTheDocument();
    });
  });

  it("previews hero edits and saves published content", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    fireEvent.change(screen.getByLabelText(/Hero title/), {
      target: { value: "Crafted homes for modern country living." }
    });

    await waitFor(() => {
      const previewContent = JSON.parse(window.sessionStorage.getItem(studioPreviewStorageKey) ?? "{}");
      expect(previewContent.hero.title).toBe("Crafted homes for modern country living.");
    });
    expect(screen.getByTitle(/Live Homepage Desktop preview/i)).toHaveAttribute("src", expect.stringContaining("studio-preview"));

    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    expect(saved.hero.title).toBe("Crafted homes for modern country living.");
  });

  it("supports local image replacement through upload", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    const upload = screen.getByTestId("hero-image-upload");
    fireEvent.change(upload, { target: { files: [tinyPng] } });

    await waitFor(() => {
      expect((screen.getByLabelText(/Hero image URL/) as HTMLInputElement).value).toContain(
        "data:image/png"
      );
    });
  });

  it("keeps invalid content from being published", () => {
    render(<AdminPage publishedContent={defaultContent} />);

    fireEvent.change(screen.getByLabelText(/Hero title/), { target: { value: "" } });

    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(screen.getByRole("alert", { name: /validation issues/i })).toBeInTheDocument();
  });

  it("creates a tracking site with a QR-ready public link", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    fireEvent.click(screen.getByRole("tab", { name: "Sites" }));
    fireEvent.click(screen.getByRole("button", { name: /create site/i }));

    await waitFor(() => {
      const link = screen.getByTestId("generated-tracking-link") as HTMLInputElement;
      expect(link.value).toMatch(/\/track\/[a-zA-Z0-9_-]+/);
    });
    expect(screen.getByLabelText("Reference")).toHaveValue("KV0001");
    expect(screen.getByLabelText("QR code preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download png/i })).toBeInTheDocument();
    expect(screen.getByText(/1155px PNG for Word letters/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Dot roundness")).toHaveValue("48");
    expect(screen.getByLabelText("Finder roundness")).toHaveValue("24");
    expect(screen.getByLabelText("Frame roundness")).toHaveValue("42");
    fireEvent.change(screen.getByLabelText("Finder roundness"), {
      target: { value: "86" }
    });
    fireEvent.change(screen.getByLabelText("Cut corners"), {
      target: { value: "34" }
    });
    expect(screen.getByLabelText("Finder roundness")).toHaveValue("86");
    expect(screen.getByLabelText("Cut corners")).toHaveValue("34");
    expect(screen.getByRole("button", { name: /save site/i })).toBeEnabled();
  });

  it("configures plot map pages and supports customer resources", async () => {
    render(<AdminSitesPanel />);
    fireEvent.click(document.querySelector(".sites-admin__toolbar .admin-save") as HTMLButtonElement);

    await waitFor(() => {
      expect(document.querySelector("#google-my-maps-embed-url-or-iframe")).toBeInTheDocument();
    });

    expect(document.querySelector("#owner-contact-name")).not.toBeInTheDocument();
    expect(document.querySelector("#summary")).not.toBeInTheDocument();
    expect(document.querySelector("#private-notes")).toBeInTheDocument();
    expect(document.querySelector("#searchland-url")).toBeInTheDocument();
    expect(screen.getByText("No template uploaded")).toBeInTheDocument();
    expect(screen.getByText("No generated letter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate letter/i })).toBeDisabled();
    expect(screen.getByText("{{legal_name}}")).toBeInTheDocument();
    expect(screen.getByText("Initial letter template")).toHaveAttribute(
      "href",
      "/templates/kingsvale-initial-letter-template.docx"
    );

    fireEvent.change(document.querySelector("#site-address") as HTMLInputElement, {
      target: { value: "12 Meadow Lane, Wokingham" }
    });
    expect(document.querySelector("#folder-region")).toHaveValue("Wokingham");

    fireEvent.change(document.querySelector("#searchland-url") as HTMLInputElement, {
      target: {
        value:
          "https://app.searchland.co.uk/preview?token=c59efd5d-7ae6-46f7-b4de-f52eceee6e0e&titleNo=HP892254&custom=false"
      }
    });

    fireEvent.change(document.querySelector("#google-my-maps-embed-url-or-iframe") as HTMLTextAreaElement, {
      target: {
        value:
          '<iframe src="https://www.google.com/maps/d/embed?mid=abc123&ehbc=2E312F"></iframe>'
      }
    });
    expect(document.querySelector("#google-my-maps-embed-url-or-iframe")).toHaveValue(
      "https://www.google.com/maps/d/embed?mid=abc123&ehbc=2E312F&basemap=satellite"
    );

    const sitesPanel = document.querySelector(".sites-admin") as HTMLElement;
    const addResourceButton = sitesPanel.querySelector("[aria-label='Add resource']") as HTMLButtonElement;
    fireEvent.click(addResourceButton);
    fireEvent.change(document.querySelector("#resource-1-title") as HTMLInputElement, {
      target: { value: "Title plan" }
    });
    fireEvent.change(document.querySelector("#resource-1-url") as HTMLInputElement, {
      target: { value: "https://example.com/title-plan.pdf" }
    });

    const saveSiteButton = [...sitesPanel.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Save site"));
    expect(saveSiteButton).toBeEnabled();
    expect([...sitesPanel.querySelectorAll("button")].some((button) => button.textContent?.includes("Delete"))).toBe(true);
  });

  it("passes automated accessibility checks for the structured editor", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    const results = await axe.run(screen.getByRole("region", { name: "Content editor" }), {
      rules: { "color-contrast": { enabled: false } }
    });

    expect(results.violations).toEqual([]);
  });
});
