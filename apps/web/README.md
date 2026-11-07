# Explainova web app

M2b: responsive studio foundation with verified Supabase sessions and sign-in/out. The local video prototype stays in the repository root and runs independently.

## Run locally

Node.js 22+ recommended (this repository uses Node 24). From the repository root:

```powershell
npm ci
npm --prefix apps/web ci
npm run db:start
npm run db:configure-app
npm run app:dev
```

Open http://127.0.0.1:3000. Studio routes redirect to `/sign-in` until authenticated. Docker Desktop must be running. `db:configure-app` creates ignored `apps/web/.env.local` using the local browser-safe key and preserves an existing file. No hosted Supabase account or paid provider keys are required.

Existing confirmed local Supabase users can sign in. For testing before signup UI is built, create a confirmed local account through Studio at http://127.0.0.1:54323 (Authentication → Users). No permanent QA account is included. Signup/confirmation and password recovery follow as separate features.

```powershell
npm run app:typecheck
npm run app:test
npm run app:build
npm --prefix apps/web start
```

With local Supabase and the app running, a separate terminal can run `npm run app:test:integration`. It creates disposable identities, exercises real session/profile checks, then deletes only those fixtures. Optional `AUTH_TEST_APP_URL` must point to `127.0.0.1`; default is port 3000. No credentials are printed or stored by this integration suite.

Stop a running dev server before starting the production server on the same port. Google Fonts are optional external styling; system fonts remain usable without them.

## Structure

- `src/app/(studio)`: protected App Router pages with a verified-session layout.
- `src/app/sign-in`: functional sign-in form and sign-in/out Server Actions.
- `src/app/api/v1/me`: independently authorized, no-store identity/profile endpoint.
- `src/lib/session.ts`: verified identity and owned active-profile checks; recheck here for each future API/action, not just navigation.
- `src/lib/supabase`: typed browser/server clients and public configuration boundary.
- `src/proxy.ts`: request-scoped cookie refresh and anonymous navigation guard.
- `src/components`: shared navigation shell, icons, and planned-feature state.
- `next.config.ts`: independent app package boundary.
- Independent `package-lock.json`: reproducible dependencies without changing Remotion's dependency tree.

## Current scope

Responsive navigation, existing-user sign-in/out, cookie session refresh, owned profile reads, and an empty projects view are implemented. Other routes describe planned features. Signup, password recovery, project persistence, provider integration, and publishing remain unimplemented. Development servers remain loopback-only; no deployment has been configured.

The marketing homepage remains planned; `/` redirects to `/projects`, which requires sign-in. The original Stitch files are design references, not copied executable application code.

## Environment boundary

The repository root `.env` belongs to the prototype and is not loaded into this app. App configuration belongs in `apps/web/.env.local` (ignored). See `.env.example`: URL, publishable/legacy anon key, and app origin are browser-safe. A hosted app origin must use HTTPS so cookies use `Secure`; local HTTP is accepted only for loopback. Never prefix a provider/service secret with `NEXT_PUBLIC_`. The configuration rejects missing values, privileged keys, and insecure non-local endpoints. Restart/rebuild Next.js after changing public environment values. No provider calls occur in this milestone.

Supabase SSR uses shared browser/server cookies with SameSite=Lax and the configured secure flag. Cookie user data is not an authorization source: the server validates the identity with Auth and checks the owned active profile. RLS is still required for future tables. Framework Server Actions handle sign-in/out origin checks; future mutations need their own identity/ownership validation. See [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## Feature development

Follow [project status](../../PROJECT_STATUS.md), [API contracts](../../API_DESIGN.md), and [database design](../../DB_DESIGN.md). Add each working vertical slice separately and record its checks and limitations in the status document. Keep server integrations outside client components; do not directly import the Windows prototype runner into Next.js requests.
