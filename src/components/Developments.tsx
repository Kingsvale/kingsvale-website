import type { Development, SiteContent } from "../lib/contentTypes";
import { ButtonLink } from "./ButtonLink";
import { ProjectCarousel } from "./ProjectImages";
import { SiteText } from "./SiteText";
import { Reveal } from "./Reveal";

type DevelopmentsProps = {
  intro: SiteContent["developmentsIntro"];
  developments: Development[];
};

export function Developments({ intro, developments }: DevelopmentsProps) {
  return (
    <section className="developments" id="developments" aria-labelledby="developments-title">
      <div className="section-heading">
        <p className="eyebrow"><SiteText field="developmentsIntro.eyebrow">{intro.eyebrow}</SiteText></p>
        <h2 id="developments-title"><SiteText field="developmentsIntro.title">{intro.title}</SiteText></h2>
        <ButtonLink href={intro.viewAllHref} variant="dark" className="section-heading__link">
          <SiteText field="developmentsIntro.viewAllLabel">{intro.viewAllLabel}</SiteText>
        </ButtonLink>
      </div>
      <div className="development-grid">
        {developments.map((development, index) => (
          <DevelopmentCard
            development={development}
            index={index}
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
  index,
  delay
}: {
  development: Development;
  index: number;
  delay: number;
}) {
  const specs = [
    { label: "Guide", value: development.priceGuide },
    { label: "Homes", value: development.homes },
    { label: "Bedrooms", value: development.bedrooms }
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <Reveal className="development-card" delay={delay}>
      <ProjectCarousel project={development} index={index}>
        {development.status && (
          <span className="development-card__status"><SiteText field={`developments.${index}.status`}>{development.status}</SiteText></span>
        )}
      </ProjectCarousel>
      <div className="development-card__body">
        <h3><SiteText field={`developments.${index}.title`}>{development.title}</SiteText></h3>
        <p className="development-card__location"><SiteText field={`developments.${index}.location`}>{development.location}</SiteText></p>
        <p><SiteText field={`developments.${index}.description`}>{development.description}</SiteText></p>
        {specs.length > 0 && (
          <dl className="development-card__specs">
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt><SiteText copy={`project_spec_${spec.label}`}>{spec.label}</SiteText></dt>
                <dd><SiteText field={`developments.${index}.${spec.label === "Guide" ? "priceGuide" : spec.label.toLowerCase()}`}>{spec.value}</SiteText></dd>
              </div>
            ))}
          </dl>
        )}
        <ButtonLink href={development.ctaHref} variant="dark" className="development-card__link">
          <SiteText field={`developments.${index}.ctaLabel`}>{development.ctaLabel}</SiteText>
        </ButtonLink>
      </div>
    </Reveal>
  );
}
