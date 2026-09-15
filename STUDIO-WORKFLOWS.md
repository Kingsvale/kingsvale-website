# Sites and Mailing

Complete changes save after a one-second pause in typing. The save bar reports
pending, saving, saved or failed states. Typing remains available during a save;
an older response cannot replace newer edits. Switching records or Studio tabs
flushes pending changes first. Invalid fields and failed saves keep the current
editor open. Save site / Save mailing can still be used to save immediately or
retry. Upload and letter-generation operations finish before navigation proceeds.
Closing or reloading the browser warns when work remains unsaved; don't ignore
that warning if a save failed. No contact drafts are copied to browser storage
as an offline fallback in production.

Folder names are shared by Sites and Mailing. Choose an existing name or type a
new one in **Folder / region**. The list supports folder filtering and collapsible
groups by folder, town or postcode district. Select records to move them together.
Filter by a folder and choose **Rename folder** to rename it or merge it into an
existing folder. Renaming explicitly includes archived records. Partial failures
report the number saved, and only successful records are updated in the editor.
Address edits do not replace an existing folder choice.

Enter letter addresses directly in the address fields in Sites or Mailing.

Letter generation uses saved presets from Settings, grouped into Initial and
Follow-up stages. Existing preset names containing “follow up” or “follow-up”
are classified automatically; use the Letter stage setting to change this.
New sites offer initial presets first. Successful initial generation saves its
completion date with the site. Returning to Mailing then opens the follow-up
stage. Earlier attached letters or a recorded first posting also qualify existing
records. Initial letters can still be regenerated using the stage selector.
Starter DOCX files remain in the help/download area, outside the preset dropdown.

Initial generation saves four files: the letter in Word and PDF, plus the supplied
Kingsvale C5 envelope in Word and PDF. The envelope uses the same recipient and
address as the letter; its front and return-address back retain the supplied
template design. Follow-up generation saves a fresh Word letter and PDF, keeping
the existing envelope available. The print files are saved with the site and
included in media backups and restores; their links are omitted from public map
responses. Replacing a letter removes its old PDF from the current print controls.

Use Preview to review each document, or Open PDF / Print to use the browser's PDF
viewer. Select the matching paper size and actual size, without added margins.
Envelope PDF page 1 is the front; page 2 is the return-address back. Borderless
printing depends on printer support. Existing saved Word letters offer Create PDF
for saved letter, without regenerating the letter or changing its mailing stage.
