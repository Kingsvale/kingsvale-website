import { SiteText } from "./SiteText";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { FooterContent } from "../lib/contentTypes";
import { postJson, type SubmitState } from "../lib/formSubmit";
import { Logo } from "./Logo";

type FooterProps = {
  brandName: string;
  brandSuffix: string;
  footer: FooterContent;
};

export function Footer({ brandName, brandSuffix, footer }: FooterProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  async function handleNewsletterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "");

    try {
      setSubmitState("submitting");
      await postJson("/api/newsletter", { email });
      setSubmitState("success");
      formElement.reset();
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <footer className="footer" id="contact">
      <div className="footer__grid">
        <div className="footer__brand">
          <Logo brandName={brandName} brandSuffix={brandSuffix} href="/" />
          <p><SiteText field={`footer.description`}>{footer.description}</SiteText></p>
          <div className="footer__socials" aria-label="Social links">
            {footer.socialLinks.map((link) => (
              <a key={link.label} href={getSocialHref(link.label, link.href)} aria-label={getSocialLabel(link.label)}>
                <img src={getSocialIcon(link.label)} alt="" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <address className="footer__contact">
          <h2><SiteText copy="footer_contact_us">Contact us</SiteText></h2>
          <a href={`tel:${footer.phone.replace(/\s/g, "")}`}>
            <Phone aria-hidden="true" />
            <span><SiteText field={`footer.phone`}>{footer.phone}</SiteText></span>
          </a>
          <a href={`mailto:${footer.email}`}>
            <Mail aria-hidden="true" />
            <span><SiteText field={`footer.email`}>{footer.email}</SiteText></span>
          </a>
          <p>
            <MapPin aria-hidden="true" />
            <span><SiteText field={`footer.address`}>{footer.address}</SiteText></span>
          </p>
        </address>
        <nav className="footer__nav" aria-label="Footer navigation">
          <h2><SiteText copy="footer_explore">Explore</SiteText></h2>
          {footer.exploreLinks.map((link, index) => (
            <a key={`${link.href}-${link.label}`} href={link.href}>
              <SiteText field={`footer.exploreLinks.${index}.label`}>{link.label}</SiteText>
            </a>
          ))}
        </nav>
        <div className="footer__newsletter">
          <h2><SiteText field={`footer.newsletterTitle`}>{footer.newsletterTitle}</SiteText></h2>
          <p><SiteText field={`footer.newsletterCopy`}>{footer.newsletterCopy}</SiteText></p>
          <form
            onSubmit={handleNewsletterSubmit}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              <SiteText copy="footer_email_address">Email address</SiteText></label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              placeholder={footer.newsletterPlaceholder}
              required
            />
            <button
              type="submit"
              aria-label="Join newsletter"
              disabled={submitState === "submitting"}
            >
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
          {submitState === "success" && <p className="footer__thanks"><SiteText copy="footer_thank_you_for_joining_">Thank you for joining.</SiteText></p>}
          {submitState === "error" && <p className="footer__thanks"><SiteText copy="footer_please_email_us_directly_">Please email us directly.</SiteText></p>}
        </div>
      </div>
      <div className="footer__bar">
        <p><SiteText copy="footer_copyright">{`© 2026 ${brandName} ${brandSuffix}. All rights reserved.`}</SiteText></p>
        <div>
          {footer.legalLinks.map((link, index) => (
            <a key={`${link.href}-${link.label}`} href={link.href}>
              <SiteText field={`footer.legalLinks.${index}.label`}>{link.label}</SiteText>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

function getSocialLabel(label: string) {
  return label.toLowerCase() === "linkedin" ? "X" : label;
}

function getSocialHref(label: string, href: string) {
  return label.toLowerCase() === "linkedin" ? "https://x.com/" : href;
}

function getSocialIcon(label: string) {
  const normalized = getSocialLabel(label).toLowerCase();
  if (normalized === "facebook") {
    return "/social/facebook.ico";
  }
  if (normalized === "instagram") {
    return "/social/instagram.ico";
  }
  return "/social/x.ico";
}
