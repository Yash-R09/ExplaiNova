# Explainova — local database

M2a implements the identity/profile foundation. Supabase Auth owns identities and passwords. `public.profiles` contains only app preferences, version/lifecycle metadata, and timestamps. Projects, jobs, media, publishing, and the login UI are separate milestones.

## Start locally

Requirements: Docker Desktop running with Linux containers, Node.js, and root dependencies installed with `npm ci`. No Supabase cloud account, hosted project, provider keys, or paid services are required.

From the repository root:

```powershell
npm run db:start
npm run db:test
npm run db:lint
```

First startup downloads container images and applies committed migrations. Later, apply newly added migrations without clearing local data:

```powershell
npm run db:migrate
```

- API: http://127.0.0.1:54321
- Postgres: port 54322
- Studio: http://127.0.0.1:54323
- Local test email inbox: http://127.0.0.1:54324

`npm run db:status` displays local development connection details. Keep its keys out of chat, screenshots, and Git. Stop this project's services with `npm run db:stop`; local volumes are retained. Do not use `supabase db reset` against a database whose data you need: it clears local application data. The normal migration command above is additive.

This is a development stack with local test credentials, not a deployable database service. The tested CLI/Docker Desktop combination publishes its service ports on all host interfaces; the documented custom-network loopback option did not change those bindings here. Do not port-forward or expose it publicly, and stop it when not in use. Services are stopped at the end of M2a testing.

The generated Supabase config disables automatic Data API grants for new tables. Migrations explicitly grant only the access needed. The `private` schema is not exposed through the Data API. Local media storage and realtime are disabled; R2 integration remains future work.

Email confirmation and secure password changes are enabled for future auth-flow testing. Confirmation emails stay in the local inbox. The dashboard has not been connected to these flows yet.

## What the first migration guarantees

- One profile per `auth.users` identity, created by a restricted signup trigger using the database identity—not editable signup metadata.
- Backfill for users created before this migration.
- Authenticated users can select their own profile only. Anonymous reads and all direct client writes are denied.
- Trusted service/database operations can write; updates advance `version` and `updated_at` and cannot change identity or creation time.
- Preferences must be an object of at most 16 KiB. Allowed setting fields and a compare-and-swap update operation will be implemented with preferences in M3. Do not treat this initial JSON shape check as full preference validation.
- Profile deletion state is `active`, `pending`, or `deleting`. There is no user-callable deletion operation yet.
- Auth identity deletion is restricted while its profile exists. Future account deletion must first orchestrate project/job/publication cleanup; this is intentionally not a cascade.

The service role bypasses row-level policies and must never reach the browser. The migration does not grant untrusted clients write access to any lifecycle/version fields.

## Tests and change workflow

`tests/database/profiles.test.sql` uses pgTAP, synthetic `example.test` identities, and a rolled-back transaction. It validates the real signup trigger, grants, RLS isolation, constraints, and trusted update behavior. Run it only against the local development instance.

1. Add a timestamped SQL migration for the current feature; never modify a migration already applied to a shared environment.
2. Apply using `npm run db:migrate`.
3. Run database tests and lint, then relevant app checks.
4. Update `PROJECT_STATUS.md` with actual results and any unverified behavior.
5. Commit after the completed feature/milestone.

Regenerate the app's database types after a schema change with `npm run db:types`. These reflect schema structure, not permission to perform writes; grants and RLS remain authoritative. The pinned CLI is v3, whose database commands target local by default; do not add `--remote` for this workflow.

The app now connects sessions, signup/confirmation, sign-in/out, recovery, and owned profile reads. Run `npm run db:configure-app` after startup to create ignored browser-safe app configuration. App setup and local integration checks are described in [apps/web/README.md](../apps/web/README.md); root `.env` remains for the video prototype.

The local templates at `templates/confirmation.html` and `templates/recovery.html` direct users through Explainova's clean confirmation/reset pages. Email confirmation and secure password changes remain enabled. The local hourly email allowance is 30 for repeatable Mailpit testing; this does not change hosted provider limits or enable external mail delivery. After changing local email configuration/templates, stop/start this stack to reload them; preserve the database volumes.

## References

- [Supabase local CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase user/profile management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Explainova database design](../DB_DESIGN.md)
