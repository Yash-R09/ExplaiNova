# Explainova web app

Milestone 1 foundation for the full application. The local video prototype stays in the repository root and runs independently.

## Run locally

Node.js 22+ recommended (this repository uses Node 24). From the repository root:

```powershell
npm --prefix apps/web ci
npm run app:dev
```

Open http://127.0.0.1:3000. No API keys or database connection are required for this scaffold.

```powershell
npm run app:typecheck
npm run app:build
npm --prefix apps/web start
```

Stop a running dev server before starting the production server on the same port. Google Fonts are optional external styling; system fonts remain usable without them.

## Structure

- `src/app`: App Router pages, root layout, tokens/styles, error/not-found handling.
- `src/components`: shared navigation shell, icons, and planned-feature state.
- `next.config.ts`: independent app package boundary.
- Independent `package-lock.json`: reproducible dependencies without changing Remotion's dependency tree.

## Current scope

Responsive navigation and an empty projects view are implemented. Other routes describe planned features. There is no authentication, persistence, provider integration, or publishing here yet. This app must remain loopback-only until authentication is implemented.

The marketing homepage is not implemented in M1; `/` redirects to the scaffold projects view. The original Stitch files are design references, not copied executable application code.

## Environment boundary

The repository root `.env` belongs to the prototype and is not loaded into this app. Future app configuration belongs in `apps/web/.env.local` (ignored). Never prefix a provider/service secret with `NEXT_PUBLIC_`. Add configuration only when its consuming feature is built; no provider requests occur in this milestone.

## Feature development

Follow [project status](../../PROJECT_STATUS.md), [API contracts](../../API_DESIGN.md), and [database design](../../DB_DESIGN.md). Add each working vertical slice separately and record its checks and limitations in the status document. Keep server integrations outside client components; do not directly import the Windows prototype runner into Next.js requests.
