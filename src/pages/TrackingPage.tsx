import { useEffect, useState, type SVGProps } from "react";
import { Logo } from "../components/Logo";
import type { SiteContent } from "../lib/contentTypes";
import { fetchTrackingSiteByToken } from "../lib/publicTrackingApi";
import type { TrackingResource, TrackingResourceType, TrackingSite } from "../lib/trackingTypes";

const trackingResourceLabels: Record<TrackingResourceType, string> = {
  image: "Image",
  document: "Document",
  link: "Link"
};

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
          <AlertCircleIcon aria-hidden="true" />
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
            <dt><MapPinIcon aria-hidden="true" /> Site</dt>
            <dd>{site.siteAddress}</dd>
          </div>
          {site.customerName && (
            <div>
              <dt><HomeIcon aria-hidden="true" /> Recipient</dt>
              <dd>{site.customerName}</dd>
            </div>
          )}
          {site.reference && (
            <div>
              <dt><ClockIcon aria-hidden="true" /> Reference</dt>
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
            <MapPinIcon aria-hidden="true" />
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
          {resource.type === "document" ? <FileTextIcon aria-hidden="true" /> : <ExternalLinkIcon aria-hidden="true" />}
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
          <ExternalLinkIcon aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function TrackingIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

function AlertCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </TrackingIcon>
  );
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </TrackingIcon>
  );
}

function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </TrackingIcon>
  );
}

function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </TrackingIcon>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </TrackingIcon>
  );
}

function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    </TrackingIcon>
  );
}

function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <TrackingIcon {...props}>
      <path d="M20 10c0 5-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 15 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </TrackingIcon>
  );
}
