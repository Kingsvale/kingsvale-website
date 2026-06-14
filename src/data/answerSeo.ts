import type { ImageAsset, SeoContent } from "../lib/contentTypes";

export const answerGuideRoutes = [
  "/new-homes-south-england",
  "/real-estate-development",
  "/land-opportunities",
  "/land-seller-guide"
] as const;

export const answerPageRoutes = [...answerGuideRoutes, "/faq"] as const;

export type GuidePageRoute = (typeof answerGuideRoutes)[number];
export type AnswerPageRoute = (typeof answerPageRoutes)[number];

export const countrysideImage: ImageAsset = {
  src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
  alt: "Rolling British countryside at golden hour",
  focalPoint: "50% 48%"
};

export const homeImage: ImageAsset = {
  src: "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
  alt: "A luxury detached home set behind landscaped planting",
  focalPoint: "50% 48%"
};

export const plansImage: ImageAsset = {
  src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
  alt: "Architectural plans and design tools on a work table",
  focalPoint: "50% 50%"
};

export const guidePageSeo: Record<GuidePageRoute, SeoContent> = {
  "/new-homes-south-england": {
    title: "New Homes in the South of England | Kingsvale Homes",
    description:
      "Explore Kingsvale Homes' approach to luxury new homes, family houses and design-led residential communities across the South of England.",
    image: homeImage
  },
  "/real-estate-development": {
    title: "Residential Real Estate Development | Kingsvale Homes",
    description:
      "Kingsvale Homes is a UK residential real estate developer focused on land appraisal, planning, design-led homes and quality delivery.",
    image: plansImage
  },
  "/land-opportunities": {
    title: "Land Opportunities for Residential Development | Kingsvale Homes",
    description:
      "Kingsvale Homes considers residential land opportunities, development sites, brownfield plots and subject-to-planning land across the South of England.",
    image: countrysideImage
  },
  "/land-seller-guide": {
    title: "Selling Land to a Residential Developer | Kingsvale Homes",
    description:
      "A practical guide for landowners preparing to discuss residential development land, planning potential and site information with Kingsvale Homes.",
    image: countrysideImage
  }
};

export const guidePageTopics: Record<GuidePageRoute, string[]> = {
  "/new-homes-south-england": ["new homes", "UK homes", "luxury homes", "South of England homes", "family homes"],
  "/real-estate-development": ["real estate development", "residential development", "property development", "planning", "new homes"],
  "/land-opportunities": ["land opportunities", "land wanted", "development land", "residential plots", "subject to planning"],
  "/land-seller-guide": ["selling land", "landowner guide", "development land", "residential developer", "land appraisal"]
};

export const faqPageSeo: SeoContent = {
  title: "Kingsvale Homes FAQ | New Homes, Land and Development",
  description:
    "Answers to common questions about Kingsvale Homes, new developments, design and build services, land opportunities and residential development.",
  image: homeImage
};

export const faqItems = [
  {
    question: "What does Kingsvale Homes do?",
    answer:
      "Kingsvale Homes is a UK property developer focused on luxury new homes, residential communities, design and build services, and land development opportunities across the South of England."
  },
  {
    question: "Where does Kingsvale Homes build new homes?",
    answer:
      "Kingsvale focuses on selected opportunities across the South of England, including locations where planning, setting, access and local demand support high-quality residential development."
  },
  {
    question: "Does Kingsvale Homes buy land for development?",
    answer:
      "Yes. Kingsvale considers land, plots and development sites with residential potential, including greenfield, brownfield, edge-of-settlement, infill and subject-to-planning opportunities."
  },
  {
    question: "What information should I send about a land opportunity?",
    answer:
      "Useful first details include the site address, approximate area, boundary or title plan, ownership position, current use, access, planning history and any known constraints."
  },
  {
    question: "Can Kingsvale consider subject-to-planning land deals?",
    answer:
      "Kingsvale can consider subject-to-planning agreements and other structured arrangements where they suit the site, planning route, landowner objectives and risk profile."
  },
  {
    question: "Does Kingsvale provide private design and build services?",
    answer:
      "Yes. Kingsvale offers design and build services for private clients and landowners, covering feasibility, planning, design coordination, procurement, site delivery and aftercare."
  },
  {
    question: "What makes a Kingsvale home different?",
    answer:
      "Kingsvale homes are shaped around setting, light, practical family layouts, durable materials, landscape connection and a restrained architectural language that should age well."
  },
  {
    question: "How can I contact Kingsvale Homes?",
    answer:
      "You can contact Kingsvale through the website contact form, by emailing enquiries@kingsvalehomes.co.uk or by calling the phone number shown on the contact page."
  }
];

export function isAnswerPageRoute(route: string): route is AnswerPageRoute {
  return answerPageRoutes.includes(route as AnswerPageRoute);
}

export function isGuidePageRoute(route: string): route is GuidePageRoute {
  return answerGuideRoutes.includes(route as GuidePageRoute);
}
