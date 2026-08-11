# WRG Platform Admin

Independent administrator application inside the WRG frontend monorepo. Run commands from the repository root unless noted otherwise.

## Development

```sh
cp apps/admin/.env.example apps/admin/.env.local
npm ci
npm run dev:admin
```

Set `VITE_API_BASE_URL` to the backend origin. For local seeded credentials and data, run the API's migrations and seed command before starting this app.

The administrator application owns its login, 2FA, reset-password, project-management, and impersonation-start flows. It does not import client pages or client authentication code. Shared imports from `@wrg/platform-ui` are presentation-only.

## Verification and deployment

```sh
npm run typecheck --workspace @wrg/platform-admin-web
npm test --workspace @wrg/platform-admin-web
npm run build --workspace @wrg/platform-admin-web
```

The root `.github/workflows/admin.yml` workflow deploys this app to its own Railway service. Configure that service with repository root `/`, config file `/apps/admin/railway.json`, and the admin subdomain. See the root README for the complete environment and GitHub configuration.
