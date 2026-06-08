import { useEffect } from "react";
import type { Development, SiteContent } from "./contentTypes";

export const siteOrigin = "https://www.kingsvalehomes.co.uk";

export function usePageSeo(content: SiteContent, route: string) {
  useEffect(() => {
    const development = route.startsWith("/developments/")
      ? content.developments.find((item) => item.id === route.split("/").filter(Boolean)[1])
      : undefined;
    const metadata = getRouteMetadata(content, route, development);
    const canonical = `${siteOrigin}${route === "/" ? "/" : route}`;

    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", development ? "article" : "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", absolutize(metadata.image));
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setLink("canonical", canonical);
    setStructuredData(buildStructuredData(content, development, canonical));
  }, [content, route]);
}

export function getRouteMetadata(content: SiteContent, route: string, development?: Development) {
  if (development) {
    return {
      title: `${development.title} | ${development.location} | ${content.brandName} ${content.brandSuffix}`,
      description: development.heroBody || development.description,
      image: development.image.src
    };
  }

  const brand = `${content.brandName} ${content.brandSuffix}`;
  const routes: Record<string, { title: string; description: string; image: string }> = {
    "/": {
      title: `${brand} | Luxury homes and exceptional communities`,
      description: content.hero.subtitle,
      image: content.hero.image.src
    },
    "/developments": {
      title: `Developments | ${brand}`,
      description: content.developmentsIntro.title,
      image: content.developments[0]?.image.src ?? content.hero.image.src
    },
    "/design-build": {
      title: `Design and Build Services | ${brand}`,
      description: "Tailored design, planning and construction services for refined British homes.",
      image: content.about.image.src
    },
    "/vision-process": {
      title: `Vision and Process | ${brand}`,
      description: "A calm, carefully managed process from land appraisal to handover.",
      image: content.about.image.src
    },
    "/about": {
      title: `About Us | ${brand}`,
      description: content.about.body,
      image: content.about.image.src
    },
    "/land-wanted": {
      title: `Land Wanted | ${brand}`,
      description: content.landWanted.body,
      image: content.landWanted.image.src
    },
    "/contact": {
      title: `Contact | ${brand}`,
      description: "Contact Kingsvale Homes about developments, land opportunities and design-led residential projects.",
      image: content.hero.image.src
    }
  };

  return routes[route] ?? {
    title: `${brand}`,
    description: "Kingsvale Homes creates exceptional communities and luxury homes across distinctive British locations.",
    image: content.hero.image.src
  };
}

export function buildStructuredData(
  content: SiteContent,
  development: Development | undefined,
  canonical: string
) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: `${content.brandName} ${content.brandSuffix}`,
    url: siteOrigin,
    email: content.footer.email,
    telephone: content.footer.phone,
    address: content.footer.address,
    image: absolutize(content.hero.image.src)
  };

  if (!development) {
    return organization;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: development.title,
    url: canonical,
    address: development.location,
    description: development.heroBody || development.description,
    image: absolutize(development.image.src),
    provider: organization
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

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
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
