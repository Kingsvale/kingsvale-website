import { SiteText } from "./SiteText";
import type { EditorialSection as EditorialContent } from "../lib/contentTypes";
import { ButtonLink } from "./ButtonLink";
import { ResponsiveImage } from "./ResponsiveImage";
import { Reveal } from "./Reveal";

type EditorialSectionProps = {
  content: EditorialContent;
};

export function EditorialSection({ content }: EditorialSectionProps) {
  return (
    <section className="editorial-split" id="legacy" aria-labelledby="legacy-title">
      <div className="editorial-split__media">
        <ResponsiveImage
          image={content.image}
          sizes="(max-width: 860px) 100vw, 50vw"
          widthHint={1200}
          className="editorial-split__image"
        />
      </div>
      <Reveal className="editorial-split__copy">
        <p className="eyebrow"><SiteText field={`about.eyebrow`}>{content.eyebrow}</SiteText></p>
        <h2 id="legacy-title"><SiteText field={`about.title`}>{content.title}</SiteText></h2>
        <p><SiteText field={`about.body`}>{content.body}</SiteText></p>
        <ButtonLink href={content.ctaHref}><SiteText field={`about.ctaLabel`}>{content.ctaLabel}</SiteText></ButtonLink>
      </Reveal>
    </section>
  );
}
