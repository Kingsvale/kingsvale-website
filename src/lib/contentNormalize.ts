import { businessAddress } from "../data/defaultContent";
import type { NavLink, SiteContent } from "./contentTypes";

const oldAddresses = new Set([
  "Kingsvale House, 1 London Road, Brentwood, Essex CM14 4QY"
]);

export function normalizeSiteContent(content: SiteContent): SiteContent {
  const normalized = structuredClone(content);

  if (oldAddresses.has(normalized.footer.address)) {
    normalized.footer.address = businessAddress;
  }

  normalized.footer.socialLinks = normalizeSocialLinks(normalized.footer.socialLinks);

  return normalized;
}

function normalizeSocialLinks(links: NavLink[]) {
  const normalized = links.map((link) => {
    if (link.label.toLowerCase() === "linkedin") {
      return { label: "X", href: "https://x.com/" };
    }
    return link;
  });

  return normalized.some((link) => link.label.toLowerCase() === "x")
    ? normalized
    : [...normalized, { label: "X", href: "https://x.com/" }];
}
