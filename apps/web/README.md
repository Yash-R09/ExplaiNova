# Explainova web app

M2a–M2d: responsive studio foundation with verified Supabase sessions, signup/email confirmation, sign-in/out, and password recovery. Independent auth review/QA is pending. The local video prototype stays in the repository root and runs independently.

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

To process one queued video job locally, apply the database migrations and create an ignored `.env.worker` in the repository root. Set `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_SERVICE_ROLE_KEY` for the local stack, `ELEVENLABS_API_KEY`, and `ELEVENLABS_MALE_VOICE_ID` and `ELEVENLABS_FEMALE_VOICE_ID` for premade voices you have verified with free-tier API access. Run `npm run worker:narration`. Scene checkpoints are stored under the ignored `outputs/narration-worker` directory and contain base64 WAV audio, word start times and duration. The job status exposes `narrationReadyAt` once all scenes are ready for assembly.

Run `npm run worker:assemble -- <video-job-id>` on the machine holding the narration checkpoints. It stores a private scene timeline and SRT captions and sets `assemblyReadyAt` on the job. Missing or invalid checkpoints fail with `VIDEO_NARRATION_CHECKPOINT_INVALID`. Submit a new job to regenerate narration. Audio that cannot fit the approved target fails with `VIDEO_NARRATION_TOO_LONG`. Revise and approve the storyboard before submitting a new job in that case.

Run `npm run worker:render -- <video-job-id>` after assembly. On Windows the worker uses Chrome from its standard installation path. Set `CHROME_PATH` in `.env.worker` if Chrome is installed elsewhere. Open `outputs/render-worker/<video-job-id>/video.mp4` and `captions.srt` from the same directory. A successful local render can be replayed without encoding again. Job completion and dashboard access follow private R2 storage.

Create a fresh account at `/sign-up` to enter the studio directly during local previews. To test the confirmation flow, set `[auth.email].enable_confirmations = true` in `supabase/config.toml` and restart local Supabase before creating a test account or running the signup integration suite. Open the confirmation email in the local inbox at http://127.0.0.1:54324, follow the link, then select **Confirm email and enter studio**. The app stages the link in a short-lived HttpOnly cookie so opening or scanning the email link leaves the confirmation pending. Missing, expired, or used links lead back to `/check-email` for a replacement.

Use `/forgot-password` to request a recovery email. Follow its link to the clean `/reset-password` page, choose a new password, then sign in again. Recovery uses an isolated server-only session for the emailed account; an existing browser account stays unchanged. Validation does not consume the link, but a rejected update after verification requires a fresh link. An uncertain update explicitly recommends testing the new password or requesting a fresh link. Successful resets revoke refresh sessions where confirmed; access JWTs can live until provider expiry.

```powershell
npm run app:typecheck
npm run app:test
npm run app:build
npm --prefix apps/web start
```

With local Supabase and the app running, a separate terminal can run `npm run app:test:integration`. It creates disposable identities, exercises real session/profile checks, then deletes only those fixtures. Optional `AUTH_TEST_APP_URL` must point to `127.0.0.1`; default is port 3000. No credentials are printed or stored by this integration suite.

`npm run app:test:signup` tests the real application Server Action forms, local email delivery, resend, confirmation, duplicate/reused/expired links, and unconfirmed access denial. It deletes only its disposable identities/profiles. Its expiry test uses Docker/SQL to backdate one generated fixture's confirmation timestamp. Test emails remain in local Mailpit with tokens for deleted fixtures. The application URL and Supabase `site_url` must match the test server (default port 3000).

`npm run app:test:recovery` tests real reset forms/mail, validation, CSRF protection, mixed-account recovery isolation, password changes, refresh-session revocation, replay/expiry, and inactive profiles. It uses disposable local accounts and backdates one fixture's recovery timestamp, then removes its records. Review the full [auth handoff checklist](../../AUTH_REVIEW_CHECKLIST.md) before moving to M3.

Stop a running dev server before starting the production server on the same port. Google Fonts are optional external styling; system fonts remain usable without them.

## Structure

- `src/app/(studio)`: protected App Router pages with a verified-session layout.
- `src/app/sign-in`: functional sign-in form and sign-in/out Server Actions.
- `src/app/sign-up`, `check-email`, `confirm-email`: signup, resend, and explicit confirmation actions/UI.
- `src/app/auth/confirm`: email-link landing that strips the token URL into a scoped HttpOnly cookie without consuming it.
- `src/app/forgot-password`, `reset-password`, `auth/recovery`: request, clean landing, and single-action reset using an isolated in-memory recovery client.
- `src/app/api/v1/me`: independently authorized, no-store identity/profile endpoint.
- `src/lib/session.ts`: verified identity and owned active-profile checks; recheck here for each future API/action, not just navigation.
- `src/lib/supabase`: typed browser/server clients and public configuration boundary.
- `src/proxy.ts`: request-scoped cookie refresh and anonymous navigation guard.
- `src/components`: shared navigation shell, icons, and planned-feature state.
- `next.config.ts`: independent app package boundary.
- Independent `package-lock.json`: reproducible dependencies without changing Remotion's dependency tree.

## Current scope

Projects and Trash now support **Search titles**: case-insensitive literal substring matching across all owned results, not just the visible page. Submit with Search/Enter; Clear search resets the input and results. Searches are retained in page links, view switches and Trash/restore returns. No-match states differ from an empty library. Query/view-bound cursors reject accidental reuse after changing search. Apply migration `20261107000500_project_title_search.sql`; `npm run app:test:search` runs disposable two-account HTTP/SSR paging and lifecycle checks. Current PostgreSQL suite: 197 tests. See [M3d handoff](../../QA_M3D_HANDOFF.md).

The search input follows the restored URL on browser Back/Forward and cached-page restoration, while retaining deliberate unsubmitted edits during ordinary use. This client enhancement preserves native GET submission and server-rendered results.

Responsive navigation, authentication, owned profiles and private idea drafts are implemented. Text and preferences autosave after a short pause; **Save now** is also available. Fields stay editable while a save is in progress. Only acknowledged current content displays Saved. Conflicts pause writes and offer the latest saved copy, including preferences, for explicit comparison/resolution. App servers bind to loopback. Local Supabase's separate port-binding limitation is documented in its README.

Expand **Video preferences** inside the draft to choose 30/60/90s, audience level, tone and male/female narration preference. Captions and topic-adaptive 2D visuals are included. Voice type is a saved preference; no named voice/sample or live narration is connected yet. Account-wide defaults remain later work. The preference migration is `20261107000400_draft_preferences.sql`; apply the latest search migration above too. `npm run app:test:preferences` runs disposable real API checks for preference persistence, exact retry/recovery, duplication and Trash preservation; The full current test count is recorded above.

Local backup payload schema 2 includes preferences and reads old schema-1 text records under the same owner/project key prefix. Old unconfirmed operations retain their exact original key/body until acknowledged, including across another reopening. Older text-only recovery cards identify that their displayed preferences come from the saved draft. Updated snapshot hashes include settings without rewriting history. See [M3c3 handoff](../../QA_M3C3_HANDOFF.md).

Pending text is stored locally by authenticated owner/project, in a separate record for each editor mount. Reopening offers recovery before writing; uncertain requests retain their original key/body for replay. Offline events pause saving, online events resume it, and transient errors retry up to four attempts before requiring manual retry. Local storage failure shows a warning. This is same-browser text recovery, not a fully offline page or cross-device sync. Local copies are not encrypted, can survive sign-out, and disappear if browser storage is cleared. No auth/provider credentials are stored with draft text. Independent review/QA checklist: [M3b handoff](../../QA_M3B_HANDOFF.md).

Use **Duplicate draft** on a library card to open a separate revision-1 copy of its saved idea, notes and preferences. Source and copy save independently. The command rejects a stale library revision and offers Refresh library; retries reuse the same request key. Pending browser edits, history, jobs and media are excluded. Recovery previews show notes for each copy (QA-04 fix). See [M3c1 handoff](../../QA_M3C_HANDOFF.md).

**Move to Trash** asks for confirmation before hiding a draft from Projects. Open **Trash** from the library to restore its saved content/history. Each lifecycle change advances the revision, so an old editor cannot overwrite a restored draft silently. Unsynced browser copies are retained and may need explicit conflict resolution. Permanent deletion/purge is unavailable. Apply all migrations through `20261107000300_project_trash_restore.sql` before running this version. See [M3c2 handoff](../../QA_M3C2_HANDOFF.md).

With local Supabase and the app running, `npm run app:test:trash` runs disposable two-account HTTP/database verification for Trash, restore, lifecycle retries, pre-delete pending recovery, paging and save/delete races. It cleans up its fixture users/projects. `npm run db:test` includes the current full PostgreSQL suite.

With local Supabase and the production app server running, `npm run app:test:projects` from the repository root runs disposable two-account HTTP integration checks against real transactions, ownership, retries, concurrent saves, pagination, and page rendering. Credentials remain in memory; created users/projects are cleaned up. Run database migration/types/tests/lint as described in the database README first.

The marketing homepage remains planned; `/` redirects to `/projects`, which requires sign-in. The original Stitch files are design references, not copied executable application code.

## Environment boundary

The repository root `.env` belongs to the prototype and is not loaded into this app. App configuration belongs in `apps/web/.env.local` (ignored). The URL, publishable or legacy anon key, and app origin in `.env.example` are browser-safe. A hosted app origin must use HTTPS so cookies use `Secure`. Local HTTP is accepted only for loopback. Never prefix a provider or service secret with `NEXT_PUBLIC_`. Restart or rebuild Next.js after changing public environment values.

To enable brainstorming locally, apply the latest migration with `npm run db:migrate`. Set `SUPABASE_SERVICE_ROLE_KEY` from the local Supabase stack and `GEMINI_API_KEY` in the web app's ignored environment file, then restart the app. Set `GEMINI_MODEL` if your key uses a different model. The service role enables execution. Without it, requests can still be saved and remain queued. Open any draft to find the optional **Brainstorm with AI** panel below the save controls.

The planning HTTP integration defaults to testing admission with execution disabled. For a provider-free execution test, build the app, set a local service-role key and a dummy `GEMINI_API_KEY` in the test server environment, then start the production app from `apps/web` with `node --import ./test/mock-gemini-preload.mjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000`. Set `PLANNING_TEST_EXECUTION=1` in the test terminal and run `npm run app:test:planning` from the repository root.

Supabase SSR uses shared browser/server cookies with SameSite=Lax and the configured secure flag. Cookie user data is not an authorization source: the server validates the identity with Auth and checks the owned active profile. RLS is still required for future tables. Framework Server Actions handle sign-in/out origin checks; future mutations need their own identity/ownership validation. See [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Local mail uses `supabase/templates/confirmation.html` and `recovery.html`; the CLI configuration requires email confirmation and secure password changes. Before any hosted rollout, install both matching templates and set Supabase Site URL/allowed callbacks/auth settings to the deployed app origin. Local Mailpit tests do not establish external email deliverability. Temporary backend outages show retry guidance; SDK/provider internals are not displayed.

## Feature development

Follow [project status](../../PROJECT_STATUS.md), [API contracts](../../API_DESIGN.md), and [database design](../../DB_DESIGN.md). Add each working vertical slice separately and record its checks and limitations in the status document. Keep server integrations outside client components; do not directly import the Windows prototype runner into Next.js requests.
