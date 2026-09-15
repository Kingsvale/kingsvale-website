import { Clock, ExternalLink, FileText, Mail, Save, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { siteFingerprint, useSiteAutosave } from "../hooks/useSiteAutosave";
import { AdminSiteFolders, SiteFolderField } from "./AdminSiteFolders";
import { useSiteFolders } from "../hooks/useSiteFolders";
import { lastWorkflowSite } from "../lib/workflowNavigation";
import { starterLetterTemplates } from "../lib/letterTemplates.js";
import { letterPresetStage } from "../lib/studioSettings";
import {
  AdminDateField as DateField,
  AdminTextInput as TextInput,
  AdminSelectField as SelectField,
  AdminTextarea as Textarea
} from "../components/AdminFields";
import {
  fetchStudioSettings,
  createSavedLetterPdf,
  generateLetterFromTemplate,
  listTrackingSites,
  saveTrackingSite,
  uploadLetterFile
} from "../lib/cmsApi";
import { defaultStudioSettings, type StudioSettings } from "../lib/studioSettings";
import { AdminDocumentPreview } from "./AdminDocumentPreview";
import { buildAddressFromParts } from "../lib/trackingNormalize";
import {
  isRemailReminderOverdue,
  priorityClass,
  suggestRemailReminderDate
} from "../lib/trackingStorage";
import {
  contactPriorityLabels,
  mailingStatusLabels,
  letterRecipientModeLabels,
  type LetterRecipientMode,
  type ContactPriority,
  type MailingStatus,
  type TrackingSite
} from "../lib/trackingTypes";
import { trackingFieldLimits, validateTrackingSite } from "../lib/trackingValidation";

const contactPriorities = Object.keys(contactPriorityLabels) as ContactPriority[];
const mailingStatuses = Object.keys(mailingStatusLabels) as MailingStatus[];
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
  "{{council}}",
  "{{postal_code}}",
  "{{tracking_link}}"
];

type SortMode = "priority" | "reminder" | "updated";

export function AdminMailingPanel({ selectedSiteId = "" }: { selectedSiteId?: string }) {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ContactPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MailingStatus | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [defaultReminderDays, setDefaultReminderDays] = useState(14);
  const [settings, setSettings] = useState<StudioSettings>(() => defaultStudioSettings());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const openedSiteId = useRef("");
  const [status, setStatus] = useState("Manage postal contact and re-mailing reminders.");

  useEffect(() => {
    let active = true;

    async function loadSites() {
      try {
      const loaded = await listTrackingSites();
      if (active) {
        const ordered = sortMailingSites(loaded, "priority");
        setSites(ordered);
        setDraft(ordered.find((site) => site.id === (selectedSiteId || lastWorkflowSite())) ?? ordered.find((site) => !site.archived) ?? ordered[0] ?? null);
      }
      } catch { if (active) setStatus("Contacts could not be loaded. Refresh to try again."); }
    }

    void loadSites();
    return () => {
      active = false;
    };
  }, []);

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
          site.mailingNotes
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
      sortMode
    );
  }, [priorityFilter, query, sites, sortMode, statusFilter]);

  useEffect(() => {
    if (!selectedSiteId || openedSiteId.current === selectedSiteId) {
      return;
    }
    const selected = sites.find((site) => site.id === selectedSiteId);
    if (selected) {
      openedSiteId.current = selectedSiteId;
      setDraft(structuredClone(selected));
      setStatus("Mailing details opened from Sites.");
    }
  }, [selectedSiteId, sites]);

  const reminders = useMemo(
    () => visibleSites.filter((site) => isRemailReminderOverdue(site)),
    [visibleSites]
  );
  const [stageChoice, setStageChoice] = useState<{ id: string; stage: "initial" | "follow-up" } | null>(null);
  const initialDone = Boolean(draft?.initialLetterGeneratedAt || draft?.letterFileUrl || draft?.firstMailedAt);
  const letterStage = stageChoice && stageChoice.id === draft?.id ? stageChoice.stage : initialDone ? "follow-up" : "initial";
  const availablePresets = settings.letterPresets.filter((preset) => letterPresetStage(preset) === letterStage);
  const selectedPreset = availablePresets.find((preset) => preset.id === draft?.letterPresetId) ?? null;
  const publicLink = draft ? buildPublicLink(draft.token) : "";
  const validation = draft ? validateTrackingSite(draft) : { valid: true, errors: [] };
  const autosave = useSiteAutosave({
    draft, saved: sites.find((site) => site.id === draft?.id), valid: validation.valid, blocked: busy,
    onSaved: (saved, snapshot) => {
      setSites((current) => sortMailingSites(current.map((site) => site.id === saved.id ? saved : site), sortMode));
      setDraft((current) => current?.id !== saved.id ? current : siteFingerprint(current) === siteFingerprint(snapshot) ? saved : { ...current, updatedAt: saved.updatedAt });
    }
  });
  const dirty = autosave.dirty;
  const moveSites = useSiteFolders({ flush: autosave.flush, setBusy, setSites, setDraft, setStatus });
  const templateUrl = selectedPreset?.templateUrl || "";

  async function selectSite(site: TrackingSite) {
    if (busy || !await autosave.flush()) return;
    if (site.id !== draft?.id) { setStageChoice(null); setDraft(structuredClone(site)); }
  }

  function markMailedToday() {
    const today = new Date().toLocaleDateString("en-CA");
    updateDraft((site) => {
      site.firstMailedAt ||= today;
      site.lastMailedAt = today;
      site.mailingStatus = "mailed";
      site.remailReminderDate = suggestRemailReminderDate(today, site.remailReminderDays || defaultReminderDays);
    });
    setStatus("Marked as posted today. Dates and follow-up reminder will save automatically.");
  }

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
      setStatus(validation.errors.map((error) => error.message).join(" "));
      return;
    }

    return autosave.flush();
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
        site.letterDocuments = site.letterDocuments?.filter((document) => document.kind !== "letter-pdf");
      });
      setStatus("Letter uploaded. Changes will save automatically.");
    } finally {
      setBusy(false);
    }
  }

  function clearLetterUpload() {
    updateDraft((site) => {
      site.letterFileName = "";
      site.letterFileUrl = "";
      site.letterDocuments = site.letterDocuments?.filter((document) => document.kind !== "letter-pdf");
    });
    setStatus("Letter removed. Changes will save automatically.");
  }

  async function generateLetter() {
    if (!draft) {
      return;
    }

    const templateUrl = selectedPreset?.templateUrl;
    if (letterStage === "follow-up" && !initialDone) return;
    if (!templateUrl) {
      setStatus("Choose a letter template or upload one in Settings before generating.");
      return;
    }

    const generationDraft: TrackingSite = {
      ...draft,
      letterPresetId: selectedPreset?.id ?? draft.letterPresetId,
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
      if (!await autosave.flush()) return;
      const generated = await generateLetterFromTemplate(generationDraft, publicLink, templateUrl, letterStage);
      if (!generated) {
        setStatus("The letter and print files could not be prepared. Please try again.");
        return;
      }

      const saved = await saveTrackingSite({
        ...generationDraft,
        initialLetterGeneratedAt: generationDraft.initialLetterGeneratedAt || (letterStage === "initial" ? new Date().toISOString() : undefined),
        letterFileName: generated.name,
        letterFileUrl: generated.url,
        letterDocuments: [
          ...(letterStage === "follow-up" ? generationDraft.letterDocuments?.filter((document) => document.kind !== "letter-pdf") ?? [] : []),
          ...generated.documents ?? []
        ]
      });
      setSites((current) => sortMailingSites(current.map((site) => (site.id === saved.id ? saved : site)), sortMode));
      setDraft(saved);
      setStageChoice({ id: saved.id, stage: letterStage });
      setPreview(generated.documents?.find((document) => document.kind === "letter-pdf") ?? generated);
      setStatus(letterStage === "initial" ? "Letter and envelope saved in Word and PDF formats. Review and print below." : "Follow-up letter saved in Word and PDF formats. Review and print below.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The letter and print files could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareExistingPdf() {
    if (!draft) return;
    setBusy(true);
    try {
      if (!await autosave.flush()) return;
      const pdf = await createSavedLetterPdf(draft.letterFileUrl);
      const document = { kind: "letter-pdf" as const, name: draft.letterFileName.replace(/\.docx$/i, ".pdf"), url: pdf.url };
      const saved = await saveTrackingSite({ ...draft, letterDocuments: [...draft.letterDocuments?.filter((item) => item.kind !== "letter-pdf") ?? [], document] });
      setSites((current) => current.map((site) => site.id === saved.id ? saved : site));
      setDraft(saved);
      setPreview(document);
      setStatus("PDF saved. Open it to print from your browser.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The PDF could not be prepared.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mailing-admin" aria-label="Postal contact workflow">
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <Mail aria-hidden="true" />
          <span>{status}</span>
        </div>
        <p className="admin-note">Default follow-up: {defaultReminderDays} days. Change the default in Settings.</p>
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
              <button key={site.id} type="button" disabled={busy} onClick={() => selectSite(site)}>
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
          <AdminSiteFolders sites={visibleSites} allSites={sites} selectedId={draft?.id} busy={busy} onMove={moveSites} onSelect={selectSite} />
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

              <fieldset className="workflow-fields" disabled={busy}>
              <div className="workflow-heading"><span>01</span><div><h3>Recipient &amp; address</h3><p>Check the details that will appear in your letter. Changes also update the site record.</p></div></div>
              <div className="admin-grid admin-grid--two">
                <TextInput label="Recipient name" value={draft.customerName} maxLength={80} onChange={(value) => updateDraft((site) => { site.customerName = value; })} />
                <SelectField label="Address letter to" value={draft.letterRecipientMode} options={Object.entries(letterRecipientModeLabels) as [LetterRecipientMode, string][]} onChange={(value) => updateDraft((site) => { site.letterRecipientMode = value as LetterRecipientMode; })} />
                {([ ["line1", "Address line 1", 90], ["line2", "Address line 2", 90], ["town", "Town / city", 70], ["county", "County", 70], ["postcode", "Postcode", 12] ] as const).map(([part, label, limit]) =>
                  <TextInput key={part} id={`mailing-address-${part}`} label={label} value={draft.siteAddressParts[part]} maxLength={limit} onChange={(value) => updateDraft((site) => {
                    site.siteAddressParts[part] = part === "postcode" ? value.toUpperCase() : value;
                    site.siteAddress = buildAddressFromParts(site.siteAddressParts);
                  })} />)}
              </div>
              <SiteFolderField value={draft.region} sites={sites} onChange={(value) => updateDraft((site) => { site.region = value; })} />
              <div className="workflow-heading"><span>02</span><div><h3>Create &amp; review your letter</h3><p>Choose a template, generate your letter and review it here before downloading.</p></div></div>
              <details className="letter-template">
                <summary>Template help &amp; starter downloads</summary>
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
              </details>

              <div className="admin-grid admin-grid--two">
                <SelectField label="Letter stage" value={letterStage} options={initialDone ? [["initial", "Initial letter"], ["follow-up", "Follow-up letter"]] : [["initial", "Initial letter"]]} onChange={(value) => setStageChoice({ id: draft.id, stage: value as "initial" | "follow-up" })} />
                <p className="admin-note">{initialDone ? "An earlier letter is saved or recorded as posted. Follow-up letters are now available. You can also regenerate the initial letter." : "Generate and save the initial letter first. Follow-up presets become available when you return to this site."}</p>
                <SelectField
                  id="letter-preset"
                  label="Letter preset"
                  value={selectedPreset?.id ?? ""}
                  onChange={(value) =>
                    updateDraft((site) => {
                      const preset = availablePresets.find((item) => item.id === value);
                      site.letterPresetId = preset?.id ?? "";
                      site.letterTemplateName = preset?.templateName ?? "";
                      site.letterTemplateUrl = preset?.templateUrl ?? "";
                      if (preset) site.letterRecipientMode = preset.recipientMode;
                    })
                  }
                  options={[
                    ["", "Choose a template"],
                    ...availablePresets.map((preset) => [preset.id, preset.name] as const)
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
                {!availablePresets.length && <p className="admin-note">Add {letterStage === "initial" ? "an initial" : "a follow-up"} preset in Settings to generate this letter.</p>}
                <button
                  type="button"
                  className="admin-save"
                  onClick={generateLetter}
                  disabled={busy || !templateUrl || !validation.valid}
                >
                  <FileText aria-hidden="true" />
                  {busy ? "Working…" : "Generate & preview letter"}
                </button>
                {templateUrl && <button type="button" className="admin-ghost" disabled={busy} onClick={() => setPreview({ url: templateUrl, name: selectedPreset?.templateName || "Letter template.docx" })}>Preview template</button>}
                {!templateUrl && <small>Choose a template above to enable generation.</small>}
                <small>
                  {letterStage === "initial" ? "Creates your letter and addressed C5 envelope in Word and PDF formats." : "Creates your follow-up letter in Word and PDF formats."} Your letter includes this site&apos;s QR code.
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
                    <button type="button" className="admin-open" onClick={() => setPreview({ url: draft.letterFileUrl, name: draft.letterFileName })}>Preview letter</button>
                  )}
                  {draft.letterFileUrl && (
                    <a href={draft.letterFileUrl} download={draft.letterFileName || "letter"} className="admin-open">
                      <ExternalLink aria-hidden="true" />
                      Download
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

              {!!draft.letterDocuments?.length && <div className="mailing-print-files" aria-label="Print files">
                <h3>Ready to print</h3>
                <details className="mailing-print-help"><summary>Paper size &amp; printing help</summary><p className="admin-note">Open a PDF to print in your browser. Choose the matching paper size (C5 for envelopes), actual size and no added margins. The envelope has two pages: the addressed front and return-address back. Print page 1 for the front only. Borderless printing requires a compatible printer.</p></details>
                {[...draft.letterDocuments].sort((a, b) => ["letter-pdf", "envelope-pdf", "envelope-docx"].indexOf(a.kind) - ["letter-pdf", "envelope-pdf", "envelope-docx"].indexOf(b.kind)).map((document) => <div className="letter-upload" key={document.kind}>
                  <div><FileText aria-hidden="true" /><span><strong>{document.kind === "letter-pdf" ? "Letter · PDF" : document.kind === "envelope-pdf" ? "Envelope · PDF · C5" : "Envelope · Word"}</strong><small>{document.name}</small></span></div>
                  <div className="letter-upload__actions">
                    <button type="button" className="admin-open" onClick={() => setPreview(document)}>Preview</button>
                    {document.kind.endsWith("pdf") && <a className="admin-save" href={document.url} target="_blank" rel="noopener noreferrer">Open PDF / Print</a>}
                    <a className="admin-open" href={document.url} download={document.name}>Download</a>
                  </div>
                </div>)}
              </div>}
              {/\.docx$/i.test(draft.letterFileUrl) && !draft.letterDocuments?.some((document) => document.kind === "letter-pdf") && <button className="admin-open" type="button" disabled={busy} onClick={prepareExistingPdf}>Create PDF for saved letter</button>}
              {/\.pdf$/i.test(draft.letterFileUrl) && <a className="admin-open" href={draft.letterFileUrl} target="_blank" rel="noopener noreferrer">Open PDF / Print</a>}

              <div className="workflow-heading"><span>03</span><div><h3>Posting &amp; follow-up</h3><p>Record when you post the letter and when to contact the owner again.</p></div></div>
              <button type="button" className="admin-small" disabled={busy} onClick={markMailedToday}>Mark posted today</button>
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
                  onChange={(value) => updateDraft((site) => { site.lastMailedAt = value; site.remailReminderDate = suggestRemailReminderDate(value, site.remailReminderDays); })}
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
                        site.remailReminderDate = suggestRemailReminderDate(site.lastMailedAt || site.firstMailedAt, site.remailReminderDays);
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

              <p className="admin-note">Second class stamped post has no delivery tracking. Use the mailing dates and reminders to plan your follow-up.</p>

              <Textarea
                id="mailing-notes"
                label="Notes"
                value={draft.mailingNotes}
                rows={5}
                maxLength={trackingFieldLimits.mailingNotes}
                onChange={(value) => updateDraft((site) => { site.mailingNotes = value; })}
              />

              {!validation.valid && <div className="admin-errors" role="alert"><strong>Check these details</strong><ul>{validation.errors.map((error) => <li key={error.path}>{error.message}</li>)}</ul></div>}
              <div className="sites-admin__actions workflow-savebar">
                <span className={autosave.error && dirty ? "workflow-save-status workflow-save-status--error" : "workflow-save-status"} role="status">
                  {autosave.label}
                </span>
                <button type="button" className="admin-save" onClick={saveDraft} disabled={busy || autosave.saving || !validation.valid}>
                  <Save aria-hidden="true" />
                  {autosave.saving ? "Saving…" : autosave.error ? "Retry save" : "Save mailing"}
                </button>
              </div>
              </fieldset>
            </section>
          )}
        </div>
      </div>
      {preview && <AdminDocumentPreview key={preview.url} file={preview} onClose={() => setPreview(null)} />}
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
