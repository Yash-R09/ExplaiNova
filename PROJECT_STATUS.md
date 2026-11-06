# Explainova — Project status

Last updated: November 6, 2026 · Current milestone: **M1 complete — Application scaffold**

## Working agreement

Build one reviewable feature at a time. Each milestone includes its relevant UI, behavior, error states, and verification. Update this document at the end of every development session with completed work, evidence, limitations, and the next small task. A mock screen does not count as an implemented feature.

Repository: [Yash-R09/ExplaiNova](https://github.com/Yash-R09/ExplaiNova). Development branch: `dev`. After each completed feature/milestone, remind the founder to commit and push any uncommitted changes. This standing instruction is also recorded in `AGENTS.md`.

## Current product state

- **Complete:** PRD, system/API/database designs, two local API video experiments, and the Stitch design set (20 desktop + 10 mobile app screens, plus approved homepages).
- **Implemented before this milestone:** the single-user local video prototype at port 4310, including Gemini planning, tested ElevenLabs narration, and Remotion export. It uses local files, not SaaS identity/storage.
- **Complete (M1):** separate Next.js/TypeScript app at `apps/web`, responsive shell, project empty state, workflow outline, and honest placeholders for later modules.
- **Not implemented in the SaaS app:** login, private persisted projects, autosave, provider calls, workers, R2, downloads, social connections, scheduling, and publishing.
- No cloud resources provisioned, no app deployed, and no billing implemented.

## Delivery plan

| Milestone | Small deliverable | Completion evidence | Status |
| --- | --- | --- | --- |
| M1 · Foundation | Independent Next.js app, design tokens, responsive shell, routes, local setup, status tracking | Build/typecheck; desktop/mobile and navigation checks; prototype tests | Complete — ready for review |
| M2 · Identity | Supabase setup/migrations for profiles, sign-up/in/out, verification, reset, session guards | Two-account isolation and expired/session recovery checks | Next |
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

November 6, 2026:

- `npm run app:build` — passed; all seven application routes (including root redirect and not-found handler) compiled/prerendered successfully.
- `npm run app:typecheck` — passed in strict mode.
- `npm test` — all seven existing prototype validation/HTTP/persistence tests passed.
- Production server `/projects` — HTTP 200. Browser verified creation, publishing, connected-account, settings, and missing-page recovery navigation.
- Layout inspection — no horizontal overflow at 1280px desktop and 389/390px mobile. Screenshots: [desktop](design/scaffold/desktop.jpg), [mobile](design/scaffold/mobile.jpg).
- Exact dependency versions and independent app lockfile recorded; install audit reported zero known vulnerabilities at installation time.
- No live auth, persistence, provider, or publishing validation applies to M1. No full accessibility audit has been performed.

## Next session

Review the scaffold, then start **M2a: Supabase configuration and the minimal profile migration with ownership policies**. Follow with session integration, then auth UI/recovery. Consult [DB design](DB_DESIGN.md) and [API design](API_DESIGN.md) before implementing schema or endpoints. Supabase project configuration is required for live identity checks; it is not required to review M1.

## Decisions and constraints to preserve

- Next.js/React/TypeScript web/API; Supabase Auth/Postgres; R2 media; separate generation workers. API/database docs govern the implementation contracts.
- Plan → Storyboard → Video; narration lives in storyboard, no separate script step.
- Educational English vertical videos, 30–90 seconds, topic-adaptive themes and captions. No children-directed mode, billing, credits, or revenue dashboard in V1.
- Male/female narration; use only free-tier API-accessible ElevenLabs voices until explicitly changed. API entitlement and commercial rights are separate checks.
- User-owned projects and channels. No shared publishing accounts. No credentials in client code.
- Preserve the original approved Stitch homepages. See [UI screen map](UI_DESIGN_SCREEN_MAP.md).

## Change log

- November 6, 2026: Completed and verified the M1 app foundation alongside the existing prototype; established this milestone tracker. M2 remains unstarted.
