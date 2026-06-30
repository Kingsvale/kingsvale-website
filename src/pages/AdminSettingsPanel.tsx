import { ExternalLink, FileText, Plus, Save, Settings, Sheet, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AdminSelectField as SelectField,
  AdminTextInput as TextInput
} from "../components/AdminFields";
import { fetchStudioSettings, saveStudioSettings, uploadLetterFile } from "../lib/cmsApi";
import {
  boundedReminderDays,
  createLetterPresetId,
  defaultStudioSettings,
  type StudioSettings
} from "../lib/studioSettings";
import {
  contactPriorityLabels,
  type ContactPriority
} from "../lib/trackingTypes";

const contactPriorities = Object.keys(contactPriorityLabels) as ContactPriority[];

export function AdminSettingsPanel() {
  const [settings, setSettings] = useState<StudioSettings>(() => defaultStudioSettings());
  const [presetName, setPresetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Manage reusable Studio defaults.");
  const sortedPresets = useMemo(
    () => [...settings.letterPresets].sort((left, right) => left.name.localeCompare(right.name)),
    [settings.letterPresets]
  );

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchStudioSettings();
        if (active) {
          setSettings(loaded);
          setStatus("Studio settings loaded.");
        }
      } catch {
        if (active) {
          setStatus("Settings API is unavailable.");
        }
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  function updateSettings(recipe: (draft: StudioSettings) => void) {
    setSettings((current) => {
      const next = structuredClone(current);
      recipe(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }

  async function handlePresetUpload(files: FileList | null) {
    const file = files?.[0];
    const name = presetName.trim();
    if (!file) {
      return;
    }
    if (!name) {
      setStatus("Name the preset before uploading the DOCX.");
      return;
    }
    if (!isAllowedLetterTemplateFile(file)) {
      setStatus("Preset template must be a DOCX Word document under 8MB.");
      return;
    }

    setBusy(true);
    try {
      const upload = await uploadLetterFile(file);
      if (!upload) {
        setStatus("Preset template could not be uploaded.");
        return;
      }

      updateSettings((draft) => {
        draft.letterPresets.unshift({
          id: createLetterPresetId(),
          name,
          templateName: upload.name,
          templateUrl: upload.url,
          recipientMode: "legal-owner",
          createdAt: new Date().toISOString()
        });
      });
      setPresetName("");
      setStatus("Preset uploaded. Save settings to keep it.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePresetReplacement(presetId: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    if (!isAllowedLetterTemplateFile(file)) {
      setStatus("Preset template must be a DOCX Word document under 8MB.");
      return;
    }

    setBusy(true);
    try {
      const upload = await uploadLetterFile(file);
      if (!upload) {
        setStatus("Preset template could not be replaced.");
        return;
      }

      updateSettings((draft) => {
        const preset = draft.letterPresets.find((item) => item.id === presetId);
        if (preset) {
          preset.templateName = upload.name;
          preset.templateUrl = upload.url;
        }
      });
      setStatus("Preset template replaced. Save settings to keep it.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    try {
      const saved = await saveStudioSettings(settings);
      setSettings(saved);
      setStatus("Studio settings saved.");
    } catch {
      setStatus("Studio settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-admin" aria-label="Studio settings">
      <div className="sites-admin__toolbar">
        <div className="admin-status sites-admin__status" role="status">
          <Settings aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button type="button" className="admin-save" onClick={handleSave} disabled={busy}>
          <Save aria-hidden="true" />
          {busy ? "Working" : "Save settings"}
        </button>
      </div>

      <div className="settings-grid">
        <section className="admin-panel" aria-labelledby="settings-letter-presets-title">
          <div className="admin-section-heading">
            <h2 id="settings-letter-presets-title">Letter presets</h2>
          </div>
          <div className="settings-preset-form">
            <TextInput
              id="letter-preset-name"
              label="Preset name"
              value={presetName}
              maxLength={80}
              onChange={setPresetName}
            />
            <label className="admin-small settings-upload">
              <Plus aria-hidden="true" />
              Upload DOCX
              <input
                className="sr-only"
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => void handlePresetUpload(event.target.files)}
              />
            </label>
          </div>
          <div className="settings-presets">
            {sortedPresets.length === 0 ? (
              <p className="admin-panel__note">No letter presets have been uploaded yet.</p>
            ) : (
              sortedPresets.map((preset) => (
                <article className="settings-preset" key={preset.id}>
                  <FileText aria-hidden="true" />
                  <div className="settings-preset__content">
                    <TextInput
                      label="Preset name"
                      value={preset.name}
                      maxLength={80}
                      onChange={(value) =>
                        updateSettings((draft) => {
                          const target = draft.letterPresets.find((item) => item.id === preset.id);
                          if (target) {
                            target.name = value;
                          }
                        })
                      }
                    />
                    <small>{preset.templateName}</small>
                  </div>
                  <label className="admin-small settings-upload">
                    <Plus aria-hidden="true" />
                    Replace DOCX
                    <input
                      className="sr-only"
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => void handlePresetReplacement(preset.id, event.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-danger"
                    aria-label={`Delete ${preset.name} preset`}
                    onClick={() =>
                      updateSettings((draft) => {
                        draft.letterPresets = draft.letterPresets.filter((item) => item.id !== preset.id);
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="settings-defaults-title">
          <div className="admin-section-heading">
            <h2 id="settings-defaults-title">Mailing defaults</h2>
          </div>
          <label className="admin-field" htmlFor="settings-default-reminder-days">
            <span className="admin-field__label">Default re-mail reminder days</span>
            <input
              id="settings-default-reminder-days"
              type="number"
              min="1"
              max="120"
              value={settings.defaultReminderDays}
              onChange={(event) =>
                updateSettings((draft) => {
                  draft.defaultReminderDays = boundedReminderDays(Number(event.target.value));
                })
              }
            />
          </label>
          <SelectField
            id="settings-default-contact-priority"
            label="Default contact priority"
            value={settings.defaultContactPriority}
            onChange={(value) =>
              updateSettings((draft) => {
                draft.defaultContactPriority = value as ContactPriority;
              })
            }
            options={contactPriorities.map((priority) => [priority, contactPriorityLabels[priority]] as const)}
          />
        </section>

        <section className="admin-panel" aria-labelledby="settings-google-sheet-title">
          <div className="admin-section-heading">
            <h2 id="settings-google-sheet-title">Google Sheet</h2>
          </div>
          <p className="admin-panel__note">
            Attach a Google Sheet for the letter reference log. Each saved Site is upserted by Site ID so repeat saves
            update the same row.
          </p>
          <label className="sites-admin__toggle">
            <input
              type="checkbox"
              checked={settings.googleSheet.enabled}
              onChange={(event) =>
                updateSettings((draft) => {
                  draft.googleSheet.enabled = event.target.checked;
                })
              }
            />
            <span>Sync saved Sites to Google Sheets</span>
          </label>
          <TextInput
            id="settings-google-spreadsheet-id"
            label="Spreadsheet ID"
            value={settings.googleSheet.spreadsheetId}
            maxLength={160}
            onChange={(value) =>
              updateSettings((draft) => {
                draft.googleSheet.spreadsheetId = value;
              })
            }
          />
          <TextInput
            id="settings-google-sheet-name"
            label="Sheet tab name"
            value={settings.googleSheet.sheetName}
            maxLength={80}
            onChange={(value) =>
              updateSettings((draft) => {
                draft.googleSheet.sheetName = value;
              })
            }
          />
          <div className="tracking-storage-banner tracking-storage-banner--server" role="note">
            <Sheet aria-hidden="true" />
            <div>
              <strong>Server credentials stay outside Studio.</strong>
              <span>
                Set a Google service account in environment variables, then share the spreadsheet with that service
                account email.
              </span>
            </div>
          </div>
          {settings.googleSheet.spreadsheetId ? (
            <a
              className="admin-open"
              href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(settings.googleSheet.spreadsheetId)}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Open configured sheet
            </a>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function isAllowedLetterTemplateFile(file: File) {
  return file.size <= 8_000_000 && (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  );
}
