import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { PlotLookupPage } from "./PlotLookupPage";

describe("PlotLookupPage", () => {
  it("renders the standalone reference and postcode lookup form", () => {
    render(<PlotLookupPage content={defaultContent} />);

    expect(screen.getByRole("heading", { name: /View the plot map for your reference./i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Reference number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postcode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open map/i })).toBeInTheDocument();
  });
});
