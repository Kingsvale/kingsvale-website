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
<<<<<<< HEAD
    setMeta("property", "og:image:alt", metadata.imageAlt);
    setMeta("property", "og:site_name", `${content.brandName} ${content.brandSuffix}`);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setMeta("name", "twitter:image", absolutize(metadata.image));
    setMeta("name", "twitter:image:alt", metadata.imageAlt);
=======
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    setLink("canonical", canonical);
    setStructuredData(buildStructuredData(content, development, canonical));
  }, [content, route]);
}

export function getRouteMetadata(content: SiteContent, route: string, development?: Development) {
  if (development) {
    return {
      title: `${development.title} | ${development.location} | ${content.brandName} ${content.brandSuffix}`,
      description: development.heroBody || development.description,
<<<<<<< HEAD
      image: development.image.src,
      imageAlt: development.image.alt
=======
      image: development.image.src
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    };
  }

  const brand = `${content.brandName} ${content.brandSuffix}`;
<<<<<<< HEAD
  const routes: Record<string, { title: string; description: string; image: string; imageAlt: string }> = {
    "/": {
      title: content.seo.home.title || `${brand} | Luxury homes and exceptional communities`,
      description: content.seo.home.description || content.hero.subtitle,
      image: content.seo.home.image.src || content.hero.image.src,
      imageAlt: content.seo.home.image.alt || content.hero.image.alt
    },
    "/developments": {
      title: content.seo.developments.title || `Developments | ${brand}`,
      description: content.seo.developments.description || content.developmentsIntro.title,
      image: content.seo.developments.image.src || content.developments[0]?.image.src || content.hero.image.src,
      imageAlt: content.seo.developments.image.alt || content.developments[0]?.image.alt || content.hero.image.alt
    },
    "/design-build": {
      title: content.pages.designBuild.seo.title || `Design and Build Services | ${brand}`,
      description: content.pages.designBuild.seo.description || content.pages.designBuild.body,
      image: content.pages.designBuild.seo.image.src || content.pages.designBuild.image.src,
      imageAlt: content.pages.designBuild.seo.image.alt || content.pages.designBuild.image.alt
    },
    "/vision-process": {
      title: content.pages.visionProcess.seo.title || `Vision and Process | ${brand}`,
      description: content.pages.visionProcess.seo.description || content.pages.visionProcess.body,
      image: content.pages.visionProcess.seo.image.src || content.pages.visionProcess.image.src,
      imageAlt: content.pages.visionProcess.seo.image.alt || content.pages.visionProcess.image.alt
    },
    "/about": {
      title: content.seo.about.title || `About Us | ${brand}`,
      description: content.seo.about.description || content.about.body,
      image: content.seo.about.image.src || content.about.image.src,
      imageAlt: content.seo.about.image.alt || content.about.image.alt
    },
    "/land-wanted": {
      title: content.seo.landWanted.title || `Land Wanted | ${brand}`,
      description: content.seo.landWanted.description || content.landWanted.body,
      image: content.seo.landWanted.image.src || content.landWanted.image.src,
      imageAlt: content.seo.landWanted.image.alt || content.landWanted.image.alt
    },
    "/contact": {
      title: content.pages.contact.seo.title || `Contact | ${brand}`,
      description: content.pages.contact.seo.description || content.pages.contact.body,
      image: content.pages.contact.seo.image.src || content.pages.contact.image.src,
      imageAlt: content.pages.contact.seo.image.alt || content.pages.contact.image.alt
=======
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
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    }
  };

  return routes[route] ?? {
    title: `${brand}`,
    description: "Kingsvale Homes creates exceptional communities and luxury homes across distinctive British locations.",
<<<<<<< HEAD
    image: content.hero.image.src,
    imageAlt: content.hero.image.alt
=======
    image: content.hero.image.src
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
