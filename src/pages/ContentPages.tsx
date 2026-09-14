import { ProjectGallery, ProjectCarousel } from "../components/ProjectImages";
import { SiteText } from "../components/SiteText";
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { ButtonLink } from "../components/ButtonLink";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { Reveal } from "../components/Reveal";
import { faqItems, faqPageSeo, guidePages, type GuidePageRoute } from "../data/answerPages";
import type { Development, FeatureItem, ImageAsset, SiteContent } from "../lib/contentTypes";
import { postJson, type SubmitState } from "../lib/formSubmit";
import { studioPath } from "../lib/studioRoute";

type ContentPageProps = {
  content: SiteContent;
};

export function DevelopmentsIndexPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="Our developments"
        title="Distinctive homes in carefully chosen locations."
        body="Every Kingsvale development is shaped around setting, longevity and the quiet details that make a home feel settled from the first day."
        image={content.hero.image}
      />
      <section className="content-band">
        <div className="content-heading">
          <p className="eyebrow"><SiteText>Current collection</SiteText></p>
          <h2><SiteText>Explore our homes</SiteText></h2>
        </div>
        <div className="listing-grid">
          {content.developments.map((development, index) => (
            <article className="listing-card" key={development.id}>
              <ProjectCarousel project={development} index={index} />
              <div className="listing-card__body">
                <p className="eyebrow"><SiteText>{development.status}</SiteText></p>
                <h2><SiteText>{development.title}</SiteText></h2>
                <p className="listing-card__location"><SiteText>{development.location}</SiteText></p>
                <p><SiteText>{development.heroBody ?? development.description}</SiteText></p>
                <ButtonLink href={development.ctaHref} variant="dark">
                  <SiteText>View development</SiteText></ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

export function DevelopmentDetailPage({
  content,
  development
}: ContentPageProps & { development: Development }) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={development.status ?? "Development"}
        title={development.title}
        body={development.heroBody ?? development.description}
        image={development.image}
      />
      <section className="detail-intro detail-intro--simple">
        <div>
          <p className="eyebrow"><SiteText>{development.location}</SiteText></p>
          <h2><SiteText>{development.description}</SiteText></h2>
        </div>
      </section>
      <ProjectGallery project={development} index={content.developments.findIndex((item) => item.id === development.id)} />
      <section className="content-band content-band--warm">
        <div className="development-story">
          <Reveal className="story-copy">
            <p className="eyebrow"><SiteText>Why it works</SiteText></p>
            <h2><SiteText>Designed around daily life, long-term value and place.</SiteText></h2>
            <p>
              <SiteText>Kingsvale homes are planned from the outside in: approach, light, privacy, storage, garden access and everyday flow are resolved before the decorative layer is added.</SiteText></p>
            <ul className="check-list">
              {(development.highlights ?? []).map((highlight) => (
                <li key={highlight}>
                  <CheckCircle2 aria-hidden="true" />
                  <span><SiteText>{highlight}</SiteText></span>
                </li>
              ))}
            </ul>
          </Reveal>

        </div>
      </section>
      <LandContactStrip />
    </PublicShell>
  );
}

export function DesignBuildPage({ content }: ContentPageProps) {
  const page = content.pages.designBuild;
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={page.eyebrow}
        title={page.title}
        body={page.body}
        image={page.image}
      />
      <ProcessGrid
        eyebrow={page.sectionEyebrow}
        title={page.sectionTitle}
        items={page.sectionItems}
      />
      <EditorialCallout
        title={page.calloutTitle}
        body={page.calloutBody}
      />
    </PublicShell>
  );
}

export function VisionProcessPage({ content }: ContentPageProps) {
  const page = content.pages.visionProcess;
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={page.eyebrow}
        title={page.title}
        body={page.body}
        image={page.image}
      />
      <ProcessGrid
        eyebrow={page.sectionEyebrow}
        title={page.sectionTitle}
        items={page.sectionItems}
      />
      <EditorialCallout
        title={page.calloutTitle}
        body={page.calloutBody}
      />
    </PublicShell>
  );
}

export function AboutPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={content.about.eyebrow}
        title={content.about.title}
        body={content.about.body}
        image={content.about.image}
      />
      <section className="content-band">
        <div className="two-column two-column--center">
          <div className="story-copy">
            <p className="eyebrow"><SiteText>How we work</SiteText></p>
            <h2><SiteText>Small enough to care deeply. Experienced enough to deliver well.</SiteText></h2>
          </div>
          <div className="rich-copy">
            <p>
              <SiteText>Kingsvale was created for clients and communities who value craft, restraint and follow-through. We work with trusted consultants, trades and suppliers, choosing durable details over passing trends.</SiteText></p>
            <p>
              <SiteText>Our homes are designed to sit comfortably in their settings while giving modern families the spaces they actually use: light kitchens, proper storage, quiet rooms, generous entrances and gardens that feel connected to the house.</SiteText></p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function LandWantedPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={content.landWanted.eyebrow}
        title={content.landWanted.title}
        body={content.landWanted.body}
        image={content.landWanted.image}
      />
      <ProcessGrid
        eyebrow="Sites we consider"
        title="Land with potential deserves a clear, discreet conversation."
        items={[
          { id: "greenfield", icon: "leaf", title: "Greenfield and edge-of-settlement", description: "Sites with a credible planning route and strong residential demand." },
          { id: "brownfield", icon: "home", title: "Brownfield", description: "Underused commercial, former agricultural or redundant residential parcels." },
          { id: "joint-ventures", icon: "users", title: "Joint ventures", description: "Partnership structures for landowners who want aligned long-term upside." },
          { id: "subject-to-planning", icon: "map", title: "Subject-to-planning", description: "Structured agreements that respect risk, timing and planning complexity." }
        ]}
      />
      <LandContactStrip />
    </PublicShell>
  );
}

export function NewHomesSouthEnglandPage({ content }: ContentPageProps) {
  return <GuidePage content={content} route="/new-homes-south-england" />;
}

export function RealEstateDevelopmentPage({ content }: ContentPageProps) {
  return <GuidePage content={content} route="/real-estate-development" />;
}

export function LandOpportunitiesPage({ content }: ContentPageProps) {
  return <GuidePage content={content} route="/land-opportunities" />;
}

export function LandSellerGuidePage({ content }: ContentPageProps) {
  return <GuidePage content={content} route="/land-seller-guide" />;
}

export function FaqPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="FAQ"
        title="Questions about Kingsvale Homes."
        body="Clear answers about our new homes, residential development work, land opportunities and design-led build services."
        image={faqPageSeo.image}
      />
      <section className="content-band">
        <div className="content-heading">
          <p className="eyebrow"><SiteText>Common questions</SiteText></p>
          <h2><SiteText>Direct answers for buyers, landowners and project partners.</SiteText></h2>
        </div>
        <div className="faq-list">
          {faqItems.map((item, index) => (
            <details className="faq-item" key={item.question} open={index === 0}>
              <summary><SiteText>{item.question}</SiteText></summary>
              <p><SiteText>{item.answer}</SiteText></p>
            </details>
          ))}
        </div>
      </section>
      <RelatedLinks
        links={[
          { label: "New homes", href: "/new-homes-south-england" },
          { label: "Residential development", href: "/real-estate-development" },
          { label: "View developments", href: "/developments" },
          { label: "Land opportunities", href: "/land-opportunities" },
          { label: "Land seller guide", href: "/land-seller-guide" }
        ]}
      />
    </PublicShell>
  );
}

export function ContactPage({ content }: ContentPageProps) {
  const page = content.pages.contact;
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      setSubmitState("submitting");
      await postJson("/api/contact", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        type: String(form.get("type") ?? ""),
        message: String(form.get("message") ?? "")
      });
      setSubmitState("success");
      event.currentTarget.reset();
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={page.eyebrow}
        title={page.title}
        body={page.body}
        image={page.image}
      />
      <section className="contact-panel" id="contact">
        <div className="contact-panel__card">
          <h2><SiteText>{page.sectionTitle || "Speak to our team"}</SiteText></h2>
          <a href={`tel:${content.footer.phone.replace(/\s/g, "")}`}>
            <Phone aria-hidden="true" />
            <SiteText>{content.footer.phone}</SiteText>
          </a>
          <a href={`mailto:${content.footer.email}`}>
            <Mail aria-hidden="true" />
            <SiteText>{content.footer.email}</SiteText>
          </a>
          <p>
            <MapPin aria-hidden="true" />
            <SiteText>{content.footer.address}</SiteText>
          </p>
        </div>
        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            <SiteText>Name</SiteText><input name="name" autoComplete="name" minLength={2} maxLength={80} required />
          </label>
          <label>
            <SiteText>Email</SiteText><input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            <SiteText>Enquiry type</SiteText><select name="type" required>
              <option>Development enquiry</option>
              <option>Land opportunity</option>
              <option>Design and build</option>
              <option>General enquiry</option>
            </select>
          </label>
          <label>
            <SiteText>Message</SiteText><textarea name="message" rows={5} minLength={10} maxLength={1200} required />
          </label>
          <button
            type="submit"
            className="button-link button-link--warm"
            disabled={submitState === "submitting"}
          >
            <span><SiteText>{submitState === "submitting" ? "Sending" : "Send enquiry"}</SiteText></span>
            <ArrowRight aria-hidden="true" />
          </button>
          {submitState === "success" && <p className="form-status"><SiteText>Thank you. Your enquiry has been received.</SiteText></p>}
          {submitState === "error" && <p className="form-status"><SiteText>Please email the team directly if this does not send.</SiteText></p>}
        </form>
      </section>
    </PublicShell>
  );
}

export function LegalPage({
  content,
  kind
}: ContentPageProps & { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={isPrivacy ? "Privacy" : "Terms"}
        title={isPrivacy ? "Privacy policy" : "Terms and conditions"}
        body={
          isPrivacy
            ? "How Kingsvale handles enquiry data, newsletter details and correspondence."
            : "The terms that govern use of this website and the information presented here."
        }
        image={content.hero.image}
      />
      <section className="content-band">
        <div className="legal-copy">
          <h2><SiteText>{isPrivacy ? "Privacy principles" : "Website terms"}</SiteText></h2>
          <p>
            <SiteText>This page should be reviewed by a qualified legal adviser before public launch. It gives Kingsvale a complete, coherent structure for launch preparation, but it is not a substitute for formal advice.</SiteText></p>
          {isPrivacy ? (
            <>
              <h3><SiteText>Information we collect</SiteText></h3>
              <p>
                <SiteText>Enquiry forms and newsletter sign-ups collect only the details needed to respond: name, email address, enquiry type, message content and basic request metadata used for fraud prevention and service reliability.</SiteText></p>
              <h3><SiteText>How information is used</SiteText></h3>
              <p>
                <SiteText>Kingsvale should use personal information to respond to enquiries, manage development interest, send requested updates and maintain website security. Personal data should not be sold.</SiteText></p>
              <h3><SiteText>Retention and choices</SiteText></h3>
              <p>
                <SiteText>Enquiry records should be retained only for a proportionate period. Newsletter subscribers should be able to unsubscribe, request correction or ask for deletion where legally available.</SiteText></p>
            </>
          ) : (
            <>
              <h3><SiteText>Website information</SiteText></h3>
              <p>
                <SiteText>Development details, imagery, availability, price guides and specifications are provided for general guidance and may change. They should not be treated as a binding offer or representation.</SiteText></p>
              <h3><SiteText>Intellectual property</SiteText></h3>
              <p>
                <SiteText>The Kingsvale name, site design, text, imagery and brand assets should remain protected. Visitors may view the site for personal use but should not reproduce material without permission.</SiteText></p>
              <h3><SiteText>Enquiries and reliance</SiteText></h3>
              <p>
                <SiteText>Buyers, landowners and clients should confirm all material facts with the Kingsvale team and their advisers before making a decision based on website content.</SiteText></p>
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

export function SecurityReviewPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="Security review"
        title="Red-team notes for the current secure implementation."
        body="This page documents what has been hardened, what remains prototype-only, and what should move to managed services before production scale."
        image={content.pages.visionProcess.image}
      />
      <section className="content-band">
        <div className="security-grid">
          <SecurityCard
            title="Implemented controls"
            items={[
              "Editor moved from /admin to the dedicated /studio workspace.",
              "Secure mode uses passphrase login with a short-lived bearer token for protected CMS requests.",
              "Optional TOTP MFA can be enabled through server environment variables.",
              "Studio routes and public tracking pages render without localhost-only gates.",
              "Published content, drafts and revision history persist in server CMS storage.",
              "Local CMS files and backups can be encrypted at rest when a CMS encryption key is configured.",
              "Server uploads are decoded, dimension-limited and converted to WebP media variants.",
              "Security headers, rate limiting, audit logging, lead validation, signed webhook forwarding and health checks are available through the secure server."
            ]}
          />
          <SecurityCard
            title="Red-team findings"
            items={[
              "If deployed as plain static files, client-side auth can still be bypassed by a motivated attacker.",
              "Published content is intentionally public and cannot be meaningfully encrypted client-side.",
              "The local Vite passphrase verifier is still visible in bundled JavaScript.",
              "Secure mode uses local file persistence rather than managed database and object storage.",
              "MFA, webhook signatures and CMS encryption depend on production environment configuration.",
              "Image processing validates decode and dimensions but is not a full malware scanning system."
            ]}
          />
          <SecurityCard
            title="Production upgrade path"
            items={[
              "Move auth to SSO/OIDC with MFA and role-based access control.",
              "Store content and revisions in a managed database with backups.",
              "Move uploads to object storage with signed URLs, scanning and lifecycle policy.",
              "Centralize audit logs and alert on suspicious studio activity.",
              "Run visual regression and performance-budget checks in CI before deployment.",
              `Keep the generated route private: ${studioPath}.`
            ]}
          />
        </div>
      </section>
    </PublicShell>
  );
}

export function NotFoundPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="Not found"
        title="This page has not been planned."
        body="Return to the homepage or explore the current Kingsvale developments."
        image={content.hero.image}
      />
    </PublicShell>
  );
}

function PublicShell({ content, children }: ContentPageProps & { children: ReactNode }) {
  return (
    <div className="site-homepage inner-site">
      <Header
        brandName={content.brandName}
        brandSuffix={content.brandSuffix}
        navLinks={content.navLinks}
      />
      <main>{children}</main>
      <Footer
        brandName={content.brandName}
        brandSuffix={content.brandSuffix}
        footer={content.footer}
      />
    </div>
  );
}

function InnerHero({
  eyebrow,
  title,
  body,
  image
}: {
  eyebrow: string;
  title: string;
  body: string;
  image: ImageAsset;
}) {
  return (
    <section className="inner-hero">
      <ResponsiveImage image={image} className="inner-hero__image" priority widthHint={1800} sizes="100vw" />
      <div className="hero__overlay" aria-hidden="true" />
      <div className="inner-hero__content">
        <p className="eyebrow hero__eyebrow"><SiteText>{eyebrow}</SiteText></p>
        <h1><SiteText>{title}</SiteText></h1>
        <p><SiteText>{body}</SiteText></p>
      </div>
    </section>
  );
}

function ProcessGrid({
  eyebrow,
  title,
  items
}: {
  eyebrow: string;
  title: string;
  items: FeatureItem[];
}) {
  return (
    <section className="content-band">
      <div className="content-heading">
        <p className="eyebrow"><SiteText>{eyebrow}</SiteText></p>
        <h2><SiteText>{title}</SiteText></h2>
      </div>
      <div className="process-grid">
        {items.map((item, index) => (
          <Reveal className="process-card" delay={index * 70} key={item.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3><SiteText>{item.title}</SiteText></h3>
            <p><SiteText>{item.description}</SiteText></p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function EditorialCallout({ title, body }: { title: string; body: string }) {
  return (
    <section className="editorial-callout">
      <p className="eyebrow"><SiteText>Kingsvale standard</SiteText></p>
      <h2><SiteText>{title}</SiteText></h2>
      <p><SiteText>{body}</SiteText></p>
    </section>
  );
}

function GuidePage({ content, route }: ContentPageProps & { route: GuidePageRoute }) {
  const page = guidePages[route];

  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow={page.eyebrow}
        title={page.title}
        body={page.body}
        image={page.image}
      />
      <section className="content-band">
        <div className="answer-summary">
          <p className="eyebrow"><SiteText>Short answer</SiteText></p>
          <h2><SiteText>{page.summaryTitle}</SiteText></h2>
          <p><SiteText>{page.summaryBody}</SiteText></p>
        </div>
      </section>
      <section className="content-band content-band--warm">
        <div className="answer-section-grid">
          {page.sections.map((section) => (
            <article className="answer-section" key={section.title}>
              <h2><SiteText>{section.title}</SiteText></h2>
              <p><SiteText>{section.body}</SiteText></p>
              {section.items && (
                <ul className="answer-list">
                  {section.items.map((item) => (
                    <li key={item}>
                      <CheckCircle2 aria-hidden="true" />
                      <span><SiteText>{item}</SiteText></span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
      <ProcessGrid
        eyebrow="What matters"
        title="The signals Kingsvale looks for."
        items={page.cards}
      />
      <RelatedLinks links={page.relatedLinks} />
    </PublicShell>
  );
}

function RelatedLinks({ links }: { links: Array<{ label: string; href: string }> }) {
  return (
    <section className="answer-links">
      <div>
        <p className="eyebrow"><SiteText>Next step</SiteText></p>
        <h2><SiteText>Explore the most relevant Kingsvale pages.</SiteText></h2>
      </div>
      <div className="answer-links__actions">
        {links.map((link) => (
          <ButtonLink href={link.href} key={link.href} variant="dark">
            <SiteText>{link.label}</SiteText>
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}

function LandContactStrip() {
  return (
    <section className="land-contact-strip">
      <div>
        <p className="eyebrow"><SiteText>Talk to Kingsvale</SiteText></p>
        <h2><SiteText>Have a site, enquiry or development question?</SiteText></h2>
      </div>
      <ButtonLink href="/contact"><SiteText>Contact us</SiteText></ButtonLink>
    </section>
  );
}

function SecurityCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="security-card">
      <h2><SiteText>{title}</SiteText></h2>
      <ul className="check-list">
        {items.map((item) => (
          <li key={item}>
            <CheckCircle2 aria-hidden="true" />
            <span><SiteText>{item}</SiteText></span>
          </li>
        ))}
      </ul>
    </article>
  );
}
