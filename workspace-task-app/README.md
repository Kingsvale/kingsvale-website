# TaskForge Workspace

A self-hosted collaborative task workspace built with Next.js, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Socket.IO, and Docker Compose.

The app is designed as a Linear-style professional workspace: dark ambient surfaces, precise glass panels, compact navigation, command-palette workflows, realtime task boards, workspace roles, invitations, mentions, notifications, and member presence.

## Design System Summary

The UI follows `UI Design Prompt 2.txt` as the design source:

- Deep near-black canvas using layered radial gradients, grid texture, noise, and animated ambient blobs.
- Indigo accent system centered on `#5E6AD2` with soft glows, hairline borders, and multi-layer shadows.
- Compact SaaS app layout rather than a marketing landing page: left workspace sidebar, top search/command bar, dense project/task surface, drawer-based task details, and modal forms.
- Typography uses Inter/system sans with tight headings, mono uppercase metadata labels, muted body text, and gradient page titles.
- Interactions are small and precise: 200ms transitions, subtle hover lift, spotlight cards, visible focus rings, keyboard shortcuts, and reduced-motion support.
- Dark mode is the default. A light-mode toggle swaps the core CSS variables while preserving the product layout and controls.

## Architecture

```text
Next.js App Router
├─ App pages: login, register, invite, workspace, profile, settings
├─ API routes: auth, workspaces, members, invites, projects, tasks, comments, notifications, search
├─ Custom server: Next request handler + Socket.IO on /api/socket
├─ Prisma/PostgreSQL: relational workspace, project, board, task, comment, activity, notification, presence schema
└─ Docker Compose: app + Postgres + persistent database volume
```

Realtime events are emitted after successful database writes:

- `task:created`
- `task:updated`
- `task:moved`
- `task:commented`
- `task:archived`
- `project:created`
- `workspace:updated`
- `member:joined`
- `notification:created`
- `presence:changed`

Clients join `workspace:{workspaceId}` rooms after Socket.IO authenticates the signed session cookie and verifies workspace membership.

## Features

- Email/password registration and login.
- Bcrypt password hashing.
- Signed HttpOnly session cookies.
- Protected app routes via Next proxy.
- Personal workspace created at registration.
- Shared workspace creation.
- Workspace switcher.
- Workspace settings.
- Invite-by-email flow with expiring invite links.
- Accept invitation flow.
- Member roles: Owner, Admin, Member, Viewer.
- Server-side role checks on all important mutations.
- Projects with default boards and lists.
- Kanban, list, and due-date calendar views.
- Task title, description, status, priority, assignee, reporter, due date, labels, checklist, comments, activity, timestamps, archive state, and attachment placeholder field.
- Mentions in comments using `@emailhandle` or compacted display name.
- Assignment and mention notifications.
- Notifications panel with unread state.
- Search across tasks, projects, and comments.
- Presence records updated through Socket.IO connections.
- Command palette with `Ctrl/Cmd + K`.
- Keyboard shortcut `N` for new task when not typing.
- Dark/light theme toggle.
- Responsive layout.

## Local Setup

```bash
npm install
copy .env.example .env
```

Update `.env` if your Postgres credentials differ:

```env
DATABASE_URL="postgresql://taskforge:taskforge@localhost:5433/taskforge?schema=public"
POSTGRES_HOST_PORT=5433
SESSION_SECRET="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Start Postgres:

```bash
docker compose up -d postgres
```

Run migrations and seed data:

```bash
npm run prisma:deploy
npm run prisma:seed
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seed users:

```text
alice@example.com
bob@example.com
june@example.com
Password: Taskforge2026!
```

## Production Build

```bash
npm run build
npm run start
```

## Docker Compose

Set a production session secret:

```bash
set SESSION_SECRET=replace-with-a-long-random-32-character-secret
docker compose up -d --build
```

The app will be available on `http://localhost:8092` by default. Override the host port with:

```bash
set HOST_PORT=8092
docker compose up -d --build
```

The app container runs:

1. `prisma migrate deploy`
2. `npm run start`

The database persists in the `taskforge_postgres` named volume.

## Portainer Deployment

1. Push this folder to a Git repository reachable by Portainer, or upload it as a stack source.
2. In Portainer, choose **Stacks** -> **Add stack**.
3. Use `docker-compose.yml` as the compose file.
4. Add stack environment variables:

```env
HOST_PORT=8092
SESSION_SECRET=replace-with-a-long-random-32-character-secret
APP_PUBLIC_URL=http://YOUR_SERVER_IP:8092
SECURE_COOKIES=false
```

Use `SECURE_COOKIES=false` when opening the app over plain HTTP, such as `http://SERVER_IP:8092`. Set it to `true` only when serving the app through HTTPS.

5. Deploy the stack.
6. Open `http://YOUR_SERVER_IP:8092`.
7. Run seed data once if wanted:

```bash
docker compose exec app npm run prisma:seed
```

### Portainer Image Upload Stack

Build and save the upload image:

```bash
docker build -t taskforge-workspace:latest .
docker save -o taskforge-workspace.tar taskforge-workspace:latest
```

In Portainer, upload `taskforge-workspace.tar` under **Images**, then deploy [docker-compose.portainer.yml](./docker-compose.portainer.yml) as a stack. The stack publishes the app on host port `8092` and keeps Postgres internal-only.

## Useful Commands

```bash
npm run typecheck
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm audit --omit=dev
```

## Security Notes

- Do not use the default compose `SESSION_SECRET` in production.
- Passwords are hashed with bcrypt.
- Session cookies are HttpOnly, SameSite=Lax, and secure in production.
- API routes repeat permission checks server-side instead of trusting UI state.
- Workspace roles gate member management, project creation, task mutation, comments, and settings updates.
- Auth endpoints have simple in-memory rate limiting. For multi-instance production, move rate limiting to Redis or an edge/proxy layer.
- The attachment field is modeled as JSON placeholder support; add object storage before enabling real file uploads.
