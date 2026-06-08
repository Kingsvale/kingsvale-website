# Kingsvale Security Review

## Scope

This review covers the React/Vite implementation, generated private studio route, secure static server, prerendered public routes, server CMS persistence, session auth, CSRF protection, optional MFA/IP controls, upload processing, local storage fallback, and contact/newsletter form endpoints.

## Implemented Controls

- `/admin` no longer exposes editing controls.
- The private studio uses a generated 16-character route: `/251db172b850d056`.
- Secure mode serves a server-side login page before loading the studio bundle.
- Studio access uses a signed HttpOnly session cookie, SameSite=Lax, an eight-hour expiry, and CSRF headers for mutating CMS/upload/logout requests.
- Optional TOTP MFA can be enabled with `STUDIO_TOTP_SECRET`.
- Optional studio network allowlisting can be enabled with `STUDIO_ALLOWED_IPS`.
- The local Vite prototype still supports PBKDF2-SHA-256 client passphrase verification and AES-GCM encrypted local editor snapshots.
- Published content and drafts are validated server-side before saving or publishing.
- Secure mode stores published content, drafts, revision history, leads, uploads and audit logs under ignored `data/` storage.
- CMS files and backups can be encrypted at rest with `CMS_ENCRYPTION_KEY`.
- Revision restore creates a new audit event and keeps a bounded revision history. Publish and restore events write bounded CMS backups.
- Server image uploads are decoded with `sharp`, dimension-limited, converted to WebP variants, and served from `/media/`.
- `public/_headers` defines CSP, frame blocking, referrer policy, permissions policy, and content-type hardening for static hosts that support header files.
- `npm run serve:secure` protects the private studio route and `studio-*` asset chunk.
- The secure server adds rate limiting, audit logging, server-side lead validation, local lead storage, optional signed contact/newsletter webhook forwarding, and `/api/ops/health`.
- Studio/editor code is split into a dedicated protected `studio-*` asset chunk in the secure server path.
- `npm run build` prerenders public route HTML. `npm run check:performance` enforces bundle/prerender budgets and checks that the studio chunk is not referenced from public HTML.
- `npm run check:prod-ready` checks offline launch hygiene: key-file absence, `.env` ignore coverage, documented server env controls, static security headers, robots/sitemap coverage, prerendered route output and private chunk exposure.

## Red-Team Findings

- If the app is served as plain static files without `serve:secure` or equivalent platform middleware, client-side auth is not true access control.
- Route hiding reduces accidental discovery but is not a security boundary by itself.
- The PBKDF2 salt and verifier are visible in the public bundle and can be brute-forced offline if the passphrase is weak.
- Published content must remain public and therefore cannot be encrypted client-side.
- `localStorage` is vulnerable to future XSS issues.
- Secure mode uses local file persistence rather than a managed database or object store.
- Sessions are in-memory, so server restarts require re-authentication and invalidate CSRF tokens.
- TOTP MFA, studio IP allowlisting, CMS encryption and webhook HMAC verification only apply when the corresponding environment variables are configured.
- Image processing validates decodability and dimensions, but it is not a full malware scanning pipeline.
- The secure server validates and stores contact/newsletter leads, but it does not yet include CAPTCHA, email delivery, double opt-in, or a persistent CRM unless webhook environment variables are configured.
- Prerendered HTML improves crawler reliability but should still be validated with real Lighthouse and search-console tooling after deployment.

## Recommended Production Controls

- Keep authentication and authorization server-side, preferably with SSO/OIDC, MFA and role-based access control.
- Store editable content and revision metadata in a managed database with backups and migrations.
- Move image uploads to object storage with signed upload URLs, malware scanning and lifecycle retention.
- Persist audit logs centrally and alert on repeated login failures, upload failures and publish activity.
- Route lead webhooks through a verified email/CRM provider with double opt-in where newsletter marketing is used.
- Run Playwright visual integrity checks and performance-budget checks in CI before deployment.
- Run `npm run lint:strict` and `npm run check:prod-ready` in CI after every production build.
- Keep security headers, CSP, rate limiting, CSRF protection, and server-side input validation enabled in the deployment target.
- Rotate the studio passphrase before any real public deployment.
