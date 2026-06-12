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
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="land-wanted-title">{content.title}</h2>
        <p>{content.body}</p>
        <ButtonLink href={content.ctaHref}>{content.ctaLabel}</ButtonLink>
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
