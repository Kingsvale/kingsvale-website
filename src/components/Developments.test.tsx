import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { Developments } from "./Developments";
import { normalizeSiteContent } from "../lib/contentNormalize";
import { validateSiteContent } from "../lib/contentValidation";

const developments = Array.from({ length: 8 }, (_, index) => ({ ...defaultContent.developments[0], id: `project-${index}`, title: `Project ${index}`, ctaHref: `/developments/project-${index}` }));

describe("homepage developments", () => {
  it("limits legacy content to its first six without changing the project collection", () => {
    render(<Developments intro={defaultContent.developmentsIntro} developments={developments} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.queryByText("Project 6")).not.toBeInTheDocument();
    expect(developments).toHaveLength(8);
  });
  it("shows chosen projects and keeps original inline editing paths", () => {
    render(<Developments intro={defaultContent.developmentsIntro} developments={developments} selectedIds={["project-7", "project-2"]} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual(["Project 2", "Project 7"]);
    expect(screen.getByText("Project 7")).toHaveAttribute("data-cms-text", "developments.7.title");
  });
  it("allows no featured projects and ignores removed projects", () => {
    const { container } = render(<Developments intro={defaultContent.developmentsIntro} developments={developments} selectedIds={["removed"]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("caps even oversized stored selections at six", () => {
    render(<Developments intro={defaultContent.developmentsIntro} developments={developments} selectedIds={developments.map((project) => project.id)} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });
  it("preserves selection on normalization and rejects publishing over six", () => {
    const content = { ...defaultContent, developments, homepageDevelopmentIds: ["project-7"] };
    expect(normalizeSiteContent(content).homepageDevelopmentIds).toEqual(["project-7"]);
    expect(validateSiteContent(content).errors.filter((error) => error.path === "homepageDevelopmentIds")).toEqual([]);
    content.homepageDevelopmentIds = developments.map((project) => project.id);
    expect(validateSiteContent(content).errors.some((error) => error.path === "homepageDevelopmentIds")).toBe(true);
  });
});
