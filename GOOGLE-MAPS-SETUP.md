# Google Maps on land and QR pages

The editor and customer map use the official Google Maps JavaScript API when a
browser API key is configured. Satellite mode is Google's Hybrid view (aerial
imagery plus road labels). Existing KML geometry and printed QR tokens are reused.

## Set up the Kingsvale project

1. Open [Google Cloud](https://console.cloud.google.com/projectcreate), sign in to
   the business Google account, and create or select a Kingsvale project.
2. Link a billing account. Google requires billing for a production Maps key,
   including when usage remains within the free allowance.
3. Enable [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com).
   No Places, Geocoding, Drawing or KML Layer APIs are needed for this integration.
4. Open **APIs & Services → Credentials**, create an API key, and edit it:
   - Application restrictions: **Websites**.
   - Website restrictions: `https://kingsvalehomes.co.uk/*` and
     `https://www.kingsvalehomes.co.uk/*`.
   - API restrictions: **Restrict key**, with only **Maps JavaScript API** selected.
5. In Kingsvale **Studio → Settings → Google Maps**, paste the key and save settings.
   Return to **Sites**, open a land map and check that its background control says
   **Satellite + labels**. Open its customer QR link and check the same outline.
6. Set Google Cloud billing alerts, review Maps usage, and configure appropriate
   API quotas. Budget alerts are notifications, not a hard spending cap.

Browser API keys are visible to website visitors by design. Restrict the key as
above; do not use a server credential, service-account JSON or unrestricted key.
For local tests, use a separate restricted development key allowing
`http://127.0.0.1:5173/*` and/or `http://localhost:5173/*`.

## Deployment and storage

Studio saves the browser key alongside the existing encrypted Studio settings.
Normal backups include it. Alternatively, set `GOOGLE_MAPS_API_KEY` in the
Portainer stack environment; that value takes precedence over the Studio key.
Both Compose files pass the optional variable into the server. A redeploy is
needed after changing environment values; saving the Studio key needs no rebuild.

`GET /api/maps/config` returns only the browser key, with caching disabled. It
never exposes other Studio settings. No key is compiled into the website bundle.
The original browser-only Vite demo reads the key from local Studio settings;
production always uses the server endpoint. Keys and billing must be configured
in Google Cloud before real imagery can be verified.

When no key is configured, the existing Leaflet/Esri map remains available. If
the Google script or authorization fails, the viewer falls back and displays a
notice. Neither case alters stored geometry. KML upload, native Google polygon
editing, adding/deleting corners, cancellation, undo and QR-page saves reuse the
same site record. No deprecated Google Drawing Library or KML Layer is used.

## Checks

- `npm test`: KML round trips, loader failures and native Google polygon behavior
  (including holes, completion, cancellation and minimum-corner deletion) use test doubles.
- `node --import tsx --test tests/server/land-map.test.mjs`: authenticated settings,
  public configuration, persistence, backups and QR-token behavior.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/land-map*.spec.ts`:
  existing desktop/mobile workflows with deterministic fallback tiles.
- `npm run build`, `npm run check:performance`, `npm run check:prod-ready`.

Real Google imagery, Google domain restrictions and Cloud billing require a final
check with the configured key; mocked tests do not verify those services.

References: [API setup](https://developers.google.com/maps/documentation/javascript/get-api-key),
[pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
[polygons](https://developers.google.com/maps/documentation/javascript/shapes).
