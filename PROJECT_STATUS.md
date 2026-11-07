# Explainova — Project status

Last updated: November 7, 2026 · Current milestone: **M3a implemented — private idea draft library and manual saving**

## Working agreement

Build one reviewable feature at a time. Each milestone includes its relevant UI, behavior, error states, and verification. Update this document at the end of every development session with completed work, evidence, limitations, and the next small task. A mock screen does not count as an implemented feature.

Repository: [Yash-R09/ExplaiNova](https://github.com/Yash-R09/ExplaiNova). Development branch: `dev`. After each completed feature/milestone, remind the founder to commit and push any uncommitted changes. This standing instruction is also recorded in `AGENTS.md`.

## Current product state

- **Complete:** PRD, system/API/database designs, two local API video experiments, and the Stitch design set (20 desktop + 10 mobile app screens, plus approved homepages).
- **Implemented before this milestone:** the single-user local video prototype at port 4310, including Gemini planning, tested ElevenLabs narration, and Remotion export. It uses local files, not SaaS identity/storage.
- **Complete (M1):** separate Next.js/TypeScript app at `apps/web`, responsive shell, project empty state, workflow outline, and honest placeholders for later modules.
- **Complete (M2a):** local Supabase CLI/configuration, profile migration, explicit grants/RLS, signup trigger, generated TypeScript database types, and 29 real PostgreSQL isolation/integrity tests. No hosted project is linked.
- **Complete (M2b):** cookie-based browser/server Supabase clients, session refresh proxy, verified identity/profile access layer, protected studio route group, working sign-in/sign-out, and owned `GET /api/v1/me`.
- **Complete (M2c):** signup, check-email/resend, explicit email confirmation, safe invalid/expired/reused-link handling, and the shared temporary-outage error fix (QA-03).
- **Complete (M2d implementation):** forgot/reset-password UI, local recovery mail, isolated token-bound reset action, invalid/expired/reused-link handling, and session revocation after success. Independent scoped QA passed; separate source/security review remains pending.
- **Complete (M3a implementation):** private persisted idea drafts, create/reopen/rename, idea/reference text, acknowledged manual saves, revision history, paginated library, and transactional conflict/idempotency protection. Proceeded at the founder's request while the separate auth source/security review remains pending.
- **Not implemented in the SaaS app:** autosave/offline draft recovery, duplicate/delete, editable generation preferences, provider calls, workers, R2, downloads, social connections, scheduling, and publishing.
- No cloud resources provisioned, no app deployed, and no billing implemented.

## Delivery plan

| Milestone | Small deliverable | Completion evidence | Status |
| --- | --- | --- | --- |
| M1 · Foundation | Independent Next.js app, design tokens, responsive shell, routes, local setup, status tracking | Build/typecheck; desktop/mobile and navigation checks; prototype tests | Complete — ready for review |
| M2 · Identity | Supabase setup/migrations for profiles, sign-up/in/out, verification, reset, session guards | Two-account isolation and expired/session recovery checks | Implemented — scoped independent QA passed; source/security review pending |
| M3 · Private projects and idea drafts | Private draft library, create/reopen/rename/duplicate/delete drafts, autosave with save-state indicators, preferences, revisioned saving and conflict recovery | RLS isolation; saved idea survives reload; offline/pending edits and revision conflicts handled honestly | M3a implemented; autosave and remaining draft operations follow |
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

### Independent M3a QA — November 7, 2026

- Tested draft changes against `3ab7908`; [independent QA report](QA_M3A_REVIEW.md). No new reproducible defects found in tested scope; no application fixes made.
- Passed create/edit/manual-save/reload/library/reopen/rename, two-tab conflict retention and explicit saved-version reload. Directly verified cancelling ordinary Settings navigation preserved unsaved text on the tested build.
- Dropped a successful PATCH response using a temporary local proxy. Browser retained text; retry acknowledged revision 4 without duplication. Final fixture history was revisions 1–5 after another save.
- Passed 64 PostgreSQL tests, 64 project HTTP assertions, 10 session checks, 13 prototype tests, schema lint, production build and typecheck. A navigation fix landed concurrently: reran all **14 app unit tests** and the build successfully afterward (**165 distinct tests/assertions** across the pass). Browser results predate that fix; its modified-click behavior still needs targeted browser verification.
- Desktop visual check and actual 390px mobile no-overflow measurement passed. Mobile screenshot failed; mobile visual QA and native reload/close prompts remain unverified. Separate source/security review remains pending.
- Removed disposable identity/draft/revisions/profile; stopped owned app/proxy/Supabase services with volumes retained and viewport reset. No provider calls or publication. Commit and push reviewed M3a/QA changes to `dev` when approved.

### M3a review fix — modified link clicks · November 7, 2026

- Fixed the reported P2: Ctrl/Cmd/Shift/Alt and non-primary link clicks bypass the leave warning without changing the current draft's dirty state. Non-self link targets and downloads also leave editor protection intact.
- Ordinary link approval no longer clears dirty state during click capture. It remains active until the editor actually unmounts (or a successful save clears it), including when a later handler cancels navigation.
- Added three regression tests covering modified gestures, repeated warning after an accepted-but-cancelled transition, and declined navigation. All **14 app unit tests** and the production build (including TypeScript) pass; whitespace checks pass. Database/project integration and browser QA were not rerun for this client-only fix; local services remain stopped. Independent review of the fix is pending.
- Changes remain uncommitted on `dev`. Next implementation remains M3b autosave/pending-edit recovery.

### M3a — Private idea draft library · November 7, 2026

- Added projects, immutable client-facing revision snapshots (including historical titles), owned read policies, and authenticated transactional RPCs. Clients cannot write these tables directly. A deferred foreign key ensures the project head always has a matching snapshot.
- Added owned project GET/list/create/PATCH endpoints. Mutations enforce same-origin JSON, a 64 KiB body cap, bounded inputs, idempotency keys, and expected-revision comparison under a database row lock. Library pagination preserves timestamp microseconds. Unknown failures return safe errors.
- Added real project creation, library cards, reopening, title/idea/reference editing, manual Save draft, acknowledgement-based save status, disabled fields during saving, and an inline conflict state that keeps unsaved text. New-project creation requires a button action; GET/prefetch never creates data.
- **Checks:** 64/64 database tests; database lint clean; 11/11 app unit tests; 64 project HTTP integration assertions; 10/10 existing session integration checks; 13/13 independent prototype tests; production app build and strict typecheck passed. Integration fixtures are disposable local users and are removed after tests.
- Browser checked create → edit → save → reload → library → reopen → rename/save. Desktop 1280px and mobile 390px had no horizontal overflow. Viewport screenshots under `design/qa/m3a/`. Native unsaved-navigation confirmation could not be verified reliably by automation and remains a manual QA item. Disposable browser identity/drafts removed; owned app server and local Supabase stopped with database volumes preserved.
- **Scope/limits:** explicit manual saving only. Pending edits currently live in browser memory; native link/unload prompts are best-effort and browser Back/Forward is not a durable recovery mechanism. M3b must add autosave, owner-scoped local recovery, serialized retries, and fuller conflict recovery before claiming resilient draft editing. API supports length/audience/tone presets, but this UI uses defaults (60s, beginner, clear); editable preferences follow. No revision browser yet.
- No AI/provider calls, rendered media, cloud provisioning, or publication. Root video prototype preserved. Separate auth source/security review and independent M3a review remain pending.

### Independent M2c/M2d QA — November 7, 2026

- Tested the uncommitted auth slice against `6a5b4b6` using production Next.js, local Supabase, Mailpit, and manual browser flows. [Independent QA report](QA_AUTH_REVIEW.md).
- No new reproducible defects found within tested scope. Independently closed QA-03: actual backend outage now gives temporary-unavailability guidance for sign-in and reset requests.
- Manual signup validation/correction, email delivery, explicit confirmation into owned studio, sign-out, recovery request/clean landing, malformed-link recovery, desktop layout, mobile reset layout, and basic label/keyboard checks passed. Mobile reset viewport confirmed at 390 × 844 without overflow; mobile signup not verified in this pass.
- Supporting checks passed: 7 auth unit tests, 10 session checks, 14 signup checks, 17 recovery checks, 29 real PostgreSQL checks, 13 prototype regressions (**90 total**), production build, typecheck, and diff whitespace validation.
- Removed browser/integration fixture identities and profiles, reset viewport, and stopped QA app/Supabase services with volumes retained. No source fixes, provider calls, or publication. Password changes tested through HTTP integration forms, not browser entry.
- Separate source/security review and broader release checks remain pending; see report limits. Commit and push the reviewed auth slice and QA documentation to `dev` when approved.

### M2d — Password recovery, November 7, 2026

- Preserved uncommitted M2c/QA-03 work. Added `/forgot-password`, `/auth/recovery`, and `/reset-password`, plus a local recovery email template and shared password validation.
- Recovery GET stages a bounded ten-minute HttpOnly token scoped to `/reset-password` and redirects to a clean no-store/no-referrer page. Input validation precedes provider verification. An ordinary browser session cannot replace the email proof.
- The password action uses a separate in-memory Supabase client for the emailed account. It does not create normal browser auth cookies or accidentally use another signed-in identity. Active owned profile is checked before update. The staged link is cleared after verification; failures after consumption require a fresh link, and ambiguous outcomes are explained honestly.
- Successful reset returns to sign-in and requests global refresh-session revocation. Access JWTs can remain valid until provider expiry; revocation failures after success have distinct truthful feedback.
- `npm run app:test:recovery` — 17 real local checks passed: generic unknown-email feedback, request delivery, no reset via ordinary login alone, clean/scoped landing, validation without token consumption, cross-origin denial, different signed-in account isolation, new/old password behavior, refresh-session revocation, reused/expired/unissued token rejection, same-password handling, unsupported URL purposes, and inactive-profile denial. Expiry changes target only disposable fixture IDs.
- `npm run app:test` — 7 auth policy/error tests passed. Existing 10 session checks, 14 signup checks, and all 13 prototype tests passed. Strict app typecheck and production build passed. No new database schema migration.
- Browser checks verified generic reset-request feedback, malformed-link recovery, clean reset-form navigation, actual 390px viewport without overflow, and real request-service outage guidance after Supabase stopped. Password changes were tested through HTTP integration, not entered in computer-use automation. [Reset form preview](design/qa/m2d-reset-password.jpg).
- All disposable recovery/session/signup fixture identities and profiles removed; local test emails reference deleted fixtures. App/Supabase stopped at handoff; volumes retained. No hosted delivery, provider calls, or video generation.
- [Auth review checklist](AUTH_REVIEW_CHECKLIST.md) records source boundaries, commands, expected behaviors, tradeoffs, and tests still needed. Independent code review/manual QA has not yet been performed for this combined auth slice.

### M2c — Signup/confirmation and QA-03 repair, November 7, 2026

- Started from pushed `6a5b4b6`. Implemented `/sign-up`, `/check-email`, `/auth/confirm`, and `/confirm-email`, sharing the approved auth visual frame.
- Signup validates email/password confirmation, retains email after validation failure, and clears password fields. Duplicate-account responses remain generic; unconfirmed users receive no app session. Profile creation uses the existing Auth trigger; no new database migration.
- Configured a local Explainova confirmation email template. Its link stages the bounded provider token in a ten-minute HttpOnly cookie, redirects to a clean no-store/no-referrer confirmation page, and requires an explicit POST action to verify. GET/email scanning does not confirm an account. Tokens are not rendered into the form or included in the success URL; successful confirmation clears the staged token and opens `/projects`.
- Resend uses Supabase throttling and generic wording. Unsupported confirmation types and redirect overrides are ignored. Expired, reused, missing, or malformed links fail closed with recovery navigation. PKCE-prefixed SHA-224 and standard SHA-224/SHA-256 hashes are accepted; other shapes fail validation.
- QA-03 fixed: returned SDK `AuthRetryableFetchError`, zero-status transport failures, and 5xx service errors now show temporary-unavailability guidance instead of credential advice. Credential and throttling messages stay distinct and generic. Actual browser outage reproduced with Supabase stopped: correct retry guidance, no access granted.
- `npm run app:test` — 6/6 tests passed, including an actual SDK returned-network-error shape and confirmation/signup policy cases.
- `npm run app:test:signup` — 14 real local app-form/Supabase/Mailpit checks passed: signup validation, email delivery, no unconfirmed access, clean confirmation GET, explicit confirmation/session/profile, duplicate signup, reused/unsupported links, resend/replacement, and genuinely expired Auth token. Expiry test changes only a disposable user's confirmation timestamp.
- `npm run app:test:integration` — existing 10/10 session isolation checks passed. `npm test` — all 13 prototype regressions passed. Production build and strict app typecheck passed.
- Browser checks passed: mismatch validation and email retention, signup → local inbox, clean confirmation landing → private studio, sign-out, and real service-outage feedback. Actual 390px signup viewport had no horizontal overflow. Screenshot capture was intermittent; the saved [fixed-outage screenshot](design/qa/m2c-outage-fixed.jpg) was visually inspected. No full accessibility or multi-device audit claimed.
- All disposable local identities/profiles removed. Test emails remain only in local Mailpit and refer to deleted fixtures. App/Supabase stopped after verification; volumes retained. No external email delivery, cloud provisioning, provider calls, or new video rendering.
- Local email allowance increased to 30/hour for repeatable Mailpit tests; this is local configuration, not a hosted-plan entitlement or a production email configuration.

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

Next implementation: **M3b — autosave and owner-scoped pending-edit recovery**, using the M3a transactional save contract. Then M3c: duplicate/delete and draft preferences. Keep M4 AI brainstorming/storyboard generation separate.

Carry forward the separate source/security review of auth changes since `6a5b4b6` using [AUTH_REVIEW_CHECKLIST.md](AUTH_REVIEW_CHECKLIST.md), and review M3a using [QA_M3A_HANDOFF.md](QA_M3A_HANDOFF.md). Independent auth QA passed within its scope. The founder explicitly requested proceeding with the next feature; that request supersedes the earlier sequencing gate, but does not mark the pending review complete.

November 7, 2026: Founder approved committing/pushing M2c/M2d, the QA-03 fix, review checklist, and independent QA report/evidence to `dev`. This checkpoint does not claim that the separate source/security review is complete. Continue reminding the founder to commit after future completed features.

## Decisions and constraints to preserve

- Next.js/React/TypeScript web/API; Supabase Auth/Postgres; R2 media; separate generation workers. API/database docs govern the implementation contracts.
- Plan → Storyboard → Video; narration lives in storyboard, no separate script step.
- Educational English vertical videos, 30–90 seconds, topic-adaptive themes and captions. No children-directed mode, billing, credits, or revenue dashboard in V1.
- Male/female narration; use only free-tier API-accessible ElevenLabs voices until explicitly changed. API entitlement and commercial rights are separate checks.
- User-owned projects and channels. No shared publishing accounts. No credentials in client code.
- Preserve the original approved Stitch homepages. See [UI screen map](UI_DESIGN_SCREEN_MAP.md).

## Change log

- November 7, 2026: Founder approved committing/pushing M3a, the modified-link protection fix, and independent QA evidence to `dev`. Publication checks confirmed credentials/env files, prototype media, dependencies and build outputs stay excluded. Remaining manual navigation/security-review limits are recorded in the QA handoff/review.

- November 7, 2026: Implemented M3a private draft persistence/library/manual saving. Autosave remains the next bounded slice; auth source/security review carried forward as pending.

- November 6, 2026: Completed and verified the M1 app foundation alongside the existing prototype; established this milestone tracker. M2 remains unstarted.
- November 6, 2026: Completed M2a local database foundation and actual PostgreSQL isolation tests. M2b session/auth integration remains unstarted.
- November 7, 2026: Completed the five reported local-prototype QA fixes, added regression coverage, and verified browser behavior with an isolated simulated worker. M2b remains the next product feature.
- November 7, 2026: Pushed prior work in `c288032`; implemented and verified M2b sessions, sign-in/out, and owned profile API. Signup/confirmation is next.
- November 7, 2026: Clarified existing V1 requirements in the roadmap: M3 explicitly covers idea drafts/autosave, and M4 explicitly covers the saved idea workspace and optional brainstorming. Documentation only; these features remain planned.
- November 7, 2026: Completed M2c signup/email confirmation and fixed QA-03. All local integration/browser checks passed; password recovery is next.
- November 7, 2026: Implemented M2d password recovery and prepared the complete auth review/QA handoff. M3 remains unstarted.
- November 7, 2026: Included independent auth QA results/evidence and prepared the founder-authorized M2c/M2d commit. No new QA defect reported; source/security review remains pending.
