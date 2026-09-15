import { ChevronDown, ChevronRight, Folder, FolderInput } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { contactPriorityLabels, mailingStatusLabels, type TrackingSite } from "../lib/trackingTypes";
import { isRemailReminderOverdue, mailingStatusClass, priorityClass } from "../lib/trackingStorage";

export const siteFolder = (site: TrackingSite) => site.region.trim() || "Uncategorised";
export function folderNames(sites: TrackingSite[]) {
  return [...new Map(sites.map((site) => [siteFolder(site).toLowerCase(), siteFolder(site)])).values()].sort((a, b) => a.localeCompare(b));
}

export function SiteFolderField({ value, sites, onChange }: { value: string; sites: TrackingSite[]; onChange: (value: string) => void }) {
  const id = useId();
  return <label className="admin-field" htmlFor={id}>
    <span className="admin-field__label">Folder / region</span>
    <input id={id} aria-label="Folder / region" list={`${id}-folders`} value={value} maxLength={80} placeholder="Choose a folder or type a new name" onChange={(event) => onChange(event.target.value)} />
    <datalist id={`${id}-folders`}>{folderNames(sites).map((name) => <option key={name} value={name} />)}</datalist>
    <small className="admin-note">Shared between Sites and Mailing. Changing the address keeps your chosen folder.</small>
  </label>;
}

type Props = {
  sites: TrackingSite[]; allSites: TrackingSite[]; selectedId?: string; busy: boolean;
  onSelect: (site: TrackingSite) => void;
  onMove: (ids: string[], folder: string) => Promise<boolean>;
};

export function AdminSiteFolders({ sites, allSites, selectedId, busy, onSelect, onMove }: Props) {
  const id = useId();
  const [groupBy, setGroupBy] = useState("folder");
  const [folder, setFolder] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [rename, setRename] = useState("");
  const folders = folderNames(allSites);
  const filtered = sites.filter((site) => !folder || siteFolder(site).toLowerCase() === folder.toLowerCase());
  const selectedVisible = selected.filter((siteId) => filtered.some((site) => site.id === siteId));
  const groups = useMemo(() => {
    const grouped = new Map<string, { name: string; sites: TrackingSite[] }>();
    for (const site of filtered) {
      const name = groupBy === "town" ? site.siteAddressParts.town.trim() || "Town not entered"
        : groupBy === "postcode" ? site.siteAddressParts.postcode.replace(/\s/g, "").slice(0, -3).toUpperCase() || "Postcode not entered"
        : siteFolder(site);
      const key = name.toLowerCase();
      const group = grouped.get(key) ?? { name, sites: [] };
      group.sites.push(site);
      grouped.set(key, group);
    }
    return [...grouped.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [filtered, groupBy]);

  async function move(ids: string[], target: string) {
    const existing = folders.find((name) => name.toLowerCase() === target.trim().toLowerCase());
    if (await onMove(ids, existing || target.trim() || "Uncategorised")) {
      setSelected([]); setDestination(""); setRenaming(false); setFolder("");
    }
  }

  return <div className="site-library">
    <div className="site-library__filters">
      <label className="admin-field"><span className="admin-field__label">Folder</span><select aria-label="Filter by folder" value={folder} onChange={(event) => { setFolder(event.target.value); setRenaming(false); setSelected([]); }}>
        <option value="">All folders</option>{folders.map((name) => <option key={name} value={name}>{name} ({allSites.filter((site) => siteFolder(site).toLowerCase() === name.toLowerCase()).length})</option>)}
      </select></label>
      <label className="admin-field"><span className="admin-field__label">Group by</span><select aria-label="Group locations by" value={groupBy} onChange={(event) => { setGroupBy(event.target.value); setCollapsed([]); }}>
        <option value="folder">Folder / region</option><option value="town">Town / city</option><option value="postcode">Postcode district</option>
      </select></label>
    </div>
    <div className="site-library__tools">
      <span>{filtered.length} {filtered.length === 1 ? "site" : "sites"}</span>
      <button type="button" className="admin-small" onClick={() => setCollapsed(collapsed.length ? [] : groups.map(([key]) => key))}>{collapsed.length ? "Expand all" : "Collapse all"}</button>
      {folder && <button type="button" className="admin-small" disabled={busy} onClick={() => { setRenaming(!renaming); setRename(folder); }}>Rename folder</button>}
    </div>
    {renaming && <div className="site-library__move">
      <label className="admin-field"><span className="admin-field__label">New folder name</span><input aria-label="New folder name" value={rename} maxLength={80} onChange={(event) => setRename(event.target.value)} /></label>
      <p>Moves every record in {folder}, including archived sites. An existing name merges the folders.</p>
      <button type="button" className="admin-small" disabled={busy || !rename.trim() || rename.trim() === folder} onClick={() => void move(allSites.filter((site) => siteFolder(site).toLowerCase() === folder.toLowerCase()).map((site) => site.id), rename)}>Save folder name</button>
    </div>}
    {filtered.length > 0 && <label className="site-library__select-all"><input type="checkbox" disabled={busy} checked={selectedVisible.length === filtered.length} onChange={(event) => setSelected(event.target.checked ? filtered.map((site) => site.id) : [])} />Select all shown</label>}
    {selectedVisible.length > 0 && <div className="site-library__move">
      <strong>{selectedVisible.length} selected</strong>
      <label className="admin-field"><span className="admin-field__label">Move to folder</span><input aria-label="Move to folder" list={`${id}-destinations`} value={destination} maxLength={80} placeholder="Existing folder or new name" onChange={(event) => setDestination(event.target.value)} /></label>
      <datalist id={`${id}-destinations`}>{folders.map((name) => <option key={name} value={name} />)}</datalist>
      <button type="button" className="admin-small" disabled={busy || !destination.trim()} onClick={() => void move(selectedVisible, destination)}><FolderInput aria-hidden="true" />Move selected</button>
      <button type="button" className="admin-ghost" onClick={() => setSelected([])}>Clear selection</button>
    </div>}
    {!filtered.length && <p className="admin-note">{allSites.length ? "No sites match. Change the folder or search to see more." : "No map pages yet."}</p>}
    {groups.map(([key, group]) => <section className="site-library__group" key={key}>
      <button type="button" className="site-group-heading" aria-expanded={!collapsed.includes(key)} onClick={() => setCollapsed((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}>
        <Folder aria-hidden="true" /><span>{group.name}</span><span>{group.sites.length}</span>{collapsed.includes(key) ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {!collapsed.includes(key) && group.sites.map((site) => <div className="site-library__row" key={site.id}>
        <input type="checkbox" aria-label={`Select ${site.title}`} disabled={busy} checked={selectedVisible.includes(site.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, site.id] : current.filter((item) => item !== site.id))} />
        <button type="button" disabled={busy} className={site.id === selectedId ? "site-row site-row--active" : "site-row"} onClick={() => onSelect(site)}>
          <span className="site-row__title">{site.title}</span><span className="site-row__meta">{site.siteAddress}{site.reference ? ` · ${site.reference}` : ""}</span>
          <span className="site-row__badges"><span className={`priority-badge ${priorityClass(site.contactPriority)}`}>{contactPriorityLabels[site.contactPriority]}</span><span className={`mailing-status ${mailingStatusClass(site.mailingStatus)}`}>{mailingStatusLabels[site.mailingStatus]}</span>{site.archived && <span className="mailing-status">Archived</span>}</span>
          {isRemailReminderOverdue(site) && <small className="site-library__overdue">Follow-up overdue</small>}
        </button>
      </div>)}
    </section>)}
  </div>;
}
