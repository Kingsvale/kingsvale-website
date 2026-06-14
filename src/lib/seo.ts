import { useEffect } from "react";
import { faqItems, faqPageSeo, guidePageSeo, guidePageTopics, isGuidePageRoute } from "../data/answerSeo";
import type { Development, SiteContent } from "./contentTypes";

export const siteOrigin = "https://www.kingsvalehomes.co.uk";
export const brandDisplayName = "Kingsvale Homes";
export const brandLogoPath = "/brand/kingsvale-logo.png";
export const brandIconPath = "/brand/kingsvale-icon-512.png";
export const defaultSeoDescription =
  "Kingsvale Homes is a UK property developer creating luxury homes, residential communities and land development opportunities across the South of England.";

export function usePageSeo(content: SiteContent, route: string) {
  useEffect(() => {
    const development = route.startsWith("/developments/")
      ? content.developments.find((item) => item.id === route.split("/").filter(Boolean)[1])
      : undefined;
    const metadata = getRouteMetadata(content, route, development);
    const canonical = `${siteOrigin}${route === "/" ? "/" : route}`;

    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", "index, follow, max-image-preview:large");
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", development ? "article" : "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", absolutize(metadata.image));
    setMeta("property", "og:image:alt", metadata.imageAlt);
    setMeta("property", "og:site_name", brandDisplayName);
    setMeta("property", "og:locale", "en_GB");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setMeta("name", "twitter:image", absolutize(metadata.image));
    setMeta("name", "twitter:image:alt", metadata.imageAlt);
    setLink("canonical", canonical);
    setLink("icon", absolutize("/brand/kingsvale-favicon-48.png"), "48x48");
    setLink("apple-touch-icon", absolutize("/brand/kingsvale-icon-192.png"));
    setStructuredData(buildStructuredData(content, development, canonical, route));
  }, [content, route]);
}

export function getRouteMetadata(content: SiteContent, route: string, development?: Development) {
  if (development) {
    return {
      title: `${development.title} New Homes in ${development.location} | ${brandDisplayName}`,
      description: trimDescription(
        `${development.heroBody || development.description} Explore ${development.homes || "new"} luxury homes by Kingsvale Homes.`
      ),
      image: development.image.src,
      imageAlt: development.image.alt
    };
  }

  if (isGuidePageRoute(route)) {
    const page = guidePageSeo[route];
    return {
      title: page.title,
      description: page.description,
      image: page.image.src,
      imageAlt: page.image.alt
    };
  }

  if (route === "/faq") {
    return {
      title: faqPageSeo.title,
      description: faqPageSeo.description,
      image: faqPageSeo.image.src,
      imageAlt: faqPageSeo.image.alt
    };
  }

  const routes: Record<string, { title: string; description: string; image: string; imageAlt: string }> = {
    "/": {
      title: content.seo.home.title || `${brandDisplayName} | UK Luxury Homes & Real Estate Development`,
      description: content.seo.home.description || defaultSeoDescription,
      image: content.seo.home.image.src || brandLogoPath,
      imageAlt: content.seo.home.image.alt || `${brandDisplayName} logo`
    },
    "/developments": {
      title: content.seo.developments.title || `UK New Home Developments | ${brandDisplayName}`,
      description: content.seo.developments.description || "Explore Kingsvale Homes developments, luxury new homes and carefully planned residential communities across desirable UK locations.",
      image: content.seo.developments.image.src || content.developments[0]?.image.src || content.hero.image.src,
      imageAlt: content.seo.developments.image.alt || content.developments[0]?.image.alt || content.hero.image.alt
    },
    "/design-build": {
      title: content.pages.designBuild.seo.title || `Design and Build Services for UK Homes | ${brandDisplayName}`,
      description: content.pages.designBuild.seo.description || "Design, planning and construction services for refined UK homes, private builds and residential development projects.",
      image: content.pages.designBuild.seo.image.src || content.pages.designBuild.image.src,
      imageAlt: content.pages.designBuild.seo.image.alt || content.pages.designBuild.image.alt
    },
    "/vision-process": {
      title: content.pages.visionProcess.seo.title || `Property Development Process | ${brandDisplayName}`,
      description: content.pages.visionProcess.seo.description || content.pages.visionProcess.body,
      image: content.pages.visionProcess.seo.image.src || content.pages.visionProcess.image.src,
      imageAlt: content.pages.visionProcess.seo.image.alt || content.pages.visionProcess.image.alt
    },
    "/about": {
      title: content.seo.about.title || `UK Property Developer | About ${brandDisplayName}`,
      description: content.seo.about.description || "Learn about Kingsvale Homes, a UK property developer building luxury homes, lasting communities and design-led residential projects.",
      image: content.seo.about.image.src || content.about.image.src,
      imageAlt: content.seo.about.image.alt || content.about.image.alt
    },
    "/land-wanted": {
      title: content.seo.landWanted.title || `Land Wanted for Development | UK Land Opportunities | ${brandDisplayName}`,
      description: content.seo.landWanted.description || "Kingsvale Homes is seeking land opportunities, development sites and residential plots across the South of England.",
      image: content.seo.landWanted.image.src || content.landWanted.image.src,
      imageAlt: content.seo.landWanted.image.alt || content.landWanted.image.alt
    },
    "/contact": {
      title: content.pages.contact.seo.title || `Contact ${brandDisplayName} | Homes, Land & Development`,
      description: content.pages.contact.seo.description || "Contact Kingsvale Homes about new homes, land opportunities, private builds and residential real estate development.",
      image: content.pages.contact.seo.image.src || content.pages.contact.image.src,
      imageAlt: content.pages.contact.seo.image.alt || content.pages.contact.image.alt
    },
    "/plot-lookup": {
      title: `Plot Lookup | ${brandDisplayName}`,
      description: "Find Kingsvale Homes land interest, plot map and customer tracking pages by reference.",
      image: brandLogoPath,
      imageAlt: `${brandDisplayName} logo`
    },
    "/privacy": {
      title: `Privacy Policy | ${brandDisplayName}`,
      description: "Read how Kingsvale Homes handles website, contact and studio data.",
      image: brandLogoPath,
      imageAlt: `${brandDisplayName} logo`
    },
    "/terms": {
      title: `Terms and Conditions | ${brandDisplayName}`,
      description: "Read the Kingsvale Homes website terms and conditions.",
      image: brandLogoPath,
      imageAlt: `${brandDisplayName} logo`
    },
    "/security-review": {
      title: `Security Review | ${brandDisplayName}`,
      description: "Review the Kingsvale Homes security posture, secure server controls and production readiness notes.",
      image: brandLogoPath,
      imageAlt: `${brandDisplayName} logo`
    }
  };

  return routes[route] ?? {
    title: brandDisplayName,
    description: defaultSeoDescription,
    image: brandLogoPath,
    imageAlt: `${brandDisplayName} logo`
  };
}

export function buildStructuredData(
  content: SiteContent,
  development: Development | undefined,
  canonical: string,
  route = new URL(canonical).pathname
) {
  const metadata = getRouteMetadata(content, route, development);
  const organizationId = `${siteOrigin}/#organization`;
  const websiteId = `${siteOrigin}/#website`;
  const webpageId = `${canonical}#webpage`;
  const guidePage = isGuidePageRoute(route) ? guidePageSeo[route] : undefined;
  const routeTopics = isGuidePageRoute(route)
    ? guidePageTopics[route]
    : route === "/faq"
      ? ["Kingsvale Homes FAQ", "new homes", "land opportunities", "design and build services"]
      : [];
  const organization = {
    "@type": ["Organization", "HomeAndConstructionBusiness"],
    "@id": organizationId,
    name: brandDisplayName,
    alternateName: ["Kingsvale", "Kingsvale Homes UK", "Kingsvale Property"],
    legalName: "Kingsvale Property Ltd",
    url: `${siteOrigin}/`,
    logo: {
      "@type": "ImageObject",
      url: absolutize(brandLogoPath),
      width: 1200,
      height: 630
    },
    image: [absolutize(brandLogoPath), absolutize(brandIconPath), absolutize(content.hero.image.src)],
    email: content.footer.email,
    telephone: content.footer.phone,
    address: buildPostalAddress(content.footer.address),
    areaServed: [
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "AdministrativeArea", name: "South of England" }
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer enquiries",
      telephone: content.footer.phone,
      email: content.footer.email,
      areaServed: "GB",
      availableLanguage: "en-GB"
    },
    knowsAbout: [
      "UK homes",
      "luxury homes",
      "new homes",
      "real estate development",
      "residential property development",
      "land opportunities",
      "land acquisition",
      "design and build services",
      "selling land for development",
      "subject-to-planning land",
      "private design and build"
    ]
  };

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${siteOrigin}/`,
    name: brandDisplayName,
    description: defaultSeoDescription,
    publisher: { "@id": organizationId },
    inLanguage: "en-GB"
  };

  const webpage = {
    "@type": "WebPage",
    "@id": webpageId,
    url: canonical,
    name: metadata.title,
    description: metadata.description,
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absolutize(metadata.image)
    },
    inLanguage: "en-GB",
    ...(routeTopics.length > 0 ? { keywords: routeTopics.join(", ") } : {})
  };

  const graph: object[] = [organization, website, webpage, buildBreadcrumb(route, canonical)];

  if (route === "/developments") {
    graph.push({
      "@type": "ItemList",
      "@id": `${canonical}#developments`,
      name: "Kingsvale Homes developments",
      itemListElement: content.developments.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absolutize(item.ctaHref),
        name: item.title
      }))
    });
  }

  if (route === "/land-wanted") {
    graph.push({
      "@type": "Service",
      "@id": `${canonical}#land-opportunities`,
      name: "Land acquisition and development opportunities",
      serviceType: "Residential land acquisition",
      areaServed: "GB",
      provider: { "@id": organizationId },
      description: metadata.description
    });
  }

  if (guidePage) {
    graph.push({
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: metadata.title,
      description: metadata.description,
      image: absolutize(metadata.image),
      mainEntityOfPage: { "@id": webpageId },
      publisher: { "@id": organizationId },
      author: { "@id": organizationId },
      dateModified: "2026-06-15",
      about: routeTopics.map((topic) => ({
        "@type": "Thing",
        name: topic
      }))
    });
  }

  if (route === "/land-opportunities") {
    graph.push({
      "@type": "Service",
      "@id": `${canonical}#residential-land-opportunities`,
      name: "Residential land opportunity appraisal",
      serviceType: "Residential development land appraisal",
      areaServed: "South of England",
      provider: { "@id": organizationId },
      description: metadata.description
    });
  }

  if (route === "/faq") {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    });
  }

  if (development) {
    graph.push({
      "@type": "Residence",
      "@id": `${canonical}#development`,
      name: development.title,
      url: canonical,
      address: development.location,
      description: development.heroBody || development.description,
      image: absolutize(development.image.src),
      numberOfRooms: development.bedrooms,
      provider: { "@id": organizationId }
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph
  };
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content.slice(0, 300);
}

function setLink(rel: string, href: string, sizes?: string) {
  const selector = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]:not([sizes])`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (sizes) {
      element.sizes = sizes;
    }
    document.head.appendChild(element);
  }
  element.href = href;
}

function setStructuredData(data: object) {
  let element = document.head.querySelector<HTMLScriptElement>("#structured-data");
  if (!element) {
    element = document.createElement("script");
    element.id = "structured-data";
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export function absolutize(src: string) {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return `${siteOrigin}${src.startsWith("/") ? src : `/${src}`}`;
}

function trimDescription(value: string) {
  return value.length > 158 ? `${value.slice(0, 155).trim()}...` : value;
}

function buildPostalAddress(address: string) {
  if (address.includes("Shelton St") && address.includes("London")) {
    return {
      "@type": "PostalAddress",
      streetAddress: "71-75 Shelton St",
      addressLocality: "London",
      postalCode: "WC2H 9JQ",
      addressCountry: "GB"
    };
  }

  return {
    "@type": "PostalAddress",
    streetAddress: address,
    addressCountry: "GB"
  };
}

function buildBreadcrumb(route: string, canonical: string) {
  const parts = route.split("/").filter(Boolean);
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${siteOrigin}/`
    },
    ...parts.map((part, index) => {
      const path = `/${parts.slice(0, index + 1).join("/")}`;
      return {
        "@type": "ListItem",
        position: index + 2,
        name: titleCase(part),
        item: index === parts.length - 1 ? canonical : `${siteOrigin}${path}`
      };
    })
  ];

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: items
  };
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
