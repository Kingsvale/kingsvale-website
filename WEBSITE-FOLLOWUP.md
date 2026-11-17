GATE: OFF (no build active)

# Kingsvale follow-up — 17 November 2026

Implemented the approved recommendations from WEBSITE-REVIEW.md. The homepage headline, business claims, photographs, colours, fonts and main layouts remain unchanged, as requested. The earlier prescriptive design review remains available in design-review.txt (69 open findings); this release does not claim a full redesign or whole-site accessibility certification.

## Private documents

Existing document URLs now require Studio authentication. Word/PDF files, uploaded title scans, private references and unassigned legacy scans are protected; public website image variants and explicitly assigned public photographs stay public. Privacy persists after a site is archived or a document is unassigned. Existing references do not need rewriting.

Studio issues a signed HttpOnly, SameSite=Strict, media-only cookie (Secure in production) so native image previews, PDF viewing/printing and downloads keep working. It expires with the Studio session and is cleared on logout. This cookie grants no API access. Protected responses use no-store, noindex and no-referrer, including byte-range requests.

Document previews include explicit sharing for 1 hour, 24 hours or 7 days, with immediate revocation. Tokens are random, stored only as hashes, bound to one file and excluded from application audit paths and portable backups. Backups carry the privacy manifest, apply protection before restoring bytes, and never restore share grants. Existing active grants are preserved when restoring on the same server.

Deployment requires a purge of Cloudflare's Kingsvale zone cache: previous document responses allowed one-year caching. Verify both hostname variants reject anonymous requests after the purge. This does not remove copies already downloaded by recipients.

## Public routes and search

Missing pages and invalid development/QR paths return HTTP 404. Valid CMS development routes remain available; trailing slashes redirect to the canonical path. The missing-page view has a homepage link.

The sitemap reads published CMS content, deduplicates canonical development paths and uses real publication timestamps where available. Draft changes cannot affect it. Studio publication and backup restoration atomically record a notification outbox with the CMS, including removed development URLs. A durable IndexNow queue retries failures, recovers interrupted requests and preserves newer publications received during a submission. Only public route shapes are eligible. Search engines decide when to crawl or index accepted submissions.

Studio > Website > SEO now shows accepted notification time, queued pages and errors, with refresh/manual notification controls. A stable verification key is derived from the existing server encryption key, or INDEXNOW_KEY can override it; the server supplies its verification file automatically. No search provider account or private key needs entering into Studio.

## Small UX refinements

- Remaining tall photographs request appropriately sized variants for their cover crop, including Studio-selected overrides. Original photographs and focal points are retained.
- Content no longer waits for repeated scroll-reveal timers to become readable; server-rendered content is visible without JavaScript.
- Keyboard users have a skip link, mobile menu focus management, Escape to close and focus restoration. Touch interaction retains the menu button focus. Body scrolling is restored when the menu closes or the viewport becomes desktop-sized.
- Gallery controls have 44px targets; desktop navigation has a larger hit area. Shared content margins use common variables with the same dimensions as before.

## Validation

- Production build and TypeScript pass; existing public transfer budgets pass (103,817 bytes gzipped public JavaScript, 21,257 bytes CSS). Studio code stays outside public initial imports.
- 105 unit tests passed.
- 13 server integration tests passed, including real Word/PDF generation and previews, private downloads, image scans, old/fresh backups, session scope, expiry/revocation, real 404s, draft/publication separation and failed queue persistence followed by restart.
- Eight desktop/mobile browser tests passed, including first-paint asset stability, Studio overview/undo/redo, QR exclusions, relay revocation, document previews/downloads/shares/session renewal, keyboard navigation and 320–1440px overflow checks.
- The new server regression suite runs in the production deployment workflow.

The original Studio/QR/AI relay implementation and its usage are described in STUDIO-UPGRADE.md. IP-based external view counts identify networks rather than individual people; no real recipient identity is inferred.
