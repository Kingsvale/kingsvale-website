import {
  AlertCircle,
  Archive,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Link,
  Mail,
  Palette,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2
} from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AdminColorInput,
  AdminRangeInput,
  AdminSelectField,
  AdminTextInput,
  AdminTextarea
} from "../components/AdminFields";
import { TrackingQrCode } from "../components/TrackingQrCode";
import {
  archiveTrackingSite,
  deleteTrackingSite,
  generateLetterFromTemplate,
  getTrackingStorageStatus,
  listTrackingSites,
  saveTrackingSite,
  subscribeTrackingStorageStatus,
  uploadLetterFile
} from "../lib/cmsApi";
import {
  createTrackingResource,
  createTrackingSite,
  detectSiteRegion,
  mailingStatusClass,
  normalizeMapEmbedInput,
  priorityClass,
} from "../lib/trackingStorage";
import {
  trackingResourceLabels,
  contactPriorityLabels,
  mailingStatusLabels,
  type ContactPriority,
  type TrackingResourceType,
  type TrackingSite
} from "../lib/trackingTypes";
import {
  trackingFieldLimits,
  validateTrackingSite,
  type TrackingValidationError
} from "../lib/trackingValidation";

const resourceTypes = Object.keys(trackingResourceLabels) as TrackingResourceType[];
const contactPriorities = Object.keys(contactPriorityLabels) as ContactPriority[];
const letterTokens = [
  "{{legal_name}}",
  "{{address}}",
  "{{street}}",
  "{{address_line_2}}",
  "{{town}}",
  "{{postal_code}}",
  "{{council}}",
  "{{tracking_link}}"
];
const starterLetterTemplates = [
  ["/templates/kingsvale-initial-letter-template.docx", "Initial letter template"],
  ["/templates/kingsvale-follow-up-letter-template.docx", "Follow-up letter template"]
] as const;

function TrackingTextInput({ id, label, ...props }: ComponentProps<typeof AdminTextInput>) {
  return <AdminTextInput {...props} id={id ?? toId(label)} label={label} />;
}

function TrackingTextarea({ id, label, rows = 3, ...props }: ComponentProps<typeof AdminTextarea>) {
  return <AdminTextarea {...props} id={id ?? toId(label)} label={label} rows={rows} />;
}

function ColorInput({ id, label, ...props }: ComponentProps<typeof AdminColorInput>) {
  return <AdminColorInput {...props} id={id ?? toId(label)} label={label} />;
}

function RangeInput({ id, label, ...props }: ComponentProps<typeof AdminRangeInput>) {
  return <AdminRangeInput {...props} id={id ?? toId(label)} label={label} />;
}

function TrackingSelectField({ id, label, ...props }: ComponentProps<typeof AdminSelectField>) {
  return <AdminSelectField {...props} id={id ?? toId(label)} label={label} />;
}

export function AdminSitesPanel() {
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [draft, setDraft] = useState<TrackingSite | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Create QR-ready land interest map pages.");
  const [storageStatus, setStorageStatus] = useState(() => getTrackingStorageStatus());

  useEffect(() => {
    let active = true;

    async function loadSites() {
      try {
        const loadedSites = await listTrackingSites();
        if (!active) {
          return;
        }

        const orderedSites = sortSites(loadedSites);
        setSites((current) => {
          const merged = [
            ...current,
            ...orderedSites.filter((site) => !current.some((item) => item.id === site.id))
          ];
          return sortSites(merged);
        });
        setDraft((current) => current ?? orderedSites.find((site) => !site.archived) ?? orderedSites[0] ?? null);
      } catch {
        if (active) {
          setStatus("Tracking storage API is unavailable.");
        }
      }
    }

    void loadSites();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => subscribeTrackingStorageStatus(setStorageStatus), []);

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
        site.region,
        site.reference,
        contactPriorityLabels[site.contactPriority],
        mailingStatusLabels[site.mailingStatus]
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, showArchived, sites]);
  const groupedSites = useMemo(() => groupSitesByRegion(visibleSites), [visibleSites]);

  const validation = useMemo(
    () => (draft ? validateTrackingSite(draft) : { valid: true, errors: [] }),
    [draft]
  );
  const errorsByPath = useMemo(() => toTrackingErrorMap(validation.errors), [validation.errors]);
  const publicLink = draft ? buildPublicLink(draft.token) : "";

  async function handleCreate() {
    setBusy(true);
    try {
      const siteDraft = createTrackingSite();
      siteDraft.reference = nextTrackingReference(sites);
      const site = await saveTrackingSite(siteDraft);
      setSites((current) => sortSites([site, ...current.filter((item) => item.id !== site.id)]));
      setDraft(site);
      setStatus(`Map page created with reference ${site.reference}. Add the plot map link, then save.`);
    } catch {
      setStatus("Map page could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    if (isDuplicateReference(draft, sites)) {
      setStatus(`Reference ${draft.reference.trim()} already exists. Use a unique reference before saving.`);
      return;
    }

    const result = validateTrackingSite(draft);
    if (!result.valid) {
      setStatus("Resolve the map page guardrails before saving.");
      return;
    }

    setBusy(true);
    try {
      const saved = await saveTrackingSite(draft);
      setSites((current) => sortSites([saved, ...current.filter((site) => site.id !== saved.id)]));
      setDraft(saved);
      setStatus("Map page saved.");
    } catch {
      setStatus("Map page could not be saved.");
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
        setStatus("Map page could not be archived.");
        return;
      }

      setSites((current) =>
        sortSites(current.map((site) => (site.id === archived.id ? archived : site)))
      );
      const next = sites.find((site) => site.id !== archived.id && !site.archived) ?? null;
      setDraft(next);
      setStatus("Map page archived. Its public link is now unavailable.");
    } catch {
      setStatus("Map page could not be archived.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!draft) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${draft.reference || draft.title}? This permanently removes the map page and cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      const deleted = await deleteTrackingSite(draft.id);
      if (!deleted) {
        setStatus("Map page could not be deleted.");
        return;
      }

      const remainingSites = sites.filter((site) => site.id !== draft.id);
      setSites(sortSites(remainingSites));
      setDraft(remainingSites.find((site) => !site.archived) ?? remainingSites[0] ?? null);
      setStatus("Map page deleted.");
    } catch {
      setStatus("Map page could not be deleted.");
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
      setStatus("Map page link copied.");
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

  async function handleLetterTemplateUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (!isAllowedLetterTemplateFile(file)) {
      setStatus("Letter template must be a DOCX Word document under 8MB.");
      return;
    }

    setBusy(true);
    try {
      const upload = await uploadLetterFile(file);
      if (!upload) {
        setStatus("Template could not be uploaded to the server. Generation needs server storage.");
        return;
      }

      updateDraft((site) => {
        site.letterTemplateName = upload.name;
        site.letterTemplateUrl = upload.url;
      });
      setStatus("Letter template uploaded to server. Save the site, or generate a letter now.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateLetter() {
    if (!draft) {
      return;
    }

    if (!draft.letterTemplateUrl) {
      setStatus("Upload a DOCX letter template before generating.");
      return;
    }

    const result = validateTrackingSite(draft);
    if (!result.valid) {
      setStatus("Resolve the site guardrails before generating a letter.");
      return;
    }

    setBusy(true);
    try {
      const generated = await generateLetterFromTemplate(draft, publicLink);
      if (!generated) {
        setStatus("Letter could not be generated. Check the template is a server-uploaded DOCX.");
        return;
      }

      const nextDraft = {
        ...draft,
        letterFileName: generated.name,
        letterFileUrl: generated.url
      };
      const saved = await saveTrackingSite(nextDraft);
      setSites((current) => sortSites([saved, ...current.filter((site) => site.id !== saved.id)]));
      setDraft(saved);
      setStatus("Letter generated with the site details and tracked QR code.");
    } catch {
      setStatus("Letter could not be generated.");
    } finally {
      setBusy(false);
    }
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
      setStatus("Letter uploaded to server. Save the site to keep it.");
    } finally {
      setBusy(false);
    }
  }

  function clearLetterTemplate() {
    updateDraft((site) => {
      site.letterTemplateName = "";
      site.letterTemplateUrl = "";
    });
    setStatus("Letter template removed. Save the site to keep this change.");
  }

  function clearLetterUpload() {
    updateDraft((site) => {
      site.letterFileName = "";
      site.letterFileUrl = "";
    });
    setStatus("Letter removed. Save the site to keep this change.");
  }

  function openInMailing() {
    if (!draft) {
      return;
    }
    window.dispatchEvent(new CustomEvent("kingsvale-open-mailing-site", { detail: { siteId: draft.id } }));
  }

  return (
    <section className="sites-admin" aria-label="Land interest map pages">
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
      <div className={`tracking-storage-banner tracking-storage-banner--${storageStatus.mode}`} role="status">
        {storageStatus.mode === "local" || storageStatus.mode === "unavailable" ? (
          <AlertCircle aria-hidden="true" />
        ) : (
          <ShieldCheck aria-hidden="true" />
        )}
        <div>
          <strong>{storageStatus.label}</strong>
          <span>{storageStatus.detail}</span>
        </div>
      </div>

      <div className="sites-admin__layout">
        <aside className="sites-admin__list" aria-label="Map page list">
          <div className="sites-admin__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="tracking-search">
              Search map pages
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
              <div className="sites-admin__empty">No map pages yet.</div>
            ) : (
              groupedSites.flatMap(([region, regionSites]) => [
                <div className="site-group-heading" key={`${region}-heading`}>
                  <Folder aria-hidden="true" />
                  <span>{region}</span>
                  <span>{regionSites.length}</span>
                </div>,
                ...regionSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  className={draft?.id === site.id ? "site-row site-row--active" : "site-row"}
                  onClick={() => {
                    setDraft(structuredClone(site));
                    setStatus(site.archived ? "Archived map page selected." : "Map page selected.");
                  }}
                >
                  <span className="site-row__title">{site.title}</span>
                  <span className="site-row__meta">
                    {site.siteAddress}
                    {site.reference ? ` · ${site.reference}` : ""}
                  </span>
                  <span className="site-row__badges">
                    <span className={`priority-badge ${priorityClass(site.contactPriority)}`}>
                      {contactPriorityLabels[site.contactPriority]}
                    </span>
                    <span className={`mailing-status ${mailingStatusClass(site.mailingStatus)}`}>
                      {mailingStatusLabels[site.mailingStatus]}
                    </span>
                  </span>
                </button>
                ))
              ])
            )}
          </div>
        </aside>

        <div className="sites-admin__detail">
          {!draft ? (
            <div className="admin-panel sites-admin__blank">
              <h2>Sites</h2>
              <p>Create a QR-ready map page for a land interest letter.</p>
            </div>
          ) : (
            <>
              {!validation.valid && (
                <div className="admin-errors" role="alert" aria-label="Map page validation issues">
                  <h2>Map page guardrails</h2>
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
                  <span className={`priority-badge ${priorityClass(draft.contactPriority)}`}>
                    {contactPriorityLabels[draft.contactPriority]}
                  </span>
                </div>

                <div className="tracking-link-box">
                  <div>
                    <span>Public map page link</span>
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
                  <button type="button" className="admin-ghost" onClick={openInMailing}>
                    <Mail aria-hidden="true" />
                    Mailing
                  </button>
                </div>

                <details className="qr-designer qr-designer--folded" open>
                  <summary className="qr-designer__summary">
                    <span><Palette aria-hidden="true" /> QR Code Design</span>
                    <small>Colours, shape and Word-ready PNG export</small>
                  </summary>
                  <div className="qr-designer__controls">
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
                </details>

                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Site title"
                    value={draft.title}
                    maxLength={trackingFieldLimits.title}
                    error={errorsByPath.title}
                    onChange={(value) => updateDraft((site) => { site.title = value; })}
                  />
                  <TrackingTextInput
                    label="Legal owner / customer name"
                    value={draft.customerName}
                    maxLength={trackingFieldLimits.customerName}
                    error={errorsByPath.customerName}
                    onChange={(value) => updateDraft((site) => { site.customerName = value; })}
                  />
                </div>
                <div className="admin-grid admin-grid--two">
                  <TrackingSelectField
                    label="Contact priority"
                    value={draft.contactPriority}
                    options={contactPriorities.map((priority) => [priority, contactPriorityLabels[priority]] as const)}
                    onChange={(value) =>
                      updateDraft((site) => { site.contactPriority = value as ContactPriority; })
                    }
                  />
                  <TrackingTextInput
                    label="Reference"
                    value={draft.reference}
                    maxLength={trackingFieldLimits.reference}
                    error={errorsByPath.reference}
                    onChange={(value) => updateDraft((site) => { site.reference = value; })}
                  />
                </div>
                {isDuplicateReference(draft, sites) && (
                  <p className="admin-field__error" role="alert">
                    This reference already exists. References must be unique.
                  </p>
                )}
                <TrackingTextInput
                  label="Site address"
                  value={draft.siteAddress}
                  maxLength={trackingFieldLimits.siteAddress}
                  error={errorsByPath.siteAddress}
                  onChange={(value) =>
                    updateDraft((site) => {
                      site.siteAddress = value;
                      if (!site.region || site.region === "Uncategorised") {
                        site.region = detectSiteRegion(value) || "Uncategorised";
                      }
                    })
                  }
                />
                <div className="admin-grid admin-grid--two">
                  <TrackingTextInput
                    label="Folder / region"
                    value={draft.region}
                    maxLength={trackingFieldLimits.region}
                    error={errorsByPath.region}
                    onChange={(value) => updateDraft((site) => { site.region = value; })}
                  />
                  <TrackingTextInput
                    label="Searchland URL"
                    type="url"
                    value={draft.searchlandUrl}
                    maxLength={trackingFieldLimits.searchlandUrl}
                    error={errorsByPath.searchlandUrl}
                    onChange={(value) => updateDraft((site) => { site.searchlandUrl = value; })}
                  />
                </div>
                <TrackingTextarea
                  label="Status note"
                  value={draft.statusNote}
                  maxLength={trackingFieldLimits.statusNote}
                  error={errorsByPath.statusNote}
                  onChange={(value) => updateDraft((site) => { site.statusNote = value; })}
                />
                <TrackingTextarea
                  id="google-my-maps-embed-url-or-iframe"
                  label="Google My Maps embed URL or iframe"
                  value={draft.mapEmbedUrl}
                  maxLength={trackingFieldLimits.mapEmbedUrl}
                  error={errorsByPath.mapEmbedUrl}
                  onChange={(value) =>
                    updateDraft((site) => { site.mapEmbedUrl = normalizeMapEmbedInput(value); })
                  }
                />
              </section>

              <section className="admin-panel" aria-labelledby="site-private-title">
                <div className="admin-section-heading">
                  <h2 id="site-private-title">Editor-only notes and letters</h2>
                </div>
                <TrackingTextarea
                  label="Private notes"
                  value={draft.privateNotes}
                  maxLength={trackingFieldLimits.privateNotes}
                  error={errorsByPath.privateNotes}
                  onChange={(value) => updateDraft((site) => { site.privateNotes = value; })}
                />
                <div className="letter-template">
                  <div className="letter-template__intro">
                    <div>
                      <FileText aria-hidden="true" />
                      <span>
                        <strong>Template placeholders</strong>
                        <small>
                          Replace only owner/address/legal fields in Word. The QR image already positioned in the
                          template will be swapped for this site&apos;s tracking QR.
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
                <div className="letter-upload">
                  <div>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{draft.letterTemplateName || "No template uploaded"}</strong>
                      <small>Upload a DOCX with placeholders like {"{{legal_name}}"} and {"{{postal_code}}"}.</small>
                    </span>
                  </div>
                  <div className="letter-upload__actions">
                    {draft.letterTemplateUrl && (
                      <a href={draft.letterTemplateUrl} download={draft.letterTemplateName || "letter-template.docx"} className="admin-open">
                        <ExternalLink aria-hidden="true" />
                        Open
                      </a>
                    )}
                    <label className="admin-small">
                      Upload template
                      <input
                        className="sr-only"
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => void handleLetterTemplateUpload(event.target.files)}
                      />
                    </label>
                    {draft.letterTemplateUrl && (
                      <button type="button" className="admin-ghost" onClick={clearLetterTemplate}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="letter-generator-actions">
                  <button
                    type="button"
                    className="admin-save"
                    onClick={handleGenerateLetter}
                    disabled={busy || !validation.valid || !draft.letterTemplateUrl}
                  >
                    <FileText aria-hidden="true" />
                    {busy ? "Generating" : "Generate letter"}
                  </button>
                  <small>Creates a DOCX from the template, fills legal/address placeholders, and inserts the tracked QR.</small>
                </div>
                <div className="letter-upload">
                  <div>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{draft.letterFileName || "No generated letter"}</strong>
                      <small>Generated or manually attached letter. Visible in Studio and Mailing only.</small>
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
                      Upload final letter
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
                {draft.searchlandUrl && (
                  <a className="admin-open" href={draft.searchlandUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Open Searchland
                  </a>
                )}
              </section>

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
                    Add images, planning documents, drawings, schedules or useful links for customers.
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
                          <TrackingSelectField
                            id={`resource-type-${index}`}
                            label="Type"
                            value={resource.type}
                            options={resourceTypes.map((type) => [type, trackingResourceLabels[type]] as const)}
                            onChange={(value) =>
                              updateDraft((site) => {
                                site.resources[index].type = value as TrackingResourceType;
                              })
                            }
                          />
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
                <button
                  type="button"
                  className="admin-danger"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
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

function groupSitesByRegion(sites: TrackingSite[]) {
  const groups = new Map<string, TrackingSite[]>();
  for (const site of sites) {
    const region = site.region?.trim() || detectSiteRegion(site.siteAddress) || "Uncategorised";
    groups.set(region, [...(groups.get(region) ?? []), site]);
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

function nextTrackingReference(sites: TrackingSite[]) {
  const usedNumbers = sites
    .map((site) => site.reference.trim().toUpperCase().match(/^KV(\d{4,})$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value));
  let next = Math.max(0, ...usedNumbers) + 1;
  const usedReferences = new Set(sites.map((site) => normalizeReference(site.reference)));

  while (usedReferences.has(`KV${String(next).padStart(4, "0")}`)) {
    next += 1;
  }

  return `KV${String(next).padStart(4, "0")}`;
}

function isDuplicateReference(draft: TrackingSite, sites: TrackingSite[]) {
  const reference = normalizeReference(draft.reference);
  return Boolean(reference) && sites.some((site) => site.id !== draft.id && normalizeReference(site.reference) === reference);
}

function normalizeReference(reference: string) {
  return reference.trim().toUpperCase();
}

function toId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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

function isAllowedLetterTemplateFile(file: File) {
  return file.size <= 8_000_000 && (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  );
}

function toTrackingErrorMap(errors: TrackingValidationError[]) {
  return errors.reduce<Record<string, string>>((map, error) => {
    map[error.path] = error.message;
    return map;
  }, {});
}
