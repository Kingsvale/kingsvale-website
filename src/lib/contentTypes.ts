export type IconKey =
  | "award"
  | "home"
  | "leaf"
  | "users"
  | "map"
  | "sparkle";

export type ImageAsset = {
  src: string;
  alt: string;
  focalPoint?: string;
};

<<<<<<< HEAD
export type SeoContent = {
  title: string;
  description: string;
  image: ImageAsset;
};

=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
export type NavLink = {
  label: string;
  href: string;
};

export type HeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: ImageAsset;
};

export type FeatureItem = {
  id: string;
  icon: IconKey;
  title: string;
  description: string;
};

export type EditorialSection = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: ImageAsset;
};

export type Development = {
  id: string;
  image: ImageAsset;
  title: string;
  location: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  status?: string;
  priceGuide?: string;
  homes?: string;
  bedrooms?: string;
  heroBody?: string;
  highlights?: string[];
  gallery?: ImageAsset[];
};

export type LandWantedContent = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: ImageAsset;
};

<<<<<<< HEAD
export type StaticPageContent = {
  eyebrow: string;
  title: string;
  body: string;
  image: ImageAsset;
  sectionEyebrow: string;
  sectionTitle: string;
  sectionItems: FeatureItem[];
  calloutTitle: string;
  calloutBody: string;
  seo: SeoContent;
};

=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
export type FooterContent = {
  description: string;
  phone: string;
  email: string;
  address: string;
  exploreLinks: NavLink[];
  newsletterTitle: string;
  newsletterCopy: string;
  newsletterPlaceholder: string;
  socialLinks: NavLink[];
  legalLinks: NavLink[];
};

export type SiteContent = {
  brandName: string;
  brandSuffix: string;
  navLinks: NavLink[];
  hero: HeroContent;
  features: FeatureItem[];
  about: EditorialSection;
  developmentsIntro: {
    eyebrow: string;
    title: string;
    viewAllLabel: string;
    viewAllHref: string;
  };
  developments: Development[];
<<<<<<< HEAD
  pages: {
    designBuild: StaticPageContent;
    visionProcess: StaticPageContent;
    contact: StaticPageContent;
  };
  landWanted: LandWantedContent;
  seo: {
    home: SeoContent;
    developments: SeoContent;
    about: SeoContent;
    landWanted: SeoContent;
  };
=======
  landWanted: LandWantedContent;
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  footer: FooterContent;
};
