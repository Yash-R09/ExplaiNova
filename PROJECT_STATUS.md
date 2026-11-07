# Explainova — Project status

Last updated: November 7, 2026 · Current milestone: **M2b complete — Verified sessions and sign-in/out**

## Working agreement

Build one reviewable feature at a time. Each milestone includes its relevant UI, behavior, error states, and verification. Update this document at the end of every development session with completed work, evidence, limitations, and the next small task. A mock screen does not count as an implemented feature.

Repository: [Yash-R09/ExplaiNova](https://github.com/Yash-R09/ExplaiNova). Development branch: `dev`. After each completed feature/milestone, remind the founder to commit and push any uncommitted changes. This standing instruction is also recorded in `AGENTS.md`.

## Current product state

- **Complete:** PRD, system/API/database designs, two local API video experiments, and the Stitch design set (20 desktop + 10 mobile app screens, plus approved homepages).
- **Implemented before this milestone:** the single-user local video prototype at port 4310, including Gemini planning, tested ElevenLabs narration, and Remotion export. It uses local files, not SaaS identity/storage.
- **Complete (M1):** separate Next.js/TypeScript app at `apps/web`, responsive shell, project empty state, workflow outline, and honest placeholders for later modules.
- **Complete (M2a):** local Supabase CLI/configuration, profile migration, explicit grants/RLS, signup trigger, generated TypeScript database types, and 29 real PostgreSQL isolation/integrity tests. No hosted project is linked.
- **Complete (M2b):** cookie-based browser/server Supabase clients, session refresh proxy, verified identity/profile access layer, protected studio route group, working sign-in/sign-out, and owned `GET /api/v1/me`.
- **Not implemented in the SaaS app:** signup/confirmation/recovery UI, private persisted projects, autosave, provider calls, workers, R2, downloads, social connections, scheduling, and publishing.
- No cloud resources provisioned, no app deployed, and no billing implemented.

## Delivery plan

| Milestone | Small deliverable | Completion evidence | Status |
| --- | --- | --- | --- |
| M1 · Foundation | Independent Next.js app, design tokens, responsive shell, routes, local setup, status tracking | Build/typecheck; desktop/mobile and navigation checks; prototype tests | Complete — ready for review |
| M2 · Identity | Supabase setup/migrations for profiles, sign-up/in/out, verification, reset, session guards | Two-account isolation and expired/session recovery checks | In progress — M2a/M2b complete; signup/confirmation next |
| M3 · Private projects and idea drafts | Private draft library, create/reopen/rename/duplicate/delete drafts, autosave with save-state indicators, preferences, revisioned saving and conflict recovery | RLS isolation; saved idea survives reload; offline/pending edits and revision conflicts handled honestly | Planned |
| M4 · Idea workspace and AI planning | Plan-stage workspace to write/refine an idea, optional AI brainstorming with saved conversation, saved reference notes, 30/60/90s, accessible male/female voices, topic theme, storyboard generation | Reopen saved planning work; brainstorm is optional; validated provider output and failure paths; no silent voice substitution | Planned |
| M5 · Storyboard review | Scene/narration editing, previews, autosave, explicit revision approval | Editing invalidates approval; stale-tab conflicts; restore/reload | Planned |
| M6 · Generation | Durable jobs/outbox/queue, ElevenLabs audio+alignment, supported visuals, Remotion, private R2 artifacts | One end-to-end owned video; stage recovery; duplicate request protection | Planned |
| M7 · Video review/export | Player, caption review, previous versions, authorized MP4/SRT downloads | Duration/technical QA; artifact ownership/expiry checks | Planned |
| M8 · Social connections | Each user's own YouTube and eligible Instagram account, OAuth/reconnect/disconnect | State/PKCE/token protection and cross-user isolation | Planned |
| M9 · Publishing | Explicit approved destination/metadata, publish now, schedule/calendar, post status/recovery | Duplicate/uncertain upload handling; due-time/timezone and token-revocation checks | Planned |
| M10 · Release readiness | Approved homepage/auth polish, notifications, full responsive/accessibility pass, operational controls | End-to-end recovery/security/cleanup checks; staged deployment review | Planned |

M6 is delivered as smaller slices: durable job skeleton → narration/alignment → scene assembly → renderer/R2 → recovery. M9 starts with one provider before adding the other. Platform approval and available account types may affect the social milestones.

Idea drafts, autosave, and the idea workspace are confirmed V1 features. A draft is a private project that can remain in the Plan stage without generating a storyboard or video. M3 provides draft persistence/autosave; M4 provides the planning workspace and optional AI assistance on top of it. The workflow remains **Plan → Storyboard → Video**, with no extra required brainstorming step. Autosave continues through storyboard editing in M5.

## M1 scope and acceptance

- Keep the root Remotion prototype and its package/dependencies intact.
- Start the new app independently with `npm run app:dev`; no external keys required.
- Use the approved cobalt/lavender/lime design direction, shared components, keyboard focus, skip link, and responsive navigation.
- `/` opens `/projects`. `/create`, `/publishing`, `/connections`, and `/settings` are navigable outlines with explicit unimplemented status. Unknown routes show a recovery link.
- Do not fake a signed-in user, saved projects, connected accounts, AI generation, or a publication result.
- Root provider keys are not copied to the web app or exposed through browser configuration.
- M1 intentionally implements the first-project state rather than a fictitious populated project list. The approved marketing homepage remains a later feature.

## Verification log

### Independent uncommitted M2b QA — November 7, 2026

- Tested current uncommitted auth changes with a production app server and local Supabase. Details: [M2b QA review](QA_M2B_REVIEW.md).
- Passed manual wrong-password/retry, Settings return target, reload persistence, sign-out/Back protection, unsafe return-target fallback, inactive-profile denial, and desktop/mobile layout checks. Confirmed actual 390 × 844 viewport with no horizontal overflow.
- Found **QA-03 (P3)**: offline Supabase returns a credential/email-confirmation error instead of temporary service unavailability. Access still fails closed; no application fix made.
- Reran auth unit tests (2/2), local session integration checks (10/10), prototype regression tests (13/13), production build, typecheck, and diff whitespace check successfully.
- Removed disposable browser/integration identities and profiles. Stopped QA app/Supabase services, retained volumes, reset viewport. No provider requests or publication.
- Next review task: fix/retest QA-03; then continue M2c as planned. M2b and QA documentation remain uncommitted; commit and push to `dev` when approved.

### M2b — Sessions and sign-in/out, November 7, 2026

- **Checkpoint:** committed all prior work and pushed `c288032` to `origin/dev` before starting M2b. Working tree was clean at that checkpoint.
- Pinned official Supabase SSR/JS dependencies. Added separate browser/server clients and an ignored local app configuration using only the local public API URL, browser-safe publishable key, and application origin. No service/provider secrets enter app configuration.
- Proxy refreshes verified claims/cookies; the request-scoped data layer independently calls Auth `getUser()` and reads the current owned active profile through RLS. Studio pages and `GET /api/v1/me` fail closed. API output has safe error envelopes, correlation IDs, and no-store headers; no tokens or storage credentials are returned.
- Added functional sign-in and local-session sign-out. Invalid credentials use generic messages; pending submissions disable inputs; failure retains email and clears the password. Return targets are restricted to known studio pages. Supabase/Next.js framework origin protections remain in place. Signup and password recovery are explicitly deferred.
- `npm run app:build` — passed with dynamic protected routes, API route, and proxy. `npm run app:typecheck` — passed. A stale generated development type cache referencing the moved pages was removed before validation.
- `npm run app:test` — 2 auth policy/configuration tests passed (open-redirect defense, missing/unsafe config, privileged key rejection, HTTPS cookie configuration).
- `npm run app:test:integration` — 10 live local checks passed: anonymous redirect/401, two owned profiles, rejected owner override, no-store private page, corrupted cookie rejection, refresh of an expired session envelope with replacement cookies, and inactive/missing-profile denial. The test expires the cookie envelope; it does not wait for a signed JWT's natural expiry or exhaustively test refresh races.
- `npm test` — all 13 prototype tests passed. Database SQL is unchanged from M2a; no new schema migration was needed.
- Browser checks passed: wrong password and retry email retention, successful sign-in, reload persistence, Settings navigation, sign-out, and protected-page revisit. Mobile DOM measurement at an actual 390px viewport found no horizontal overflow. Desktop [sign-in preview](design/scaffold/sign-in.jpg) was saved and visually inspected; mobile screenshot capture failed, so no full mobile visual/accessibility audit is claimed.
- All disposable integration/browser test identities and profiles were removed. App/Supabase services stopped after verification, volumes retained. No cloud project, provider calls, or new video rendering.

### Prototype QA repairs — November 7, 2026

- Fixed all five reported review/manual-QA issues before proceeding with M2b.
- File writes now snapshot inputs, serialize by destination, use unique same-directory temporary files, clean up on failure, and retry only transient Windows file-replacement locks. Project saves, render admission, and project reads share an in-process project queue. Client save requests also serialize captured snapshots, including initial project ID assignment.
- Project status compares the current storyboard hash with the completed render version. Changed narration/voice/settings return `stale` without active media links. Original render metadata/files remain available on disk; restoring the exact rendered content restores readiness.
- New drafts and edits clear the player source, both download URLs, old status, and pending project timers. Successful saves clear obsolete validation errors. Late responses cannot overwrite another project's visible save/status state.
- All editor/planning/approval controls are disabled before render submission and remain disabled during active rendering, including after reload. Pending autosave is cleared before rendering. Terminal job states unlock the controls.
- Render completion now releases its in-memory admission lock through the project queue, preventing polling from falsely reporting an active/completing job as interrupted.
- `npm test` — **13/13 passed**. Regression cases include 64 simultaneous writes with concurrent readers, cleanup/recovery after failure, eight concurrent HTTP saves, stale-output detection and exact-content restoration, blocked writes during simulated rendering, and repeated polling across fast completions.
- `npm run app:build` — passed, including TypeScript and all scaffold routes. The root prototype fixes do not change the SaaS app's features.
- Browser verification used the actual prototype UI on an isolated loopback QA server, with a simulated worker and a copy of an existing sample video. Verified active-render field locking (24 controls), lock restoration after reload, ready → new-sample reset, invalid-title correction and save/reload, and narration edit → stale → reload with no active output links.
- No live Gemini/ElevenLabs requests, speech synthesis, or new video renders. Database checks were not rerun; database implementation was unchanged in this repair session. This was targeted browser QA, not a full mobile/accessibility audit. Temporary QA server stopped; test fixtures are ignored under `.cache/`.

### Manual QA review

November 6, 2026:

- Tested the running M1 scaffold and independent local prototype through the browser. Detailed reproduction steps and coverage: [manual QA report](QA_REPORT.md).
- Found QA-01 (P2): loading a new sample retains the previous project's ready status/video/download links until reload. Found QA-02 (P3): validation error remains after successful corrected save. No application fixes made.
- Passed scaffold navigation, missing-page recovery, keyboard skip link, prototype save/reload, approval rejection/invalidation, and empty-title validation. Supporting checks: 7/7 prototype tests and production app build passed.
- Mobile override did not change the actual viewport; mobile remains unverified. Supabase status was blocked by a CLI telemetry EPERM outside the workspace; database tests were not rerun. No live provider calls or new rendering performed.
- Created one separate local QA draft; preserved the existing rendered project and preexisting implementation changes. Next task: fix/retest QA-01 and QA-02, then resume M2b. QA documentation remains uncommitted; commit and push to `dev` when approved.

### M2a — Local database foundation

November 6, 2026:

- User selected local Supabase with Docker Desktop. Installed pinned Supabase CLI 3.0.0, initialized local Postgres 17, and applied `20261106000100_identity_profiles.sql` successfully.
- `supabase test db` — all 29 pgTAP tests passed against real PostgreSQL, including symmetric two-user isolation, missing identity, denied anonymous/client writes, untrusted signup metadata, constraints, trusted update versioning, immutable identity/timestamps, and restricted Auth deletion.
- `supabase db lint --schema public,private --level warning --fail-on warning` — passed with no schema errors.
- Migration command after restart — no pending migrations, confirming local migration history/volumes persisted.
- Database types generated from the running local public schema; `npm run app:typecheck` passed.
- `npm test` — all seven existing prototype tests passed.
- Startup configuration enables email confirmation/secure password changes and disables unused realtime/storage/analytics/edge services. End-to-end authentication remains unimplemented and unverified.
- Supabase CLI's custom-network mode did not enforce loopback port binding on this Docker Desktop setup and initially broke the test container's network lookup. Restored the standard project network; final test/lint runs passed. The temporary custom network was removed. Local services are stopped after verification, with volumes retained. See [database setup](supabase/README.md) for the port-binding limitation.
- No provider calls, hosted migrations, cloud provisioning, or publication occurred. Backfill SQL exists for preexisting identities, but the initial local database contained no preexisting user data; that upgrade scenario has not been independently exercised.

### M1 — App scaffold

November 6, 2026:

- `npm run app:build` — passed; all seven application routes (including root redirect and not-found handler) compiled/prerendered successfully.
- `npm run app:typecheck` — passed in strict mode.
- `npm test` — all seven existing prototype validation/HTTP/persistence tests passed.
- Production server `/projects` — HTTP 200. Browser verified creation, publishing, connected-account, settings, and missing-page recovery navigation.
- Layout inspection — no horizontal overflow at 1280px desktop and 389/390px mobile. Screenshots: [desktop](design/scaffold/desktop.jpg), [mobile](design/scaffold/mobile.jpg).
- Exact dependency versions and independent app lockfile recorded; install audit reported zero known vulnerabilities at installation time.
- No live auth, persistence, provider, or publishing validation applies to M1. No full accessibility audit has been performed.

## Next session

Start **M2c: account creation and email confirmation**, including local inbox verification, invalid/expired confirmation links, safe redirects, and returning to the studio. Then implement password recovery as another small slice. Existing confirmed Supabase users can already sign in; no QA account was retained. The studio project list still awaits M3 persistence/autosave.

November 7, 2026: Founder approved committing and pushing M2b and the explicit idea-draft/autosave/workspace roadmap updates to `dev`. The snapshot also includes [M2b QA review](QA_M2B_REVIEW.md) and its evidence. Known P3 QA-03 remains open: a backend outage displays the generic credential error instead of temporary-unavailability guidance; no access-control failure was observed. Fix and retest this error classification before the next auth slice.

## Decisions and constraints to preserve

- Next.js/React/TypeScript web/API; Supabase Auth/Postgres; R2 media; separate generation workers. API/database docs govern the implementation contracts.
- Plan → Storyboard → Video; narration lives in storyboard, no separate script step.
- Educational English vertical videos, 30–90 seconds, topic-adaptive themes and captions. No children-directed mode, billing, credits, or revenue dashboard in V1.
- Male/female narration; use only free-tier API-accessible ElevenLabs voices until explicitly changed. API entitlement and commercial rights are separate checks.
- User-owned projects and channels. No shared publishing accounts. No credentials in client code.
- Preserve the original approved Stitch homepages. See [UI screen map](UI_DESIGN_SCREEN_MAP.md).

## Change log

- November 6, 2026: Completed and verified the M1 app foundation alongside the existing prototype; established this milestone tracker. M2 remains unstarted.
- November 6, 2026: Completed M2a local database foundation and actual PostgreSQL isolation tests. M2b session/auth integration remains unstarted.
- November 7, 2026: Completed the five reported local-prototype QA fixes, added regression coverage, and verified browser behavior with an isolated simulated worker. M2b remains the next product feature.
- November 7, 2026: Pushed prior work in `c288032`; implemented and verified M2b sessions, sign-in/out, and owned profile API. Signup/confirmation is next.
- November 7, 2026: Clarified existing V1 requirements in the roadmap: M3 explicitly covers idea drafts/autosave, and M4 explicitly covers the saved idea workspace and optional brainstorming. Documentation only; these features remain planned.
