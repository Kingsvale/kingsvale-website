import { SiteText } from "./SiteText";
import type { LandWantedContent } from "../lib/contentTypes";
import { ButtonLink } from "./ButtonLink";
import { ResponsiveImage } from "./ResponsiveImage";
import { Reveal } from "./Reveal";

type LandWantedProps = {
  content: LandWantedContent;
};

export function LandWanted({ content }: LandWantedProps) {
  return (
    <section className="land-wanted" id="land-wanted" aria-labelledby="land-wanted-title">
      <Reveal className="land-wanted__copy">
        <p className="eyebrow"><SiteText field={`landWanted.eyebrow`}>{content.eyebrow}</SiteText></p>
        <h2 id="land-wanted-title"><SiteText field={`landWanted.title`}>{content.title}</SiteText></h2>
        <p><SiteText field={`landWanted.body`}>{content.body}</SiteText></p>
        <ButtonLink href={content.ctaHref}><SiteText field={`landWanted.ctaLabel`}>{content.ctaLabel}</SiteText></ButtonLink>
      </Reveal>
      <div className="land-wanted__media">
        <ResponsiveImage
          image={content.image}
          sizes="(max-width: 860px) 100vw, 56vw"
          widthHint={1400}
          className="land-wanted__image"
        />
      </div>
    </section>
  );
}
