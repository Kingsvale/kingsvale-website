import {
  AlertCircle,
  Clock,
  ExternalLink,
  FileText,
  Home,
  Image as ImageIcon,
  MapPin
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "../components/Logo";
import type { SiteContent } from "../lib/contentTypes";
import { fetchTrackingSiteByToken } from "../lib/publicTrackingApi";
import {
  trackingResourceLabels,
  type TrackingResource,
  type TrackingSite
} from "../lib/trackingTypes";

type TrackingPageProps = {
  content: SiteContent;
  token: string;
};

export function TrackingPage({ content, token }: TrackingPageProps) {
  const [site, setSite] = useState<TrackingSite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSite() {
      const trackingSite = await fetchTrackingSiteByToken(token);
      if (active) {
        setSite(trackingSite);
        setLoading(false);
      }
    }

    void loadSite();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="tracking-page tracking-page--loading">
        <div className="route-loading" />
      </main>
    );
  }

  if (!site) {
    return (
      <main className="tracking-page">
        <section className="tracking-empty" aria-labelledby="tracking-missing-title">
          <Logo brandName={content.brandName} brandSuffix={content.brandSuffix} />
          <AlertCircle aria-hidden="true" />
          <h1 id="tracking-missing-title">Map link unavailable.</h1>
          <p>This private plot map link may have expired, been archived, or been typed incorrectly.</p>
          <a className="button-link button-link--dark" href="/">
            Return to Kingsvale
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <Logo brandName={content.brandName} brandSuffix={content.brandSuffix} />
        <a href="/" className="tracking-header__home">Kingsvale Homes</a>
      </header>

      <section className="tracking-hero" aria-labelledby="tracking-title">
        <div>
          <p className="eyebrow">Land interest map</p>
          <h1 id="tracking-title">{site.title}</h1>
          <p>{site.summary}</p>
        </div>
        <dl className="tracking-facts">
          <div>
            <dt><MapPin aria-hidden="true" /> Site</dt>
            <dd>{site.siteAddress}</dd>
          </div>
          {site.customerName && (
            <div>
              <dt><Home aria-hidden="true" /> Recipient</dt>
              <dd>{site.customerName}</dd>
            </div>
          )}
          {site.reference && (
            <div>
              <dt><Clock aria-hidden="true" /> Reference</dt>
              <dd>{site.reference}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="tracking-current tracking-current--map" aria-labelledby="tracking-current-title">
        <div>
          <p className="eyebrow">Plot outline</p>
          <h2 id="tracking-current-title">View the area Kingsvale is interested in.</h2>
          <p>{site.statusNote}</p>
          <a className="tracking-call-link" href={`tel:${content.footer.phone.replace(/[^\d+]/g, "")}`}>
            Call {content.footer.phone}
            {site.reference ? <span>Quote reference {site.reference}</span> : null}
          </a>
        </div>
        <span>Updated {new Date(site.updatedAt).toLocaleString()}</span>
      </section>

      <section className="tracking-map-section">
        <div className="section-heading">
          <p className="eyebrow">Interactive map</p>
        </div>
        {site.mapEmbedUrl ? (
          <iframe
            className="tracking-map"
            src={site.mapEmbedUrl}
            title={`${site.title} map`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="tracking-map tracking-map--empty">
            <MapPin aria-hidden="true" />
            <h3>Map coming soon.</h3>
            <p>Kingsvale has not added the plot outline map to this page yet.</p>
          </div>
        )}
      </section>

      {site.resources.length > 0 && (
        <section className="tracking-resources" aria-labelledby="tracking-resources-title">
          <div className="section-heading">
            <p className="eyebrow">Shared resources</p>
            <h2 id="tracking-resources-title">Supporting information</h2>
          </div>
          <div className="tracking-resources__grid">
            {site.resources.map((resource) => (
              <TrackingResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function TrackingResourceCard({ resource }: { resource: TrackingResource }) {
  const isImage = resource.type === "image";

  return (
    <article className={isImage ? "tracking-resource tracking-resource--image" : "tracking-resource"}>
      {isImage ? (
        <a className="tracking-resource__media" href={resource.url} target="_blank" rel="noreferrer">
          <img src={resource.url} alt={resource.title} loading="lazy" decoding="async" />
        </a>
      ) : (
        <div className="tracking-resource__icon">
          {resource.type === "document" ? <FileText aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
        </div>
      )}
      <div className="tracking-resource__body">
        <span>
          {isImage ? <ImageIcon aria-hidden="true" /> : null}
          {trackingResourceLabels[resource.type]}
        </span>
        <h3>{resource.title}</h3>
        {resource.note && <p>{resource.note}</p>}
        <a href={resource.url} target="_blank" rel="noreferrer">
          Open resource
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
