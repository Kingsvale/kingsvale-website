import { Clock, Mail, RefreshCw, Save, Search } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  checkMailingTrackingStatus,
  listTrackingSites,
  saveTrackingSite
} from "../lib/cmsApi";
import {
  isRemailReminderOverdue,
  mailingStatusClass,
  priorityClass,
  suggestRemailReminderDate
} from "../lib/trackingStorage";
import {
  contactPriorityLabels,
  mailingStatusLabels,
  type ContactPriority,
  type MailingStatus,
  type TrackingSite
} from "../lib/trackingTypes";
import { trackingFieldLimits, validateTrackingSite } from "../lib/trackingValidation";

const contactPriorities = Object.keys(contactPriorityLabels) as ContactPriority[];
const mailingStatuses = Object.keys(mailingStatusLabels) as MailingStatus[];
const defaultReminderStorageKey = "kingsvale-mailing-default-reminder-days-v1";

type SortMode = "priority" | "reminder" | "updated";

export function AdminMailingPanel() {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ContactPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MailingStatus | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [defaultReminderDays, setDefaultReminderDays] = useState(() => readDefaultReminderDays());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Manage postal contact and re-mailing reminders.");

  useEffect(() => {
    let active = true;

    async function loadSites() {
      const loaded = await listTrackingSites();
      if (active) {
        const ordered = sortMailingSites(loaded, sortMode);
        setSites(ordered);
        setDraft(ordered[0] ?? null);
      }
    }

    void loadSites();
    return () => {
      active = false;
    };
  }, [sortMode]);

  const visibleSites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortMailingSites(
      sites.filter((site) => {
        if (site.archived) {
          return false;
        }
        if (priorityFilter !== "all" && site.contactPriority !== priorityFilter) {
          return false;
        }
        if (statusFilter !== "all" && site.mailingStatus !== statusFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [
          site.reference,
          site.title,
          site.siteAddress,
          site.customerName,
          site.ownerContactName,
          site.royalMailTrackingNumber,
          site.mailingNotes
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
      sortMode
    );
  }, [priorityFilter, query, sites, sortMode, statusFilter]);

  const reminders = useMemo(
    () => visibleSites.filter((site) => isRemailReminderOverdue(site)),
    [visibleSites]
  );

  function updateDraft(recipe: (site: TrackingSite) => void) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = structuredClone(current);
      recipe(next);
      next.mailingLastUpdatedAt = new Date().toISOString();
      return next;
    });
  }

  async function saveDraft() {
    if (!draft) {
      return;
    }

    const validation = validateTrackingSite(draft);
    if (!validation.valid) {
      setStatus("Resolve mailing validation issues before saving.");
      return;
    }

    setBusy(true);
    try {
      const saved = await saveTrackingSite(draft);
      setSites((current) => sortMailingSites(current.map((site) => (site.id === saved.id ? saved : site)), sortMode));
      setDraft(saved);
      setStatus("Mailing details saved.");
    } catch {
      setStatus("Mailing details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function checkTracking() {
    if (!draft) {
      return;
    }

    setBusy(true);
    try {
      const synced = await checkMailingTrackingStatus(draft.id);
      if (!synced) {
        setStatus("Tracking unavailable.");
        return;
      }
      setSites((current) => sortMailingSites(current.map((site) => (site.id === synced.id ? synced : site)), sortMode));
      setDraft(synced);
      setStatus(synced.trackingStatus);
    } catch {
      setStatus("Tracking lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateDefaultReminderDays(value: number) {
    const next = Math.min(120, Math.max(1, Math.trunc(value || 14)));
    setDefaultReminderDays(next);
    window.localStorage.setItem(defaultReminderStorageKey, String(next));
  }

  return (
    <section className="mailing-admin" aria-label="Postal contact workflow">
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <Mail aria-hidden="true" />
          <span>{status}</span>
        </div>
        <label className="mailing-default" htmlFor="default-reminder-days">
          <span>Default re-mail reminder</span>
          <input
            id="default-reminder-days"
            type="number"
            min="1"
            max="120"
            value={defaultReminderDays}
            onChange={(event) => updateDefaultReminderDays(Number(event.target.value))}
          />
          <span>days</span>
        </label>
      </div>

      <div className="mailing-summary">
        <Metric label="Contacts" value={visibleSites.length} />
        <Metric label="High priority" value={visibleSites.filter((site) => site.contactPriority === "high").length} />
        <Metric label="Overdue reminders" value={reminders.length} tone={reminders.length ? "urgent" : "normal"} />
      </div>

      {reminders.length > 0 && (
        <section className="mailing-reminders" aria-labelledby="mailing-reminders-title">
          <div className="admin-section-heading">
            <h2 id="mailing-reminders-title">Needs attention</h2>
          </div>
          <div className="mailing-reminders__list">
            {reminders.slice(0, 4).map((site) => (
              <button key={site.id} type="button" onClick={() => setDraft(structuredClone(site))}>
                <Clock aria-hidden="true" />
                <span>{site.title}</span>
                <strong>{site.remailReminderDate}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mailing-layout">
        <aside className="mailing-list" aria-label="Mailing contacts">
          <div className="sites-admin__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="mailing-search">Search mailing contacts</label>
            <input
              id="mailing-search"
              value={query}
              placeholder="Search mailing contacts"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="mailing-filters">
            <SelectField
              label="Priority"
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value as ContactPriority | "all")}
              options={[["all", "All priorities"], ...contactPriorities.map((item) => [item, contactPriorityLabels[item]] as const)]}
            />
            <SelectField
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as MailingStatus | "all")}
              options={[["all", "All statuses"], ...mailingStatuses.map((item) => [item, mailingStatusLabels[item]] as const)]}
            />
            <SelectField
              label="Sort"
              value={sortMode}
              onChange={(value) => setSortMode(value as SortMode)}
              options={[
                ["priority", "Priority"],
                ["reminder", "Reminder date"],
                ["updated", "Last updated"]
              ]}
            />
          </div>
          <div className="mailing-rows">
            {visibleSites.map((site) => (
              <button
                key={site.id}
                type="button"
                className={draft?.id === site.id ? "mailing-row mailing-row--active" : "mailing-row"}
                onClick={() => setDraft(structuredClone(site))}
              >
                <span>
                  <strong>{site.reference || "No reference"}</strong>
                  {site.title}
                </span>
                <small>{site.siteAddress}</small>
                <span className="site-row__badges">
                  <span className={`priority-badge ${priorityClass(site.contactPriority)}`}>
                    {contactPriorityLabels[site.contactPriority]}
                  </span>
                  <span className={`mailing-status ${mailingStatusClass(site.mailingStatus)}`}>
                    {mailingStatusLabels[site.mailingStatus]}
                  </span>
                </span>
                {isRemailReminderOverdue(site) && <em>Reminder overdue</em>}
              </button>
            ))}
          </div>
        </aside>

        <div className="mailing-detail">
          {!draft ? (
            <div className="admin-panel sites-admin__blank">
              <h2>Mailing</h2>
              <p>Create a site in the Sites tab to manage postal contact.</p>
            </div>
          ) : (
            <section className="admin-panel mailing-editor" aria-labelledby="mailing-editor-title">
              <div className="site-editor__heading">
                <div>
                  <h2 id="mailing-editor-title">{draft.title}</h2>
                  <p>{draft.reference || "No reference"} · {draft.siteAddress}</p>
                </div>
                <span className={`priority-badge ${priorityClass(draft.contactPriority)}`}>
                  {contactPriorityLabels[draft.contactPriority]}
                </span>
              </div>

              <div className="admin-grid admin-grid--two">
                <TextInput
                  label="Owner/contact name"
                  value={draft.ownerContactName}
                  maxLength={trackingFieldLimits.ownerContactName}
                  onChange={(value) => updateDraft((site) => { site.ownerContactName = value; })}
                />
                <SelectField
                  label="Contact priority"
                  value={draft.contactPriority}
                  onChange={(value) => updateDraft((site) => { site.contactPriority = value as ContactPriority; })}
                  options={contactPriorities.map((item) => [item, contactPriorityLabels[item]] as const)}
                />
              </div>

              <div className="admin-grid admin-grid--two">
                <SelectField
                  label="Mailing status"
                  value={draft.mailingStatus}
                  onChange={(value) => updateDraft((site) => { site.mailingStatus = value as MailingStatus; })}
                  options={mailingStatuses.map((item) => [item, mailingStatusLabels[item]] as const)}
                />
                <TextInput
                  label="Royal Mail tracking number"
                  value={draft.royalMailTrackingNumber}
                  maxLength={trackingFieldLimits.royalMailTrackingNumber}
                  onChange={(value) => updateDraft((site) => { site.royalMailTrackingNumber = value; })}
                />
              </div>

              <div className="admin-grid admin-grid--three">
                <DateField
                  label="Date first mailed"
                  value={draft.firstMailedAt}
                  onChange={(value) =>
                    updateDraft((site) => {
                      site.firstMailedAt = value;
                      site.lastMailedAt = site.lastMailedAt || value;
                      site.remailReminderDays = site.remailReminderDays || defaultReminderDays;
                      site.remailReminderDate = suggestRemailReminderDate(value, site.remailReminderDays);
                    })
                  }
                />
                <DateField
                  label="Last mailed"
                  value={draft.lastMailedAt}
                  onChange={(value) => updateDraft((site) => { site.lastMailedAt = value; })}
                />
                <label className="admin-field" htmlFor="reminder-days">
                  <span className="admin-field__label">Reminder days</span>
                  <input
                    id="reminder-days"
                    type="number"
                    min="1"
                    max="120"
                    value={draft.remailReminderDays}
                    onChange={(event) =>
                      updateDraft((site) => {
                        site.remailReminderDays = Number(event.target.value);
                        site.remailReminderDate = suggestRemailReminderDate(site.firstMailedAt, site.remailReminderDays);
                      })
                    }
                  />
                </label>
              </div>

              <DateField
                label="Re-mailing reminder date"
                value={draft.remailReminderDate}
                onChange={(value) => updateDraft((site) => { site.remailReminderDate = value; })}
                overdue={isRemailReminderOverdue(draft)}
              />

              <div className="mailing-tracking-box">
                <div>
                  <span>Postage/tracking status</span>
                  <strong>{draft.trackingStatus || "Tracking unavailable"}</strong>
                  <small>
                    {draft.trackingLastCheckedAt
                      ? `Checked ${new Date(draft.trackingLastCheckedAt).toLocaleString()}`
                      : "Not checked yet"}
                  </small>
                </div>
                <button type="button" className="admin-ghost" onClick={checkTracking} disabled={busy}>
                  <RefreshCw aria-hidden="true" />
                  Check tracking
                </button>
              </div>

              <label className="admin-field" htmlFor="mailing-notes">
                <span className="admin-field__label">
                  Notes
                  <span aria-hidden="true">{draft.mailingNotes.length}/{trackingFieldLimits.mailingNotes}</span>
                </span>
                <textarea
                  id="mailing-notes"
                  value={draft.mailingNotes}
                  rows={5}
                  maxLength={trackingFieldLimits.mailingNotes}
                  onChange={(event) => updateDraft((site) => { site.mailingNotes = event.target.value; })}
                />
              </label>

              <div className="sites-admin__actions">
                <span className="analytics-admin__subtle">
                  Last updated {new Date(draft.mailingLastUpdatedAt || draft.updatedAt).toLocaleString()}
                </span>
                <button type="button" className="admin-save" onClick={saveDraft} disabled={busy}>
                  <Save aria-hidden="true" />
                  {busy ? "Working" : "Save mailing"}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "urgent" }) {
  return (
    <article className={tone === "urgent" ? "analytics-metric analytics-metric--urgent" : "analytics-metric"}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function TextInput({
  label,
  value,
  maxLength,
  onChange
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
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
        value={value}
        maxLength={maxLength}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  overdue = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  overdue?: boolean;
}) {
  const id = toId(label);
  return (
    <label className={overdue ? "admin-field admin-field--overdue" : "admin-field"} htmlFor={id}>
      <span className="admin-field__label">{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      {overdue && <span className="admin-field__error">Reminder overdue</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  const id = toId(label);
  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function sortMailingSites(sites: TrackingSite[], mode: SortMode) {
  const priorityWeight: Record<ContactPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
    unknown: 3,
    "do-not-contact": 4
  };

  return [...sites].sort((left, right) => {
    if (mode === "priority") {
      return priorityWeight[left.contactPriority] - priorityWeight[right.contactPriority]
        || left.title.localeCompare(right.title);
    }
    if (mode === "reminder") {
      return (left.remailReminderDate || "9999-12-31").localeCompare(right.remailReminderDate || "9999-12-31");
    }
    return right.mailingLastUpdatedAt.localeCompare(left.mailingLastUpdatedAt);
  });
}

function readDefaultReminderDays() {
  if (typeof window === "undefined") {
    return 14;
  }
  const parsed = Number(window.localStorage.getItem(defaultReminderStorageKey));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 120 ? Math.trunc(parsed) : 14;
}

function toId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
