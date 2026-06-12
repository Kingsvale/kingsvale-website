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
            <p className="eyebrow hero__eyebrow">Received a Kingsvale letter?</p>
            <h1 id="lookup-title">View the plot map for your reference.</h1>
            <p>Enter the reference number from your letter and the postcode for the addressed property.</p>
          </div>
        </section>

        <section className="lookup-panel" aria-label="Plot lookup form">
          <form className="plot-lookup__form" onSubmit={handleSubmit}>
            <label>
              Reference number
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                autoComplete="off"
                minLength={2}
                maxLength={64}
                required
              />
            </label>
            <label>
              Postcode
              <input
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
            {status === "not-found" && <p role="status">No matching plot map was found for those details.</p>}
            {status === "error" && <p role="status">Lookup is unavailable. Please contact Kingsvale directly.</p>}
          </form>
        </section>
      </main>
      <Footer brandName={content.brandName} brandSuffix={content.brandSuffix} footer={content.footer} />
    </div>
  );
}
