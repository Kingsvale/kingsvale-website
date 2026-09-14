# Automatic production deployment

Website changes are pushed to `main`. GitHub Actions tests and builds the Docker
image, publishes both `latest` and the full commit SHA, then commits a Compose
manifest with that exact SHA to **production**. Only after the image is available
does it call Portainer's Git webhook. Portainer tracks **production**, not `main`.

The action passes only when `https://kingsvalehomes.co.uk/api/ops/health` reports
`ok: true` and a `revision` matching the source commit. A successful webhook
response alone is not a deployment.

## Why a deployment branch?

Portainer Community Edition 2.45 exposes Git webhooks but locks **Re-pull image**
and **Force redeployment** behind Business Edition. Its Git webhook does not
apply Business Edition image tag/environment query parameters. Reusing `latest`
can leave an older local image running, even after Portainer records a new Git
commit. Another webhook for that same commit can be skipped.

The production manifest instead uses a unique published image tag and is updated
after the build finishes. Even a workflow retry creates a new deployment commit,
so Portainer checks again. No Business Edition features, new API keys or manual
container edits are required. The branch is deployment output; don't edit website
code there. Its Compose file is regenerated from `main` on every release while
preserving all stack environment references and volume declarations.

## Portainer: one-time configuration

After the workflow has created `production`, open the existing **kingsvale**
stack and **Edit Git settings**:

- Repository: `https://github.com/Kingsvale/kingsvale-website`
- Repository reference: `refs/heads/production`
- Compose path: `docker-compose.portainer.yml`
- **Create a Webhook**: enabled.
- Leave the locked Business Edition controls alone.

Save the settings with **Redeploy** selected for the initial switch. Keep SMTP
credentials, Studio credentials, encryption keys and `HOST_PORT` in the **stack's
environment variables**. Changes made only through container **Duplicate/Edit**
are replaced when the stack redeploys. Keep the existing `kingsvale_data` volume
and `CMS_ENCRYPTION_KEY`.

In GitHub → repository **Settings → Secrets and variables → Actions**, set
`PORTAINER_WEBHOOK_URL` to the stack's HTTPS `/api/stacks/webhooks/...` URL. Use
the existing publicly reachable Portainer route with a valid certificate; the
GitHub-hosted runner cannot reach a private `192.168.x.x` address. Do not use
the dashboard URL (`#!/...`). A proxy must forward the API POST to Portainer,
not return its login page or redirect. Do not publish the webhook token.

The workflow uses GitHub's built-in token with repository contents write access
to update `production`. Branch protection must permit that update. It never
force-pushes or changes `main`. Workflows are serialized and stale source commits
are rejected. Do not configure an additional `main` push webhook in Portainer.

## Diagnosing a failed action

- **Missing or invalid webhook:** correct the repository secret.
- **Redirect or HTML:** check the public proxy route; the secret must be the API
  webhook, not a browser login link.
- **HTTP 401/403/404:** check webhook validity and proxy access rules.
- **HTTP 409:** Portainer is busy. The workflow retries briefly; inspect its
  deployment status before retrying if this persists.
- **Old/unversioned release:** confirm the stack tracks `refs/heads/production`,
  inspect its update logs, image tag and GHCR pull permissions, and ensure the
  website proxy targets `kingsvale-site` on its configured port.
- **Unhealthy/unreachable site:** inspect container logs, required stack variables
  and the website reverse proxy. A correct image tag alone doesn't prove health.
- **Manifest push rejected:** check repository Actions permissions and protection
  rules on `production`. A failed push must not trigger the webhook.

After correcting settings, rerun the **latest main** workflow in GitHub Actions.
This creates a fresh deployment commit, even if the image SHA is unchanged. A
verified live release is recorded in the action log.

For a deliberate rollback, commit a known-good SHA image tag to the production
Compose manifest and trigger the webhook. Coordinate this with Actions so an
in-flight job does not overwrite the rollback. Retain the data volume and
encryption key; a code rollback does not restore data.

References: [Portainer Git commit checks](https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/how-do-automatic-updates-for-stacks-applications-work),
[Community Edition webhook implementation](https://github.com/portainer/portainer/blob/develop/api/http/handler/stacks/webhook_invoke.go),
and [GitOps settings](https://docs.portainer.io/user/docker/stacks/add).
