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
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    try {
      setSubmitState("submitting");
      await postJson("/api/newsletter", { email });
      setSubmitState("success");
      event.currentTarget.reset();
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <footer className="footer" id="contact">
      <div className="footer__grid">
        <div className="footer__brand">
          <Logo brandName={brandName} brandSuffix={brandSuffix} href="/" />
          <p>{footer.description}</p>
          <div className="footer__socials" aria-label="Social links">
            {footer.socialLinks.map((link) => (
              <a key={link.label} href={getSocialHref(link.label, link.href)} aria-label={getSocialLabel(link.label)}>
                <img src={getSocialIcon(link.label)} alt="" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <address className="footer__contact">
          <h2>Contact us</h2>
          <a href={`tel:${footer.phone.replace(/\s/g, "")}`}>
            <Phone aria-hidden="true" />
            <span>{footer.phone}</span>
          </a>
          <a href={`mailto:${footer.email}`}>
            <Mail aria-hidden="true" />
            <span>{footer.email}</span>
          </a>
          <p>
            <MapPin aria-hidden="true" />
            <span>{footer.address}</span>
          </p>
        </address>
        <nav className="footer__nav" aria-label="Footer navigation">
          <h2>Explore</h2>
          {footer.exploreLinks.map((link) => (
            <a key={`${link.href}-${link.label}`} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="footer__newsletter">
          <h2>{footer.newsletterTitle}</h2>
          <p>{footer.newsletterCopy}</p>
          <form
            onSubmit={handleNewsletterSubmit}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
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
          {submitState === "success" && <p className="footer__thanks">Thank you for joining.</p>}
          {submitState === "error" && <p className="footer__thanks">Please email us directly.</p>}
        </div>
      </div>
      <div className="footer__bar">
        <p>(c) 2026 {brandName} {brandSuffix}. All rights reserved.</p>
        <div>
          {footer.legalLinks.map((link) => (
            <a key={`${link.href}-${link.label}`} href={link.href}>
              {link.label}
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
