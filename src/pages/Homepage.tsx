import type { SiteContent } from "../lib/contentTypes";
import { Developments } from "../components/Developments";
import { EditorialSection } from "../components/EditorialSection";
import { FeatureStrip } from "../components/FeatureStrip";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { LandWanted } from "../components/LandWanted";

type HomepageProps = {
  content: SiteContent;
  preview?: boolean;
};

export function Homepage({ content, preview = false }: HomepageProps) {
  const ContentWrapper = preview ? "div" : "main";

  return (
    <div className="site-homepage" data-preview={preview}>
      <Header
        brandName={content.brandName}
        brandSuffix={content.brandSuffix}
        navLinks={content.navLinks}
      />
      <ContentWrapper className="homepage-content">
        <Hero hero={content.hero} />
        <FeatureStrip features={content.features} />
        <EditorialSection content={content.about} />
        <Developments
          intro={content.developmentsIntro}
          developments={content.developments}
        />
        <LandWanted content={content.landWanted} />
      </ContentWrapper>
      <Footer
        brandName={content.brandName}
        brandSuffix={content.brandSuffix}
        footer={content.footer}
      />
    </div>
  );
}
