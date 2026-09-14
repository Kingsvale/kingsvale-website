import type {
  Development,
  FeatureItem,
  FooterContent,
  ImageAsset,
  NavLink,
  SiteContent
} from "./contentTypes";

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export const fieldLimits = {
  brandName: 24,
  brandSuffix: 16,
  navLabel: 32,
  heroEyebrow: 32,
  heroTitle: 86,
  heroSubtitle: 130,
  ctaLabel: 34,
  featureTitle: 42,
  featureDescription: 120,
  eyebrow: 32,
  sectionTitle: 78,
  body: 340,
  developmentTitle: 42,
  developmentLocation: 44,
  developmentDescription: 130,
  footerDescription: 150,
  contact: 120,
  newsletterCopy: 140,
  placeholder: 42,
  imageAlt: 150
} as const;

const iconKeys = ["award", "home", "leaf", "users", "map", "sparkle"];

function addRequiredTextError(
  errors: ValidationError[],
  path: string,
  value: string | undefined,
  label: string,
  limit: number
) {
  const text = value?.trim() ?? "";

  if (!text) {
    errors.push({ path, message: `${label} is required.` });
    return;
  }

  if (text.length > limit) {
    errors.push({
      path,
      message: `${label} must be ${limit} characters or fewer.`
    });
  }
}

function addHrefError(
  errors: ValidationError[],
  path: string,
  value: string | undefined,
  label: string
) {
  const href = value?.trim() ?? "";

  if (!href) {
    errors.push({ path, message: `${label} is required.` });
    return;
  }

  if (!isValidHref(href)) {
    errors.push({
      path,
      message: `${label} must be a URL, anchor link, email link or phone link.`
    });
  }
}

function addImageErrors(errors: ValidationError[], path: string, image?: ImageAsset) {
  if (!image) {
    errors.push({ path, message: "Image is required." });
    return;
  }

  addRequiredTextError(errors, `${path}.src`, image.src, "Image source", image.src?.startsWith("data:") ? 3_500_000 : 9000);
  addRequiredTextError(
    errors,
    `${path}.alt`,
    image.alt,
    "Image alt text",
    fieldLimits.imageAlt
  );

  if (image.src && !isValidImageSource(image.src)) {
    errors.push({
      path: `${path}.src`,
      message: "Image source must be an image URL, relative path or uploaded data image."
    });
  }
  if (image.focalPoint !== undefined && !/^(100|\d{1,2})% (100|\d{1,2})%$/.test(image.focalPoint)) {
    errors.push({ path: `${path}.focalPoint`, message: "Choose a focal point between 0 and 100%." });
  }
}

function addLinkErrors(
  errors: ValidationError[],
  path: string,
  link: NavLink | undefined,
  labelLimit = fieldLimits.navLabel
) {
  if (!link) {
    errors.push({ path, message: "Link is required." });
    return;
  }

  addRequiredTextError(errors, `${path}.label`, link.label, "Link label", labelLimit);
  addHrefError(errors, `${path}.href`, link.href, "Link URL");
}

function addFeatureErrors(errors: ValidationError[], feature: FeatureItem, index: number) {
  const path = `features.${index}`;
  addRequiredTextError(errors, `${path}.title`, feature.title, "Feature title", fieldLimits.featureTitle);
  addRequiredTextError(
    errors,
    `${path}.description`,
    feature.description,
    "Feature description",
    fieldLimits.featureDescription
  );

  if (!iconKeys.includes(feature.icon)) {
    errors.push({ path: `${path}.icon`, message: "Choose an approved feature icon." });
  }
}

function addDevelopmentErrors(errors: ValidationError[], development: Development, index: number) {
  const path = `developments.${index}`;
  addRequiredTextError(
    errors,
    `${path}.title`,
    development.title,
    "Development title",
    fieldLimits.developmentTitle
  );
  addRequiredTextError(
    errors,
    `${path}.location`,
    development.location,
    "Development location",
    fieldLimits.developmentLocation
  );
  addRequiredTextError(
    errors,
    `${path}.description`,
    development.description,
    "Development description",
    fieldLimits.developmentDescription
  );
  addRequiredTextError(
    errors,
    `${path}.ctaLabel`,
    development.ctaLabel,
    "Development CTA label",
    fieldLimits.ctaLabel
  );
  addHrefError(errors, `${path}.ctaHref`, development.ctaHref, "Development CTA link");
  addImageErrors(errors, `${path}.image`, development.image);
  for (const [key, limit] of [["status", 120], ["priceGuide", 120], ["homes", 120], ["bedrooms", 120], ["heroBody", 600]] as const) {
    const value = development[key];
    if (value !== undefined && (typeof value !== "string" || value.length > limit)) errors.push({ path: `developments.${index}.${key}`, message: `Use up to ${limit} characters.` });
  }
  if (development.highlights !== undefined && (!Array.isArray(development.highlights) || development.highlights.length > 20 || development.highlights.some((value: string) => typeof value !== "string" || value.length > 300))) errors.push({ path: `developments.${index}.highlights`, message: "Use up to 20 highlights of 300 characters each." });
  if (!/^\/developments\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(development.ctaHref)) errors.push({ path: `developments.${index}.ctaHref`, message: "Use /developments/project-name with lowercase letters, numbers and hyphens." });
  if (development.gallery !== undefined) {
    if (!Array.isArray(development.gallery) || development.gallery.length > 12) {
      errors.push({ path: `${path}.gallery`, message: "Use up to 12 gallery images." });
    } else development.gallery.forEach((image, i) => addImageErrors(errors, `${path}.gallery.${i}`, image));
  }
}

function addFooterErrors(errors: ValidationError[], footer: FooterContent) {
  addRequiredTextError(
    errors,
    "footer.description",
    footer.description,
    "Footer description",
    fieldLimits.footerDescription
  );
  addRequiredTextError(errors, "footer.phone", footer.phone, "Phone", fieldLimits.contact);
  addRequiredTextError(errors, "footer.email", footer.email, "Email", fieldLimits.contact);
  addRequiredTextError(errors, "footer.address", footer.address, "Address", fieldLimits.contact);
  addRequiredTextError(
    errors,
    "footer.newsletterTitle",
    footer.newsletterTitle,
    "Newsletter title",
    fieldLimits.navLabel
  );
  addRequiredTextError(
    errors,
    "footer.newsletterCopy",
    footer.newsletterCopy,
    "Newsletter copy",
    fieldLimits.newsletterCopy
  );
  addRequiredTextError(
    errors,
    "footer.newsletterPlaceholder",
    footer.newsletterPlaceholder,
    "Newsletter placeholder",
    fieldLimits.placeholder
  );

  validateLinkCollection(errors, "footer.exploreLinks", footer.exploreLinks, 1, 8);
  validateLinkCollection(errors, "footer.socialLinks", footer.socialLinks, 0, 4);
  validateLinkCollection(errors, "footer.legalLinks", footer.legalLinks, 1, 4);
}

function validateLinkCollection(
  errors: ValidationError[],
  path: string,
  links: NavLink[],
  min: number,
  max: number
) {
  if (!Array.isArray(links) || links.length < min || links.length > max) {
    errors.push({
      path,
      message: `Use between ${min} and ${max} links.`
    });
    return;
  }

  links.forEach((link, index) => addLinkErrors(errors, `${path}.${index}`, link));
}

export function isValidHref(href: string): boolean {
  if (href.startsWith("#") || href.startsWith("/") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return true;
  }

  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function isValidImageSource(src: string): boolean {
  if (src.startsWith("data:image/") || src.startsWith("/") || src.startsWith("./")) {
    return true;
  }

  try {
    const parsed = new URL(src);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateSiteContent(content: SiteContent): ValidationResult {
  const errors: ValidationError[] = [];

  if (content.textOverrides && (typeof content.textOverrides !== "object" || Array.isArray(content.textOverrides) || Object.keys(content.textOverrides).length > 512 || Object.entries(content.textOverrides).some(([key, value]) => (["__proto__", "constructor", "prototype"].includes(key) || !/^[a-zA-Z0-9_-]{1,160}$/.test(key)) || typeof value !== "string" || value.length > 2400))) {
    errors.push({ path: "textOverrides", message: "Page text must be plain text of 2,400 characters or fewer per field." });
  }
  if (content.imageOverrides && (typeof content.imageOverrides !== "object" || Array.isArray(content.imageOverrides) || Object.keys(content.imageOverrides).length > 128)) errors.push({ path: "imageOverrides", message: "Page images are invalid." });
  else Object.entries(content.imageOverrides ?? {}).forEach(([key, image]) => {
    if (["__proto__", "constructor", "prototype"].includes(key) || !/^[a-zA-Z0-9_-]{1,160}$/.test(key)) errors.push({ path: "imageOverrides", message: "Page image key is invalid." });
    addImageErrors(errors, `imageOverrides.${key}`, image);
  });

  const projectRoutes = Array.isArray(content.developments) ? content.developments.map((project) => project.ctaHref) : [];
  if (Array.isArray(content.developments)) content.developments.forEach((project, index) => { if (projectRoutes.indexOf(project.ctaHref) !== index || content.developments.some((other, i) => i !== index && project.ctaHref === `/developments/${other.id}`)) errors.push({ path: `developments.${index}.ctaHref`, message: "Choose a unique project page address." }); });
  addRequiredTextError(errors, "brandName", content.brandName, "Brand name", fieldLimits.brandName);
  addRequiredTextError(errors, "brandSuffix", content.brandSuffix, "Brand suffix", fieldLimits.brandSuffix);
  validateLinkCollection(errors, "navLinks", content.navLinks, 3, 8);

  addRequiredTextError(errors, "hero.eyebrow", content.hero.eyebrow, "Hero eyebrow", fieldLimits.heroEyebrow);
  addRequiredTextError(errors, "hero.title", content.hero.title, "Hero title", fieldLimits.heroTitle);
  addRequiredTextError(
    errors,
    "hero.subtitle",
    content.hero.subtitle,
    "Hero subtitle",
    fieldLimits.heroSubtitle
  );
  addRequiredTextError(errors, "hero.ctaLabel", content.hero.ctaLabel, "Hero CTA label", fieldLimits.ctaLabel);
  addHrefError(errors, "hero.ctaHref", content.hero.ctaHref, "Hero CTA link");
  addImageErrors(errors, "hero.image", content.hero.image);

  if (!Array.isArray(content.features) || content.features.length !== 4) {
    errors.push({
      path: "features",
      message: "The feature strip must contain exactly four feature items."
    });
  } else {
    content.features.forEach((feature, index) => addFeatureErrors(errors, feature, index));
  }

  addRequiredTextError(errors, "about.eyebrow", content.about.eyebrow, "About eyebrow", fieldLimits.eyebrow);
  addRequiredTextError(errors, "about.title", content.about.title, "About title", fieldLimits.sectionTitle);
  addRequiredTextError(errors, "about.body", content.about.body, "About body", fieldLimits.body);
  addRequiredTextError(errors, "about.ctaLabel", content.about.ctaLabel, "About CTA label", fieldLimits.ctaLabel);
  addHrefError(errors, "about.ctaHref", content.about.ctaHref, "About CTA link");
  addImageErrors(errors, "about.image", content.about.image);

  addRequiredTextError(
    errors,
    "developmentsIntro.eyebrow",
    content.developmentsIntro.eyebrow,
    "Developments eyebrow",
    fieldLimits.eyebrow
  );
  addRequiredTextError(
    errors,
    "developmentsIntro.title",
    content.developmentsIntro.title,
    "Developments title",
    fieldLimits.sectionTitle
  );
  addRequiredTextError(
    errors,
    "developmentsIntro.viewAllLabel",
    content.developmentsIntro.viewAllLabel,
    "Developments link label",
    fieldLimits.ctaLabel
  );
  addHrefError(
    errors,
    "developmentsIntro.viewAllHref",
    content.developmentsIntro.viewAllHref,
    "Developments link"
  );

  if (!Array.isArray(content.developments) || content.developments.length > 100) {
    errors.push({
      path: "developments",
      message: "Use up to 100 projects."
    });
  } else {
    content.developments.forEach((development, index) =>
      addDevelopmentErrors(errors, development, index)
    );
  }

  addRequiredTextError(
    errors,
    "landWanted.eyebrow",
    content.landWanted.eyebrow,
    "Land wanted eyebrow",
    fieldLimits.eyebrow
  );
  addRequiredTextError(
    errors,
    "landWanted.title",
    content.landWanted.title,
    "Land wanted title",
    fieldLimits.sectionTitle
  );
  addRequiredTextError(
    errors,
    "landWanted.body",
    content.landWanted.body,
    "Land wanted body",
    fieldLimits.body
  );
  addRequiredTextError(
    errors,
    "landWanted.ctaLabel",
    content.landWanted.ctaLabel,
    "Land wanted CTA label",
    fieldLimits.ctaLabel
  );
  addHrefError(errors, "landWanted.ctaHref", content.landWanted.ctaHref, "Land wanted CTA link");
  addImageErrors(errors, "landWanted.image", content.landWanted.image);

  addFooterErrors(errors, content.footer);

  Object.entries(content.pages ?? {}).forEach(([key, page]) => {
    addImageErrors(errors, `pages.${key}.image`, page.image);
    addImageErrors(errors, `pages.${key}.seo.image`, page.seo?.image);
  });
  Object.entries(content.seo ?? {}).forEach(([key, seo]) => addImageErrors(errors, `seo.${key}.image`, seo.image));

  return {
    valid: errors.length === 0,
    errors
  };
}
