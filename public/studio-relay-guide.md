# Kingsvale Studio relay — version 1

Create a key in Studio → AI connections. Use HTTPS and store the secret in your assistant's secret manager. A key is shown once, expires after 7, 30 or 90 days, and can be revoked immediately. No connection exists until you create a key.

Base URL: https://kingsvalehomes.co.uk/api/relay/v1

Send `Authorization: Bearer YOUR_KEY` on every request. GET the base URL for capabilities and the permissions on your key.

Editing requires the matching read permission. The connection must read the current content and revision before writing; site editing therefore also grants access to the selected records' private details.

## Website content

- `GET /website` (`website:read`): returns `draft`, `published`, `revision` and `updatedAt`, with an `ETag` header.
- `PUT /website/draft` (`website:draft:write`): send JSON `{ "content": <edited draft> }` and `If-Match: "<revision from GET>"`. Start with the returned draft, retain its complete structure, change only intended fields. The server validates the result and returns the new revision. This never publishes. Review at `/studio?tab=website`, then publish using Studio.
- `POST /media` (`media:upload`): multipart form with file field `image`. JPEG, PNG, WebP or AVIF; at most 12 MB / 32 million pixels. The response contains `image` with its URL and responsive variants. Keep all returned image properties when assigning it to a draft image field. Uploading does not select the image or publish anything. Do not retry a successful upload; save the returned asset reference.

## Selected site records

The key must explicitly include the sites it may access. Site read access includes the record's private details; grant only when needed.

- `GET /sites` (`sites:read`): permitted site IDs, titles, references and revisions.
- `GET /sites/:id` (`sites:read`): record and revision, with ETag.
- `PATCH /sites/:id` (`sites:write`): JSON `{ "changes": { "summary": "Updated wording" } }`, plus If-Match. Fields: title, summary, currentStatus, statusNote, plotDescription, landAddress, mapEmbedUrl, landMap, resources, privateNotes, ownerContactName, contactPriority, region. Updates to public fields change the live QR page immediately. Private notes remain private. You cannot change IDs, QR tokens, references, posting dates, archived state or files through this operation.

## Errors and retries

401: invalid, expired or revoked key. 403: missing permission or inaccessible site. 409: another editor changed the record; read again and reconcile, never blindly overwrite. 422: validation errors. 428: missing If-Match. 429: rate limit; retry with backoff. Responses are JSON and are not cached. Mutations are serialized with Studio writes and saved atomically on this single-server deployment.

If a write times out, GET the record and compare it with your intended change before retrying. This API does not promise automatic idempotent replay. Keys cannot publish website content, delete records, read backups, change settings, send email or execute code. Image uploads use the existing image-validation service. Key creation, revocation and mutations are recorded in the server audit log. Recreate integration keys after migrating to a fresh server; they are intentionally excluded from portable backups.
