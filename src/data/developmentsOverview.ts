import { copyKey } from "../lib/siteEditing";
export const overviewCopy = {
  eyebrow: "Our developments",
  title: "Distinctive homes in carefully chosen locations.",
  body: "Every Kingsvale development is shaped around setting, longevity and the quiet details that make a home feel settled from the first day.",
  collectionEyebrow: "Current collection",
  collectionTitle: "Explore our homes"
};
export const overviewKeys = Object.fromEntries(Object.entries(overviewCopy).map(([field, copy]) => [field, copyKey(copy, "/developments")])) as Record<keyof typeof overviewCopy, string>;
