import { SiteText } from "./SiteText";
import type { HeroContent } from "../lib/contentTypes";
import { ResponsiveImage } from "./ResponsiveImage";
import { ButtonLink } from "./ButtonLink";

type HeroProps = {
  hero: HeroContent;
};

export function Hero({ hero }: HeroProps) {
  // Cover crops a wide photograph into a tall mobile frame. Select enough pixels
  // for the full scaled photograph, rather than only the viewport's narrow width.
  const coverWidth = hero.image.width && hero.image.height ? Math.ceil(780 * 1.05 * hero.image.width / hero.image.height) : 0;
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <ResponsiveImage
        image={hero.image}
        className="hero__image"
        sizes={coverWidth ? `max(100vw, ${coverWidth}px)` : "100vw"}
        widthHint={2000}
        priority
      />
      <div className="hero__overlay" aria-hidden="true" />
      <div className="hero__content">
        <p className="eyebrow hero__eyebrow"><SiteText field={`hero.eyebrow`}>{hero.eyebrow}</SiteText></p>
        <h1 id="hero-title"><SiteText field={`hero.title`}>{hero.title}</SiteText></h1>
        <p className="hero__subtitle"><SiteText field={`hero.subtitle`}>{hero.subtitle}</SiteText></p>
        <ButtonLink href={hero.ctaHref} variant="light">
          <SiteText field={`hero.ctaLabel`}>{hero.ctaLabel}</SiteText>
        </ButtonLink>
      </div>
    </section>
  );
}
