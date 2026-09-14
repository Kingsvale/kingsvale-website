import type { ImageAsset, SiteContent } from "./contentTypes";

export type ImageSlot = { path: string; title: string; group: string; route: string; image: ImageAsset };

export function imageStatus(image: ImageAsset) {
  if (image.src.includes("images.unsplash.com/") || image.src.startsWith("/placeholders/")) return "Placeholder";
  if (image.src.startsWith("/media/")) return "Uploaded";
  if (image.src.startsWith("data:")) return "Embedded";
  if (image.src.startsWith("/")) return "Site asset";
  return "External link";
}

export function imageSlots(content: SiteContent): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const add = (path: string, title: string, group: string, route: string, image: ImageAsset) => slots.push({ path, title, group, route, image });
  add("hero.image", "Homepage hero", "Website pages", "/", content.hero.image);
  add("about.image", "About / homepage story", "Website pages", "/about", content.about.image);
  add("landWanted.image", "Land wanted", "Website pages", "/land-wanted", content.landWanted.image);
  const pages = { designBuild: ["Design & build", "/design-build"], visionProcess: ["Vision & process", "/vision-process"], contact: ["Contact", "/contact"] };
  for (const key of Object.keys(pages) as (keyof typeof pages)[]) {
    add(`pages.${key}.image`, pages[key][0], "Website pages", pages[key][1], content.pages[key].image);
    add(`pages.${key}.seo.image`, `${pages[key][0]} social preview`, "Social previews", pages[key][1], content.pages[key].seo.image);
  }
  content.developments.forEach((development, index) => {
    const route = `/developments/${development.id}`;
    add(`developments.${index}.image`, `${development.title} — cover`, development.title, route, development.image);
    development.gallery?.forEach((image, i) => add(`developments.${index}.gallery.${i}`, `${development.title} — gallery ${i + 1}`, development.title, route, image));
  });
  const seoRoutes = { home: "/", developments: "/developments", about: "/about", landWanted: "/land-wanted" };
  for (const key of Object.keys(content.seo) as (keyof SiteContent["seo"])[]) {
    add(`seo.${key}.image`, `${key === "landWanted" ? "Land wanted" : key[0].toUpperCase() + key.slice(1)} social preview`, "Social previews", seoRoutes[key], content.seo[key].image);
  }
  return slots;
}

export function replaceImageSlot(content: SiteContent, path: string, image: ImageAsset) {
  // Paths come only from our inventory, never from an uploaded file or URL.
  if (!imageSlots(content).some((slot) => slot.path === path)) return;
  const parts = path.split(".");
  let target = content as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = image;
}
