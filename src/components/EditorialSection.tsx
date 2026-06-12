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
        <p className="eyebrow">{content.eyebrow}</p>
        <h2 id="legacy-title">{content.title}</h2>
        <p>{content.body}</p>
        <ButtonLink href={content.ctaHref}>{content.ctaLabel}</ButtonLink>
      </Reveal>
    </section>
  );
}
