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

## Free property suggestions

**Postcode to search** immediately shows matching addresses already saved in
Studio. **Find addresses** additionally queries OpenStreetMap through an
authenticated server endpoint. Choose a suggestion and click **Use this address**,
then check and complete the fields. This fills the site address used in letters;
it does not change the separately entered owner postal address or contact name.

No account, paid API key or billing configuration is used. OpenStreetMap coverage
is incomplete, and many UK postcodes have no mapped property addresses. This is
not an exhaustive Royal Mail address lookup. In a live source check on 15 September
2026, SL4 5HS returned no usable mapped property addresses; saved Studio records
at that postcode remain available. Do not manufacture house numbers, infer every
property from a range, or interpret missing results as an absence of properties.

Only the postcode is sent to the external service, not owner names, notes or
contact details. Searches are user-triggered, limited to one at a time with a
three-second gap, and cached in memory for 24 hours (maximum 200 postcodes).
Requests time out after 15 seconds and return at most 200 mapped elements.
On failure, manual entry and saved-address suggestions remain available.

Source: [OpenStreetMap / ODbL](https://www.openstreetmap.org/copyright), accessed
using the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).
