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

  addRequiredTextError(errors, `${path}.src`, image.src, "Image source", 9000);
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

  if (!Array.isArray(content.developments) || content.developments.length < 1 || content.developments.length > 6) {
    errors.push({
      path: "developments",
      message: "Use between one and six developments."
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

  return {
    valid: errors.length === 0,
    errors
  };
}
