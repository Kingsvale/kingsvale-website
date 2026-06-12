import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { AdminPage } from "./AdminPage";
import { storageKey } from "../lib/storage";

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
  it("exposes Website, Sites and Analytics studio tabs", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    expect(screen.getByRole("tab", { name: "Website" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sites" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Content editor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Website analytics" })).toBeInTheDocument();
    });
  });

  it("previews hero edits and saves published content", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    fireEvent.change(screen.getByLabelText(/Hero title/), {
      target: { value: "Crafted homes for modern country living." }
    });

    const preview = screen.getByLabelText(/live homepage preview/i);
    await waitFor(() => {
      expect(preview).toHaveTextContent("Crafted homes for modern country living.");
    });

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
    expect(screen.getByLabelText("QR code preview")).toBeInTheDocument();
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

  it("applies status templates and supports customer resources", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    fireEvent.click(screen.getByRole("tab", { name: "Sites" }));
    fireEvent.click(screen.getByRole("button", { name: /create site/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Apply status template")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Apply status template"), {
      target: { value: "construction" }
    });
    expect(screen.getByLabelText("Current status")).toHaveValue("construction");
    expect(screen.getByLabelText(/Milestone 1 label/)).toHaveValue("Site setup");

    fireEvent.click(screen.getByRole("button", { name: /add resource/i }));
    fireEvent.change(screen.getByLabelText(/Resource 1 title/), {
      target: { value: "Planning pack" }
    });
    fireEvent.change(screen.getByLabelText(/Resource 1 URL/), {
      target: { value: "https://example.com/planning-pack.pdf" }
    });

    expect(screen.getByRole("button", { name: /save site/i })).toBeEnabled();
  });

  it("passes automated accessibility checks for the structured editor", async () => {
    render(<AdminPage publishedContent={defaultContent} />);

    const results = await axe.run(screen.getByRole("region", { name: "Content editor" }), {
      rules: { "color-contrast": { enabled: false } }
    });

    expect(results.violations).toEqual([]);
  });
});
