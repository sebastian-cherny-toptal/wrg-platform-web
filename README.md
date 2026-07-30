# WRG Platform Web

First-version React frontend for Workforce Research Group. It replaces the legacy CRA/React Router 5 shell with a strict TypeScript, Vite, React Router, TanStack Query, Zustand, Zod, and Tailwind stack.

## Local development

Requirements: Node 22.13+ and npm 10+.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

The default environment uses synthetic fixtures from `src/fixtures/data.ts`. Names and addresses are intentionally fictional (`example.invalid`), and no staging service is contacted. Set `VITE_USE_API_FIXTURES=false` only when a local `/v1` API is available.

Useful commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Client fixture login matches the legacy pattern: username `demo-client` → organization confirmation → email `client@example.invalid`. Admin fixture login uses any valid email and an 8+ character password, then a 6-digit code on `/admin/2FA`.

## Architecture

- `src/app/metadata.ts`: canonical typed route map, legacy aliases, client access flags, and admin permission shortcodes.
- `src/api/client.ts`: fetch abstraction, Zod response validation, cookie-based session requests, normalized API errors, `/v1` endpoints, and explicitly gated legacy endpoints.
- `src/store/app-store.ts`: UI/session selection and cart state. Session tokens are never stored by JavaScript; the API is expected to use secure HTTP-only cookies.
- `src/app/router.tsx`: role, entitlement, and permission guards.
- `src/fixtures`: deterministic development and visual fixture data without real PII.
- `src/test` and `e2e`: MSW-backed test setup, RTL tests, and Playwright smoke coverage.

## Session and impersonation contract

`GET /v1/session` is the source of truth on startup. A session carries `verifiedAt`, `expiresAt`, and nullable impersonation metadata. Impersonation keeps the administrator actor identity and reason visible in a persistent banner. Stopping impersonation calls `DELETE /v1/session/impersonation`.

The frontend does not accept tokens from query strings or local storage. Backend authentication should use `Secure`, `HttpOnly`, `SameSite` cookies and enforce the same authorization rules server-side.

## Deployment

The multi-stage `Dockerfile` builds static assets and serves them using the SPA-aware Nginx configuration in `deploy/nginx.conf` on port 8080. Runtime API routing should proxy `/v1` to the backend at the ingress/load-balancer layer.

Legacy API access defaults off. Enabling `VITE_ENABLE_LEGACY_API` only permits calls declared with `legacy: true`; it does not silently fall back from `/v1`.
