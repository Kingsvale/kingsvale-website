import type { SiteContent } from "../lib/contentTypes";

export const businessAddress = "71-75 Shelton St, London WC2H 9JQ";

export const defaultContent: SiteContent = {
  brandName: "Kingsvale",
  brandSuffix: "Homes",
  navLinks: [
    { label: "Home", href: "/" },
    { label: "Design & Build Services", href: "/design-build" },
    { label: "Land Wanted", href: "/land-wanted" },
    { label: "Our Vision & Process", href: "/vision-process" },
    { label: "About Us", href: "/about" },
    { label: "Our Developments", href: "/developments" },
    { label: "Contact Us", href: "/contact" }
  ],
  hero: {
    eyebrow: "Kingsvale Homes",
    title: "Shaping exceptional communities. Building lasting value.",
    subtitle: "Thoughtfully designed homes. Exceptional craftsmanship. Lasting value.",
    ctaLabel: "Discover our developments",
    ctaHref: "/developments",
    image: {
      src: "https://images.unsplash.com/photo-1756435292384-1bf32eff7baf",
      alt: "A grand stone-accent luxury home at sunset with warm interior lighting",
      focalPoint: "54% 52%"
    }
  },
  features: [
    {
      id: "craftsmanship",
      icon: "award",
      title: "Award-winning craftsmanship",
      description: "Built to the highest standards with meticulous attention to detail."
    },
    {
      id: "locations",
      icon: "home",
      title: "Exceptional locations",
      description: "Premium settings across the most desirable communities."
    },
    {
      id: "sustainable",
      icon: "leaf",
      title: "Sustainable by design",
      description: "Future-focused homes that are beautiful, efficient and enduring."
    },
    {
      id: "customers",
      icon: "users",
      title: "Customer at the heart",
      description: "We build lasting relationships as well as outstanding homes."
    }
  ],
  about: {
    eyebrow: "Our legacy",
    title: "Building homes. Creating legacies.",
    body: "At Kingsvale Homes, we believe a home is more than a place to live. It is a foundation for life. For over a decade, we have been designing and building exceptional homes and communities across the South, combining timeless architecture with modern living.",
    ctaLabel: "Our vision & process",
    ctaHref: "/vision-process",
    image: {
      src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
      alt: "An elegant neutral living room with a fireplace and bespoke shelving",
      focalPoint: "48% 50%"
    }
  },
  developmentsIntro: {
    eyebrow: "Our developments",
    title: "Beautiful homes in exceptional locations.",
    viewAllLabel: "View all developments",
    viewAllHref: "/developments"
  },
  developments: [
    {
      id: "ridings",
      title: "The Ridings",
      location: "Chandlers Ford, Hampshire",
      description: "A collection of 4 and 5 bedroom homes surrounded by open green space.",
      ctaLabel: "View development",
      ctaHref: "/developments/ridings",
      status: "Now selling",
      priceGuide: "From GBP 875,000",
      homes: "14",
      bedrooms: "4 and 5",
      heroBody: "A refined collection of family homes arranged around generous gardens, open green space and calm residential streets.",
      highlights: [
        "Carefully planned layouts with generous kitchens and family spaces.",
        "Natural materials, warm detailing and a restrained architectural palette.",
        "Close to transport links, schools and established local amenities."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
        alt: "A luxury detached home set behind landscaped planting",
        focalPoint: "50% 48%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
          alt: "A refined country-style house with a warm evening sky",
          focalPoint: "52% 50%"
        },
        {
          src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
          alt: "A warm contemporary living room designed for luxury family life",
          focalPoint: "50% 52%"
        }
      ]
    },
    {
      id: "meadow-green",
      title: "Meadow Green",
      location: "Bramshaw, Hampshire",
      description: "Stylish new homes in a charming village setting.",
      ctaLabel: "View development",
      ctaHref: "/developments/meadow-green",
      status: "Coming soon",
      priceGuide: "Register interest",
      homes: "9",
      bedrooms: "3 and 4",
      heroBody: "A village-led development shaped around light, landscape and understated contemporary living.",
      highlights: [
        "A compact collection with a quiet sense of place.",
        "Designed to balance privacy, gardens and community character.",
        "A calm route into the New Forest and surrounding market towns."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
        alt: "A refined country-style house with a warm evening sky",
        focalPoint: "52% 50%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
          alt: "An elegant neutral living room with a fireplace and bespoke shelving",
          focalPoint: "48% 50%"
        },
        {
          src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
          alt: "Rolling British countryside at golden hour",
          focalPoint: "50% 48%"
        }
      ]
    },
    {
      id: "oakdene-heights",
      title: "Oakdene Heights",
      location: "Shalford, Surrey",
      description: "Contemporary homes in a peaceful setting close to nature.",
      ctaLabel: "View development",
      ctaHref: "/developments/oakdene-heights",
      status: "Planning approved",
      priceGuide: "From GBP 1.1m",
      homes: "6",
      bedrooms: "4 and 5",
      heroBody: "A small, elevated collection of contemporary homes with mature landscape and long-term value at the centre.",
      highlights: [
        "Quiet residential setting with strong access to countryside.",
        "Modern elevations softened by natural stone and planting.",
        "Each home is planned around daily flow, storage and garden connection."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
        alt: "A spacious modern home with stone walls and manicured gardens",
        focalPoint: "45% 50%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde",
          alt: "A bright luxury home surrounded by mature trees",
          focalPoint: "48% 52%"
        },
        {
          src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
          alt: "An elegant living space with warm architectural materials",
          focalPoint: "50% 50%"
        }
      ]
    },
    {
      id: "hilltop-park",
      title: "Hilltop Park",
      location: "Wokingham, Berkshire",
      description: "Spacious family homes in a vibrant community close to the town.",
      ctaLabel: "View development",
      ctaHref: "/developments/hilltop-park",
      status: "Final homes",
      priceGuide: "From GBP 795,000",
      homes: "22",
      bedrooms: "3, 4 and 5",
      heroBody: "A community of spacious homes with everyday practicality, strong local connections and polished architectural detail.",
      highlights: [
        "A generous mix of homes for families at different stages.",
        "Established town links, green space and considered street scenes.",
        "Durable finishes and layouts designed for modern family life."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde",
        alt: "A bright luxury home surrounded by mature trees",
        focalPoint: "48% 52%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
          alt: "A luxury detached home set behind landscaped planting",
          focalPoint: "50% 48%"
        },
        {
          src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
          alt: "A refined country-style house with a warm evening sky",
          focalPoint: "52% 50%"
        }
      ]
    },
    {
      id: "willow-court",
      title: "Willow Court",
      location: "Ascot, Berkshire",
      description: "A private courtyard of elegant homes with generous gardens and calm architectural detailing.",
      ctaLabel: "View development",
      ctaHref: "/developments/willow-court",
      status: "In planning",
      priceGuide: "Register interest",
      homes: "8",
      bedrooms: "4 and 5",
      heroBody: "A discreet courtyard address shaped for privacy, landscape and everyday family flow.",
      highlights: [
        "Private drive approach with considered street scene and planting.",
        "Open kitchen, dining and family spaces with strong garden connection.",
        "Close to rail links, schools and established village amenities."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
        alt: "A warm contemporary living room designed for luxury family life",
        focalPoint: "50% 52%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
          alt: "An elegant living space with warm architectural materials",
          focalPoint: "50% 50%"
        },
        {
          src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde",
          alt: "A bright luxury home surrounded by mature trees",
          focalPoint: "48% 52%"
        }
      ]
    },
    {
      id: "marlowe-gardens",
      title: "Marlowe Gardens",
      location: "Marlow, Buckinghamshire",
      description: "Boutique town-edge homes planned around light, storage, landscape and low-energy comfort.",
      ctaLabel: "View development",
      ctaHref: "/developments/marlowe-gardens",
      status: "Land secured",
      priceGuide: "Coming soon",
      homes: "5",
      bedrooms: "3 and 4",
      heroBody: "A compact collection designed for refined town-edge living with landscape doing quiet work.",
      highlights: [
        "Boutique scale with a restrained palette of brick, stone and timber.",
        "Flexible studies, utility spaces and storage for practical daily living.",
        "A strong base for riverside walks, town amenities and commuter routes."
      ],
      image: {
        src: "https://images.unsplash.com/photo-1600566752355-35792bedcfea",
        alt: "A light modern kitchen and dining space with natural finishes",
        focalPoint: "50% 50%"
      },
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
          alt: "An elegant neutral living room with a fireplace and bespoke shelving",
          focalPoint: "48% 50%"
        },
        {
          src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
          alt: "Rolling British countryside at golden hour",
          focalPoint: "50% 48%"
        }
      ]
    }
  ],
  pages: {
    designBuild: {
      eyebrow: "Design & build services",
      title: "A complete route from land and concept to finished home.",
      body: "For private clients and landowners, Kingsvale brings planning intelligence, architectural discipline, procurement control and site delivery under one calm, accountable process.",
      image: {
        src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
        alt: "A warm contemporary living room designed for luxury family life",
        focalPoint: "50% 52%"
      },
      sectionEyebrow: "What we manage",
      sectionTitle: "Built for clients who want clarity at every stage.",
      sectionItems: [
        {
          id: "feasibility",
          icon: "map",
          title: "Feasibility",
          description: "Site appraisal, planning constraints, budget ranges and route-to-consent advice."
        },
        {
          id: "design",
          icon: "sparkle",
          title: "Design",
          description: "Architectural direction, specification strategy, material palette and internal planning."
        },
        {
          id: "procurement",
          icon: "award",
          title: "Procurement",
          description: "Tender packs, supplier coordination, programme planning and value engineering."
        },
        {
          id: "delivery",
          icon: "home",
          title: "Delivery",
          description: "Site management, quality control, handover preparation and aftercare."
        }
      ],
      calloutTitle: "Quietly controlled. Carefully detailed.",
      calloutBody: "The best luxury homes feel effortless because the difficult decisions have been resolved early. Our role is to protect the design intent while keeping cost, programme and quality visible.",
      seo: {
        title: "Design and Build Services | Kingsvale Homes",
        description: "Tailored design, planning and construction services for refined British homes.",
        image: {
          src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
          alt: "A warm contemporary living room designed for luxury family life",
          focalPoint: "50% 52%"
        }
      }
    },
    visionProcess: {
      eyebrow: "Our vision & process",
      title: "Timeless homes, measured decisions and lasting value.",
      body: "We work deliberately: understanding the land, refining the brief, testing details and delivering homes that feel established, efficient and beautifully composed.",
      image: {
        src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
        alt: "Architectural plans and design tools on a work table",
        focalPoint: "50% 50%"
      },
      sectionEyebrow: "Our rhythm",
      sectionTitle: "A disciplined process for exceptional outcomes.",
      sectionItems: [
        {
          id: "listen",
          icon: "users",
          title: "Listen",
          description: "We establish the commercial, lifestyle and planning priorities before design begins."
        },
        {
          id: "shape",
          icon: "map",
          title: "Shape",
          description: "We align massing, materials, layouts and landscape into a coherent proposition."
        },
        {
          id: "refine",
          icon: "sparkle",
          title: "Refine",
          description: "We test cost, performance, buildability and buyer experience in detail."
        },
        {
          id: "deliver",
          icon: "award",
          title: "Deliver",
          description: "We build with accountable site control and a long-term aftercare mindset."
        }
      ],
      calloutTitle: "Luxury without noise.",
      calloutBody: "Kingsvale's visual language is restrained because confidence does not need volume. Proportion, materiality, light and durability do the work.",
      seo: {
        title: "Vision and Process | Kingsvale Homes",
        description: "A calm, carefully managed process from land appraisal to handover.",
        image: {
          src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
          alt: "Architectural plans and design tools on a work table",
          focalPoint: "50% 50%"
        }
      }
    },
    contact: {
      eyebrow: "Contact us",
      title: "Start a conversation with Kingsvale.",
      body: "Whether you are exploring a new home, a private build or land with development potential, we would be pleased to hear from you.",
      image: {
        src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
        alt: "An elegant living space with warm architectural materials",
        focalPoint: "50% 50%"
      },
      sectionEyebrow: "Contact",
      sectionTitle: "Speak to our team",
      sectionItems: [],
      calloutTitle: "Talk to Kingsvale",
      calloutBody: "We will respond discreetly and clearly.",
      seo: {
        title: "Contact | Kingsvale Homes",
        description: "Contact Kingsvale Homes about developments, land opportunities and design-led residential projects.",
        image: {
          src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
          alt: "An elegant living space with warm architectural materials",
          focalPoint: "50% 50%"
        }
      }
    }
  },
  landWanted: {
    eyebrow: "Land wanted",
    title: "Do you have land with potential?",
    body: "We are actively seeking land and development opportunities across the South. If you own a site or know of a potential opportunity, we would love to hear from you.",
    ctaLabel: "Submit your land",
    ctaHref: "/land-wanted",
    image: {
      src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
      alt: "Rolling British countryside at golden hour",
      focalPoint: "50% 48%"
    }
  },
  seo: {
    home: {
      title: "Kingsvale Homes | Luxury homes and exceptional communities",
      description: "Thoughtfully designed homes. Exceptional craftsmanship. Lasting value.",
      image: {
        src: "https://images.unsplash.com/photo-1756435292384-1bf32eff7baf",
        alt: "A grand stone-accent luxury home at sunset with warm interior lighting",
        focalPoint: "54% 52%"
      }
    },
    developments: {
      title: "Developments | Kingsvale Homes",
      description: "Distinctive homes in carefully chosen locations.",
      image: {
        src: "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
        alt: "A luxury detached home set behind landscaped planting",
        focalPoint: "50% 48%"
      }
    },
    about: {
      title: "About Us | Kingsvale Homes",
      description: "Building homes and creating legacies across the South.",
      image: {
        src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
        alt: "An elegant neutral living room with a fireplace and bespoke shelving",
        focalPoint: "48% 50%"
      }
    },
    landWanted: {
      title: "Land Wanted | Kingsvale Homes",
      description: "Kingsvale is actively seeking land and development opportunities across the South.",
      image: {
        src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
        alt: "Rolling British countryside at golden hour",
        focalPoint: "50% 48%"
      }
    }
  },
  footer: {
    description: "Creating exceptional homes and communities that stand the test of time.",
    phone: "01252 123 456",
    email: "enquiries@kingsvalehomes.co.uk",
    address: businessAddress,
    exploreLinks: [
      { label: "Design & Build Services", href: "/design-build" },
      { label: "Land Wanted", href: "/land-wanted" },
      { label: "Our Vision & Process", href: "/vision-process" },
      { label: "Our Developments", href: "/developments" },
      { label: "About Us", href: "/about" },
      { label: "Contact Us", href: "/contact" }
    ],
    newsletterTitle: "Newsletter",
    newsletterCopy: "Be the first to hear about our latest developments and news.",
    newsletterPlaceholder: "Your email address",
    socialLinks: [
      { label: "Facebook", href: "https://www.facebook.com/" },
      { label: "Instagram", href: "https://www.instagram.com/" },
      { label: "X", href: "https://x.com/" }
    ],
    legalLinks: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" }
    ]
  }
};
