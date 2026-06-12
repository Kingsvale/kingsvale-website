import type { Development, SiteContent } from "../lib/contentTypes";
import { ButtonLink } from "./ButtonLink";
import { ResponsiveImage } from "./ResponsiveImage";
import { Reveal } from "./Reveal";

type DevelopmentsProps = {
  intro: SiteContent["developmentsIntro"];
  developments: Development[];
};

export function Developments({ intro, developments }: DevelopmentsProps) {
  return (
    <section className="developments" id="developments" aria-labelledby="developments-title">
      <div className="section-heading">
        <p className="eyebrow">{intro.eyebrow}</p>
        <h2 id="developments-title">{intro.title}</h2>
        <ButtonLink href={intro.viewAllHref} variant="dark" className="section-heading__link">
          {intro.viewAllLabel}
        </ButtonLink>
      </div>
      <div className="development-grid">
        {developments.map((development, index) => (
          <DevelopmentCard
            development={development}
            delay={index * 90}
            key={development.id}
          />
        ))}
      </div>
    </section>
  );
}

function DevelopmentCard({
  development,
  delay
}: {
  development: Development;
  delay: number;
}) {
  return (
    <Reveal className="development-card" delay={delay}>
      <a href={development.ctaHref} className="development-card__media">
        <ResponsiveImage
          image={development.image}
          sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 25vw"
          widthHint={720}
        />
      </a>
      <div className="development-card__body">
        <h3>{development.title}</h3>
        <p className="development-card__location">{development.location}</p>
        <p>{development.description}</p>
        <ButtonLink href={development.ctaHref} variant="dark" className="development-card__link">
          {development.ctaLabel}
        </ButtonLink>
      </div>
    </Reveal>
  );
}
