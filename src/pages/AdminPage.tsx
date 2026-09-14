import { AdminOverviewEditor } from "./AdminOverviewEditor";
import { AdminContactDelivery } from "./AdminContactDelivery";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  History,
  LogOut,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { defaultContent } from "../data/defaultContent";
import {
  AdminSelectField as SelectField,
  AdminTextInput as TextInput,
  AdminTextarea as Textarea
} from "../components/AdminFields";
import { iconOptions } from "../components/IconRenderer";
import type {
  Development,
  FeatureItem,
  IconKey,
  NavLink,
  SeoContent,
  SiteContent
} from "../lib/contentTypes";
import {
  fieldLimits,
  validateSiteContent,
  type ValidationError
} from "../lib/contentValidation";
import {
  cloneContent,
  resetPublishedContent,
  savePublishedContent
} from "../lib/storage";
import { saveEncryptedEditorSnapshot } from "../lib/studioSecurity";
import {
  fetchCmsDraft,
  getTrackingStorageStatus,
  hasServerSession,
  listCmsRevisions,
  publishCmsContent,
  restoreCmsRevision,
  saveCmsDraft,
  subscribeTrackingStorageStatus
} from "../lib/cmsApi";
import {
  buildStudioPreviewUrl,
  saveStudioPreviewContent,
  studioPreviewMessageType
} from "../lib/studioPreview";
import { AdminAnalyticsPanel } from "./AdminAnalyticsPanel";
import { AdminBackupPanel } from "./AdminBackupPanel";
import { AdminMailingPanel } from "./AdminMailingPanel";
import { AdminSettingsPanel } from "./AdminSettingsPanel";
import { AdminSitesPanel } from "./AdminSitesPanel";
import { ImageEditor, ImageUploadContext } from "./AdminImageEditor";
import { AdminImagesPanel } from "./AdminImagesPanel";
import { ProjectGallery } from "./AdminProjectGallery";
import { isLocalDemoRuntime } from "../lib/runtimeMode";
import { normalizeSiteContent } from "../lib/contentNormalize";
import { websiteDraftKey } from "../lib/websiteDraft";
import "../studio-media.css";
import "../studio-workflows.css";
import { applyTextEdit, readField, previewReadyMessage, previewEditMessage, previewSelectMessage, previewModeMessage, previewScrollMessage } from "../lib/siteEditing";

type AdminPageProps = {
  publishedContent: SiteContent;
  studioSecret?: string;
  encryptedSnapshotSummary?: string;
  onLogout?: () => void;
};

type RevisionSummary = {
  id: string;
  createdAt: string;
  user: string;
  title: string;
};

type AdminRootTab = "website" | "sites" | "mailing" | "analytics" | "backup" | "settings";
type PreviewRoute = string;
type PreviewDevice = "desktop" | "tablet" | "mobile";

const emptyLink: NavLink = { label: "New link", href: "#" };

const editorSections = [
  { id: "images", label: "Images & galleries" },
  { id: "hero", label: "Homepage hero" },
  { id: "features", label: "Homepage highlights" },
  { id: "legacy", label: "Our Legacy" },
  { id: "developments", label: "Our developments" },
  { id: "land", label: "Land wanted" },
  { id: "brand", label: "Header/nav" },
  { id: "design", label: "Design page" },
  { id: "vision", label: "Vision page" },
  { id: "contact", label: "Contact" },
  { id: "seo", label: "SEO" },
  { id: "footer", label: "Footer" }
] as const;

const adminRootTabs: { id: AdminRootTab; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "sites", label: "Sites" },
  { id: "mailing", label: "Mailing" },
  { id: "analytics", label: "Analytics" },
  { id: "backup", label: "Backup" },
  { id: "settings", label: "Settings" }
];

const previewRoutes: { value: PreviewRoute; label: string }[] = [
  { value: "/", label: "Homepage" },
  { value: "/design-build", label: "Design & Build Services" },
  { value: "/land-wanted", label: "Land Wanted" },
  { value: "/vision-process", label: "Our Vision & Process" },
  { value: "/about", label: "About Us" },
  { value: "/developments", label: "Our Developments" },
  { value: "/contact", label: "Contact Us" },
  { value: "/faq", label: "Frequently asked questions" },
  { value: "/new-homes-south-england", label: "New homes in the South" },
  { value: "/real-estate-development", label: "Real estate development" },
  { value: "/land-opportunities", label: "Land opportunities" },
  { value: "/land-seller-guide", label: "Land seller guide" },
  { value: "/privacy", label: "Privacy policy" },
  { value: "/terms", label: "Terms and conditions" },
  { value: "/plot-lookup", label: "Plot lookup" },
  { value: "/security-review", label: "Security information" }
];

const previewDevices = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 820, height: 1080, icon: Tablet },
  { id: "mobile", label: "Phone", width: 390, height: 844, icon: Smartphone }
] as const;

type PreviewDeviceConfig = (typeof previewDevices)[number];
type EditorSectionId = (typeof editorSections)[number]["id"];

const previewRoutePanels: Partial<Record<PreviewRoute, EditorSectionId>> = {
  "/": "hero",
  "/design-build": "design",
  "/land-wanted": "land",
  "/vision-process": "vision",
  "/about": "legacy",
  "/developments": "developments",
  "/contact": "contact"
};

export function AdminPage({
  publishedContent,
  studioSecret = "",
  encryptedSnapshotSummary = "Encrypted snapshot updates after publishing.",
  onLogout
}: AdminPageProps) {
  const [draft, setDraft] = useState<SiteContent>(() => {
    if (isLocalDemoRuntime()) {
      try { const saved = localStorage.getItem(websiteDraftKey); if (saved) return normalizeSiteContent(JSON.parse(saved)); } catch { /* Start from published content if the local draft is unavailable. */ }
    }
    return cloneContent(publishedContent);
  });
  const [status, setStatus] = useState<string>("Draft changes are visible in the preview.");
  const [activeRootTab, setActiveRootTab] = useState<AdminRootTab>("website");
  const [activePanel, setActivePanel] = useState<EditorSectionId>("hero");
  const [selectedMailingSiteId, setSelectedMailingSiteId] = useState("");
  const [previewRoute, setPreviewRoute] = useState<PreviewRoute>("/");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [imageSelection, setImageSelection] = useState("");
  const [textSelection, setTextSelection] = useState<{ path: string; value: string } | null>(null);
  const [scrollSection, setScrollSection] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(draft.developments[0]?.id ?? "");
  const [editingOverview, setEditingOverview] = useState(false);
  const [removedProject, setRemovedProject] = useState<{ project: Development; index: number } | null>(null);
  const selectedProject = draft.developments.find((project) => project.id === selectedProjectId) ?? draft.developments[0];
  const [serverMode, setServerMode] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draft));
  const [uploadsPending, setUploadsPending] = useState(0);
  const unsaved = JSON.stringify(draft) !== savedDraft;
  const storageUnavailable = !checkingStorage && !serverMode && (!isLocalDemoRuntime() || hasServerSession());
  const availablePreviewRoutes = [...previewRoutes, ...draft.developments.map((development) => ({ value: development.ctaHref as PreviewRoute, label: development.title }))];
  const [trackingStorageStatus, setTrackingStorageStatus] = useState(() => getTrackingStorageStatus());
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState("");
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const validation = useMemo(() => validateSiteContent(draft), [draft]);
  const errorsByPath = useMemo(() => toErrorMap(validation.errors), [validation.errors]);
  const activePanelLabel = editorSections.find((section) => section.id === activePanel)?.label ?? "Hero";
  const previewRouteLabel = availablePreviewRoutes.find((route) => route.value === previewRoute)?.label ?? "selected page";
  const previewDeviceConfig = previewDevices.find((device) => device.id === previewDevice) ?? previewDevices[0];

  useEffect(() => {
    let active = true;

    async function loadServerDraft() {
      try {
        const payload = await fetchCmsDraft();
        if (!active) {
          return;
        }
        setServerMode(true);
        if (payload.draft) {
          const loaded = normalizeSiteContent(payload.draft);
          setDraft(loaded);
          setSavedDraft(JSON.stringify(loaded));
        }
        const revisionList = await listCmsRevisions();
        if (active) {
          setRevisions(revisionList);
          setStatus(
            payload.updatedAt
              ? `Server CMS draft loaded. Last updated ${new Date(payload.updatedAt).toLocaleString()}.`
              : "Server CMS draft loaded."
          );
        }
      } catch {
        if (active) {
          setServerMode(false);
          if (!isLocalDemoRuntime()) setStatus("The backend is unavailable. Sign in again or retry before saving.");
        }
      } finally { if (active) setCheckingStorage(false); }
    }

    void loadServerDraft();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleOpenMailingSite(event: Event) {
      const siteId = (event as CustomEvent<{ siteId?: string }>).detail?.siteId ?? "";
      setSelectedMailingSiteId(siteId);
      setActiveRootTab("mailing");
    }

    window.addEventListener("kingsvale-open-mailing-site", handleOpenMailingSite);
    return () => {
      window.removeEventListener("kingsvale-open-mailing-site", handleOpenMailingSite);
    };
  }, []);

  useEffect(() => subscribeTrackingStorageStatus(setTrackingStorageStatus), []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (unsaved || uploadsPending) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, uploadsPending]);

  async function saveDraft() {
    if (storageUnavailable) return;
    setBusy(true);
    try {
      if (serverMode) await saveCmsDraft(draft);
      else if (isLocalDemoRuntime()) localStorage.setItem(websiteDraftKey, JSON.stringify(draft));
      else throw new Error("Backend unavailable");
      setSavedDraft(JSON.stringify(draft));
      setStatus(serverMode ? "Draft saved on the backend. The live website has not changed." : "Draft saved on this browser. The live website has not changed.");
    } catch { setStatus("Draft could not be saved. Your edits are still here; check the connection and retry."); }
    finally { setBusy(false); }
  }

  function selectEditorSection(section: EditorSectionId) {
    setActivePanel(section);
    const route = Object.entries(previewRoutePanels).find(([, panel]) => panel === section)?.[0];
    if (section === "developments") setPreviewRoute("/developments");
    if (section === "legacy") { setPreviewRoute("/"); setScrollSection("legacy"); }
    else if (route) setPreviewRoute(route as PreviewRoute);
    if (section === "images") setPreviewRoute(draft.developments[0]?.ctaHref ?? "/");
  }

  function updateDraft(recipe: (content: SiteContent) => void) {
    setDraft((current) => {
      const next = cloneContent(current);
      recipe(next);
      return next;
    });
  }

  async function publish() {
    if (storageUnavailable || checkingStorage || uploadsPending) return;
    const result = validateSiteContent(draft);
    if (!result.valid) {
      setStatus("Resolve the validation issues before publishing.");
      return;
    }

    setBusy(true);
    setStatus("Publishing content...");
    try {
      if (serverMode) {
        await saveCmsDraft(draft);
        await publishCmsContent(draft);
        setRevisions(await listCmsRevisions());
      } else if (isLocalDemoRuntime()) {
        savePublishedContent(draft);
        localStorage.setItem(websiteDraftKey, JSON.stringify(draft));
        await saveEncryptedEditorSnapshot(draft, studioSecret);
      }
      setSavedDraft(JSON.stringify(draft));
      window.dispatchEvent(new Event("kingsvale-content-updated"));
      setStatus(
        serverMode
          ? "Published to the server CMS. The public site is updated."
          : studioSecret
            ? "Published. The public site is updated and an encrypted studio snapshot was refreshed."
            : "Published. The public site now uses this content."
      );
    } catch {
      setStatus("Publish failed. Check the server session and validation state.");
    } finally {
      setBusy(false);
    }
  }

  async function resetToDefaults() {
    if (!window.confirm("Restore all default website content and placeholder photographs? This will update the live website.")) return;
    const defaults = cloneContent(defaultContent);
    setDraft(defaults);
    setBusy(true);
    try {
      if (serverMode) {
        await saveCmsDraft(defaults);
        await publishCmsContent(defaults);
        setRevisions(await listCmsRevisions());
      } else {
        resetPublishedContent();
        localStorage.setItem(websiteDraftKey, JSON.stringify(defaults));
      }
      window.dispatchEvent(new Event("kingsvale-content-updated"));
      setSavedDraft(JSON.stringify(defaults));
      setStatus("Default Kingsvale content restored.");
    } catch {
      setStatus("Reset failed. Check the server session.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreSelectedRevision() {
    if (!selectedRevision) {
      return;
    }

    setBusy(true);
    try {
      const payload = await restoreCmsRevision(selectedRevision);
      setDraft(cloneContent(payload.content));
      setSavedDraft(JSON.stringify(payload.content));
      setRevisions(await listCmsRevisions());
      setSelectedRevision("");
      setShowRevisionHistory(false);
      window.dispatchEvent(new Event("kingsvale-content-updated"));
      setStatus("Revision restored and published.");
    } catch {
      setStatus("Revision restore failed.");
    } finally {
      setBusy(false);
    }
  }

  function handlePreviewRouteChange(route: PreviewRoute) {
    setPreviewRoute(route);
    if (route.startsWith("/developments/")) setSelectedProjectId(draft.developments.find((project) => project.ctaHref === route || project.id === route.split("/")[2])?.id ?? selectedProjectId);
    setActivePanel((current) => current === "images" ? current : previewRoutePanels[route] ?? "developments");
  }

  return (
    <ImageUploadContext.Provider value={(delta) => setUploadsPending((count) => count + delta)}>
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <a className="admin-back" href="/">
            <ArrowRight aria-hidden="true" />
            Homepage
          </a>
          <h1>Kingsvale private studio</h1>
          <p>
            Edit one designed section at a time. The layout stays fixed, the
            guardrails stay active, and the preview shows exactly what will publish.
          </p>
          <div className="admin-root-tabs" role="tablist" aria-label="Studio areas">
            {adminRootTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeRootTab === tab.id}
                aria-controls={`admin-root-panel-${tab.id}`}
                disabled={uploadsPending > 0 || busy}
                onClick={() => setActiveRootTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-actions">
          <div className="admin-secure-pill">
            <ShieldCheck aria-hidden="true" />
            <span>{checkingStorage ? "Connecting to storage…" : serverMode ? "Images & drafts stored on the backend" : isLocalDemoRuntime() ? "Local studio · browser drafts" : encryptedSnapshotSummary}</span>
          </div>
          <div className={`admin-storage-pill admin-storage-pill--${trackingStorageStatus.mode}`} role="status">
            {trackingStorageStatus.mode === "local" || trackingStorageStatus.mode === "unavailable" ? (
              <AlertCircle aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            <span>{trackingStorageStatus.label}</span>
          </div>
          {activeRootTab === "website" && serverMode && (
            <button
              type="button"
              className="admin-ghost"
              disabled={busy || revisions.length === 0}
              onClick={() => setShowRevisionHistory(true)}
            >
              <History aria-hidden="true" />
              Revision history
            </button>
          )}
          {activeRootTab === "website" && (
            <>
              <a className="admin-open" href="/" target="_blank" rel="noreferrer">
                <Eye aria-hidden="true" />
                Open site
              </a>
              <button type="button" className="admin-ghost" onClick={resetToDefaults} disabled={busy || uploadsPending > 0 || checkingStorage || storageUnavailable}>
                <RotateCcw aria-hidden="true" />
                Reset
              </button>
            </>
          )}
          {onLogout && (
            <button type="button" className="admin-ghost" disabled={busy || uploadsPending > 0} onClick={() => { if (!unsaved || window.confirm("Lock Studio and discard unsaved changes? Save a draft first to keep them.")) onLogout(); }}>
              <LogOut aria-hidden="true" />
              Lock
            </button>
          )}
        </div>
      </header>

      {showRevisionHistory && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revision-history-title"
          >
            <div className="admin-modal__heading">
              <div>
                <h2 id="revision-history-title">Revision history</h2>
                <p>Restore the version that was live before a previous publish.</p>
              </div>
              <button type="button" className="admin-ghost" onClick={() => setShowRevisionHistory(false)}>
                Close
              </button>
            </div>
            <div className="revision-list">
              {revisions.map((revision) => (
                <label
                  className={selectedRevision === revision.id ? "revision-row revision-row--selected" : "revision-row"}
                  key={revision.id}
                >
                  <input
                    type="radio"
                    name="cms-revision"
                    value={revision.id}
                    checked={selectedRevision === revision.id}
                    onChange={(event) => setSelectedRevision(event.target.value)}
                  />
                  <span>
                    <strong>{new Date(revision.createdAt).toLocaleString()}</strong>
                    <small>{revision.title} - saved by {revision.user}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="admin-modal__actions">
              <button type="button" className="admin-ghost" onClick={() => setShowRevisionHistory(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-save"
                disabled={!selectedRevision || busy}
                onClick={restoreSelectedRevision}
              >
                <RotateCcw aria-hidden="true" />
                Restore selected revision
              </button>
            </div>
          </section>
        </div>
      )}

      {activeRootTab === "website" && (
      <main className="admin-layout" id="admin-root-panel-website" role="tabpanel">
        <section className="admin-editor" aria-label="Content editor">
          <div className="admin-status" role="status">
            {validation.valid ? <Check aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            <span><strong>{activePanelLabel}</strong> - {status}</span>
          </div>

          <p className="draft-state" role="status">{uploadsPending ? "Uploading images — wait before saving or publishing." : unsaved ? "Unsaved changes · save a draft to come back later" : "Draft is up to date"}</p>
          {!validation.valid && (
            <div className="admin-errors" role="alert" aria-label="Validation issues">
              <h2>Content guardrails</h2>
              <ul>
                {validation.errors.slice(0, 8).map((error) => (
                  <li key={`${error.path}-${error.message}`}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}

          <fieldset className="admin-edit-fields" disabled={busy || checkingStorage || uploadsPending > 0}>
          <div className="admin-tabs" role="tablist" aria-label="Editor sections">
            {editorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activePanel === section.id}
                aria-controls={`editor-panel-${section.id}`}
                disabled={uploadsPending > 0 || busy || checkingStorage}
                onClick={() => selectEditorSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
          <p className="admin-panel__note">
            Click any text in the preview to type directly on the page. Press Enter to apply or Escape to cancel. Click a photograph to open its image editor.
          </p>

          {textSelection && <section className="inline-selection" aria-label="Selected preview text">
            <div className="studio-image__heading"><h2>Selected text</h2><button type="button" className="admin-small" onClick={() => setTextSelection(null)}>Close text editor</button></div>
            <Textarea label="Text selected in preview" value={String(readField(draft, textSelection.path) ?? textSelection.value)} maxLength={2400} onChange={(value) => updateDraft((next) => { applyTextEdit(next, textSelection.path, value); })} helper="Edit here or directly in the preview. Changes stay in your draft until you publish." />
          </section>}
          {activePanel === "images" && <AdminImagesPanel requestedPath={imageSelection} content={draft} updateContent={updateDraft} onPreview={(route) => setPreviewRoute(route as PreviewRoute)} />}
          {activePanel === "brand" && (
          <EditorPanel title="Header and navigation" id="editor-panel-brand">
            <div className="admin-grid admin-grid--two">
              <TextInput
                label="Brand name"
                value={draft.brandName}
                onChange={(value) => updateDraft((content) => { content.brandName = value; })}
                maxLength={fieldLimits.brandName}
                error={errorsByPath.brandName}
              />
              <TextInput
                label="Brand suffix"
                value={draft.brandSuffix}
                onChange={(value) => updateDraft((content) => { content.brandSuffix = value; })}
                maxLength={fieldLimits.brandSuffix}
                error={errorsByPath.brandSuffix}
              />
            </div>
            <LinksEditor
              title="Header navigation"
              links={draft.navLinks}
              min={3}
              max={8}
              errorsByPath={errorsByPath}
              path="navLinks"
              onChange={(links) => updateDraft((content) => { content.navLinks = links; })}
            />
          </EditorPanel>
          )}

          {activePanel === "hero" && (
          <EditorPanel title="Homepage hero" id="editor-panel-hero">
            <TextInput
              label="Eyebrow"
              value={draft.hero.eyebrow}
              onChange={(value) => updateDraft((content) => { content.hero.eyebrow = value; })}
              maxLength={fieldLimits.heroEyebrow}
              error={errorsByPath["hero.eyebrow"]}
            />
            <Textarea
              label="Hero title"
              value={draft.hero.title}
              onChange={(value) => updateDraft((content) => { content.hero.title = value; })}
              maxLength={fieldLimits.heroTitle}
              rows={3}
              error={errorsByPath["hero.title"]}
            />
            <Textarea
              label="Subtitle"
              value={draft.hero.subtitle}
              onChange={(value) => updateDraft((content) => { content.hero.subtitle = value; })}
              maxLength={fieldLimits.heroSubtitle}
              rows={3}
              error={errorsByPath["hero.subtitle"]}
            />
            <div className="admin-grid admin-grid--two">
              <TextInput
                label="CTA label"
                value={draft.hero.ctaLabel}
                onChange={(value) => updateDraft((content) => { content.hero.ctaLabel = value; })}
                maxLength={fieldLimits.ctaLabel}
                error={errorsByPath["hero.ctaLabel"]}
              />
              <TextInput
                label="CTA link"
                value={draft.hero.ctaHref}
                onChange={(value) => updateDraft((content) => { content.hero.ctaHref = value; })}
                maxLength={120}
                error={errorsByPath["hero.ctaHref"]}
              />
            </div>
            <ImageEditor
              title="Hero image"
              image={draft.hero.image}
              error={errorsByPath["hero.image.src"] || errorsByPath["hero.image.alt"]}
              onChange={(image) => updateDraft((content) => { content.hero.image = image; })}
            />
          </EditorPanel>
          )}

          {activePanel === "features" && (
          <EditorPanel title="Homepage highlights" id="editor-panel-features">
            <p className="admin-panel__note">
              These four cards sit directly below the homepage hero.
            </p>
            <div className="admin-stack">
              {draft.features.map((feature, index) => (
                <FeatureEditor
                  key={feature.id}
                  feature={feature}
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.features.length - 1}
                  errorsByPath={errorsByPath}
                  onMove={(direction) =>
                    updateDraft((content) => {
                      content.features = moveItem(content.features, index, direction);
                    })
                  }
                  onChange={(nextFeature) =>
                    updateDraft((content) => {
                      content.features[index] = nextFeature;
                    })
                  }
                />
              ))}
            </div>
          </EditorPanel>
          )}

          {activePanel === "design" && (
          <StaticPageEditor
            title="Design & Build Services page"
            id="editor-panel-design"
            content={draft.pages.designBuild}
            onChange={(next) => updateDraft((content) => { content.pages.designBuild = next; })}
          />
          )}

          {activePanel === "vision" && (
          <StaticPageEditor
            title="Our Vision & Process page"
            id="editor-panel-vision"
            content={draft.pages.visionProcess}
            onChange={(next) => updateDraft((content) => { content.pages.visionProcess = next; })}
          />
          )}

          {activePanel === "legacy" && (
          <EditorialEditor
            title="About Us page"
            id="editor-panel-legacy"
            content={draft.about}
            path="about"
            errorsByPath={errorsByPath}
            onChange={(next) => updateDraft((content) => { content.about = next; })}
          />
          )}

          {activePanel === "developments" && (
          <EditorPanel title="Developments & project pages" id="editor-panel-developments">
            <details className="studio-image__details"><summary>Homepage section heading & link</summary>
            <TextInput
              label="Section eyebrow"
              value={draft.developmentsIntro.eyebrow}
              onChange={(value) =>
                updateDraft((content) => { content.developmentsIntro.eyebrow = value; })
              }
              maxLength={fieldLimits.eyebrow}
              error={errorsByPath["developmentsIntro.eyebrow"]}
            />
            <Textarea
              label="Section heading"
              value={draft.developmentsIntro.title}
              onChange={(value) =>
                updateDraft((content) => { content.developmentsIntro.title = value; })
              }
              maxLength={fieldLimits.sectionTitle}
              rows={2}
              error={errorsByPath["developmentsIntro.title"]}
            />
            <div className="admin-grid admin-grid--two">
              <TextInput
                label="View all label"
                value={draft.developmentsIntro.viewAllLabel}
                onChange={(value) =>
                  updateDraft((content) => { content.developmentsIntro.viewAllLabel = value; })
                }
                maxLength={fieldLimits.ctaLabel}
                error={errorsByPath["developmentsIntro.viewAllLabel"]}
              />
              <TextInput
                label="View all link"
                value={draft.developmentsIntro.viewAllHref}
                onChange={(value) =>
                  updateDraft((content) => { content.developmentsIntro.viewAllHref = value; })
                }
                maxLength={120}
                error={errorsByPath["developmentsIntro.viewAllHref"]}
              />
            </div>
            </details>
            <div className="admin-section-heading">
              <h3>Projects</h3>
              <button type="button" className="admin-small" onClick={() => { setEditingOverview(true); setPreviewRoute("/developments"); setScrollSection(""); }}>Edit developments overview</button>
              <button
                type="button"
                className="admin-small"
                disabled={draft.developments.length >= 100}
                onClick={() => {
                  const project = createDevelopment();
                  updateDraft((content) => { content.developments.push(project); });
                  setEditingOverview(false);
                  setSelectedProjectId(project.id);
                  setPreviewRoute(`/developments/${project.id}`);
                }}
              >
                <Plus aria-hidden="true" />
                Add project
              </button>
            </div>
            {editingOverview && <AdminOverviewEditor content={draft} updateContent={updateDraft} onClose={() => setEditingOverview(false)} />}
            {removedProject && <div className="admin-note" role="status">{removedProject.project.title} removed from the draft. <button type="button" className="admin-small" onClick={() => { updateDraft((next) => { next.developments.splice(Math.min(removedProject.index, next.developments.length), 0, removedProject.project); }); setSelectedProjectId(removedProject.project.id); setPreviewRoute(removedProject.project.ctaHref); setRemovedProject(null); }}>Undo removal</button></div>}
            <p className="admin-note">{draft.developments.length} projects · Add, select or remove a project below. Save your draft, then publish when ready.</p>
            {!selectedProject && <p className="admin-note">No projects yet. Select Add project to create your first project.</p>}
            {selectedProject && <>
            <SelectField label="Project to edit" value={selectedProject.id} options={draft.developments.map((project) => [project.id, project.title] as const)} onChange={(id) => { setEditingOverview(false); setSelectedProjectId(id); setPreviewRoute(draft.developments.find((project) => project.id === id)!.ctaHref); }} />
            <p className="admin-note">Choose a project below to edit its page, photographs and introduction. Click any text in the preview to edit the overview or the story below its gallery.</p>
            <button type="button" className="admin-small" onClick={() => { setPreviewRoute(selectedProject.ctaHref); setScrollSection("gallery"); }}>Edit selected project page & gallery</button>
            <div className="admin-stack">
              {draft.developments.map((development, index) => development.id === selectedProject.id && (
                <DevelopmentEditor
                  key={development.id}
                  development={development}
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.developments.length - 1}
                  canRemove={true}
                  errorsByPath={errorsByPath}
                  onMove={(direction) =>
                    updateDraft((content) => {
                      content.developments = moveItem(content.developments, index, direction);
                    })
                  }
                  onRemove={() => {
                    setRemovedProject({ project: development, index });
                    const nextProject = draft.developments[index + 1] ?? draft.developments[index - 1];
                    updateDraft((content) => { content.developments.splice(index, 1); });
                    setSelectedProjectId(nextProject?.id ?? ""); setPreviewRoute(nextProject?.ctaHref ?? "/developments");
                  }}
                  onChange={(nextDevelopment) => {
                    updateDraft((content) => { content.developments[index] = nextDevelopment; });
                    if (nextDevelopment.ctaHref !== development.ctaHref && /^\/developments\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextDevelopment.ctaHref)) setPreviewRoute(nextDevelopment.ctaHref);
                  }}
                />
              ))}
            </div>
            </>}
          </EditorPanel>
          )}

          {activePanel === "land" && (
          <LandWantedEditor
            id="editor-panel-land"
            content={draft.landWanted}
            errorsByPath={errorsByPath}
            onChange={(next) => updateDraft((content) => { content.landWanted = next; })}
          />
          )}

          {activePanel === "contact" && (<>
          <AdminContactDelivery />
          <StaticPageEditor
            title="Contact page"
            id="editor-panel-contact"
            content={draft.pages.contact}
            onChange={(next) => updateDraft((content) => { content.pages.contact = next; })}
            compact
          />
          </>)}

          {activePanel === "seo" && (
          <EditorPanel title="SEO and social sharing" id="editor-panel-seo">
            <SeoEditor
              title="Homepage"
              value={draft.seo.home}
              onChange={(next) => updateDraft((content) => { content.seo.home = next; })}
            />
            <SeoEditor
              title="Developments"
              value={draft.seo.developments}
              onChange={(next) => updateDraft((content) => { content.seo.developments = next; })}
            />
            <SeoEditor
              title="Design & Build Services"
              value={draft.pages.designBuild.seo}
              onChange={(next) => updateDraft((content) => { content.pages.designBuild.seo = next; })}
            />
            <SeoEditor
              title="Vision & Process"
              value={draft.pages.visionProcess.seo}
              onChange={(next) => updateDraft((content) => { content.pages.visionProcess.seo = next; })}
            />
            <SeoEditor
              title="About Us"
              value={draft.seo.about}
              onChange={(next) => updateDraft((content) => { content.seo.about = next; })}
            />
            <SeoEditor
              title="Land Wanted"
              value={draft.seo.landWanted}
              onChange={(next) => updateDraft((content) => { content.seo.landWanted = next; })}
            />
            <SeoEditor
              title="Contact"
              value={draft.pages.contact.seo}
              onChange={(next) => updateDraft((content) => { content.pages.contact.seo = next; })}
            />
          </EditorPanel>
          )}

          {activePanel === "footer" && (
          <EditorPanel title="Footer" id="editor-panel-footer">
            <Textarea
              label="Footer description"
              value={draft.footer.description}
              onChange={(value) => updateDraft((content) => { content.footer.description = value; })}
              maxLength={fieldLimits.footerDescription}
              rows={3}
              error={errorsByPath["footer.description"]}
            />
            <div className="admin-grid admin-grid--two">
              <TextInput
                label="Phone"
                value={draft.footer.phone}
                onChange={(value) => updateDraft((content) => { content.footer.phone = value; })}
                maxLength={fieldLimits.contact}
                error={errorsByPath["footer.phone"]}
              />
              <TextInput
                label="Email"
                type="email"
                value={draft.footer.email}
                onChange={(value) => updateDraft((content) => { content.footer.email = value; })}
                maxLength={fieldLimits.contact}
                error={errorsByPath["footer.email"]}
              />
            </div>
            <Textarea
              label="Address"
              value={draft.footer.address}
              onChange={(value) => updateDraft((content) => { content.footer.address = value; })}
              maxLength={fieldLimits.contact}
              rows={2}
              error={errorsByPath["footer.address"]}
            />
            <div className="admin-grid admin-grid--two">
              <TextInput
                label="Newsletter title"
                value={draft.footer.newsletterTitle}
                onChange={(value) =>
                  updateDraft((content) => { content.footer.newsletterTitle = value; })
                }
                maxLength={fieldLimits.navLabel}
                error={errorsByPath["footer.newsletterTitle"]}
              />
              <TextInput
                label="Newsletter placeholder"
                value={draft.footer.newsletterPlaceholder}
                onChange={(value) =>
                  updateDraft((content) => { content.footer.newsletterPlaceholder = value; })
                }
                maxLength={fieldLimits.placeholder}
                error={errorsByPath["footer.newsletterPlaceholder"]}
              />
            </div>
            <Textarea
              label="Newsletter copy"
              value={draft.footer.newsletterCopy}
              onChange={(value) =>
                updateDraft((content) => { content.footer.newsletterCopy = value; })
              }
              maxLength={fieldLimits.newsletterCopy}
              rows={3}
              error={errorsByPath["footer.newsletterCopy"]}
            />
            <LinksEditor
              title="Explore links"
              links={draft.footer.exploreLinks}
              min={1}
              max={8}
              errorsByPath={errorsByPath}
              path="footer.exploreLinks"
              onChange={(links) => updateDraft((content) => { content.footer.exploreLinks = links; })}
            />
            <LinksEditor
              title="Social links"
              links={draft.footer.socialLinks}
              min={0}
              max={4}
              errorsByPath={errorsByPath}
              path="footer.socialLinks"
              onChange={(links) => updateDraft((content) => { content.footer.socialLinks = links; })}
            />
            <LinksEditor
              title="Legal links"
              links={draft.footer.legalLinks}
              min={1}
              max={4}
              errorsByPath={errorsByPath}
              path="footer.legalLinks"
              onChange={(links) => updateDraft((content) => { content.footer.legalLinks = links; })}
            />
          </EditorPanel>
          )}
          </fieldset>
        </section>

        <aside className="admin-preview" aria-label={`Live ${previewRouteLabel} preview`}>
          <div className="admin-preview__bar">
            <div>
              <Eye aria-hidden="true" />
              <span>Live preview</span>
            </div>
            <label className="sr-only" htmlFor="preview-route">Preview page</label>
            <select
              id="preview-route"
              disabled={uploadsPending > 0}
              value={previewRoute}
              onChange={(event) => handlePreviewRouteChange(event.target.value as PreviewRoute)}
            >
              {availablePreviewRoutes.map((route) => (
                <option key={route.value} value={route.value}>
                  {route.label}
                </option>
              ))}
            </select>
            <div className="admin-preview__devices" aria-label="Preview device" role="group">
              {previewDevices.map((device) => {
                const Icon = device.icon;
                return (
                <button
                  key={device.id}
                  type="button"
                  aria-pressed={previewDevice === device.id}
                  onClick={() => setPreviewDevice(device.id)}
                >
                  <Icon aria-hidden="true" />
                  {device.label}
                </button>
                );
              })}
            </div>
            <button type="button" className="admin-preview__refresh" onClick={() => setPreviewKey((key) => key + 1)}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
            <a className="admin-preview__open" href={previewRoute} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Open
            </a>
          </div>
          <div className="admin-preview__editbar">
            <div role="group" aria-label="Preview interaction mode"><button type="button" aria-pressed={inlineEdit} onClick={() => setInlineEdit(true)}>Click to edit</button><button type="button" aria-pressed={!inlineEdit} onClick={() => setInlineEdit(false)}>Browse website</button></div>
            <span>{inlineEdit ? "Click text to type · Enter to apply · click images to replace" : "Follow links and try the galleries. Switch back to edit text."}</span>
            {previewRoute === "/" && <label>Jump to section<select aria-label="Jump to homepage section" value={scrollSection} onChange={(event) => setScrollSection(event.target.value)}><option value="">Choose a section</option><option value="home">Homepage hero</option><option value="legacy">Our Legacy</option><option value="developments">Our developments</option><option value="land-wanted">Land wanted</option><option value="contact">Footer</option></select></label>}
          </div>
          <div className="admin-preview__url">
            <span>{previewRoute}</span>
            <span>{previewDeviceConfig.width} x {previewDeviceConfig.height}</span>
          </div>
          <PreviewFrame
            content={draft}
            editMode={inlineEdit && !busy && uploadsPending === 0}
            scrollSection={scrollSection}
            onEdit={(path, value) => { updateDraft((next) => { applyTextEdit(next, path, value); }); setStatus("Preview text updated in your draft. Save or publish when ready."); }}
            onSelect={(selection) => {
              if (busy || uploadsPending) return;
              if (selection.kind === "text") { setTextSelection({ path: selection.path, value: selection.value ?? "" }); }
              else {
                if (/^imageOverrides\.[a-zA-Z0-9_-]{1,160}$/.test(selection.path) && !["__proto__", "constructor", "prototype"].includes(selection.path.slice(15)) && !readField(draft, selection.path) && selection.src && !selection.src.startsWith("data:")) {
                  updateDraft((next) => { next.imageOverrides ??= {}; next.imageOverrides[selection.path.slice(15)] = { src: selection.src!, alt: selection.alt || "Website image", focalPoint: "50% 50%" }; });
                }
                setTextSelection(null); setImageSelection(selection.path); setActivePanel("images");
              }
            }}
            device={previewDeviceConfig}
            refreshKey={previewKey}
            route={previewRoute}
            title={`Live ${previewRouteLabel} ${previewDeviceConfig.label} preview`}
          />
        </aside>
        <div className="studio-draftbar" aria-label="Website draft actions" role="region">
          <span>{uploadsPending ? "Uploading photographs…" : unsaved ? "Changes ready to save" : "Draft saved"}<small>Publish when you are ready to update the live website.</small></span>
              <button type="button" className="admin-ghost" onClick={saveDraft} disabled={!unsaved || !validation.valid || busy || uploadsPending > 0 || checkingStorage || storageUnavailable}><Save aria-hidden="true" />Save draft</button>
              <button
                type="button"
                className="admin-save"
                onClick={publish}
                disabled={!validation.valid || busy || uploadsPending > 0 || checkingStorage || storageUnavailable}
              >
                <Save aria-hidden="true" />
                {busy ? "Working" : "Publish"}
              </button>

        </div>
      </main>
      )}
      {activeRootTab === "sites" && (
      <main className="admin-root-main" id="admin-root-panel-sites" role="tabpanel">
        <AdminSitesPanel />
      </main>
      )}
      {activeRootTab === "mailing" && (
      <main className="admin-root-main" id="admin-root-panel-mailing" role="tabpanel">
        <AdminMailingPanel selectedSiteId={selectedMailingSiteId} />
      </main>
      )}
      {activeRootTab === "analytics" && (
      <main className="admin-root-main" id="admin-root-panel-analytics" role="tabpanel">
        <AdminAnalyticsPanel />
      </main>
      )}
      {activeRootTab === "backup" && (
      <main className="admin-root-main" id="admin-root-panel-backup" role="tabpanel">
          <AdminBackupPanel onImported={async () => {
            const restored = serverMode ? (await fetchCmsDraft()).draft : JSON.parse(localStorage.getItem(websiteDraftKey) ?? "null");
            if (restored) { const content = normalizeSiteContent(restored); setDraft(content); setSavedDraft(JSON.stringify(content)); }
            window.dispatchEvent(new Event("kingsvale-content-updated"));
            setStatus("Imported website draft loaded. Review your images before editing further.");
          }} />
      </main>
      )}
      {activeRootTab === "settings" && (
      <main className="admin-root-main" id="admin-root-panel-settings" role="tabpanel">
        <AdminSettingsPanel />
      </main>
      )}
    </div>
    </ImageUploadContext.Provider>
  );
}

function PreviewFrame({
  content, editMode, scrollSection, onEdit, onSelect,
  device,
  refreshKey,
  route,
  title
}: {
  content: SiteContent;
  editMode: boolean;
  scrollSection: string;
  onEdit: (path: string, value: string) => void;
  onSelect: (selection: { kind: "text" | "image"; path: string; value?: string; src?: string; alt?: string }) => void;
  device: PreviewDeviceConfig;
  refreshKey: number;
  route: PreviewRoute;
  title: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const previewUrl = buildStudioPreviewUrl(route, refreshKey);
  const callbacks = useRef({ onEdit, onSelect }); callbacks.current = { onEdit, onSelect };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === previewReadyMessage) {
        iframeRef.current?.contentWindow?.postMessage({ type: previewModeMessage, enabled: editMode }, window.location.origin);
        if (scrollSection) iframeRef.current?.contentWindow?.postMessage({ type: previewScrollMessage, id: scrollSection }, window.location.origin);
        return;
      }
      if (!editMode) return;
      if (typeof data?.path !== "string" || data.path.length > 200) return;
      if (data.type === previewEditMessage && typeof data.value === "string") callbacks.current.onEdit(data.path, data.value);
      if (data.type === previewSelectMessage && ["image", "text"].includes(data.kind)) callbacks.current.onSelect(data);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [editMode, scrollSection]);
  useEffect(() => { iframeRef.current?.contentWindow?.postMessage({ type: previewModeMessage, enabled: editMode }, window.location.origin); }, [editMode]);
  useEffect(() => { if (scrollSection) iframeRef.current?.contentWindow?.postMessage({ type: previewScrollMessage, id: scrollSection }, window.location.origin); }, [scrollSection, route]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const updateScale = () => {
      const availableWidth = Math.max(280, stage.clientWidth - 32);
      setScale(Math.min(1, Number((availableWidth / device.width).toFixed(3))));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScale);
    observer?.observe(stage);
    return () => {
      window.removeEventListener("resize", updateScale);
      observer?.disconnect();
    };
  }, [device.width]);

  useEffect(() => {
    sendPreviewContent();
  }, [content]);

  function sendPreviewContent() {
    saveStudioPreviewContent(content);
    iframeRef.current?.contentWindow?.postMessage(
      { type: studioPreviewMessageType, content },
      window.location.origin
    );
  }

  const shellStyle = {
    width: `${device.width * scale}px`,
    height: `${device.height * scale}px`,
    "--preview-width": `${device.width}px`,
    "--preview-height": `${device.height}px`,
    "--preview-scale": scale
  } as CSSProperties;

  return (
    <div className="admin-preview__stage" ref={stageRef}>
      <div className="admin-preview__device-shell" style={shellStyle}>
        <iframe
          ref={iframeRef}
          className="admin-preview__frame"
          title={title}
          src={previewUrl}
          onLoad={() => { sendPreviewContent(); iframeRef.current?.contentWindow?.postMessage({ type: previewModeMessage, enabled: editMode }, window.location.origin); if (scrollSection) iframeRef.current?.contentWindow?.postMessage({ type: previewScrollMessage, id: scrollSection }, window.location.origin); }}
        />
      </div>
    </div>
  );
}

function EditorPanel({
  title,
  id,
  children
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel" id={id} role="tabpanel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function FeatureEditor({
  feature,
  index,
  canMoveUp,
  canMoveDown,
  errorsByPath,
  onChange,
  onMove
}: {
  feature: FeatureItem;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  errorsByPath: Record<string, string>;
  onChange: (feature: FeatureItem) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <article className="admin-subcard">
      <CardControls
        title={`Feature ${index + 1}`}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMove}
      />
      <SelectField
        id={`feature-icon-${index}`}
        label="Icon"
        value={feature.icon}
        options={iconOptions.map((option) => [option.value, option.label] as const)}
        onChange={(value) => onChange({ ...feature, icon: value as IconKey })}
      />
      <TextInput
        label={`Feature ${index + 1} title`}
        value={feature.title}
        onChange={(value) => onChange({ ...feature, title: value })}
        maxLength={fieldLimits.featureTitle}
        error={errorsByPath[`features.${index}.title`]}
      />
      <Textarea
        label={`Feature ${index + 1} description`}
        value={feature.description}
        onChange={(value) => onChange({ ...feature, description: value })}
        maxLength={fieldLimits.featureDescription}
        rows={2}
        error={errorsByPath[`features.${index}.description`]}
      />
    </article>
  );
}

function StaticPageEditor({
  title,
  id,
  content,
  onChange,
  compact = false
}: {
  title: string;
  id?: string;
  content: SiteContent["pages"]["designBuild"];
  onChange: (content: SiteContent["pages"]["designBuild"]) => void;
  compact?: boolean;
}) {
  return (
    <EditorPanel title={title} id={id}>
      <TextInput
        label="Page eyebrow"
        value={content.eyebrow}
        onChange={(value) => onChange({ ...content, eyebrow: value })}
        maxLength={fieldLimits.eyebrow}
      />
      <Textarea
        label="Page title"
        value={content.title}
        onChange={(value) => onChange({ ...content, title: value })}
        maxLength={fieldLimits.sectionTitle}
        rows={2}
      />
      <Textarea
        label="Page body"
        value={content.body}
        onChange={(value) => onChange({ ...content, body: value })}
        maxLength={fieldLimits.body}
        rows={4}
      />
      <ImageEditor
        title={`${title} hero image`}
        image={content.image}
        onChange={(image) => onChange({ ...content, image })}
      />
      {!compact && (
        <>
          <div className="admin-grid admin-grid--two">
            <TextInput
              label="Section eyebrow"
              value={content.sectionEyebrow}
              onChange={(value) => onChange({ ...content, sectionEyebrow: value })}
              maxLength={fieldLimits.eyebrow}
            />
            <TextInput
              label="Section title"
              value={content.sectionTitle}
              onChange={(value) => onChange({ ...content, sectionTitle: value })}
              maxLength={fieldLimits.sectionTitle}
            />
          </div>
          <div className="admin-stack">
            {content.sectionItems.map((item, index) => (
              <FeatureEditor
                key={item.id}
                feature={item}
                index={index}
                canMoveUp={index > 0}
                canMoveDown={index < content.sectionItems.length - 1}
                errorsByPath={{}}
                onMove={(direction) =>
                  onChange({ ...content, sectionItems: moveItem(content.sectionItems, index, direction) })
                }
                onChange={(nextItem) =>
                  onChange({ ...content, sectionItems: replaceItem(content.sectionItems, index, nextItem) })
                }
              />
            ))}
          </div>
          <Textarea
            label="Callout title"
            value={content.calloutTitle}
            onChange={(value) => onChange({ ...content, calloutTitle: value })}
            maxLength={fieldLimits.sectionTitle}
            rows={2}
          />
          <Textarea
            label="Callout body"
            value={content.calloutBody}
            onChange={(value) => onChange({ ...content, calloutBody: value })}
            maxLength={fieldLimits.body}
            rows={4}
          />
        </>
      )}
    </EditorPanel>
  );
}

function SeoEditor({
  title,
  value,
  onChange
}: {
  title: string;
  value: SeoContent;
  onChange: (value: SeoContent) => void;
}) {
  return (
    <article className="admin-subcard">
      <h3>{title}</h3>
      <TextInput
        label={`${title} SEO title`}
        value={value.title}
        onChange={(next) => onChange({ ...value, title: next })}
        maxLength={70}
      />
      <Textarea
        label={`${title} meta description`}
        value={value.description}
        onChange={(next) => onChange({ ...value, description: next })}
        maxLength={160}
        rows={3}
      />
      <ImageEditor
        title={`${title} social preview image`}
        image={value.image}
        onChange={(image) => onChange({ ...value, image })}
      />
    </article>
  );
}

function EditorialEditor({
  title,
  id,
  content,
  path,
  errorsByPath,
  onChange
}: {
  title: string;
  id?: string;
  content: SiteContent["about"];
  path: "about";
  errorsByPath: Record<string, string>;
  onChange: (content: SiteContent["about"]) => void;
}) {
  return (
    <EditorPanel title={title} id={id}>
      <TextInput
        label="Eyebrow"
        value={content.eyebrow}
        onChange={(value) => onChange({ ...content, eyebrow: value })}
        maxLength={fieldLimits.eyebrow}
        error={errorsByPath[`${path}.eyebrow`]}
      />
      <Textarea
        label="Title"
        value={content.title}
        onChange={(value) => onChange({ ...content, title: value })}
        maxLength={fieldLimits.sectionTitle}
        rows={2}
        error={errorsByPath[`${path}.title`]}
      />
      <Textarea
        label="Body copy"
        value={content.body}
        onChange={(value) => onChange({ ...content, body: value })}
        maxLength={fieldLimits.body}
        rows={5}
        error={errorsByPath[`${path}.body`]}
      />
      <div className="admin-grid admin-grid--two">
        <TextInput
          label="CTA label"
          value={content.ctaLabel}
          onChange={(value) => onChange({ ...content, ctaLabel: value })}
          maxLength={fieldLimits.ctaLabel}
          error={errorsByPath[`${path}.ctaLabel`]}
        />
        <TextInput
          label="CTA link"
          value={content.ctaHref}
          onChange={(value) => onChange({ ...content, ctaHref: value })}
          maxLength={120}
          error={errorsByPath[`${path}.ctaHref`]}
        />
      </div>
      <ImageEditor
        title={`${title} image`}
        image={content.image}
        error={errorsByPath[`${path}.image.src`] || errorsByPath[`${path}.image.alt`]}
        onChange={(image) => onChange({ ...content, image })}
      />
    </EditorPanel>
  );
}

function LandWantedEditor({
  id,
  content,
  errorsByPath,
  onChange
}: {
  id?: string;
  content: SiteContent["landWanted"];
  errorsByPath: Record<string, string>;
  onChange: (content: SiteContent["landWanted"]) => void;
}) {
  return (
    <EditorPanel title="Land wanted CTA" id={id}>
      <TextInput
        label="Eyebrow"
        value={content.eyebrow}
        onChange={(value) => onChange({ ...content, eyebrow: value })}
        maxLength={fieldLimits.eyebrow}
        error={errorsByPath["landWanted.eyebrow"]}
      />
      <Textarea
        label="Title"
        value={content.title}
        onChange={(value) => onChange({ ...content, title: value })}
        maxLength={fieldLimits.sectionTitle}
        rows={2}
        error={errorsByPath["landWanted.title"]}
      />
      <Textarea
        label="Body copy"
        value={content.body}
        onChange={(value) => onChange({ ...content, body: value })}
        maxLength={fieldLimits.body}
        rows={4}
        error={errorsByPath["landWanted.body"]}
      />
      <div className="admin-grid admin-grid--two">
        <TextInput
          label="CTA label"
          value={content.ctaLabel}
          onChange={(value) => onChange({ ...content, ctaLabel: value })}
          maxLength={fieldLimits.ctaLabel}
          error={errorsByPath["landWanted.ctaLabel"]}
        />
        <TextInput
          label="CTA link"
          value={content.ctaHref}
          onChange={(value) => onChange({ ...content, ctaHref: value })}
          maxLength={120}
          error={errorsByPath["landWanted.ctaHref"]}
        />
      </div>
      <ImageEditor
        title="Land wanted image"
        image={content.image}
        error={errorsByPath["landWanted.image.src"] || errorsByPath["landWanted.image.alt"]}
        onChange={(image) => onChange({ ...content, image })}
      />
    </EditorPanel>
  );
}

function DevelopmentEditor({
  development,
  index,
  canMoveUp,
  canMoveDown,
  canRemove,
  errorsByPath,
  onChange,
  onMove,
  onRemove
}: {
  development: Development;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  errorsByPath: Record<string, string>;
  onChange: (development: Development) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <article className="admin-subcard">
      <CardControls
        title={`Development ${index + 1}`}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMove}
        onRemove={canRemove ? onRemove : undefined}
      />
      {canRemove && <button type="button" className="admin-small" onClick={onRemove}><Trash2 aria-hidden="true" />Remove project</button>}
      <div className="admin-grid admin-grid--two">
        <TextInput
          label={`Development ${index + 1} title`}
          value={development.title}
          onChange={(value) => onChange({ ...development, title: value })}
          maxLength={fieldLimits.developmentTitle}
          error={errorsByPath[`developments.${index}.title`]}
        />
        <TextInput
          label={`Development ${index + 1} location`}
          value={development.location}
          onChange={(value) => onChange({ ...development, location: value })}
          maxLength={fieldLimits.developmentLocation}
          error={errorsByPath[`developments.${index}.location`]}
        />
      </div>
      <Textarea
        label={`Development ${index + 1} description`}
        value={development.description}
        onChange={(value) => onChange({ ...development, description: value })}
        maxLength={fieldLimits.developmentDescription}
        rows={3}
        error={errorsByPath[`developments.${index}.description`]}
      />
      <div className="admin-grid admin-grid--two">
        <TextInput
          label={`Development ${index + 1} CTA label`}
          value={development.ctaLabel}
          onChange={(value) => onChange({ ...development, ctaLabel: value })}
          maxLength={fieldLimits.ctaLabel}
          error={errorsByPath[`developments.${index}.ctaLabel`]}
        />
        <TextInput
          label="Project page address"
          value={development.ctaHref}
          onChange={(value) => onChange({ ...development, ctaHref: value })}
          maxLength={120}
          error={errorsByPath[`developments.${index}.ctaHref`]}
        />
      </div>
      <p className="admin-note">Use /developments/ followed by your project name. The homepage and project list will use this address.</p>
      <button type="button" className="admin-small" onClick={() => onChange({ ...development, ctaHref: `/developments/${development.title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || development.id}` })}>Use project name for page address</button>
      <ImageEditor
        title={`Development ${index + 1} image`}
        image={development.image}
        error={
          errorsByPath[`developments.${index}.image.src`] ||
          errorsByPath[`developments.${index}.image.alt`]
        }
        onChange={(image) => onChange({ ...development, image })}
      />
      <details className="studio-image__details"><summary>Project details & page text</summary>
        <div className="admin-grid admin-grid--two">
          {(["status"] as const).map((field) => <TextInput key={field} label={`Project ${field}`} value={development[field] ?? ""} maxLength={120} onChange={(value) => onChange({ ...development, [field]: value })} />)}
        </div>
        <Textarea label="Project page introduction" value={development.heroBody ?? development.description} maxLength={600} onChange={(heroBody) => onChange({ ...development, heroBody })} />
        <Textarea label="Project highlights (one per line)" value={(development.highlights ?? []).join("\n")} maxLength={1800} onChange={(value) => onChange({ ...development, highlights: value.split("\n") })} />
      </details>
      <ProjectGallery title={development.title} images={development.gallery ?? []} onChange={(gallery) => onChange({ ...development, gallery })} />
    </article>
  );
}

function LinksEditor({
  title,
  links,
  min,
  max,
  path,
  errorsByPath,
  onChange
}: {
  title: string;
  links: NavLink[];
  min: number;
  max: number;
  path: string;
  errorsByPath: Record<string, string>;
  onChange: (links: NavLink[]) => void;
}) {
  return (
    <div className="links-editor">
      <div className="admin-section-heading">
        <h3>{title}</h3>
        <button
          type="button"
          className="admin-small"
          disabled={links.length >= max}
          onClick={() => onChange([...links, { ...emptyLink }])}
        >
          <Plus aria-hidden="true" />
          Add
        </button>
      </div>
      <div className="admin-stack">
        {links.map((link, index) => (
          <article className="admin-link-row" key={`${link.label}-${index}`}>
            <CardControls
              title={`${title} ${index + 1}`}
              canMoveUp={index > 0}
              canMoveDown={index < links.length - 1}
              onMove={(direction) => onChange(moveItem(links, index, direction))}
              onRemove={links.length > min ? () => onChange(links.filter((_, itemIndex) => itemIndex !== index)) : undefined}
              compact
            />
            <TextInput
              label={`${title} ${index + 1} label`}
              value={link.label}
              onChange={(value) =>
                onChange(replaceItem(links, index, { ...link, label: value }))
              }
              maxLength={fieldLimits.navLabel}
              error={errorsByPath[`${path}.${index}.label`]}
            />
            <TextInput
              label={`${title} ${index + 1} link`}
              value={link.href}
              onChange={(value) =>
                onChange(replaceItem(links, index, { ...link, href: value }))
              }
              maxLength={160}
              error={errorsByPath[`${path}.${index}.href`]}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function CardControls({
  title,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  compact = false
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "card-controls card-controls--compact" : "card-controls"}>
      <h3>{title}</h3>
      <div>
        <button
          type="button"
          aria-label={`Move ${title} up`}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ChevronUp aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${title} down`}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ChevronDown aria-hidden="true" />
        </button>
        {onRemove && (
          <button type="button" aria-label={`Remove ${title}`} onClick={onRemove}>
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const next = [...items];
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return next;
  }

  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

function replaceItem<T>(items: T[], index: number, item: T) {
  return items.map((current, itemIndex) => (itemIndex === index ? item : current));
}

function createDevelopment(): Development {
  const id = `project-${crypto.randomUUID().slice(0, 8)}`;
  return {
    ...cloneContent(defaultContent).developments[0],
    id,
    title: "New project",
    gallery: [],
    priceGuide: "", homes: "", bedrooms: "",
    status: "",
    highlights: [],
    heroBody: "Tell visitors about this project.",
    location: "Hampshire",
    description: "A refined collection of homes in a carefully chosen setting.",
    ctaHref: `/developments/${id}`
  };
}

function toErrorMap(errors: ValidationError[]) {
  return errors.reduce<Record<string, string>>((map, error) => {
    map[error.path] = error.message;
    return map;
  }, {});
}
