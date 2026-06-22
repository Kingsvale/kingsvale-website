import { Clock, ExternalLink, FileText, Mail, RefreshCw, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AdminDateField as DateField,
  AdminSelectField as SelectField,
  AdminTextInput as TextInput,
  AdminTextarea as Textarea
} from "../components/AdminFields";
import {
  checkMailingTrackingStatus,
  fetchStudioSettings,
  generateLetterFromTemplate,
  listTrackingSites,
  saveTrackingSite,
  uploadLetterFile
} from "../lib/cmsApi";
import { defaultStudioSettings, type StudioSettings } from "../lib/studioSettings";
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
const letterTokens = [
  "{{legal_name}}",
  "{{address}}",
  "{{address_line_1}}",
  "{{address_line_2}}",
  "{{site_address}}",
  "{{plot_description}}",
  "{{title_number}}",
  "{{reference}}",
  "{{date}}",
  "{{town}}",
  "{{county}}",
  "{{postal_code}}",
  "{{tracking_link}}"
];
const starterLetterTemplates = [
  ["/templates/kingsvale-initial-letter-template.docx", "Initial letter template"],
  ["/templates/kingsvale-follow-up-letter-template.docx", "Follow-up letter template"]
] as const;

type SortMode = "priority" | "reminder" | "updated";

export function AdminMailingPanel({ selectedSiteId = "" }: { selectedSiteId?: string }) {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ContactPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MailingStatus | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [defaultReminderDays, setDefaultReminderDays] = useState(() => readDefaultReminderDays());
  const [settings, setSettings] = useState<StudioSettings>(() => defaultStudioSettings());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Manage postal contact and re-mailing reminders.");

  useEffect(() => {
    let active = true;

    async function loadSites() {
      const loaded = await listTrackingSites();
      if (active) {
        const ordered = sortMailingSites(loaded, sortMode);
        setSites(ordered);
        setDraft(ordered.find((site) => !site.archived) ?? ordered[0] ?? null);
      }
    }

    void loadSites();
    return () => {
      active = false;
    };
  }, [sortMode]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchStudioSettings();
        if (!active) {
          return;
        }
        setSettings(loaded);
        setDefaultReminderDays(loaded.defaultReminderDays);
      } catch {
        if (active) {
          setStatus("Mailing settings could not be loaded.");
        }
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

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
          site.royalMailTrackingNumber,
          site.mailingNotes
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
      sortMode
    );
  }, [priorityFilter, query, sites, sortMode, statusFilter]);

  useEffect(() => {
    if (!selectedSiteId) {
      return;
    }
    const selected = sites.find((site) => site.id === selectedSiteId);
    if (selected) {
      setDraft(structuredClone(selected));
      setStatus("Mailing details opened from Sites.");
    }
  }, [selectedSiteId, sites]);

  const reminders = useMemo(
    () => visibleSites.filter((site) => isRemailReminderOverdue(site)),
    [visibleSites]
  );
  const selectedPreset = useMemo(() => {
    if (!draft) {
      return null;
    }
    return settings.letterPresets.find((preset) => preset.id === draft.letterPresetId) ?? null;
  }, [draft, settings.letterPresets]);
  const publicLink = draft ? buildPublicLink(draft.token) : "";

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

  async function handleLetterUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (!isAllowedLetterFile(file)) {
      setStatus("Letter upload must be a PDF, image or Word document under 8MB.");
      return;
    }

    setBusy(true);
    try {
      const upload = await uploadLetterFile(file);
      if (!upload) {
        setStatus("Letter could not be uploaded to the server.");
        return;
      }

      updateDraft((site) => {
        site.letterFileName = upload.name;
        site.letterFileUrl = upload.url;
      });
      setStatus("Letter uploaded to server. Save mailing to keep it.");
    } finally {
      setBusy(false);
    }
  }

  function clearLetterUpload() {
    updateDraft((site) => {
      site.letterFileName = "";
      site.letterFileUrl = "";
    });
    setStatus("Letter removed. Save mailing to keep this change.");
  }

  async function generateLetter() {
    if (!draft) {
      return;
    }

    const templateUrl = selectedPreset?.templateUrl || draft.letterTemplateUrl;
    if (!templateUrl) {
      setStatus("Upload a letter preset in Settings before generating.");
      return;
    }

    const generationDraft: TrackingSite = {
      ...draft,
      letterPresetId: selectedPreset?.id ?? draft.letterPresetId,
      letterRecipientMode: selectedPreset?.recipientMode ?? draft.letterRecipientMode,
      letterTemplateName: selectedPreset?.templateName ?? draft.letterTemplateName,
      letterTemplateUrl: templateUrl
    };

    const validation = validateTrackingSite(generationDraft);
    if (!validation.valid) {
      setStatus("Resolve mailing validation issues before generating a letter.");
      return;
    }

    setBusy(true);
    try {
      const generated = await generateLetterFromTemplate(generationDraft, publicLink, templateUrl);
      if (!generated) {
        setStatus("Letter could not be generated. Check the preset is a server-uploaded DOCX.");
        return;
      }

      const saved = await saveTrackingSite({
        ...generationDraft,
        letterFileName: generated.name,
        letterFileUrl: generated.url
      });
      setSites((current) => sortMailingSites(current.map((site) => (site.id === saved.id ? saved : site)), sortMode));
      setDraft(saved);
      setStatus("Letter generated from the selected preset.");
    } catch {
      setStatus("Letter could not be generated.");
    } finally {
      setBusy(false);
    }
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
              id="priority"
              label="Priority"
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value as ContactPriority | "all")}
              options={[["all", "All priorities"], ...contactPriorities.map((item) => [item, contactPriorityLabels[item]] as const)]}
            />
            <SelectField
              id="status"
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as MailingStatus | "all")}
              options={[["all", "All statuses"], ...mailingStatuses.map((item) => [item, mailingStatusLabels[item]] as const)]}
            />
            <SelectField
              id="sort"
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

              <SelectField
                id="contact-priority"
                label="Contact priority"
                value={draft.contactPriority}
                onChange={(value) => updateDraft((site) => { site.contactPriority = value as ContactPriority; })}
                options={contactPriorities.map((item) => [item, contactPriorityLabels[item]] as const)}
              />

              <div className="admin-grid admin-grid--two">
                <SelectField
                  id="mailing-status"
                  label="Mailing status"
                  value={draft.mailingStatus}
                  onChange={(value) => updateDraft((site) => { site.mailingStatus = value as MailingStatus; })}
                  options={mailingStatuses.map((item) => [item, mailingStatusLabels[item]] as const)}
                />
                <TextInput
                  id="royal-mail-tracking-number"
                  label="Royal Mail tracking number"
                  value={draft.royalMailTrackingNumber}
                  maxLength={trackingFieldLimits.royalMailTrackingNumber}
                  onChange={(value) => updateDraft((site) => { site.royalMailTrackingNumber = value; })}
                />
              </div>

              <div className="admin-grid admin-grid--three">
                <DateField
                  id="date-first-mailed"
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
                  id="last-mailed"
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
                id="re-mailing-reminder-date"
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

              <div className="letter-template">
                <div className="letter-template__intro">
                  <div>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>Letter generation</strong>
                      <small>
                        Presets are uploaded in Settings and use the site details already saved in Sites.
                      </small>
                    </span>
                  </div>
                  <div className="letter-template__tokens" aria-label="Supported letter placeholders">
                    {letterTokens.map((token) => (
                      <code key={token}>{token}</code>
                    ))}
                  </div>
                  <div className="letter-template__links" aria-label="Starter letter templates">
                    {starterLetterTemplates.map(([href, label]) => (
                      <a key={href} href={href} download>
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin-grid admin-grid--two">
                <SelectField
                  id="letter-preset"
                  label="Letter preset"
                  value={selectedPreset?.id ?? ""}
                  onChange={(value) =>
                    updateDraft((site) => {
                      const preset = settings.letterPresets.find((item) => item.id === value);
                      site.letterPresetId = preset?.id ?? "";
                      site.letterRecipientMode = preset?.recipientMode ?? site.letterRecipientMode;
                      site.letterTemplateName = preset?.templateName ?? "";
                      site.letterTemplateUrl = preset?.templateUrl ?? "";
                    })
                  }
                  options={[
                    ["", "No preset selected"],
                    ...settings.letterPresets.map((preset) => [preset.id, preset.name] as const)
                  ]}
                />
                <div className="mailing-site-details">
                  <span>{draft.reference || "No reference"}</span>
                  <strong>{draft.siteAddress}</strong>
                  <small>
                    {draft.titleNumber ? `Title ${draft.titleNumber}` : "No title number saved"}
                    {draft.plotDescription ? ` - ${draft.plotDescription}` : ""}
                  </small>
                </div>
              </div>

              <div className="letter-generator-actions">
                <button
                  type="button"
                  className="admin-save"
                  onClick={generateLetter}
                  disabled={busy || !selectedPreset || !validateTrackingSite(draft).valid}
                >
                  <FileText aria-hidden="true" />
                  {busy ? "Generating" : "Generate letter"}
                </button>
                <small>
                  Creates a DOCX, fills the legal/address placeholders, and inserts this site&apos;s tracked QR code.
                </small>
              </div>

              <div className="letter-upload">
                <div>
                  <FileText aria-hidden="true" />
                  <span>
                    <strong>{draft.letterFileName || "No letter uploaded"}</strong>
                    <small>Generated or manually attached letter. Not visible on the public map page.</small>
                  </span>
                </div>
                <div className="letter-upload__actions">
                  {draft.letterFileUrl && (
                    <a href={draft.letterFileUrl} download={draft.letterFileName || "letter"} className="admin-open">
                      <ExternalLink aria-hidden="true" />
                      Open
                    </a>
                  )}
                  <label className="admin-small">
                    Upload letter
                    <input
                      className="sr-only"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => void handleLetterUpload(event.target.files)}
                    />
                  </label>
                  {draft.letterFileUrl && (
                    <button type="button" className="admin-ghost" onClick={clearLetterUpload}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <Textarea
                id="mailing-notes"
                label="Notes"
                value={draft.mailingNotes}
                rows={5}
                maxLength={trackingFieldLimits.mailingNotes}
                onChange={(value) => updateDraft((site) => { site.mailingNotes = value; })}
              />

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

function buildPublicLink(token: string) {
  if (typeof window === "undefined") {
    return `/track/${token}`;
  }

  return `${window.location.origin}/track/${token}`;
}

function isAllowedLetterFile(file: File) {
  const allowedTypes = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);
  return file.size <= 8_000_000 && (allowedTypes.has(file.type) || /\.(pdf|png|jpe?g|webp|docx?)$/i.test(file.name));
}
