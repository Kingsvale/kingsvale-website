import type { FeatureItem, ImageAsset } from "../lib/contentTypes";
import {
  countrysideImage,
  homeImage,
  plansImage,
  type GuidePageRoute
} from "./answerSeo";

export {
  answerGuideRoutes,
  answerPageRoutes,
  faqItems,
  faqPageSeo,
  isAnswerPageRoute,
  isGuidePageRoute,
  type AnswerPageRoute,
  type GuidePageRoute
} from "./answerSeo";

type AnswerSection = {
  title: string;
  body: string;
  items?: string[];
};

export type GuidePageContent = {
  route: GuidePageRoute;
  eyebrow: string;
  title: string;
  body: string;
  image: ImageAsset;
  summaryTitle: string;
  summaryBody: string;
  sections: AnswerSection[];
  cards: FeatureItem[];
  relatedLinks: Array<{ label: string; href: string }>;
};

export const guidePages: Record<GuidePageRoute, GuidePageContent> = {
  "/new-homes-south-england": {
    route: "/new-homes-south-england",
    eyebrow: "New homes",
    title: "New homes across the South of England.",
    body: "Kingsvale Homes creates design-led new homes and residential communities in carefully chosen locations across the South of England, with a focus on light, landscape, practical layouts and long-term value.",
    image: homeImage,
    summaryTitle: "Kingsvale builds refined new homes in selected southern UK locations.",
    summaryBody:
      "The company focuses on considered homes rather than high-volume estates: strong settings, composed architecture, useful family spaces, efficient fabric and details that should still feel calm years after completion.",
    sections: [
      {
        title: "What kind of homes does Kingsvale build?",
        body:
          "Kingsvale Homes builds new homes and residential communities with a premium, design-led character. Typical priorities include generous kitchens, garden connection, flexible studies, natural light, storage and durable materials."
      },
      {
        title: "Where does Kingsvale focus?",
        body:
          "Kingsvale's stated focus is the South of England, including selected opportunities in counties such as Hampshire, Surrey, Berkshire and Buckinghamshire where setting, access and residential demand support high-quality homes."
      },
      {
        title: "Who are the homes designed for?",
        body:
          "The homes are planned for buyers who want a polished new-build experience without losing the sense of permanence, landscape and proportion associated with established British homes."
      }
    ],
    cards: [
      {
        id: "locations",
        icon: "map",
        title: "Selected locations",
        description: "Sites are chosen for planning potential, setting, transport, schools, amenities and long-term residential appeal."
      },
      {
        id: "family-life",
        icon: "home",
        title: "Family-ready layouts",
        description: "Plans prioritise light kitchens, storage, work-from-home space, arrival areas and easy garden connection."
      },
      {
        id: "craft",
        icon: "award",
        title: "Durable finish",
        description: "Architecture, materials and specification are shaped to feel settled, practical and quietly refined."
      }
    ],
    relatedLinks: [
      { label: "View developments", href: "/developments" },
      { label: "Design and build services", href: "/design-build" },
      { label: "Contact Kingsvale", href: "/contact" }
    ]
  },
  "/real-estate-development": {
    route: "/real-estate-development",
    eyebrow: "Real estate development",
    title: "Residential development shaped by place, planning and people.",
    body: "Kingsvale Homes approaches real estate development as a complete route from site appraisal and planning strategy through design, procurement, build quality and aftercare.",
    image: plansImage,
    summaryTitle: "Real estate development at Kingsvale starts with the land and ends with homes that feel resolved.",
    summaryBody:
      "The development process balances planning viability, commercial discipline, architecture, landscape, specification and buyer experience before construction begins.",
    sections: [
      {
        title: "How does Kingsvale approach a development site?",
        body:
          "The team starts by assessing planning context, access, constraints, surrounding character, likely demand, infrastructure and the scale of homes that would be credible for the location."
      },
      {
        title: "What makes a development opportunity suitable?",
        body:
          "Suitable opportunities usually have a realistic residential planning route, a setting where well-designed homes can add value, and enough clarity around access, services and ownership to progress a responsible appraisal."
      },
      {
        title: "How is quality protected?",
        body:
          "Kingsvale protects quality by resolving the brief, specification, procurement and buildability early, then keeping site delivery aligned with the design intent."
      }
    ],
    cards: [
      {
        id: "appraisal",
        icon: "map",
        title: "Site appraisal",
        description: "Constraints, access, ownership, market demand and planning routes are tested before commitments are made."
      },
      {
        id: "planning",
        icon: "sparkle",
        title: "Design and planning",
        description: "Massing, materials, landscape and home layouts are developed around the setting and target buyer."
      },
      {
        id: "delivery",
        icon: "award",
        title: "Controlled delivery",
        description: "Procurement, programme, site quality and aftercare are managed as part of one development process."
      }
    ],
    relatedLinks: [
      { label: "Our process", href: "/vision-process" },
      { label: "Land wanted", href: "/land-wanted" },
      { label: "Land opportunities", href: "/land-opportunities" }
    ]
  },
  "/land-opportunities": {
    route: "/land-opportunities",
    eyebrow: "Land opportunities",
    title: "Land opportunities for residential development.",
    body: "Kingsvale Homes is interested in land, plots and development sites where thoughtful residential design can unlock long-term value for landowners, buyers and local settings.",
    image: countrysideImage,
    summaryTitle: "Kingsvale considers land with a credible route to high-quality homes.",
    summaryBody:
      "The best first conversation includes site location, ownership position, approximate area, access, planning history, constraints and any existing drawings or professional advice.",
    sections: [
      {
        title: "What land opportunities does Kingsvale consider?",
        body:
          "Kingsvale considers greenfield, edge-of-settlement, brownfield, redundant commercial, former agricultural and larger garden or infill opportunities where residential development may be appropriate.",
        items: [
          "Sites with a clear address, access point and ownership position.",
          "Land with planning history or an identifiable planning route.",
          "Opportunities where design quality can improve value and setting."
        ]
      },
      {
        title: "How can a landowner start a conversation?",
        body:
          "A landowner or agent can share the site address, title plan if available, approximate acreage, current use, access arrangements, planning status and any timing expectations."
      },
      {
        title: "Does Kingsvale consider flexible deal structures?",
        body:
          "Kingsvale can consider direct purchases, subject-to-planning agreements and partnership structures where risk, timing and upside need to be balanced."
      }
    ],
    cards: [
      {
        id: "greenfield",
        icon: "leaf",
        title: "Greenfield and edge sites",
        description: "Land near established settlements with a credible planning case and strong residential need."
      },
      {
        id: "brownfield",
        icon: "home",
        title: "Brownfield and redundant land",
        description: "Underused buildings, former commercial sites and land that may suit carefully designed homes."
      },
      {
        id: "partnerships",
        icon: "users",
        title: "Landowner partnerships",
        description: "Structured conversations for owners who want discretion, clarity and aligned commercial terms."
      }
    ],
    relatedLinks: [
      { label: "Submit land", href: "/land-wanted" },
      { label: "Seller guide", href: "/land-seller-guide" },
      { label: "Contact Kingsvale", href: "/contact" }
    ]
  },
  "/land-seller-guide": {
    route: "/land-seller-guide",
    eyebrow: "Landowner guide",
    title: "Selling land to a residential developer.",
    body: "A practical guide for landowners, agents and advisers preparing to discuss residential development potential with Kingsvale Homes.",
    image: countrysideImage,
    summaryTitle: "A clear land submission makes the first appraisal faster and more useful.",
    summaryBody:
      "Landowners do not need a perfect planning pack before speaking to Kingsvale, but the strongest enquiries include enough factual detail for a responsible initial view.",
    sections: [
      {
        title: "What should a landowner prepare?",
        body:
          "Start with the address, plan or boundary, ownership position, current use, site area, access, planning history and any known constraints such as trees, flood risk, rights of way or neighbouring sensitivities."
      },
      {
        title: "What happens after Kingsvale receives a site?",
        body:
          "The first review usually considers location, constraints, likely planning route, market fit, broad capacity, delivery complexity and whether a direct, conditional or partnership structure might be appropriate."
      },
      {
        title: "Do landowners need planning permission first?",
        body:
          "Not always. Some land is best discussed early, especially where the right strategy may involve subject-to-planning terms or a staged planning approach."
      }
    ],
    cards: [
      {
        id: "facts",
        icon: "map",
        title: "Share the facts",
        description: "Boundary, access, ownership, planning history and known constraints give the appraisal a useful base."
      },
      {
        id: "strategy",
        icon: "sparkle",
        title: "Discuss the route",
        description: "Kingsvale can help frame whether the opportunity suits direct purchase, conditional terms or partnership."
      },
      {
        id: "discretion",
        icon: "users",
        title: "Keep it discreet",
        description: "Early land conversations can be handled privately and clearly before wider professional work begins."
      }
    ],
    relatedLinks: [
      { label: "Land opportunities", href: "/land-opportunities" },
      { label: "Submit land", href: "/land-wanted" },
      { label: "FAQ", href: "/faq" }
    ]
  }
};
