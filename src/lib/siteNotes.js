export const siteNotesMaxLength = 3000;

// privateNotes is the shared note; mailingNotes remains a compatible alias for
// existing records and backups. Merge distinct legacy notes without truncation.
export function sharedSiteNotes(site, previous) {
  const privateNotes = site.privateNotes ?? "";
  const mailingNotes = site.mailingNotes ?? "";
  if (typeof privateNotes !== "string" || typeof mailingNotes !== "string") {
    return { privateNotes, mailingNotes };
  }

  let notes;
  if (previous && privateNotes !== previous.privateNotes && mailingNotes === previous.mailingNotes) {
    notes = privateNotes;
  } else if (previous && mailingNotes !== previous.mailingNotes && privateNotes === previous.privateNotes) {
    notes = mailingNotes;
  } else if (!privateNotes.trim()) {
    notes = mailingNotes;
  } else if (!mailingNotes.trim() || privateNotes === mailingNotes) {
    notes = privateNotes;
  } else {
    notes = `${privateNotes}\n\n${mailingNotes}`;
  }
  return { privateNotes: notes, mailingNotes: notes };
}
