# WRG Platform frontends

One npm-workspaces repository containing two independently deployed web applications:

- `apps/client`: the client Feedback Data Dashboard.
- `apps/admin`: the administrator application.
- `packages/ui`: deliberately small shared presentation layer (currently WRG branding and login artwork).
- `deploy`: shared static-server configuration.

The applications share source control and selected visual assets, but not routing, authentication state, deployment services, domains, or release workflows. Admin pages and admin API clients must remain in `apps/admin`; `apps/client` only owns the short-lived `/admin-preview` exchange used when an administrator opens a client dashboard.

## Local development

Requirements: Node 20.19+ and npm 10+.

```sh
npm ci
cp apps/client/.env.example apps/client/.env.local
cp apps/admin/.env.example apps/admin/.env.local
npm run dev:client
npm run dev:admin
```

The client runs on Vite's default port (`5173`) and the admin app is configured for `5174`. Run the API separately, then set each app's API origin in its own `.env.local`.

Useful commands:

```sh
npm run check
npm run test:e2e:client
npm run build --workspace @wrg/platform-client-web
npm run build --workspace @wrg/platform-admin-web
```

## Authentication and impersonation boundaries

- Client and admin login routes live in different applications and origins.
- Admin credentials/tokens use the admin origin's session storage and are not available to the client origin.
- Client authentication remains cookie-backed for normal users.
- `View dashboard` asks the backend for a single-use grant, opens the client app at `/admin-preview?grant=...`, and exchanges it for a short-lived impersonated client session.
- The client displays the persistent `Admin access` banner and can end that impersonated session. It never receives the administrator's normal access or refresh token.
- Legacy client URLs such as `/admin-login` and `/admin/*` redirect to `VITE_ADMIN_APP_URL`; they do not render an admin bundle.

Authorization must still be enforced by the backend. Frontend route separation is not a security boundary by itself.

## CI and deployment

Changes to each app trigger only its path-scoped GitHub Actions workflow. Changes to `packages/ui`, deployment configuration, or the root workspace lockfile verify and deploy both applications.

Configure the GitHub `production` environment with:

- Secret `RAILWAY_TOKEN`.
- Variable `RAILWAY_CLIENT_SERVICE_ID`.
- Variable `RAILWAY_ADMIN_SERVICE_ID`.

Use two Railway services sourced from this same repository:

| Service | Railway config file | Public domain | Required build variables |
| --- | --- | --- | --- |
| Client | `/apps/client/railway.json` | `feedbackdatadashboard.com` | `VITE_ADMIN_APP_URL=https://admin.feedbackdatadashboard.com/admin/projects` and the client API variables |
| Admin | `/apps/admin/railway.json` | `admin.feedbackdatadashboard.com` | `VITE_API_BASE_URL=https://api.feedbackdatadashboard.com` |

Keep the Railway root directory empty (repository root) for both services. Each Dockerfile needs the root workspace lockfile and shared package during its build. Vite variables are embedded at build time, so redeploy after changing them.

Both images serve their own static bundle on port `8080`, use `deploy/nginx.conf` for SPA fallback, and expose `/healthz`.
