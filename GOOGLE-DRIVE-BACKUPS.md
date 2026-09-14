# Daily Google Drive backups

Open **Studio → Backup** on the deployed website. Use the main Google Workspace account, **info@kingsvalehomes.co.uk**. The enquiries address is an alias and is not the account to authorise.

## One-time connection

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the info account. Create a project in the Kingsvale Workspace organisation, for example “Kingsvale website backups”.
2. Under **APIs & Services → Library**, enable **Google Drive API**.
3. Open **Google Auth Platform**. Complete the branding/contact details and choose an **Internal** audience. Add the scope `https://www.googleapis.com/auth/drive.file` under Data Access. It gives the application access to its own files rather than the whole Drive.
4. Under **Clients**, create an OAuth client with application type **Web application**. Add the exact authorised redirect URI shown in Studio. For the live site it is:

   `https://kingsvalehomes.co.uk/api/drive-backup/callback`

5. Copy the client ID and client secret into the private fields in **Studio → Backup → Set up Google Drive**, then save. These are Google Cloud OAuth credentials, not your Google password or SMTP app password. Do not commit them to GitHub or paste them into chat.
6. Choose **Connect Google Drive**, sign in as **info@kingsvalehomes.co.uk** and approve access. Returning to Studio enables the schedule and starts the first backup. Wait for a **Last verified backup** timestamp, then open the backup folder to confirm the file.

If Internal is unavailable, ask your Workspace administrator to create the project under your organisation. An External app in Testing normally receives a refresh token that expires after seven days for Drive access. Do not use that configuration for unattended backups. Google administration policies may require an administrator to allow the client.

## Storage policy

- Runs daily at **03:00 Europe/London**, adjusting for British Summer Time. Requires the existing server container to be running; Studio can be closed. A restart after the scheduled time triggers a catch-up. Missed days cannot reconstruct historical data.
- Keeps up to **7 daily, 4 weekly and 2 monthly** calendar restore points. One file can satisfy several categories. Budget defaults to **3 GB**, adjustable to 1, 2 or 5 GB. Newest points take priority when size reduces the history.
- Full snapshots are gzip-compressed. Every archive contains its own copies of content, saved drafts/revisions, site records, uploaded images and responsive variants, documents, settings, analytics and enquiry/newsletter logs. No incremental chain is needed to restore.
- Google upload byte count and MD5 checksum must match the locally compressed archive before it is marked verified; a SHA-256 digest is stored in the file’s private app metadata. Cleanup starts only after verification.
- Old managed archives are **permanently deleted**, not moved to Trash, to actually release storage. Only files bearing this installation’s private application markers inside its own folder are eligible. Other Drive files and other installations are excluded.
- During upload, space for one additional archive is needed above the retained budget. A check leaves at least **500 MB** of reported Google account capacity as headroom. Gmail/Photos/other Drive files can share the same quota. If insufficient room is available, no existing backup is sacrificed to make room for an unverified replacement.
- Failed jobs retry at most hourly. A failed cleanup leaves the verified replacement intact and shows a warning; the budget may temporarily be exceeded. The next successful job retries cleanup. Status, timestamps and recent restore points appear in Studio. There is no external outage alert if the host itself is down.

## Persistence and security

The connection, refresh token, schedule and status are stored in `data/private/google-drive-backup.json`, encrypted with the existing `CMS_ENCRYPTION_KEY`. The normal `kingsvale_data:/app/data` volume persists this file across GitHub/Portainer redeployments. No extra SMTP or Drive environment secrets need copying on every deployment. Do not delete the data volume or change the encryption key without preserving the existing value.

OAuth state is one-time, browser-bound and expires after ten minutes; PKCE is used. Tokens and client secrets are never returned by the status API. Saving configuration and starting a backup require the authenticated Studio session. Google credentials are deliberately excluded from the content archive; after disaster recovery, reconnect Google Drive. Disconnect stops background use locally and preserves existing Drive files. To revoke Google's grant as well, remove the app in your Google Account's third-party connections.

Drive archives are portable compressed JSON, not password-encrypted archives. Keep the backup folder private and do not share its files. Google encrypts its storage and HTTPS protects uploads. Server environment keys, the application code (kept in GitHub), external image URLs and unsaved browser edits are not bundled. Preserve deployment secrets separately in your password manager.

Only run one Kingsvale server instance against a data volume/Drive connection; scheduling is protected against overlapping work in that process, not coordinated across replicas. If migrating hosts, stop the old scheduler before starting the new one. Renewing the same connection reuses its existing folder. If someone deletes/trashes that folder, restore it in Drive; the service fails safely instead of deleting or adopting other folders.

`PUBLIC_SITE_URL` (or `SITE_URL`) may set another trusted public origin; otherwise the callback uses `https://kingsvalehomes.co.uk`. Configure the matching redirect URI in Google. Run the connection on HTTPS. No Drive backup is possible until the owner completes the Google setup.

## Restore

1. In Studio open **Recent restore points** or **Open backup folder**.
2. Download the desired `.json.gz` file from Drive.
3. Under **Import backup**, choose that file directly. Studio decompresses it, validates its structure and shows the contents summary.
4. Choose Replace or Merge, then import. The server saves a local recovery backup first and verifies uploaded file checksums before applying the restore.

Each raw JSON archive must fit `BACKUP_IMPORT_MAX_MB` (currently 250 MB by default; supported up to 1,000 MB). The cloud job refuses to create an archive too large for that server's restore limit. Raise that variable in the persistent Portainer **stack** settings when the image library grows, allowing for server/browser memory used by the existing full-backup pipeline. Large installations may eventually need a streaming archive format.

Run `node --test tests/server/drive-backup.test.mjs` for schedule, retention, isolated cleanup, OAuth state, quota, upload verification, restart and restore checks. Google API behaviour is simulated; the first real upload must be confirmed after authorisation.

## Google references

- [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Drive file access scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Permanent deletion versus Trash](https://developers.google.com/workspace/drive/api/guides/delete)
