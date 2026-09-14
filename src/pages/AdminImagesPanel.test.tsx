import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { uploadCmsImage } from "../lib/cmsApi";
import type { ImageAsset } from "../lib/contentTypes";
import { imageSlots } from "../lib/imageInventory";
import { ImageEditor } from "./AdminImageEditor";
import { ProjectGallery } from "./AdminProjectGallery";
import { AdminImagesPanel } from "./AdminImagesPanel";

vi.mock("../lib/cmsApi", () => ({ uploadCmsImage: vi.fn() }));

describe("Studio photographs", () => {
  it("includes every gallery image and social preview in the replacement workspace", () => {
    const slots = imageSlots(defaultContent);
    expect(slots.filter((slot) => slot.path.includes(".gallery."))).toHaveLength(defaultContent.developments.reduce((total, development) => total + (development.gallery?.length ?? 0), 0));
    expect(slots.filter((slot) => slot.group === "Social previews")).toHaveLength(7);
    render(<AdminImagesPanel content={defaultContent} updateContent={vi.fn()} onPreview={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search website images"), { target: { value: "Ridings" } });
    expect(screen.getByRole("button", { name: /The Ridings — cover/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Meadow Green — cover/ })).not.toBeInTheDocument();
  });

  it("retains the old image on upload failure and lets the same file be retried", async () => {
    const onChange = vi.fn();
    vi.mocked(uploadCmsImage).mockRejectedValueOnce(new Error("Your Studio session has expired."));
    render(<ImageEditor title="Project cover" image={defaultContent.developments[0].image} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Upload Project cover"), { target: { files: [new File(["x"], "garden.png", { type: "image/png" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("session has expired");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Upload Project cover")).toBeEnabled();
  });

  it("replaces placeholder alt text and stale variants, with an undo", async () => {
    const old = { ...defaultContent.hero.image, variants: [{ src: "/media/old.webp", width: 480 }] };
    const next = { src: "/media/garden.webp", alt: "Garden", focalPoint: "50% 50%" };
    vi.mocked(uploadCmsImage).mockResolvedValueOnce(next);
    function Editor() { const [image, setImage] = useState<ImageAsset>(old); return <ImageEditor title="Cover" image={image} onChange={setImage} />; }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Upload Cover"), { target: { files: [new File(["x"], "garden.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByLabelText("Cover alt text")).toHaveValue("Garden"));
    fireEvent.click(screen.getByRole("button", { name: "Undo replacement" }));
    expect(screen.getByLabelText("Cover alt text")).toHaveValue(old.alt);
  });

  it("keeps successful gallery uploads in order when one file fails, and allows reordering/removal", async () => {
    vi.mocked(uploadCmsImage).mockResolvedValueOnce({ src: "/media/first.webp", alt: "First" })
      .mockRejectedValueOnce(new Error("Invalid image"))
      .mockResolvedValueOnce({ src: "/media/last.webp", alt: "Last" });
    function Gallery() { const [images, setImages] = useState<ImageAsset[]>([]); return <ProjectGallery title="Ridings" images={images} onChange={setImages} />; }
    render(<Gallery />);
    fireEvent.change(screen.getByLabelText("Add Ridings gallery images"), { target: { files: ["first", "broken", "last"].map((name) => new File(["x"], `${name}.png`, { type: "image/png" })) } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2 images added"));
    expect(screen.getByRole("alert")).toHaveTextContent("broken.png: Invalid image");
    expect(screen.getByLabelText("Ridings gallery image 1 alt text")).toHaveValue("First");
    fireEvent.click(screen.getByRole("button", { name: "Move later" }));
    expect(screen.getByLabelText("Ridings gallery image 2 alt text")).toHaveValue("First");
    fireEvent.click(screen.getByRole("button", { name: "Remove from gallery" }));
    expect(screen.getByLabelText("Ridings gallery image 1 alt text")).toHaveValue("Last");
  });
});
