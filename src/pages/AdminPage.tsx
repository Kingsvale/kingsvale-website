import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  LogOut,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud
} from "lucide-react";
import {
  lazy,
  Suspense,
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState
} from "react";
import { defaultContent } from "../data/defaultContent";
import { iconOptions } from "../components/IconRenderer";
import type {
  Development,
  FeatureItem,
  IconKey,
  ImageAsset,
  NavLink,
  SeoContent,
  SiteContent
} from "../lib/contentTypes";
import {
  fieldLimits,
  validateSiteContent,
  type ValidationError
} from "../lib/contentValidation";
import { readImageFile } from "../lib/imageUtils";
import {
  cloneContent,
  resetPublishedContent,
  savePublishedContent
} from "../lib/storage";
import { saveEncryptedEditorSnapshot } from "../lib/studioSecurity";
import {
  fetchCmsDraft,
  listCmsRevisions,
  publishCmsContent,
  restoreCmsRevision,
  saveCmsDraft,
  uploadCmsImage
} from "../lib/cmsApi";
import { AdminAnalyticsPanel } from "./AdminAnalyticsPanel";
import { AdminSitesPanel } from "./AdminSitesPanel";

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

type AdminRootTab = "website" | "sites" | "analytics";

const HomepagePreview = lazy(() =>
  import("./Homepage").then((module) => ({ default: module.Homepage }))
);

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  helper?: string;
  error?: string;
  type?: "text" | "url" | "email" | "tel";
  placeholder?: string;
};

const emptyLink: NavLink = { label: "New link", href: "#" };

const editorSections = [
  { id: "hero", label: "Hero" },
  { id: "brand", label: "Brand" },
  { id: "features", label: "Features" },
  { id: "design", label: "Design & Build" },
  { id: "vision", label: "Vision & Process" },
  { id: "legacy", label: "About" },
  { id: "developments", label: "Developments" },
  { id: "land", label: "Land" },
  { id: "contact", label: "Contact" },
  { id: "seo", label: "SEO" },
  { id: "footer", label: "Footer" }
] as const;

const adminRootTabs: { id: AdminRootTab; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "sites", label: "Sites" },
  { id: "analytics", label: "Analytics" }
];

type EditorSectionId = (typeof editorSections)[number]["id"];

export function AdminPage({
  publishedContent,
  studioSecret = "",
  encryptedSnapshotSummary = "Encrypted snapshot updates after publishing.",
  onLogout
}: AdminPageProps) {
  const [draft, setDraft] = useState<SiteContent>(() => cloneContent(publishedContent));
  const [status, setStatus] = useState<string>("Draft changes are visible in the preview.");
  const [activeRootTab, setActiveRootTab] = useState<AdminRootTab>("website");
  const [activePanel, setActivePanel] = useState<EditorSectionId>("hero");
  const [serverMode, setServerMode] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const validation = useMemo(() => validateSiteContent(draft), [draft]);
  const errorsByPath = useMemo(() => toErrorMap(validation.errors), [validation.errors]);
  const activePanelLabel = editorSections.find((section) => section.id === activePanel)?.label ?? "Hero";

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
          setDraft(cloneContent(payload.draft));
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
        }
      }
    }

    void loadServerDraft();
    return () => {
      active = false;
    };
  }, []);

  function updateDraft(recipe: (content: SiteContent) => void) {
    setDraft((current) => {
      const next = cloneContent(current);
      recipe(next);
      return next;
    });
  }

  async function publish() {
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
      } else {
        savePublishedContent(draft);
        await saveEncryptedEditorSnapshot(draft, studioSecret);
      }
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
      }
      window.dispatchEvent(new Event("kingsvale-content-updated"));
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
      setRevisions(await listCmsRevisions());
      setSelectedRevision("");
      window.dispatchEvent(new Event("kingsvale-content-updated"));
      setStatus("Revision restored and published.");
    } catch {
      setStatus("Revision restore failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
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
            <span>{serverMode ? "Server CMS session active" : encryptedSnapshotSummary}</span>
          </div>
          {activeRootTab === "website" && serverMode && revisions.length > 0 && (
            <details className="admin-versioning">
              <summary>Recovery</summary>
              <div className="admin-versioning__controls">
                <label className="sr-only" htmlFor="revision-select">
                  Restore revision
                </label>
                <select
                  id="revision-select"
                  value={selectedRevision}
                  onChange={(event) => setSelectedRevision(event.target.value)}
                >
                  <option value="">Revision history</option>
                  {revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      {new Date(revision.createdAt).toLocaleString()} - {revision.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="admin-ghost"
                  disabled={!selectedRevision || busy}
                  onClick={restoreSelectedRevision}
                >
                  Restore
                </button>
              </div>
            </details>
          )}
          {activeRootTab === "website" && (
            <>
              <a className="admin-open" href="/" target="_blank" rel="noreferrer">
                <Eye aria-hidden="true" />
                Open site
              </a>
              <button type="button" className="admin-ghost" onClick={resetToDefaults} disabled={busy}>
                <RotateCcw aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                className="admin-save"
                onClick={publish}
                disabled={!validation.valid || busy}
              >
                <Save aria-hidden="true" />
                {busy ? "Working" : "Publish"}
              </button>
            </>
          )}
          {onLogout && (
            <button type="button" className="admin-ghost" onClick={onLogout}>
              <LogOut aria-hidden="true" />
              Lock
            </button>
          )}
        </div>
      </header>

      {activeRootTab === "website" && (
      <main className="admin-layout" id="admin-root-panel-website" role="tabpanel">
        <section className="admin-editor" aria-label="Content editor">
          <div className="admin-status" role="status">
            {validation.valid ? <Check aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            <span><strong>{activePanelLabel}</strong> - {status}</span>
          </div>

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

          <div className="admin-tabs" role="tablist" aria-label="Editor sections">
            {editorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activePanel === section.id}
                aria-controls={`editor-panel-${section.id}`}
                onClick={() => setActivePanel(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          {activePanel === "brand" && (
          <EditorPanel title="Brand and navigation" id="editor-panel-brand">
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
          <EditorPanel title="Hero" id="editor-panel-hero">
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
          <EditorPanel title="Feature strip" id="editor-panel-features">
            <p className="admin-panel__note">
              The strip always keeps four value propositions to preserve the
              balanced editorial rhythm.
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
          <EditorPanel title="Developments" id="editor-panel-developments">
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
            <div className="admin-section-heading">
              <h3>Development cards</h3>
              <button
                type="button"
                className="admin-small"
                disabled={draft.developments.length >= 6}
                onClick={() =>
                  updateDraft((content) => {
                    content.developments.push(createDevelopment());
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add
              </button>
            </div>
            <div className="admin-stack">
              {draft.developments.map((development, index) => (
                <DevelopmentEditor
                  key={development.id}
                  development={development}
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.developments.length - 1}
                  canRemove={draft.developments.length > 1}
                  errorsByPath={errorsByPath}
                  onMove={(direction) =>
                    updateDraft((content) => {
                      content.developments = moveItem(content.developments, index, direction);
                    })
                  }
                  onRemove={() =>
                    updateDraft((content) => {
                      content.developments.splice(index, 1);
                    })
                  }
                  onChange={(nextDevelopment) =>
                    updateDraft((content) => {
                      content.developments[index] = nextDevelopment;
                    })
                  }
                />
              ))}
            </div>
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

          {activePanel === "contact" && (
          <StaticPageEditor
            title="Contact page"
            id="editor-panel-contact"
            content={draft.pages.contact}
            onChange={(next) => updateDraft((content) => { content.pages.contact = next; })}
            compact
          />
          )}

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
        </section>

        <aside className="admin-preview" aria-label="Live homepage preview">
          <div className="admin-preview__bar">
            <Eye aria-hidden="true" />
            <span>Live preview before publishing</span>
          </div>
          <div className="admin-preview__viewport">
            <Suspense fallback={<div className="route-loading" />}>
              <HomepagePreview content={draft} preview />
            </Suspense>
          </div>
        </aside>
      </main>
      )}
      {activeRootTab === "sites" && (
      <main className="admin-root-main" id="admin-root-panel-sites" role="tabpanel">
        <AdminSitesPanel />
      </main>
      )}
      {activeRootTab === "analytics" && (
      <main className="admin-root-main" id="admin-root-panel-analytics" role="tabpanel">
        <AdminAnalyticsPanel />
      </main>
      )}
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

function TextInput({
  label,
  value,
  onChange,
  maxLength,
  helper,
  error,
  type = "text",
  placeholder
}: FieldProps) {
  const generatedId = useId();
  const id = `${toId(label)}-${generatedId}`;

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
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && <span className="admin-field__helper">{helper}</span>}
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
  helper,
  error
}: FieldProps & { rows?: number }) {
  const generatedId = useId();
  const id = `${toId(label)}-${generatedId}`;

  return (
    <label className="admin-field" htmlFor={id}>
      <span className="admin-field__label">
        {label}
        <span aria-hidden="true">{value.length}/{maxLength}</span>
      </span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && <span className="admin-field__helper">{helper}</span>}
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

function ImageEditor({
  title,
  image,
  onChange,
  error
}: {
  title: string;
  image: ImageAsset;
  onChange: (image: ImageAsset) => void;
  error?: string;
}) {
  const [fileError, setFileError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const uploadedImage = await uploadCmsImage(file);
      if (uploadedImage) {
        setFileError("");
        onChange({
          ...image,
          ...uploadedImage,
          alt: image.alt || uploadedImage.alt || file.name.replace(/\.[^.]+$/, "")
        });
        return;
      }

      const dataUrl = await readImageFile(file);
      setFileError("");
      onChange({
        ...image,
        src: dataUrl,
        alt: image.alt || file.name.replace(/\.[^.]+$/, "")
      });
    } catch (caughtError) {
      setFileError(caughtError instanceof Error ? caughtError.message : "Image upload failed.");
    }
  }

  return (
    <div className="image-editor">
      <div className="image-editor__preview">
        <img src={image.src} alt={image.alt || ""} />
      </div>
      <div className="image-editor__fields">
        <h3>{title}</h3>
        <TextInput
          label={`${title} URL`}
          value={image.src}
          onChange={(value) => onChange({ ...image, src: value })}
          maxLength={9000}
          error={error}
        />
        <TextInput
          label={`${title} alt text`}
          value={image.alt}
          onChange={(value) => onChange({ ...image, alt: value })}
          maxLength={fieldLimits.imageAlt}
        />
        <label className="admin-upload">
          <UploadCloud aria-hidden="true" />
          <span>Upload replacement image</span>
          <input
            type="file"
            data-testid={`${toId(title)}-upload`}
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleFile}
          />
        </label>
        {fileError && <p className="admin-field__error">{fileError}</p>}
      </div>
    </div>
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
      <label className="admin-field" htmlFor={`feature-icon-${index}`}>
        <span className="admin-field__label">Icon</span>
        <select
          id={`feature-icon-${index}`}
          value={feature.icon}
          onChange={(event) =>
            onChange({ ...feature, icon: event.target.value as IconKey })
          }
        >
          {iconOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
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
          label={`Development ${index + 1} CTA link`}
          value={development.ctaHref}
          onChange={(value) => onChange({ ...development, ctaHref: value })}
          maxLength={120}
          error={errorsByPath[`developments.${index}.ctaHref`]}
        />
      </div>
      <ImageEditor
        title={`Development ${index + 1} image`}
        image={development.image}
        error={
          errorsByPath[`developments.${index}.image.src`] ||
          errorsByPath[`developments.${index}.image.alt`]
        }
        onChange={(image) => onChange({ ...development, image })}
      />
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
  const id = `development-${Date.now()}`;
  return {
    ...cloneContent(defaultContent).developments[0],
    id,
    title: "New development",
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

function toId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
