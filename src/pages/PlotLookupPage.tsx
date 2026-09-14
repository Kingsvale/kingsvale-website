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
          <form className="plot-lookup__form" onSubmit={handleSubmit}>
            <label><SiteText>Reference number</SiteText><input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                autoComplete="off"
                minLength={2}
                maxLength={64}
                required
              />
            </label>
            <label><SiteText>Postcode</SiteText><input
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
                autoComplete="postal-code"
                minLength={5}
                maxLength={10}
                required
              />
            </label>
            <button type="submit" disabled={status === "checking"}>
              {status === "checking" ? "Checking" : "Open map"}
            </button>
            {status === "not-found" && <p role="status"><SiteText>No matching plot map was found for those details.</SiteText></p>}
            {status === "error" && <p role="status"><SiteText>Lookup is unavailable. Please contact Kingsvale directly.</SiteText></p>}
          </form>
        </section>
      </main>
      <Footer brandName={content.brandName} brandSuffix={content.brandSuffix} footer={content.footer} />
    </div>
  );
}
