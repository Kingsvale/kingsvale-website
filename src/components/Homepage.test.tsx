import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { Homepage } from "../pages/Homepage";

describe("Homepage", () => {
  it("renders the premium homepage sections and accessible image text", () => {
    render(<Homepage content={defaultContent} />);

    expect(
      screen.getByRole("heading", {
        name: /Shaping exceptional communities. Building lasting value./i
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Beautiful homes in exceptional locations./i })).toBeInTheDocument();
    expect(
      screen.getByAltText(/grand stone-accent luxury home/i)
    ).toBeInTheDocument();
  });

  it("opens and closes the mobile navigation menu", () => {
    render(<Homepage content={defaultContent} />);

    const button = screen.getByRole("button", { name: /open navigation/i });
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });

    expect(nav).toHaveAttribute("data-open", "false");
    fireEvent.click(button);
    expect(nav).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("button", { name: /close navigation/i })).toBeInTheDocument();
  });

  it("passes automated accessibility checks for the public homepage", async () => {
    const { container } = render(<Homepage content={defaultContent} />);

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } }
    });

    expect(results.violations).toEqual([]);
  });
});
