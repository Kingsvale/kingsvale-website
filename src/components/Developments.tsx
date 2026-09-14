import { ArrowUpRight } from "lucide-react";
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
  return (
    <Reveal className="development-card" delay={delay}>
      <ProjectCarousel project={development} index={index} />
      <a className="development-card__body" href={development.ctaHref}>
        <div className="development-card__identity">
          <h3><SiteText field={`developments.${index}.title`}>{development.title}</SiteText></h3>
          <p className="development-card__location"><SiteText field={`developments.${index}.location`}>{development.location}</SiteText></p>
        </div>
        <span className="development-card__arrow" aria-hidden="true"><ArrowUpRight /></span>
      </a>
    </Reveal>
  );
}
