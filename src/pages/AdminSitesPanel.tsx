import {
  Archive,
<<<<<<< HEAD
  Copy,
  ExternalLink,
  Folder,
  Link,
  Palette,
  Plus,
=======
  Building2,
  Clock,
  Copy,
  ExternalLink,
  Link,
  Palette,
  Plus,
  RefreshCw,
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  Save,
  Search,
  Trash2
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { TrackingQrCode } from "../components/TrackingQrCode";
import {
  archiveTrackingSite,
<<<<<<< HEAD
=======
  checkTrackingCouncilStatus,
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  listTrackingSites,
  saveTrackingSite
} from "../lib/cmsApi";
import {
  createTrackingResource,
<<<<<<< HEAD
  createTrackingSite,
  detectLocalAuthority,
  normalizeMapEmbedInput,
  normalizeReference
} from "../lib/trackingStorage";
import {
  trackingResourceLabels,
  type TrackingResourceType,
  type TrackingSite,
=======
  createMilestone,
  createTrackingSite,
  trackingStatusClass
} from "../lib/trackingStorage";
import {
  applyTrackingStatusTemplate,
  trackingStatusTemplates
} from "../lib/trackingTemplates";
import {
  trackingMilestoneLabels,
  trackingResourceLabels,
  trackingStatusLabels,
  type TrackingMilestoneState,
  type TrackingResourceType,
  type TrackingSite,
  type TrackingStatus
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
} from "../lib/trackingTypes";
import {
  trackingFieldLimits,
  validateTrackingSite,
  type TrackingValidationError
} from "../lib/trackingValidation";

<<<<<<< HEAD
=======
const trackingStatuses = Object.keys(trackingStatusLabels) as TrackingStatus[];
const milestoneStates = Object.keys(trackingMilestoneLabels) as TrackingMilestoneState[];
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
const resourceTypes = Object.keys(trackingResourceLabels) as TrackingResourceType[];

export function AdminSitesPanel() {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
<<<<<<< HEAD
  const [status, setStatus] = useState("Create QR-ready land interest map pages.");
=======
  const [status, setStatus] = useState("Create customer tracking pages and share their QR-ready links.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d

  useEffect(() => {
    let active = true;

    async function loadSites() {
      const loadedSites = await listTrackingSites();
      if (!active) {
        return;
      }

      const orderedSites = sortSites(loadedSites);
      setSites(orderedSites);
      setDraft(orderedSites.find((site) => !site.archived) ?? orderedSites[0] ?? null);
    }

    void loadSites();
    return () => {
      active = false;
    };
  }, []);

  const visibleSites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sites.filter((site) => {
      if (!showArchived && site.archived) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        site.title,
        site.customerName,
        site.siteAddress,
        site.reference,
<<<<<<< HEAD
        site.localAuthority
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, showArchived, sites]);
  const groupedSites = useMemo(() => groupSitesByAuthority(visibleSites), [visibleSites]);
=======
        trackingStatusLabels[site.currentStatus]
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, showArchived, sites]);
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d

  const validation = useMemo(
    () => (draft ? validateTrackingSite(draft) : { valid: true, errors: [] }),
    [draft]
  );
  const errorsByPath = useMemo(() => toTrackingErrorMap(validation.errors), [validation.errors]);
  const publicLink = draft ? buildPublicLink(draft.token) : "";

  async function handleCreate() {
    setBusy(true);
    try {
      const site = await saveTrackingSite(createTrackingSite());
      setSites((current) => sortSites([site, ...current.filter((item) => item.id !== site.id)]));
      setDraft(site);
<<<<<<< HEAD
      setStatus("Map page created. Add the plot map link, then save.");
    } catch {
      setStatus("Map page could not be created.");
=======
      setStatus("Tracking page created. Edit the details, then save.");
    } catch {
      setStatus("Tracking page could not be created.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    const result = validateTrackingSite(draft);
    if (!result.valid) {
<<<<<<< HEAD
      setStatus("Resolve the map page guardrails before saving.");
      return;
    }

    if (sites.some((site) => site.id !== draft.id && site.reference === draft.reference)) {
      setStatus("Reference already exists. Choose a unique KV reference.");
=======
      setStatus("Resolve the tracking page guardrails before saving.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
      return;
    }

    setBusy(true);
    try {
      const saved = await saveTrackingSite(draft);
      setSites((current) => sortSites([saved, ...current.filter((site) => site.id !== saved.id)]));
      setDraft(saved);
<<<<<<< HEAD
      setStatus("Map page saved.");
    } catch {
      setStatus("Map page could not be saved.");
=======
      setStatus("Tracking page saved.");
    } catch {
      setStatus("Tracking page could not be saved.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!draft) {
      return;
    }

    setBusy(true);
    try {
      const archived = await archiveTrackingSite(draft.id);
      if (!archived) {
<<<<<<< HEAD
        setStatus("Map page could not be archived.");
=======
        setStatus("Tracking page could not be archived.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
        return;
      }

      setSites((current) =>
        sortSites(current.map((site) => (site.id === archived.id ? archived : site)))
      );
      const next = sites.find((site) => site.id !== archived.id && !site.archived) ?? null;
      setDraft(next);
<<<<<<< HEAD
      setStatus("Map page archived. Its public link is now unavailable.");
    } catch {
      setStatus("Map page could not be archived.");
=======
      setStatus("Tracking page archived. Its public link is now unavailable.");
    } catch {
      setStatus("Tracking page could not be archived.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCouncilCheck() {
    if (!draft) {
      return;
    }

    setBusy(true);
    try {
      const synced = await checkTrackingCouncilStatus(draft.id);
      if (!synced) {
        setStatus("Council connector is not available for this tracking page.");
        return;
      }

      setSites((current) => sortSites(current.map((site) => (site.id === synced.id ? synced : site))));
      setDraft(synced);
      setStatus(synced.council.lastSyncStatus);
    } catch {
      setStatus("Council connector check failed.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    } finally {
      setBusy(false);
    }
  }

  async function copyPublicLink() {
    if (!publicLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicLink);
<<<<<<< HEAD
      setStatus("Map page link copied.");
=======
      setStatus("Tracking link copied.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    } catch {
      setStatus("Copy failed. Select the link field and copy it manually.");
    }
  }

<<<<<<< HEAD
=======
  function handleTemplateChange(templateId: string) {
    const template = trackingStatusTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setDraft((current) => current ? applyTrackingStatusTemplate(current, template) : current);
    setStatus(`${template.label} template applied. Review details, then save.`);
  }

>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  function updateDraft(recipe: (site: TrackingSite) => void) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  }

  return (
<<<<<<< HEAD
    <section className="sites-admin" aria-label="Land interest map pages">
=======
    <section className="sites-admin" aria-label="Customer tracking sites">
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <Link aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button type="button" className="admin-save" onClick={handleCreate} disabled={busy}>
          <Plus aria-hidden="true" />
          Create site
        </button>
      </div>

      <div className="sites-admin__layout">
<<<<<<< HEAD
        <aside className="sites-admin__list" aria-label="Map page list">
          <div className="sites-admin__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="tracking-search">
              Search map pages
=======
        <aside className="sites-admin__list" aria-label="Tracking page list">
          <div className="sites-admin__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="tracking-search">
              Search tracking pages
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
            </label>
            <input
              id="tracking-search"
              value={query}
              placeholder="Search sites"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className="sites-admin__toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span>Show archived</span>
          </label>
          <div className="sites-admin__rows">
            {visibleSites.length === 0 ? (
<<<<<<< HEAD
              <div className="sites-admin__empty">No map pages yet.</div>
            ) : (
              groupedSites.flatMap(([authority, authoritySites]) => [
                <div className="site-group-heading" key={`${authority}-heading`}>
                  <Folder aria-hidden="true" />
                  <span>{authority}</span>
                  <span>{authoritySites.length}</span>
                </div>,
                ...authoritySites.map((site) => (
=======
              <div className="sites-admin__empty">No tracking pages yet.</div>
            ) : (
              visibleSites.map((site) => (
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                <button
                  key={site.id}
                  type="button"
                  className={draft?.id === site.id ? "site-row site-row--active" : "site-row"}
                  onClick={() => {
                    setDraft(structuredClone(site));
<<<<<<< HEAD
                    setStatus(site.archived ? "Archived map page selected." : "Map page selected.");
=======
                    setStatus(site.archived ? "Archived tracking page selected." : "Tracking page selected.");
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                  }}
                >
                  <span className="site-row__title">{site.title}</span>
                  <span className="site-row__meta">
                    {site.siteAddress}
                    {site.reference ? ` · ${site.reference}` : ""}
                  </span>
<<<<<<< HEAD
                  {site.mapEmbedUrl && <span className="site-row__meta">Map embed configured</span>}
                </button>
                ))
              ])
=======
                  <span className={`tracking-status ${trackingStatusClass(site.currentStatus)}`}>
                    {trackingStatusLabels[site.currentStatus]}
                  </span>
                </button>
              ))
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
            )}
          </div>
        </aside>

        <div className="sites-admin__detail">
          {!draft ? (
            <div className="admin-panel sites-admin__blank">
              <h2>Sites</h2>
<<<<<<< HEAD
              <p>Create a QR-ready map page for a land interest letter.</p>
=======
              <p>Create a customer tracking page to generate a QR-ready link.</p>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
            </div>
          ) : (
            <>
              {!validation.valid && (
<<<<<<< HEAD
                <div className="admin-errors" role="alert" aria-label="Map page validation issues">
                  <h2>Map page guardrails</h2>
=======
                <div className="admin-errors" role="alert" aria-label="Tracking validation issues">
                  <h2>Tracking guardrails</h2>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                  <ul>
                    {validation.errors.slice(0, 8).map((error) => (
                      <li key={`${error.path}-${error.message}`}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <section className="admin-panel site-editor" aria-labelledby="site-editor-title">
                <div className="site-editor__heading">
                  <div>
                    <h2 id="site-editor-title">{draft.title}</h2>
                    <p>Updated {new Date(draft.updatedAt).toLocaleString()}</p>
                  </div>
<<<<<<< HEAD
=======
                  <span className={`tracking-status ${trackingStatusClass(draft.currentStatus)}`}>
                    {trackingStatusLabels[draft.currentStatus]}
                  </span>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                </div>

                <div className="tracking-link-box">
                  <div>
<<<<<<< HEAD
                    <span>Public map page link</span>
=======
                    <span>Public tracking link</span>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                    <input
                      data-testid="generated-tracking-link"
                      value={publicLink}
                      readOnly
                      onFocus={(event) => event.target.select()}
                    />
                  </div>
                  <button type="button" className="admin-ghost" onClick={copyPublicLink}>
                    <Copy aria-hidden="true" />
                    Copy
                  </button>
                  <a className="admin-open" href={publicLink} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Open
                  </a>
                </div>

<<<<<<< HEAD
                <details className="qr-designer qr-designer--folded">
                  <summary className="admin-section-heading">
                    <h3><Palette aria-hidden="true" /> QR Code Design</h3>
                    <span>Open controls</span>
                  </summary>
                  <div className="qr-designer__controls">
=======
                <div className="qr-designer">
                  <div className="qr-designer__controls">
                    <div className="admin-section-heading">
                      <h3><Palette aria-hidden="true" /> QR design</h3>
                    </div>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                    <div className="admin-grid admin-grid--two">
                      <ColorInput
                        label="Foreground"
                        value={draft.qrStyle.foreground}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.foreground = value; })
                        }
                      />
                      <ColorInput
                        label="Background"
                        value={draft.qrStyle.background}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.background = value; })
                        }
                      />
                      <ColorInput
                        label="Accent"
                        value={draft.qrStyle.accent}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.accent = value; })
                        }
                      />
                      <RangeInput
                        label="Dot roundness"
                        value={draft.qrStyle.dotRoundness}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.dotRoundness = value; })
                        }
                      />
                      <RangeInput
                        label="Finder roundness"
                        value={draft.qrStyle.finderRoundness}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.finderRoundness = value; })
                        }
                      />
                      <RangeInput
                        label="Frame roundness"
                        value={draft.qrStyle.frameRoundness}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.frameRoundness = value; })
                        }
                      />
                      <RangeInput
                        label="Cut corners"
                        value={draft.qrStyle.frameCut}
                        onChange={(value) =>
                          updateDraft((site) => { site.qrStyle.frameCut = value; })
                        }
                      />
                    </div>
                    <TrackingTextInput
                      label="QR label"
                      value={draft.qrStyle.frameLabel}
                      maxLength={trackingFieldLimits.qrFrameLabel}
                      error={errorsByPath["qrStyle.frameLabel"]}
                      onChange={(value) =>
                        updateDraft((site) => { site.qrStyle.frameLabel = value; })
                      }
                    />
                    <label className="sites-admin__toggle">
                      <input
                        type="checkbox"
                        checked={draft.qrStyle.includeLogo}
                        onChange={(event) =>
                          updateDraft((site) => { site.qrStyle.includeLogo = event.target.checked; })
                        }
                      />
                      <span>Include Kingsvale mark</span>
                    </label>
                  </div>
                  <TrackingQrCode value={publicLink} style={draft.qrStyle} title={draft.title} />
<<<<<<< HEAD
                </details>
=======
                </div>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d

                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Site title"
                    value={draft.title}
                    maxLength={trackingFieldLimits.title}
                    error={errorsByPath.title}
                    onChange={(value) => updateDraft((site) => { site.title = value; })}
                  />
                  <TrackingTextInput
                    label="Customer name"
                    value={draft.customerName}
                    maxLength={trackingFieldLimits.customerName}
                    error={errorsByPath.customerName}
                    onChange={(value) => updateDraft((site) => { site.customerName = value; })}
                  />
                </div>
                <TrackingTextInput
                  label="Site address"
                  value={draft.siteAddress}
                  maxLength={trackingFieldLimits.siteAddress}
                  error={errorsByPath.siteAddress}
<<<<<<< HEAD
                  onChange={(value) =>
                    updateDraft((site) => {
                      site.siteAddress = value;
                      if (!site.localAuthority || site.localAuthority === "Uncategorised") {
                        site.localAuthority = detectLocalAuthority(value) || "Uncategorised";
                      }
                    })
                  }
                />
                <TrackingTextInput
                  label="Council or local authority"
                  value={draft.localAuthority}
                  maxLength={trackingFieldLimits.localAuthority}
                  error={errorsByPath.localAuthority}
                  onChange={(value) => updateDraft((site) => { site.localAuthority = value; })}
=======
                  onChange={(value) => updateDraft((site) => { site.siteAddress = value; })}
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                />
                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Reference"
                    value={draft.reference}
                    maxLength={trackingFieldLimits.reference}
                    error={errorsByPath.reference}
<<<<<<< HEAD
                    onChange={(value) => updateDraft((site) => { site.reference = normalizeReference(value); })}
                  />
                  <TrackingTextInput
                    label="Map page note"
                    value={draft.statusNote}
                    maxLength={trackingFieldLimits.statusNote}
                    error={errorsByPath.statusNote}
                    onChange={(value) => updateDraft((site) => { site.statusNote = value; })}
                  />
                </div>
=======
                    onChange={(value) => updateDraft((site) => { site.reference = value; })}
                  />
                  <label className="admin-field" htmlFor="tracking-status">
                    <span className="admin-field__label">Current status</span>
                    <select
                      id="tracking-status"
                      value={draft.currentStatus}
                      onChange={(event) =>
                        updateDraft((site) => { site.currentStatus = event.target.value as TrackingStatus; })
                      }
                    >
                      {trackingStatuses.map((trackingStatus) => (
                        <option key={trackingStatus} value={trackingStatus}>
                          {trackingStatusLabels[trackingStatus]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="admin-field" htmlFor="status-template">
                  <span className="admin-field__label">Apply status template</span>
                  <select
                    id="status-template"
                    value=""
                    onChange={(event) => handleTemplateChange(event.target.value)}
                  >
                    <option value="">Choose a template</option>
                    {trackingStatusTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                <TrackingTextarea
                  label="Summary"
                  value={draft.summary}
                  maxLength={trackingFieldLimits.summary}
                  error={errorsByPath.summary}
                  onChange={(value) => updateDraft((site) => { site.summary = value; })}
                />
                <TrackingTextarea
<<<<<<< HEAD
                  label="Google My Maps embed URL or iframe"
                  value={draft.mapEmbedUrl}
                  maxLength={trackingFieldLimits.mapEmbedUrl}
                  error={errorsByPath.mapEmbedUrl}
                  helper="Paste the Google My Maps embed URL, or paste the full iframe code and Studio will extract the source URL."
                  onChange={(value) =>
                    updateDraft((site) => { site.mapEmbedUrl = normalizeMapEmbedInput(value); })
                  }
                />
                <TrackingTextInput
                  label="Searchland URL"
                  type="url"
                  value={draft.searchlandUrl}
                  maxLength={trackingFieldLimits.searchlandUrl}
                  error={errorsByPath.searchlandUrl}
                  onChange={(value) => updateDraft((site) => { site.searchlandUrl = value; })}
                />
                <TrackingTextarea
                  label="Private notes"
                  value={draft.privateNotes}
                  maxLength={trackingFieldLimits.privateNotes}
                  error={errorsByPath.privateNotes}
                  helper="Internal only. These notes are not shown on the public QR page."
                  onChange={(value) => updateDraft((site) => { site.privateNotes = value; })}
                />
              </section>

=======
                  label="Status note"
                  value={draft.statusNote}
                  maxLength={trackingFieldLimits.statusNote}
                  error={errorsByPath.statusNote}
                  onChange={(value) => updateDraft((site) => { site.statusNote = value; })}
                />
              </section>

              <section className="admin-panel" aria-labelledby="tracking-milestones-title">
                <div className="admin-section-heading">
                  <h2 id="tracking-milestones-title">Milestones</h2>
                  <button
                    type="button"
                    className="admin-small"
                    disabled={draft.milestones.length >= 8}
                    onClick={() =>
                      updateDraft((site) => {
                        site.milestones.push(createMilestone());
                      })
                    }
                  >
                    <Plus aria-hidden="true" />
                    Add
                  </button>
                </div>
                <div className="admin-stack">
                  {draft.milestones.map((milestone, index) => (
                    <article className="admin-subcard milestone-editor" key={milestone.id}>
                      <div className="card-controls">
                        <h3>Milestone {index + 1}</h3>
                        {draft.milestones.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove milestone ${index + 1}`}
                            onClick={() =>
                              updateDraft((site) => {
                                site.milestones.splice(index, 1);
                              })
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="admin-grid admin-grid--two">
                        <TrackingTextInput
                          label={`Milestone ${index + 1} label`}
                          value={milestone.label}
                          maxLength={trackingFieldLimits.milestoneLabel}
                          error={errorsByPath[`milestones.${index}.label`]}
                          onChange={(value) =>
                            updateDraft((site) => { site.milestones[index].label = value; })
                          }
                        />
                        <label className="admin-field" htmlFor={`milestone-state-${index}`}>
                          <span className="admin-field__label">State</span>
                          <select
                            id={`milestone-state-${index}`}
                            value={milestone.state}
                            onChange={(event) =>
                              updateDraft((site) => {
                                site.milestones[index].state = event.target.value as TrackingMilestoneState;
                              })
                            }
                          >
                            {milestoneStates.map((state) => (
                              <option key={state} value={state}>
                                {trackingMilestoneLabels[state]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="admin-grid admin-grid--two">
                        <label className="admin-field" htmlFor={`milestone-date-${index}`}>
                          <span className="admin-field__label">Date</span>
                          <input
                            id={`milestone-date-${index}`}
                            type="date"
                            value={milestone.date ?? ""}
                            onChange={(event) =>
                              updateDraft((site) => { site.milestones[index].date = event.target.value; })
                            }
                          />
                        </label>
                        <TrackingTextInput
                          label={`Milestone ${index + 1} note`}
                          value={milestone.note ?? ""}
                          maxLength={trackingFieldLimits.milestoneNote}
                          error={errorsByPath[`milestones.${index}.note`]}
                          onChange={(value) =>
                            updateDraft((site) => { site.milestones[index].note = value; })
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>

>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
              <section className="admin-panel" aria-labelledby="tracking-resources-title">
                <div className="admin-section-heading">
                  <h2 id="tracking-resources-title">Customer resources</h2>
                  <button
                    type="button"
                    className="admin-small"
                    aria-label="Add resource"
                    disabled={draft.resources.length >= 8}
                    onClick={() =>
                      updateDraft((site) => {
                        site.resources.push(createTrackingResource());
                      })
                    }
                  >
                    <Plus aria-hidden="true" />
                    Add
                  </button>
                </div>
                {draft.resources.length === 0 ? (
                  <p className="admin-panel__note">
<<<<<<< HEAD
                    Add optional supporting images, title documents, drawings or useful links for recipients.
=======
                    Add images, planning documents, drawings, schedules or useful links for customers.
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
                  </p>
                ) : (
                  <div className="admin-stack">
                    {draft.resources.map((resource, index) => (
                      <article className="admin-subcard resource-editor" key={resource.id}>
                        <div className="card-controls">
                          <h3>{trackingResourceLabels[resource.type]} {index + 1}</h3>
                          <button
                            type="button"
                            aria-label={`Remove resource ${index + 1}`}
                            onClick={() =>
                              updateDraft((site) => {
                                site.resources.splice(index, 1);
                              })
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                        <div className="admin-grid admin-grid--two">
                          <label className="admin-field" htmlFor={`resource-type-${index}`}>
                            <span className="admin-field__label">Type</span>
                            <select
                              id={`resource-type-${index}`}
                              value={resource.type}
                              onChange={(event) =>
                                updateDraft((site) => {
                                  site.resources[index].type = event.target.value as TrackingResourceType;
                                })
                              }
                            >
                              {resourceTypes.map((type) => (
                                <option key={type} value={type}>
                                  {trackingResourceLabels[type]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <TrackingTextInput
                            label={`Resource ${index + 1} title`}
                            value={resource.title}
                            maxLength={trackingFieldLimits.resourceTitle}
                            error={errorsByPath[`resources.${index}.title`]}
                            onChange={(value) =>
                              updateDraft((site) => { site.resources[index].title = value; })
                            }
                          />
                        </div>
                        <TrackingTextInput
                          label={`Resource ${index + 1} URL`}
                          type="url"
                          value={resource.url}
                          maxLength={trackingFieldLimits.resourceUrl}
                          error={errorsByPath[`resources.${index}.url`]}
                          onChange={(value) =>
                            updateDraft((site) => { site.resources[index].url = value; })
                          }
                        />
                        <TrackingTextInput
                          label={`Resource ${index + 1} note`}
                          value={resource.note}
                          maxLength={trackingFieldLimits.resourceNote}
                          error={errorsByPath[`resources.${index}.note`]}
                          onChange={(value) =>
                            updateDraft((site) => { site.resources[index].note = value; })
                          }
                        />
                      </article>
                    ))}
                  </div>
                )}
              </section>

<<<<<<< HEAD
=======
              <section className="admin-panel" aria-labelledby="council-shell-title">
                <div className="site-editor__heading">
                  <div>
                    <h2 id="council-shell-title">Council connector</h2>
                    <p>Manual updates stay available while API automation is prepared.</p>
                  </div>
                  <button type="button" className="admin-ghost" onClick={handleCouncilCheck} disabled={busy}>
                    <RefreshCw aria-hidden="true" />
                    Check status
                  </button>
                </div>
                <label className="sites-admin__toggle">
                  <input
                    type="checkbox"
                    checked={draft.council.mode === "configured"}
                    onChange={(event) =>
                      updateDraft((site) => {
                        site.council.mode = event.target.checked ? "configured" : "none";
                      })
                    }
                  />
                  <span>Enable council API connector shell</span>
                </label>
                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Council name"
                    value={draft.council.councilName}
                    maxLength={trackingFieldLimits.councilName}
                    error={errorsByPath["council.councilName"]}
                    onChange={(value) => updateDraft((site) => { site.council.councilName = value; })}
                  />
                  <TrackingTextInput
                    label="Application reference"
                    value={draft.council.applicationReference}
                    maxLength={trackingFieldLimits.applicationReference}
                    error={errorsByPath["council.applicationReference"]}
                    onChange={(value) =>
                      updateDraft((site) => { site.council.applicationReference = value; })
                    }
                  />
                </div>
                <TrackingTextInput
                  label="Council API base URL"
                  value={draft.council.apiBaseUrl ?? ""}
                  maxLength={trackingFieldLimits.apiBaseUrl}
                  error={errorsByPath["council.apiBaseUrl"]}
                  onChange={(value) => updateDraft((site) => { site.council.apiBaseUrl = value; })}
                />
                <div className="council-sync-summary">
                  <Building2 aria-hidden="true" />
                  <span>{draft.council.lastSyncStatus}</span>
                  <Clock aria-hidden="true" />
                  <span>
                    {draft.council.lastCheckedAt
                      ? new Date(draft.council.lastCheckedAt).toLocaleString()
                      : "Never checked"}
                  </span>
                </div>
              </section>

>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
              <div className="sites-admin__actions">
                <button
                  type="button"
                  className="admin-save"
                  onClick={handleSave}
                  disabled={!validation.valid || busy || draft.archived}
                >
                  <Save aria-hidden="true" />
                  {busy ? "Working" : "Save site"}
                </button>
                <button
                  type="button"
                  className="admin-ghost"
                  onClick={handleArchive}
                  disabled={busy || draft.archived}
                >
                  <Archive aria-hidden="true" />
                  Archive
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TrackingTextInput({
  label,
  value,
  maxLength,
  onChange,
  error,
  type = "text"
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "url";
}) {
  const id = toId(label);
  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        <span aria-hidden="true">{value.length}/{maxLength}</span>
      </span>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = toId(label);
  return (
    <label className="admin-field color-field" htmlFor={id}>
      <span className="admin-field__label">{label}</span>
      <span className="color-field__control">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{value}</span>
      </span>
    </label>
  );
}

function RangeInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = toId(label);
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <label className="admin-field range-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        <span aria-hidden="true">{Math.round(safeValue)}%</span>
      </span>
      <input
        id={id}
        aria-label={label}
        type="range"
        min="0"
        max="100"
        step="1"
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TrackingTextarea({
  label,
  value,
  maxLength,
  onChange,
<<<<<<< HEAD
  error,
  helper
=======
  error
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  error?: string;
<<<<<<< HEAD
  helper?: string;
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
}) {
  const id = toId(label);
  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        <span aria-hidden="true">{value.length}/{maxLength}</span>
      </span>
      <textarea
        id={id}
        value={value}
        rows={3}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
<<<<<<< HEAD
      {helper && <span className="admin-field__helper">{helper}</span>}
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

function buildPublicLink(token: string) {
  if (typeof window === "undefined") {
    return `/track/${token}`;
  }

  return `${window.location.origin}/track/${token}`;
}

function sortSites(sites: TrackingSite[]) {
  return [...sites].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

<<<<<<< HEAD
function groupSitesByAuthority(sites: TrackingSite[]) {
  const groups = new Map<string, TrackingSite[]>();
  for (const site of sites) {
    const authority = site.localAuthority?.trim() || "Uncategorised";
    groups.set(authority, [...(groups.get(authority) ?? []), site]);
  }

  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "Uncategorised") {
      return 1;
    }
    if (right === "Uncategorised") {
      return -1;
    }
    return left.localeCompare(right);
  });
}

=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
function toTrackingErrorMap(errors: TrackingValidationError[]) {
  return errors.reduce<Record<string, string>>((map, error) => {
    map[error.path] = error.message;
    return map;
  }, {});
}

function toId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
