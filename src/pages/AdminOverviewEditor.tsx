import { AdminTextarea, AdminTextInput } from "../components/AdminFields";
import { overviewCopy, overviewKeys } from "../data/developmentsOverview";
import type { SiteContent } from "../lib/contentTypes";
import { applyTextEdit } from "../lib/siteEditing";
export function AdminOverviewEditor({ content, updateContent, onClose }: { content: SiteContent; updateContent: (recipe: (content: SiteContent) => void) => void; onClose: () => void }) {
  const labels = { eyebrow: "Overview eyebrow", title: "Overview page heading", body: "Overview introduction", collectionEyebrow: "Collection eyebrow", collectionTitle: "Collection heading" };
  return <section className="admin-subcard overview-editor" aria-label="Developments overview editor">
    <div className="admin-section-heading"><h3>Developments overview</h3><button type="button" className="admin-small" onClick={onClose}>Done</button></div>
    <p>Edit the heading and introduction on the Our Developments page. Changes appear in the preview and are saved with your draft.</p>
    {(Object.keys(overviewCopy) as (keyof typeof overviewCopy)[]).map((field) => {
      const props = { label: labels[field], value: content.textOverrides?.[overviewKeys[field]] ?? overviewCopy[field], maxLength: field === "body" ? 1200 : 160, onChange: (value: string) => updateContent((next) => { applyTextEdit(next, `textOverrides.${overviewKeys[field]}`, value); }) };
      return field === "body" ? <AdminTextarea key={field} {...props} rows={4} /> : <AdminTextInput key={field} {...props} />;
    })}
  </section>;
}
