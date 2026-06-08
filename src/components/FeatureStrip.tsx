import type { FeatureItem } from "../lib/contentTypes";
import { IconRenderer } from "./IconRenderer";
import { Reveal } from "./Reveal";

type FeatureStripProps = {
  features: FeatureItem[];
};

export function FeatureStrip({ features }: FeatureStripProps) {
  return (
    <section className="feature-strip" aria-label="Kingsvale values">
      <div className="feature-strip__inner">
        {features.map((feature, index) => (
          <Reveal className="feature" delay={index * 80} key={feature.id}>
            <IconRenderer icon={feature.icon} className="feature__icon" />
            <div>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
