import { ArrowRight, CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { ButtonLink } from "../components/ButtonLink";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { Reveal } from "../components/Reveal";
import type { Development, ImageAsset, SiteContent } from "../lib/contentTypes";
import { postJson, type SubmitState } from "../lib/formSubmit";
import { studioPath } from "../lib/studioRoute";

type ContentPageProps = {
  content: SiteContent;
};

const pageImages = {
  design: {
    src: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
    alt: "A warm contemporary living room designed for luxury family life",
    focalPoint: "50% 52%"
  },
  process: {
    src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
    alt: "Architectural plans and design tools on a work table",
    focalPoint: "50% 50%"
  },
  contact: {
    src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
    alt: "An elegant living space with warm architectural materials",
    focalPoint: "50% 50%"
  }
} satisfies Record<string, ImageAsset>;

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
          <p className="eyebrow">Current collection</p>
          <h2>Explore our homes</h2>
        </div>
        <div className="listing-grid">
          {content.developments.map((development) => (
            <article className="listing-card" key={development.id}>
              <a href={development.ctaHref} className="listing-card__media">
                <ResponsiveImage
                  image={development.image}
                  sizes="(max-width: 760px) 100vw, 33vw"
                  widthHint={960}
                />
              </a>
              <div className="listing-card__body">
                <p className="eyebrow">{development.status}</p>
                <h2>{development.title}</h2>
                <p className="listing-card__location">{development.location}</p>
                <p>{development.heroBody ?? development.description}</p>
                <dl className="mini-specs">
                  <div>
                    <dt>Homes</dt>
                    <dd>{development.homes}</dd>
                  </div>
                  <div>
                    <dt>Bedrooms</dt>
                    <dd>{development.bedrooms}</dd>
                  </div>
                  <div>
                    <dt>Guide</dt>
                    <dd>{development.priceGuide}</dd>
                  </div>
                </dl>
                <ButtonLink href={development.ctaHref} variant="dark">
                  View development
                </ButtonLink>
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
      <section className="detail-intro">
        <div>
          <p className="eyebrow">{development.location}</p>
          <h2>{development.description}</h2>
        </div>
        <dl className="spec-panel">
          <div>
            <dt>Homes</dt>
            <dd>{development.homes}</dd>
          </div>
          <div>
            <dt>Bedrooms</dt>
            <dd>{development.bedrooms}</dd>
          </div>
          <div>
            <dt>Price guide</dt>
            <dd>{development.priceGuide}</dd>
          </div>
        </dl>
      </section>
      <section className="content-band content-band--warm">
        <div className="two-column">
          <Reveal className="story-copy">
            <p className="eyebrow">Why it works</p>
            <h2>Designed around daily life, long-term value and place.</h2>
            <p>
              Kingsvale homes are planned from the outside in: approach, light,
              privacy, storage, garden access and everyday flow are resolved
              before the decorative layer is added.
            </p>
            <ul className="check-list">
              {(development.highlights ?? []).map((highlight) => (
                <li key={highlight}>
                  <CheckCircle2 aria-hidden="true" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="gallery-grid">
            {(development.gallery ?? [development.image]).map((image) => (
              <ResponsiveImage
                key={image.src}
                image={image}
                sizes="(max-width: 860px) 100vw, 44vw"
                widthHint={900}
              />
            ))}
          </div>
        </div>
      </section>
      <LandContactStrip />
    </PublicShell>
  );
}

export function DesignBuildPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="Design & build services"
        title="A complete route from land and concept to finished home."
        body="For private clients and landowners, Kingsvale brings planning intelligence, architectural discipline, procurement control and site delivery under one calm, accountable process."
        image={pageImages.design}
      />
      <ProcessGrid
        eyebrow="What we manage"
        title="Built for clients who want clarity at every stage."
        items={[
          ["Feasibility", "Site appraisal, planning constraints, budget ranges and route-to-consent advice."],
          ["Design", "Architectural direction, specification strategy, material palette and internal planning."],
          ["Procurement", "Tender packs, supplier coordination, programme planning and value engineering."],
          ["Delivery", "Site management, quality control, handover preparation and aftercare."]
        ]}
      />
      <EditorialCallout
        title="Quietly controlled. Carefully detailed."
        body="The best luxury homes feel effortless because the difficult decisions have been resolved early. Our role is to protect the design intent while keeping cost, programme and quality visible."
      />
    </PublicShell>
  );
}

export function VisionProcessPage({ content }: ContentPageProps) {
  return (
    <PublicShell content={content}>
      <InnerHero
        eyebrow="Our vision & process"
        title="Timeless homes, measured decisions and lasting value."
        body="We work deliberately: understanding the land, refining the brief, testing details and delivering homes that feel established, efficient and beautifully composed."
        image={pageImages.process}
      />
      <ProcessGrid
        eyebrow="Our rhythm"
        title="A disciplined process for exceptional outcomes."
        items={[
          ["Listen", "We establish the commercial, lifestyle and planning priorities before design begins."],
          ["Shape", "We align massing, materials, layouts and landscape into a coherent proposition."],
          ["Refine", "We test cost, performance, buildability and buyer experience in detail."],
          ["Deliver", "We build with accountable site control and a long-term aftercare mindset."]
        ]}
      />
      <EditorialCallout
        title="Luxury without noise."
        body="Kingsvale's visual language is restrained because confidence does not need volume. Proportion, materiality, light and durability do the work."
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
            <p className="eyebrow">How we work</p>
            <h2>Small enough to care deeply. Experienced enough to deliver well.</h2>
          </div>
          <div className="rich-copy">
            <p>
              Kingsvale was created for clients and communities who value craft,
              restraint and follow-through. We work with trusted consultants,
              trades and suppliers, choosing durable details over passing trends.
            </p>
            <p>
              Our homes are designed to sit comfortably in their settings while
              giving modern families the spaces they actually use: light kitchens,
              proper storage, quiet rooms, generous entrances and gardens that
              feel connected to the house.
            </p>
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
          ["Greenfield and edge-of-settlement", "Sites with a credible planning route and strong residential demand."],
          ["Brownfield", "Underused commercial, former agricultural or redundant residential parcels."],
          ["Joint ventures", "Partnership structures for landowners who want aligned long-term upside."],
          ["Subject-to-planning", "Structured agreements that respect risk, timing and planning complexity."]
        ]}
      />
      <LandContactStrip />
    </PublicShell>
  );
}

export function ContactPage({ content }: ContentPageProps) {
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
        eyebrow="Contact us"
        title="Start a conversation with Kingsvale."
        body="Whether you are exploring a new home, a private build or land with development potential, we would be pleased to hear from you."
        image={pageImages.contact}
      />
      <section className="contact-panel" id="contact">
        <div className="contact-panel__card">
          <h2>Speak to our team</h2>
          <a href={`tel:${content.footer.phone.replace(/\s/g, "")}`}>
            <Phone aria-hidden="true" />
            {content.footer.phone}
          </a>
          <a href={`mailto:${content.footer.email}`}>
            <Mail aria-hidden="true" />
            {content.footer.email}
          </a>
          <p>
            <MapPin aria-hidden="true" />
            {content.footer.address}
          </p>
        </div>
        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
          </label>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Enquiry type
            <select name="type" required>
              <option>Development enquiry</option>
              <option>Land opportunity</option>
              <option>Design and build</option>
              <option>General enquiry</option>
            </select>
          </label>
          <label>
            Message
            <textarea name="message" rows={5} minLength={10} maxLength={1200} required />
          </label>
          <button
            type="submit"
            className="button-link button-link--warm"
            disabled={submitState === "submitting"}
          >
            <span>{submitState === "submitting" ? "Sending" : "Send enquiry"}</span>
            <ArrowRight aria-hidden="true" />
          </button>
          {submitState === "success" && <p className="form-status">Thank you. Your enquiry has been received.</p>}
          {submitState === "error" && <p className="form-status">Please email the team directly if this does not send.</p>}
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
          <h2>{isPrivacy ? "Privacy principles" : "Website terms"}</h2>
          <p>
            This page should be reviewed by a qualified legal adviser before
            public launch. It gives Kingsvale a complete, coherent structure for
            launch preparation, but it is not a substitute for formal advice.
          </p>
          {isPrivacy ? (
            <>
              <h3>Information we collect</h3>
              <p>
                Enquiry forms and newsletter sign-ups collect only the details
                needed to respond: name, email address, enquiry type, message
                content and basic request metadata used for fraud prevention and
                service reliability.
              </p>
              <h3>How information is used</h3>
              <p>
                Kingsvale should use personal information to respond to
                enquiries, manage development interest, send requested updates
                and maintain website security. Personal data should not be sold.
              </p>
              <h3>Retention and choices</h3>
              <p>
                Enquiry records should be retained only for a proportionate
                period. Newsletter subscribers should be able to unsubscribe,
                request correction or ask for deletion where legally available.
              </p>
            </>
          ) : (
            <>
              <h3>Website information</h3>
              <p>
                Development details, imagery, availability, price guides and
                specifications are provided for general guidance and may change.
                They should not be treated as a binding offer or representation.
              </p>
              <h3>Intellectual property</h3>
              <p>
                The Kingsvale name, site design, text, imagery and brand assets
                should remain protected. Visitors may view the site for personal
                use but should not reproduce material without permission.
              </p>
              <h3>Enquiries and reliance</h3>
              <p>
                Buyers, landowners and clients should confirm all material facts
                with the Kingsvale team and their advisers before making a
                decision based on website content.
              </p>
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
        image={pageImages.process}
      />
      <section className="content-band">
        <div className="security-grid">
          <SecurityCard
            title="Implemented controls"
            items={[
              "Editor moved from /admin to a generated 16-character route.",
              "Secure mode uses a server login page, signed HttpOnly session cookie and CSRF checks.",
              "Optional TOTP MFA and studio IP allowlisting can be enabled through server environment variables.",
              "The secure server protects the studio route and studio asset chunk.",
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
              "MFA, IP allowlisting, webhook signatures and CMS encryption depend on production environment configuration.",
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
        <p className="eyebrow hero__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{body}</p>
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
  items: [string, string][];
}) {
  return (
    <section className="content-band">
      <div className="content-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="process-grid">
        {items.map(([itemTitle, body], index) => (
          <Reveal className="process-card" delay={index * 70} key={itemTitle}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{itemTitle}</h3>
            <p>{body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function EditorialCallout({ title, body }: { title: string; body: string }) {
  return (
    <section className="editorial-callout">
      <p className="eyebrow">Kingsvale standard</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function LandContactStrip() {
  return (
    <section className="land-contact-strip">
      <div>
        <p className="eyebrow">Talk to Kingsvale</p>
        <h2>Have a site, enquiry or development question?</h2>
      </div>
      <ButtonLink href="/contact">Contact us</ButtonLink>
    </section>
  );
}

function SecurityCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="security-card">
      <h2>{title}</h2>
      <ul className="check-list">
        {items.map((item) => (
          <li key={item}>
            <CheckCircle2 aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
