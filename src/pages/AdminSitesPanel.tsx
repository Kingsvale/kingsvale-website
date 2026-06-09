import {
  Archive,
  Building2,
  Clock,
  Copy,
  ExternalLink,
  Link,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  archiveTrackingSite,
  checkTrackingCouncilStatus,
  listTrackingSites,
  saveTrackingSite
} from "../lib/cmsApi";
import {
  createMilestone,
  createTrackingSite,
  trackingStatusClass
} from "../lib/trackingStorage";
import {
  trackingMilestoneLabels,
  trackingStatusLabels,
  type TrackingMilestoneState,
  type TrackingSite,
  type TrackingStatus
} from "../lib/trackingTypes";
import {
  trackingFieldLimits,
  validateTrackingSite,
  type TrackingValidationError
} from "../lib/trackingValidation";

const trackingStatuses = Object.keys(trackingStatusLabels) as TrackingStatus[];
const milestoneStates = Object.keys(trackingMilestoneLabels) as TrackingMilestoneState[];

export function AdminSitesPanel() {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Create customer tracking pages and share their QR-ready links.");

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
        trackingStatusLabels[site.currentStatus]
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, showArchived, sites]);

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
      setStatus("Tracking page created. Edit the details, then save.");
    } catch {
      setStatus("Tracking page could not be created.");
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
      setStatus("Resolve the tracking page guardrails before saving.");
      return;
    }

    setBusy(true);
    try {
      const saved = await saveTrackingSite(draft);
      setSites((current) => sortSites([saved, ...current.filter((site) => site.id !== saved.id)]));
      setDraft(saved);
      setStatus("Tracking page saved.");
    } catch {
      setStatus("Tracking page could not be saved.");
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
        setStatus("Tracking page could not be archived.");
        return;
      }

      setSites((current) =>
        sortSites(current.map((site) => (site.id === archived.id ? archived : site)))
      );
      const next = sites.find((site) => site.id !== archived.id && !site.archived) ?? null;
      setDraft(next);
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
      setStatus("Tracking link copied.");
    } catch {
      setStatus("Copy failed. Select the link field and copy it manually.");
    }
  }

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
    <section className="sites-admin" aria-label="Customer tracking sites">
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
        <aside className="sites-admin__list" aria-label="Tracking page list">
          <div className="sites-admin__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="tracking-search">
              Search tracking pages
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
              <div className="sites-admin__empty">No tracking pages yet.</div>
            ) : (
              visibleSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  className={draft?.id === site.id ? "site-row site-row--active" : "site-row"}
                  onClick={() => {
                    setDraft(structuredClone(site));
                    setStatus(site.archived ? "Archived tracking page selected." : "Tracking page selected.");
                  }}
                >
                  <span className="site-row__title">{site.title}</span>
                  <span className="site-row__meta">
                    {site.siteAddress}
                    {site.reference ? ` · ${site.reference}` : ""}
                  </span>
                  <span className={`tracking-status ${trackingStatusClass(site.currentStatus)}`}>
                    {trackingStatusLabels[site.currentStatus]}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="sites-admin__detail">
          {!draft ? (
            <div className="admin-panel sites-admin__blank">
              <h2>Sites</h2>
              <p>Create a customer tracking page to generate a QR-ready link.</p>
            </div>
          ) : (
            <>
              {!validation.valid && (
                <div className="admin-errors" role="alert" aria-label="Tracking validation issues">
                  <h2>Tracking guardrails</h2>
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
                  <span className={`tracking-status ${trackingStatusClass(draft.currentStatus)}`}>
                    {trackingStatusLabels[draft.currentStatus]}
                  </span>
                </div>

                <div className="tracking-link-box">
                  <div>
                    <span>Public tracking link</span>
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
                  onChange={(value) => updateDraft((site) => { site.siteAddress = value; })}
                />
                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Reference"
                    value={draft.reference}
                    maxLength={trackingFieldLimits.reference}
                    error={errorsByPath.reference}
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
                <TrackingTextarea
                  label="Summary"
                  value={draft.summary}
                  maxLength={trackingFieldLimits.summary}
                  error={errorsByPath.summary}
                  onChange={(value) => updateDraft((site) => { site.summary = value; })}
                />
                <TrackingTextarea
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

function TrackingTextarea({
  label,
  value,
  maxLength,
  onChange,
  error
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  error?: string;
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

function toTrackingErrorMap(errors: TrackingValidationError[]) {
  return errors.reduce<Record<string, string>>((map, error) => {
    map[error.path] = error.message;
    return map;
  }, {});
}

function toId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
