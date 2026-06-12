import {
  AlertCircle,
<<<<<<< HEAD
=======
  Building2,
  CheckCircle2,
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
import {
  trackingResourceLabels,
=======
import { trackingStatusClass } from "../lib/trackingStorage";
import {
  trackingMilestoneLabels,
  trackingResourceLabels,
  trackingStatusLabels,
  type TrackingMilestoneState,
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
          <h1 id="tracking-missing-title">Map link unavailable.</h1>
          <p>This private plot map link may have expired, been archived, or been typed incorrectly.</p>
=======
          <h1 id="tracking-missing-title">Tracking link unavailable.</h1>
          <p>This private project link may have expired, been archived, or been typed incorrectly.</p>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
        <a href="/" className="tracking-header__home">Kingsvale Homes</a>
=======
        <span className={`tracking-status ${trackingStatusClass(site.currentStatus)}`}>
          {trackingStatusLabels[site.currentStatus]}
        </span>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
      </header>

      <section className="tracking-hero" aria-labelledby="tracking-title">
        <div>
<<<<<<< HEAD
          <p className="eyebrow">Land interest map</p>
=======
          <p className="eyebrow">Customer project tracker</p>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
              <dt><Home aria-hidden="true" /> Recipient</dt>
=======
              <dt><Home aria-hidden="true" /> Customer</dt>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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

<<<<<<< HEAD
      <section className="tracking-current tracking-current--map" aria-labelledby="tracking-current-title">
        <div>
          <p className="eyebrow">Plot outline</p>
          <h2 id="tracking-current-title">View the area Kingsvale is interested in.</h2>
          <p>{site.statusNote}</p>
          <a className="tracking-call-link" href={`tel:${content.footer.phone.replace(/[^\d+]/g, "")}`}>
            Call {content.footer.phone}
            {site.reference ? <span>Quote reference {site.reference}</span> : null}
          </a>
=======
      <section className="tracking-current" aria-labelledby="tracking-current-title">
        <div>
          <p className="eyebrow">Current update</p>
          <h2 id="tracking-current-title">{trackingStatusLabels[site.currentStatus]}</h2>
          <p>{site.statusNote}</p>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
        </div>
        <span>Updated {new Date(site.updatedAt).toLocaleString()}</span>
      </section>

<<<<<<< HEAD
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
=======
      <section className="tracking-grid" aria-label="Project progress">
        <div className="tracking-panel">
          <h2>Milestones</h2>
          <ol className="tracking-timeline">
            {site.milestones.map((milestone) => (
              <li key={milestone.id} className={`tracking-timeline__item tracking-timeline__item--${milestone.state}`}>
                <span>{milestoneIcon(milestone.state)}</span>
                <div>
                  <strong>{milestone.label}</strong>
                  <small>
                    {trackingMilestoneLabels[milestone.state]}
                    {milestone.date ? ` · ${new Date(milestone.date).toLocaleDateString()}` : ""}
                  </small>
                  {milestone.note && <p>{milestone.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="tracking-panel tracking-council">
          <Building2 aria-hidden="true" />
          <h2>Council application</h2>
          <p>
            {site.council.mode === "configured"
              ? `${site.council.councilName || "Council"} reference ${site.council.applicationReference || "pending"}.`
              : "Manual Kingsvale updates are active for this project."}
          </p>
          <dl>
            <div>
              <dt>Sync status</dt>
              <dd>{site.council.lastSyncStatus}</dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>
                {site.council.lastCheckedAt
                  ? new Date(site.council.lastCheckedAt).toLocaleString()
                  : "Not yet checked"}
              </dd>
            </div>
          </dl>
        </aside>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
      </section>

      {site.resources.length > 0 && (
        <section className="tracking-resources" aria-labelledby="tracking-resources-title">
          <div className="section-heading">
            <p className="eyebrow">Shared resources</p>
<<<<<<< HEAD
            <h2 id="tracking-resources-title">Supporting information</h2>
=======
            <h2 id="tracking-resources-title">Images and documents</h2>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
=======

function milestoneIcon(state: TrackingMilestoneState) {
  if (state === "complete") {
    return <CheckCircle2 aria-hidden="true" />;
  }

  if (state === "blocked") {
    return <AlertCircle aria-hidden="true" />;
  }

  return <Clock aria-hidden="true" />;
}
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
