# Studio and public website update — 17 November 2026

## First paint and public pages

The server now renders public pages using the currently published CMS content. The same content is embedded as inert JSON for React to hydrate. Visitors see the chosen photographs and text from the first HTML response; the page no longer renders the original build-time placeholders before fetching the CMS.

Published content also supplies server-rendered titles, descriptions, social images and structured data. HTML is not cached by the browser, and the server's rendered-page cache changes with the published content hash. Studio and QR routes are marked noindex. Preview routes mount independently. Public pages keep their published content if a later request fails.

The homepage hero and Land wanted photograph now request image resolution for their cover crops, improving mobile sharpness when the uploaded image includes dimensions and larger variants.

## Studio

- **Overview:** active sites, externally viewed sites, follow-ups and prepared letters, with next actions and recent QR activity.
- **QR views:** searchable and filterable site activity, first/latest view dates, unique outside networks, and whether the latest public update was viewed. Status also appears alongside Sites and Mailing records.
- **Website:** grouped undo/redo, Ctrl/Cmd+S, changed-area summary, explicit draft reload and conflict detection. Loading or restoring a revision resets undo history. Restoring a revision changes the draft; publishing remains a separate action.
- **AI connections:** named, scoped, expiring access keys, shown once and immediately revocable. Website changes remain drafts. Access to selected site records and their live QR pages is separately granted.
- **Storage:** serialized state mutations and atomic file replacement; corrupt stored content produces an error rather than silently falling back to empty state. Autosave keeps the server's acknowledged revision between consecutive saves and document generation.
- **Loading:** new panels and Mailing load separately, keeping private Studio code out of the public entry bundle.

## What a QR view means

A visible QR page sends a view after 1.2 seconds. Its signed receipt identifies the content actually delivered, so a delayed request cannot claim that a later update was viewed. A stale tab cannot erase an already confirmed view of the current update.

Views represent **networks, not identified people**. IPv4 uses the public IP; IPv6 uses its /64 network. Shared Wi-Fi can combine people, and changing networks can count one person again. A known bot, Studio preview, excluded editor browser or excluded network does not count. There is no claim that opening a link proves a particular recipient read it.

Studio login excludes that network and sets a signed, HttpOnly editor-exclusion cookie for 180 days. The QR views panel can name the current network (for example, Home network), exclude another public IP, or remove an exclusion. Adding an exclusion removes that network's previous counts. If the home IP changes, sign in again from that network. Manually named network exclusions persist until removed; automatic exclusions are bounded to 100 entries together with manual entries.

Repeated views of the same version within 30 minutes count once. Records expire 180 days after each network's last view. Network identifiers are keyed hashes; raw visitor IPs are not stored in the QR engagement file. The existing server audit log remains a separate operational log. Counts begin with this release; past scans cannot be reconstructed.

The verified hosting path uses Cloudflare Tunnel, Nginx Proxy Manager and Docker's `172.30.0.1` gateway. The production manifest trusts that immediate peer and reads Cloudflare's client-address header. If the topology changes, update `TRUSTED_PROXY_CIDRS` and `CLIENT_IP_HEADER`; the panel reports unreliable address detection and suppresses counts rather than treating every visitor as one proxy. Do not expose a path that allows untrusted clients to forge the trusted header.

QR history and exclusions are included in portable backups, with a key identity check. Preserve the existing `CMS_ENCRYPTION_KEY` when restoring them. Integration secrets are deliberately excluded from portable backups and must be recreated on a fresh server.

## Connecting an assistant

Open **Studio → AI connections**, choose permissions and expiry, and copy the one-time key into the assistant's secret store. No assistant or external service is connected automatically by this release.

The [relay guide](public/studio-relay-guide.md) documents `/api/relay/v1`, image uploads, full website draft updates, selected-site patches, ETag preconditions and retry handling. Keys cannot publish the website, delete records, access backups, change settings, send email or execute code. Explicit site-write access updates permitted public QR fields immediately.

## Validation

- Production build, TypeScript and 22 prerendered routes.
- 105 unit/component tests across 24 files.
- Server regression checks for published first paint, spoofed headers, persistent exclusions, IPv6 grouping, delayed receipts, stale-tab ordering, concurrent writes, revoked/scoped keys, private-field filtering, malformed storage and encoded server-bundle paths.
- Existing media/backup regression suite, including LibreOffice document rendering.
- Four desktop/mobile browser checks for hydration, a lazy public route, dashboard, QR views, exclusions, key lifecycle, undo/redo, keyboard save and reload.
- Production readiness checks and bundle budgets. Public JavaScript: 103,324 bytes gzip; largest chunk: 69,663 bytes; public CSS: 21,131 bytes. The total public JavaScript ceiling was explicitly increased from 102,500 to 104,000 bytes for CMS bootstrap and signed QR receipts; the existing largest-chunk and CSS ceilings remain unchanged.

The design review is recorded separately in [WEBSITE-REVIEW.md](WEBSITE-REVIEW.md). Its visual gate is not a functional or security certification.
