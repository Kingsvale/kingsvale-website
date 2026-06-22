# Kingsvale Luxury Real Estate Website

A responsive luxury real estate homepage and structured admin editor inspired by the provided Kingsvale-style reference: cinematic hero imagery, serif editorial typography, charcoal and ivory palette, restrained taupe accents, polished property cards, and calm premium motion.

## What Is Included

- Responsive homepage with header, hero, feature strip, legacy split, developments, land wanted CTA, and luxury footer.
- Structured Studio editor at `/studio` with passphrase auth, bearer-token API protection in secure mode, and live preview before publishing.
- Editable content model for hero, features, developments, about, land wanted, footer, navigation, social links, and images.
- Image replacement via URL or upload. Secure mode validates image bytes and generates WebP media variants with `sharp`.
- Public content pages for developments, development details, design and build, vision and process, about, land wanted, contact, privacy, terms, and a security review.
- `/admin` is intentionally inert and does not expose editing controls.
- Client-side PBKDF2 passphrase verification and AES-GCM encrypted private editor snapshots remain available for the local Vite prototype.
- Secure server CMS persistence for published content, draft content, revision history, audit logs, leads and uploaded media under ignored `data/` storage.
- Short-lived Studio bearer tokens for secure CMS mutations, optional TOTP MFA, public lead validation, optional signed webhook forwarding, route SEO metadata, robots and sitemap files.
- Build-time prerendered HTML for all public routes, including each development detail page.
- Optional local CMS encryption at rest, bounded revision history, CMS backup files and a read-only `/api/ops/health` endpoint for deployment checks.
- Production readiness preflight that checks secrets hygiene, headers, robots, sitemap, prerendered route output and private chunk exposure.
- Opinionated guardrails: fixed section order, exactly four feature-strip items, one to six development cards, approved icon choices, and text length limits.
- Lightweight scroll reveals, hover states, image scale treatments, and `prefers-reduced-motion` support.
- Unit, component, accessibility, admin workflow, responsive, and Playwright E2E tests.

## Assumptions

- The Vite dev server keeps the local prototype path: published studio changes persist in browser `localStorage` under `kingsvale-site-content-v1`.
- `npm run serve:secure` is the production-style path: published content, drafts, revisions, uploaded media, audit logs and leads persist under `data/`.
- For a real multi-user production launch, replace local `data/` persistence with a database/CMS and object storage without changing the typed `SiteContent` schema.
- Managed production storage is still a deployment choice: this repo now isolates and documents the secure local store, but a real launch should place CMS rows, media, lead records and audit events in managed database/object/logging services.
- Default photography uses remote optimized image URLs. Local Vite uploads are data URLs; secure-server uploads are decoded and converted to WebP variants in `/media/`.
- The client passphrase gate is retained for Vite-only use. Secure mode verifies the same passphrase server-side and returns a short-lived bearer token for CMS, tracking, analytics and upload APIs.

## Setup

```bash
npm install
npx playwright install chromium
```

## Run Locally

```bash
npm run dev -- --port 5173
```

Homepage: `http://127.0.0.1:5173/`

Studio: `http://127.0.0.1:5173/studio`

Security review page: `http://127.0.0.1:5173/security-review`

For local static-demo studio access, use the fixture passphrase from the E2E test setup or rotate the PBKDF2 verifier in `src/lib/studioSecurity.ts`.

For the secure production-style server, set:

```bash
$env:STUDIO_USER="kingsvale"
$env:STUDIO_PASSWORD="your-rotated-passphrase"
$env:STUDIO_AUTH_TOKEN_SECRET="a-long-random-auth-token-secret"
$env:CMS_ENCRYPTION_KEY="a-long-random-cms-encryption-key"
npm run build
npm run serve:secure
```

Secure studio login: `http://127.0.0.1:4173/studio`

Optional hardening:

```bash
$env:STUDIO_TOTP_SECRET="BASE32-TOTP-SECRET"
$env:CMS_MAX_REVISIONS="5"
$env:CMS_MAX_BACKUPS="30"
$env:BACKUP_IMPORT_MAX_MB="25"
```

Optional Royal Mail or third-party tracking lookup:

```bash
$env:ROYAL_MAIL_TRACKING_API_URL="https://tracking-provider.example/lookup"
$env:ROYAL_MAIL_TRACKING_API_KEY="provider-api-key"
```

Optional lead forwarding:

```bash
$env:CONTACT_WEBHOOK_URL="https://example.com/contact-webhook"
$env:NEWSLETTER_WEBHOOK_URL="https://example.com/newsletter-webhook"
$env:LEAD_WEBHOOK_HMAC_SECRET="a-shared-webhook-signing-secret"
```

Health check: `http://127.0.0.1:4173/api/ops/health`

## Test

```bash
npm test
npm run test:e2e
npm run lint
npm run lint:strict
npm run check:performance
npm run check:prod-ready
```

`check:performance` and `check:prod-ready` expect a fresh `npm run build` first because they inspect the generated `dist/` output.

## Build

```bash
npm run build
```

## Docker And Portainer

The repo includes a `Dockerfile`, a local `docker-compose.yml`, and a Portainer upload-friendly `docker-compose.portainer.yml`. The container serves the production secure server on internal port `4173` and persists CMS content, uploads, leads, audit logs and backups in the named `kingsvale_data` volume.

The Docker image can build without secrets, but the container entrypoint refuses to start unless `STUDIO_PASSWORD`, `STUDIO_AUTH_TOKEN_SECRET` and `CMS_ENCRYPTION_KEY` are set.

The Dockerfile builds the production `dist/` output inside Docker, then copies it into a smaller runtime image. For local checks before building the image:

```bash
npm install
npm run build
```

Local smoke test:

```bash
docker compose build
docker compose up -d
docker compose logs -f kingsvale
```

Required Portainer environment variables:

```bash
HOST_PORT=8095
STUDIO_USER=kingsvale
STUDIO_PASSWORD=replace-with-a-rotated-editor-password
STUDIO_AUTH_TOKEN_SECRET=replace-with-a-long-random-auth-token-secret
CMS_ENCRYPTION_KEY=replace-with-a-long-random-cms-key
```

In deployed Docker/Portainer mode, Studio login uses `STUDIO_PASSWORD` from the environment. The older browser-only passphrase verifier is only a local demo fallback when the secure server is not available.

Optional variables:

```bash
STUDIO_TOTP_SECRET=
CMS_MAX_REVISIONS=5
CMS_MAX_BACKUPS=30
BACKUP_IMPORT_MAX_MB=25
ROYAL_MAIL_TRACKING_API_URL=
ROYAL_MAIL_TRACKING_API_KEY=
CONTACT_WEBHOOK_URL=
NEWSLETTER_WEBHOOK_URL=
LEAD_WEBHOOK_HMAC_SECRET=
```

Leave `STUDIO_TOTP_SECRET` blank unless you have set up an authenticator app with a Base32 TOTP secret. If it is set, Studio login requires both the passphrase and the current 6-digit authenticator code.

Create a `.tar` image for Portainer upload:

```bash
docker build -t kingsvale-luxury-real-estate:latest .
docker save -o kingsvale-luxury-real-estate.tar kingsvale-luxury-real-estate:latest
```

Upload the `.tar` image in Portainer:

1. In Portainer, open the target environment.
2. Go to `Images`.
3. Use `Import image` or `Load image`, depending on your Portainer version.
4. Upload `kingsvale-luxury-real-estate.tar`.
5. Confirm the image appears as `kingsvale-luxury-real-estate:latest`.

Deploy the uploaded image as a Portainer Stack:

1. In Portainer, go to `Stacks` -> `Add stack`.
2. Paste the contents of `docker-compose.portainer.yml` into the Web editor.
3. Add the required environment variables above in the Stack environment section.
4. Deploy the stack.
5. Open `http://SERVER_IP:8095/` or the host port you set with `HOST_PORT`.
6. Open Studio at `/studio`.

Move local Studio data to the deployed instance:

1. In the local Studio, open `Backup` and choose `Export full backup`.
2. Build and upload the new Docker image as usual.
3. In the production Studio on Portainer, open `Backup`, choose the exported JSON, and import it.
4. Use `Replace everything` when production should exactly match local content, or `Merge sites, visits and leads` when production records should be kept.

The Docker image and the editable Studio data are intentionally separate. The image carries code and default placeholders; the backup JSON carries website edits, Sites/QR pages, mailing workflow data, analytics and lead logs. Keep the `kingsvale_data` Docker volume and `CMS_ENCRYPTION_KEY` stable between redeploys so existing production data remains readable.

Portainer GHCR deployment:

1. Make sure the GitHub Container Registry package `ghcr.io/kingsvale/kingsvale-website` is public, or configure GHCR credentials in Portainer.
2. In Portainer, go to `Stacks` -> `Add stack`.
3. Choose `Git repository` or `Web editor`.
4. Use `docker-compose.portainer.yml` as the compose file.
5. Add the required environment variables above in the Stack environment section.
6. Deploy the stack. Portainer pulls `ghcr.io/kingsvale/kingsvale-website:latest`.
7. Open `http://SERVER_IP:8095/` or the host port you set with `HOST_PORT`.
8. Open Studio at `/studio`.

Automatic redeploy from GitHub:

1. In GitHub, open `Kingsvale/kingsvale-website` -> `Settings` -> `Secrets and variables` -> `Actions`.
2. Add a repository secret named `PORTAINER_WEBHOOK_URL` containing the Portainer stack webhook URL.
3. Push to `main`, or run the `Publish Docker image` workflow manually.
4. The workflow builds and pushes `ghcr.io/kingsvale/kingsvale-website:latest`.
5. After the image push succeeds, the workflow posts to the Portainer webhook so the stack redeploys and pulls the new image.

Keep the `kingsvale_data` volume attached so redeploys keep Studio data. Do not commit Portainer webhook URLs, Studio passwords, CMS encryption keys or GHCR tokens to this public repository.

If you run behind a reverse proxy such as Traefik, Nginx Proxy Manager, Caddy, or Cloudflare Tunnel, point the proxy to container port `4173` and keep HTTPS enabled.

## Performance And Accessibility Notes

- Images use responsive `srcset`, width hints, lazy loading outside the hero, async decoding, and high-priority loading for the hero image.
- Secure image uploads are normalized to WebP variants and served from `/media/` with immutable caching.
- Motion is CSS and IntersectionObserver based, with no heavy animation library.
- Layout dimensions use fixed breakpoints, aspect ratios, and constrained grids to reduce layout shift.
- Components use semantic landmarks, labelled controls, accessible buttons, alt text, keyboard-friendly navigation, and automated axe checks.
- SEO metadata is updated per route, with Open Graph tags, canonical URL, JSON-LD structured data, robots.txt and sitemap.xml.
- Public routes are prerendered after `vite build` so crawlers and social previews receive meaningful HTML before hydration.
- `npm run check:performance` enforces Lighthouse-style public bundle/prerender budgets, reports total generated JS, and verifies the private studio chunk is not referenced by public HTML.
- `npm run check:prod-ready` verifies offline launch hygiene: no leftover SSH key files, `.env` ignored, documented environment controls, hardened static headers, robots/sitemap coverage, prerendered route output, clean SPA fallback shell and no public studio chunk reference.
- For a full Lighthouse pass, run `npm run build`, then `npm run serve:secure`, and test the secure server URL in Chrome Lighthouse.

## Red-Team Security Notes

- Client-side route hiding is not true access control. Secure mode protects the private route and studio chunk server-side; plain static hosting does not.
- The studio passphrase is verified with PBKDF2-SHA-256 using a stored verifier and salt. This avoids a plaintext secret in the production app bundle, but the verifier is still available to an attacker who can download the JavaScript.
- AES-GCM is used for private editor snapshots in local storage. Published public content is not encrypted because the public website must render it without an editor passphrase.
- `serve:secure` adds bearer-token CMS protection, optional TOTP MFA, rate limiting, server-side validation, audit logs, revision history, encrypted CMS files when configured, backups and server media processing. For production scale, move local `data/` files to managed DB/object storage, use SSO/OIDC/MFA through an identity provider and store secrets in a manager.

## Acceptance Criteria

- Homepage visually follows the attached premium property developer reference.
- Studio edits cannot change the section structure or break the layout.
- Hero, features, development cards, imagery, CTAs, footer content, navigation, newsletter copy, and social links are editable.
- Preview is available before publish.
- Motion is restrained and honors reduced-motion preferences.
- Desktop, tablet, and mobile layouts are supported.
- Tests and production build pass.

## Default Image Sources

- Hero stone-accent home: [Unsplash photo by Justin Wolff](https://unsplash.com/photos/modern-luxury-house-with-stone-accents-at-sunset-7qD-iDyrdHY)
- Additional editable default imagery is served from Unsplash image URLs and can be replaced in the admin editor.
