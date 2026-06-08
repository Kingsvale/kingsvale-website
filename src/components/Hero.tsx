import type { HeroContent } from "../lib/contentTypes";
import { ResponsiveImage } from "./ResponsiveImage";
import { ButtonLink } from "./ButtonLink";

type HeroProps = {
  hero: HeroContent;
};

export function Hero({ hero }: HeroProps) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <ResponsiveImage
        image={hero.image}
        className="hero__image"
        sizes="100vw"
        widthHint={2000}
        priority
      />
      <div className="hero__overlay" aria-hidden="true" />
      <div className="hero__content">
        <p className="eyebrow hero__eyebrow">{hero.eyebrow}</p>
        <h1 id="hero-title">{hero.title}</h1>
        <p className="hero__subtitle">{hero.subtitle}</p>
        <ButtonLink href={hero.ctaHref} variant="light">
          {hero.ctaLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
