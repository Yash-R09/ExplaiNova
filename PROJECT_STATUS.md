# Explainova — Project status

Last updated: November 7, 2026 · Current milestone: **Prototype QA fixes complete; M2a complete**

## Working agreement

Build one reviewable feature at a time. Each milestone includes its relevant UI, behavior, error states, and verification. Update this document at the end of every development session with completed work, evidence, limitations, and the next small task. A mock screen does not count as an implemented feature.

Repository: [Yash-R09/ExplaiNova](https://github.com/Yash-R09/ExplaiNova). Development branch: `dev`. After each completed feature/milestone, remind the founder to commit and push any uncommitted changes. This standing instruction is also recorded in `AGENTS.md`.

## Current product state

- **Complete:** PRD, system/API/database designs, two local API video experiments, and the Stitch design set (20 desktop + 10 mobile app screens, plus approved homepages).
- **Implemented before this milestone:** the single-user local video prototype at port 4310, including Gemini planning, tested ElevenLabs narration, and Remotion export. It uses local files, not SaaS identity/storage.
- **Complete (M1):** separate Next.js/TypeScript app at `apps/web`, responsive shell, project empty state, workflow outline, and honest placeholders for later modules.
- **Complete (M2a):** local Supabase CLI/configuration, profile migration, explicit grants/RLS, signup trigger, generated TypeScript database types, and 29 real PostgreSQL isolation/integrity tests. No hosted project is linked.
- **Not implemented in the SaaS app:** login, private persisted projects, autosave, provider calls, workers, R2, downloads, social connections, scheduling, and publishing.
- No cloud resources provisioned, no app deployed, and no billing implemented.

## Delivery plan

| Milestone | Small deliverable | Completion evidence | Status |
| --- | --- | --- | --- |
| M1 · Foundation | Independent Next.js app, design tokens, responsive shell, routes, local setup, status tracking | Build/typecheck; desktop/mobile and navigation checks; prototype tests | Complete — ready for review |
| M2 · Identity | Supabase setup/migrations for profiles, sign-up/in/out, verification, reset, session guards | Two-account isolation and expired/session recovery checks | In progress — M2a complete; M2b next |
| M3 · Private projects | Owned project CRUD/list, preferences, revisioned saving and conflict recovery | RLS tests across two users; reload/revision/conflict checks | Planned |
| M4 · Idea planning | Save brief, 30/60/90s, male/female accessible voice selection, topic theme, Gemini planning job | Validated provider output; unavailable key/model/quota paths; no silent voice substitution | Planned |
| M5 · Storyboard review | Scene/narration editing, previews, autosave, explicit revision approval | Editing invalidates approval; stale-tab conflicts; restore/reload | Planned |
| M6 · Generation | Durable jobs/outbox/queue, ElevenLabs audio+alignment, supported visuals, Remotion, private R2 artifacts | One end-to-end owned video; stage recovery; duplicate request protection | Planned |
| M7 · Video review/export | Player, caption review, previous versions, authorized MP4/SRT downloads | Duration/technical QA; artifact ownership/expiry checks | Planned |
| M8 · Social connections | Each user's own YouTube and eligible Instagram account, OAuth/reconnect/disconnect | State/PKCE/token protection and cross-user isolation | Planned |
| M9 · Publishing | Explicit approved destination/metadata, publish now, schedule/calendar, post status/recovery | Duplicate/uncertain upload handling; due-time/timezone and token-revocation checks | Planned |
| M10 · Release readiness | Approved homepage/auth polish, notifications, full responsive/accessibility pass, operational controls | End-to-end recovery/security/cleanup checks; staged deployment review | Planned |

M6 is delivered as smaller slices: durable job skeleton → narration/alignment → scene assembly → renderer/R2 → recovery. M9 starts with one provider before adding the other. Platform approval and available account types may affect the social milestones.

## M1 scope and acceptance

- Keep the root Remotion prototype and its package/dependencies intact.
- Start the new app independently with `npm run app:dev`; no external keys required.
- Use the approved cobalt/lavender/lime design direction, shared components, keyboard focus, skip link, and responsive navigation.
- `/` opens `/projects`. `/create`, `/publishing`, `/connections`, and `/settings` are navigable outlines with explicit unimplemented status. Unknown routes show a recovery link.
- Do not fake a signed-in user, saved projects, connected accounts, AI generation, or a publication result.
- Root provider keys are not copied to the web app or exposed through browser configuration.
- M1 intentionally implements the first-project state rather than a fictitious populated project list. The approved marketing homepage remains a later feature.

## Verification log

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

Start **M2b: Supabase browser/server clients, validated session handling, and route protection**. Then implement signup/signin/signout, email confirmation, and password recovery as small reviewable flows. Local database commands are in [supabase/README.md](supabase/README.md). The dashboard still behaves as the M1 scaffold; it is not yet connected to Supabase. Project tables and autosave follow in M3.

November 7, 2026: Founder approved committing the M2a foundation and prototype QA fixes to `dev`. This snapshot includes the QA report and generated Next.js development instructions. M2b session integration starts after this checkpoint; remind the founder to commit that new feature when complete.

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
