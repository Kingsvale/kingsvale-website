import { SiteText } from "../components/SiteText";
import { type FormEvent, useState } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { ResponsiveImage } from "../components/ResponsiveImage";
import type { SiteContent } from "../lib/contentTypes";
import { lookupTrackingSite } from "../lib/publicTrackingApi";

type PlotLookupPageProps = {
  content: SiteContent;
};

export function PlotLookupPage({ content }: PlotLookupPageProps) {
  const [reference, setReference] = useState("");
  const [postcode, setPostcode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "not-found" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("checking");
    try {
      const site = await lookupTrackingSite(reference, postcode);
      if (!site) {
        setStatus("not-found");
        return;
      }
      window.location.href = `/track/${site.token}`;
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="site-homepage inner-site">
      <Header brandName={content.brandName} brandSuffix={content.brandSuffix} navLinks={content.navLinks} />
      <main>
        <section className="lookup-hero" aria-labelledby="lookup-title">
          <ResponsiveImage image={content.hero.image} className="lookup-hero__image" priority widthHint={1800} sizes="100vw" />
          <div className="hero__overlay" aria-hidden="true" />
          <div className="lookup-hero__content">
            <p className="eyebrow hero__eyebrow"><SiteText>Received a Kingsvale letter?</SiteText></p>
            <h1 id="lookup-title"><SiteText>View the plot map for your reference.</SiteText></h1>
            <p><SiteText>Enter the reference number from your letter and the postcode for the addressed property.</SiteText></p>
          </div>
        </section>

        <section className="lookup-panel" aria-label="Plot lookup form">
          <div className="lookup-panel__intro"><p className="eyebrow"><SiteText>Your property reference</SiteText></p><h2><SiteText>Find your plot.</SiteText></h2><p><SiteText>Your letter contains everything you need. Enter the reference and the postcode printed in its address.</SiteText></p></div>
          <form className="plot-lookup__form" onSubmit={handleSubmit} aria-busy={status === "checking"}>
            <label htmlFor="lookup-reference"><SiteText>Reference number</SiteText><input
                id="lookup-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="e.g. KV0111"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={status === "checking"}
                autoComplete="off"
                minLength={2}
                maxLength={64}
                required
              />
            </label>
            <label htmlFor="lookup-postcode"><SiteText>Postcode</SiteText><input
                id="lookup-postcode"
                value={postcode}
                onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                placeholder="e.g. RG23 7DZ"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={status === "checking"}
                autoComplete="postal-code"
                minLength={5}
                maxLength={10}
                required
              />
            </label>
            <button type="submit" disabled={status === "checking"}>
              {status === "checking" ? "Checking" : "Open map"}
            </button>
            {status === "not-found" && <p className="lookup-message" role="status"><SiteText>No matching plot map was found. Check the reference and use the postcode printed on your letter.</SiteText></p>}
            {status === "error" && <p className="lookup-message" role="alert"><SiteText>We could not check your details just now. Please try again in a moment.</SiteText></p>}
          </form>
          <p className="lookup-panel__help"><SiteText>You can also scan the QR code on your letter to open the plot directly.</SiteText> <a href="/contact"><SiteText>Need a hand? Contact us</SiteText></a></p>
        </section>
      </main>
      <Footer brandName={content.brandName} brandSuffix={content.brandSuffix} footer={content.footer} />
    </div>
  );
}
