# Explainova — Project status

Last updated: November 10, 2026 · Current milestone: **M4a implemented — planning request persistence**

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
- **Complete (M3b implementation):** debounced serialized autosave, editable fields during requests, owner/project-scoped local pending copies, explicit recovery, bounded idempotent retries, offline/reconnect handling, and explicit two-version conflict resolution. QA-04 (notes omitted from previews) was fixed in M3c1 and independently retested/closed. Source/security review remains pending. See [M3c1 QA report](QA_M3C_REVIEW.md).
- **Complete (M3c1 implementation):** Duplicate draft from the library creates an independent revision-1 copy of saved creative inputs. Owned transactional copy, stale-source protection, safe idempotent retries and Unicode-safe title prefixing are implemented.
- **Complete (M3c2 implementation):** confirmed Move to Trash, private paginated Trash, one-click restoration, preserved saved content/history, revision fencing across lifecycle transitions, and idempotent lifecycle commands. [Independent QA](QA_M3C2_REVIEW.md) passed within its scope with no new defects; separate source/security review remains pending.
- **Complete (M3c3 implementation):** per-draft 30/60/90s, audience, tone and male/female narration preference, saved through autosave/recovery/conflicts and retained by duplication/Trash. Captions included and topic-adaptive 2D visuals are fixed V1 requirements. [Independent QA](QA_M3C3_REVIEW.md) passed within its scope with no new defects; source/security review remains pending. Named voice selection/preview and account-wide defaults remain later work.
- **Complete (M3d implementation):** private case-insensitive title search across Projects/Trash, query-bound pagination, literal special characters, distinct no-match states and search-preserving lifecycle navigation. Independent QA reported QA-05 (Back restored results but retained a later input); fixed and implementation-retested in Projects/Trash. Independent fix retest and source/security review remain pending. See [QA report](QA_M3D_REVIEW.md).
- **Complete (M4a implementation):** authenticated brainstorming submission and recent history, with a durable request tied to the saved draft revision and protected against duplicate retries.
- **Not implemented in the SaaS app:** provider calls, named voice catalog/samples, account-wide preference defaults, workers, R2, downloads, social connections, scheduling, and publishing. Permanent deletion/purge is not implemented.
- No cloud resources provisioned, no app deployed, and no billing implemented.

## Delivery plan

| Milestone | Small deliverable | Completion evidence | Status |
| --- | --- | --- | --- |
| M1 · Foundation | Independent Next.js app, design tokens, responsive shell, routes, local setup, status tracking | Build/typecheck; desktop/mobile and navigation checks; prototype tests | Complete — ready for review |
| M2 · Identity | Supabase setup/migrations for profiles, sign-up/in/out, verification, reset, session guards | Two-account isolation and expired/session recovery checks | Implemented — scoped independent QA passed; source/security review pending |
| M3 · Private projects and idea drafts | Private draft library, create/reopen/title search/rename/duplicate/delete drafts, active/Trash views, autosave, draft preferences, revisioned saving and conflict recovery | RLS isolation; saved idea/preferences survive reload; pending edits and revision conflicts handled honestly | Feature implementation complete through M3d — review pending |
| M4 · Idea workspace and AI planning | Plan-stage workspace to write/refine an idea, optional AI brainstorming with saved conversation, saved reference notes, 30/60/90s, accessible male/female voices, topic theme, storyboard generation | Reopen saved planning work; brainstorm is optional; validated provider output and failure paths; no silent voice substitution | In progress · M4a implemented |
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

### Independent M4a QA · November 10, 2026

- Passed app unit tests, 13 prototype regressions, 207 PostgreSQL assertions, schema lint, production build and typecheck. Live planning, project, Trash, preference, search and session suites passed.
- Additional live checks confirmed the saved draft and request notes are stored separately in the snapshot, history returns the newest 20 requests in order, and a retry after a draft revision change returns the original acknowledgement. Disposable fixtures were removed.
- No reproducible defects found in this pass. Next is M4b execution and provider failure handling. Commit and push the reviewed M4a slice to `dev` when ready.

### M4a planning request persistence · November 10, 2026

- Added authenticated brainstorm submission and recent request history. Each request stores the initial message and a snapshot of the saved draft and request reference text. Submission atomically checks the current revision and deduplicates retries within 24 hours.
- Production build, 52 app tests, 207 pgTAP assertions, database lint and live planning HTTP integration passed. HTTP coverage includes simultaneous retries, changed payloads, stale revisions and two-account isolation.
- This slice covers the API and persistence. Requests remain queued until M4b adds execution. Next, connect Gemini to saved brainstorming requests, persist validated replies and handle provider failures. Commit and push this slice after review.

### M4a whitespace validation review

- Matched PostgreSQL message trimming to JavaScript `trim()` in the RPC and table constraint. Direct RPC tests reproduced the bug before the fix and cover tabs, newlines, Unicode whitespace and valid messages with whitespace at their edges.
- Reran all 211 pgTAP assertions, database lint, the production build, typecheck, 52 app tests, 13 prototype tests and the live planning HTTP integration. The HTTP test confirms a blank request returns 422 without consuming the retry key. The next feature remains M4b brainstorming execution.

### M3d QA-05 repair and authorized commit · November 7, 2026

- Fixed history restoration of edited native GET form values. Search input is now controlled, follows applied server query changes, and synchronizes to the URL on pageshow/popstate both immediately and on the next animation frame after browser form restoration. Direct DOM synchronization also covers restored values when React state already equals the correct query. Listeners/pending frames clean up on unmount; normal unsubmitted editing remains intact.
- Added three event/timing regression tests: browser restoration after an event, unchanged ordinary edits, latest navigation/cleanup. **52 app tests**, **153 search HTTP/SSR assertions**, production build and strict typecheck pass. Whitespace checks pass. Independent pre-fix QA's 697 full-suite results remain historical; database/lint and unrelated backend suites were not rerun for this client-only repair.
- Browser verified Ocean → Moon → Back gives Ocean input/status/results, persists after Tab, Forward gives Moon, and repeated Back remains correct. Unfiltered → Moon → Back restores an empty input. Trash Moon → Ocean → Back/Forward also matches query/results; mobile 390px Back restoration had no horizontal overflow. Unsubmitted typing and Clear search still pass. Evidence in `design/qa/m3d/back-query-fixed*.png`.
- Disposable fixture account/seeded drafts removed; owned app/Supabase stopped, volumes retained, tab/viewport cleaned up. Founder explicitly requested fixing and committing this checkpoint; stage/publish checks exclude credentials/env files, rendered media, dependencies and build outputs. Independent repair retest/source review remains pending.

### Independent M3d QA — November 7, 2026

- Tested uncommitted title search against `b9b6947`; [independent QA report](QA_M3D_REVIEW.md). Found **QA-05 (P3)**: browser Back restores prior URL/results/status but leaves the subsequent query in the search field. Filtering remains correct; full reload resynchronizes it. No source fix made.
- Passed browser 22 matching titles across 20+2 pages, case/trim normalization, title-only no-match, literal punctuation/emoji, new-query cursor reset, Clear search after unsubmitted edit, and filtered move/Trash/restore navigation.
- Mobile search visually checked at actual 390 × 844 without horizontal overflow; basic keyboard progression passed. Broader accessibility/device/source-security review remains pending.
- Passed 49 app tests, 13 prototype tests, 197 PostgreSQL tests, 153 search assertions, 124 project assertions, 109 Trash assertions, 42 preference assertions and 10 session checks (**697 total**), schema lint, production build, typecheck and whitespace checks.
- Removed disposable browser/integration fixtures, reset viewport and stopped owned app/Supabase services with volumes retained. No provider calls or publication. Next: fix/retest QA-05, then complete review before M4. Commit and push reviewed M3d/QA changes to `dev` when approved.

### M3d — Private title search · November 7, 2026

- Added server-rendered GET search forms to Projects and Trash, with labelled input, Enter/Search submission, Clear search, applied-query status and separate no-match states. Empty search returns the full current view. Search is a case-insensitive literal title substring, not idea/reference search, fuzzy matching or wildcard syntax.
- Search RPC derives active ownership, filters title and active/trashed status before ordering/limit, preserves newest-update ordering and returns ordinary active docs or summary-only Trash results. Existing no-query RPCs and v1 cursors remain compatible. Search adds `q` to list API and search-bound cursor fingerprints; changed query/view with an old cursor is rejected.
- Pagination/first-page links and Projects↔Trash navigation retain the normalized query. Trash/restore returns to the filtered first page. A browser-discovered issue where Clear search kept an unsubmitted input edit was fixed by remounting the form on applied view/query changes; browser retest confirmed URL, input and results reset together.
- **Checks:** 197 PostgreSQL tests (33 new), clean schema lint, 49 app unit tests (3 new), 153 real search HTTP assertions, 124 existing project assertions, 109 Trash assertions, 42 preference assertions, 10 session checks, 13 prototype tests, strict typecheck and production build passed. Whitespace checks passed. Existing project race may add one assertion by lock order.
- Search tests include matches older than the unfiltered first page, literal percent/underscore/backslash/quotes, Unicode/emoji, title-only scope, two-owner isolation, inactive denial, matching-page traversal, cross-query/view cursor rejection, rename/Trash/restore updates and server-rendered pagination links.
- Browser: 22 matches → first page 20 → older page 2 with query retained; new unmatched title resets pagination and shows honest no-match state; Clear search restores all drafts, including after an unsubmitted edit. Move matching draft to Trash, switch views, restore and move again retained the search, with refreshed lists verified. Desktop 1280px and mobile 390px had no horizontal overflow; inspected screenshots under `design/qa/m3d/`.
- Migration `20261107000500_project_title_search.sql` applied locally and types regenerated. Disposable users/seeded drafts removed, owned app/Supabase stopped with volumes retained, QA tab/viewport cleaned up. No providers, video renders, cloud changes, publishing, or root prototype source edits.
- M3 feature implementation is complete; independent M3d QA/source/security review is pending. [Handoff](QA_M3D_HANDOFF.md). Changes remain uncommitted; remind the founder to commit/push after review. Next milestone is M4 AI planning, delivered in small slices.

### Independent M3c3 QA — November 7, 2026

- Tested uncommitted preferences against `1aa7f8e`; [independent QA report](QA_M3C3_REVIEW.md). No new reproducible defects found within tested scope; no source fixes made.
- Passed browser preference selection/save/reload, preference-only stale-tab conflict, saved-settings comparison and explicit saved-version choice. Distinct local preference copies were visible before recovery; restored 30s/male selections saved and survived clean reload.
- Mobile expanded controls passed visual inspection at actual 390 × 844 without horizontal overflow; basic label/keyboard checks passed. Broader accessibility/device/source-security review remains pending.
- Passed 46 app unit tests, 13 prototype tests, 164 PostgreSQL tests, 42 preference assertions, 124 project assertions, 109 Trash assertions and 10 session checks (**508 total**), schema lint, production build, strict typecheck and whitespace validation.
- Removed disposable browser/integration fixtures, discarded remaining listed QA recovery copy, reset viewport and stopped owned app/Supabase services with volumes retained. No provider calls or publication. Commit and push reviewed M3c3/QA changes to `dev` when approved.

### M3c3 — Editable draft preferences · November 7, 2026

- Added optional collapsed Video preferences inside the existing idea editor: target 30/60/90 seconds, beginner/intermediate/advanced audience, clear/conversational/direct tone, and male/female narration preference. Uses existing autosave and Save now; no new workflow step. Captions and topic-adaptive 2D visuals stay included. Voice type is explicitly a preference; no named provider voice/sample or generation is represented as available.
- API/SQL accept strict partial settings `{voice,captions,theme}` with only male/female, true, topic respectively. Partial updates retain existing settings. Text-only edits no longer reset a chosen voice. New revision content hashes include normalized settings; existing immutable snapshots are untouched. Duplicates and Trash/restore retain preferences.
- Autosave/dirty detection, queued acknowledgements, pending copies and conflict comparisons now include all preferences. Recovery cards show settings before choosing. New local backup schema 2 retains the owner/project key scope and reads schema-1 text-only copies, marking inherited settings clearly. Legacy uncertain requests preserve their original text-only body/key across another reopen before newer edits/preferences queue. No-settings create commands preserve their pre-migration request hash, keeping existing idempotency retries compatible.
- **Checks:** 164 PostgreSQL tests (31 new preference cases), clean DB lint, 46 app unit tests (8 new), 42 real preference HTTP assertions, 124 project assertions, 109 Trash assertions, 10 session checks, 13 prototype tests, production build and strict typecheck passed. Whitespace check passed. Existing project race may produce one extra assertion by lock order.
- Browser: selected all controls, autosaved and reloaded; stale preference-only change paused and comparison showed actual saved selections; explicit saved-version choice worked. Reopening two copies with identical title/idea but different length/voice showed distinct summaries, and restoring 30s/male saved and survived reload. Desktop 1280px and mobile 390px controls showed no horizontal overflow; screenshots inspected under `design/qa/m3c3/`. Full accessibility/device audit remains pending.
- Local migration `20261107000400_draft_preferences.sql` applied; DB types regenerated (public signatures unchanged). Started Docker Desktop in background because it was stopped. Disposable test identities/projects/local recovery copies cleaned up, owned app/Supabase stopped with volumes retained. No provider calls, paid voice selection, rendering, cloud publishing or root prototype changes.
- Independent review/QA pending: [handoff](QA_M3C3_HANDOFF.md). Changes remain uncommitted. PRD §7.2 also requires title search; this is now explicit as M3d rather than marking the entire library milestone complete prematurely. After that, proceed to M4 AI planning in small slices.

### Independent M3c2 QA — November 7, 2026

- Tested uncommitted Trash/restore against `584a8b5`; [independent QA report](QA_M3C2_REVIEW.md). No new reproducible defects found in tested scope; no application fixes made.
- Passed browser empty Trash, move confirmation/Cancel, active-card removal, hidden trashed editor, restore with preserved idea/multiline notes, and reload at lifecycle revision 4.
- Pre-Trash editor save after restoration correctly conflicted and retained local text; comparison showed the restored saved content. Explicit saved-version choice preserved server data. Stale Restore in another tab failed safely with Refresh view recovery.
- Desktop visual checks and populated Trash at actual 390 × 844 passed without horizontal overflow. Full mobile/accessibility/source-security review remains outside this scoped QA.
- Passed 38 app unit tests, 13 prototype tests, 133 PostgreSQL tests, 109 lifecycle HTTP assertions, 124 project assertions and 10 session checks (**427 total**), schema lint, production build, typecheck and whitespace checks.
- Removed disposable browser/integration fixtures, cleared rejected pending editor text via explicit saved-version choice, reset viewport and stopped owned app/Supabase with volumes retained. No provider calls or publication. Commit and push reviewed M3c2/QA changes to `dev` when approved.

### M3c2 — Reversible Trash and restoration · November 7, 2026

- Library cards now offer Move to Trash with inline confirmation/Cancel. Trash is a separate protected `/projects/trash` page, reachable from the library, with empty state, summaries, pagination and Restore draft. Only saved content is restored; local pending copies remain available through the existing recovery system. Permanent deletion and automatic purge are absent.
- Added same-origin, no-store DELETE `/api/v1/projects/:id` (202), POST `/api/v1/projects/:id/restore` (200), and GET project list `view=trash`. Both commands require exact expectedRevision JSON and an Idempotency-Key. List cursors bind `drafts-v1` or `trash-v1`; crossing views is rejected. Trash summaries contain only id/title/revision/deletedAt/updatedAt.
- New RPCs derive active ownership, lock the project, compare revision, and change deleted_at with an incremented edit_version plus a matching unchanged creative snapshot. Trashed records/history remain invisible to normal RLS reads and normal GET/PATCH/duplicate commands. Restoring keeps identity, content/settings/hash and history, while fencing pre-delete autosaves. Same-key retries return the original acknowledgement without reapplying a later lifecycle transition.
- **Checks:** 133 PostgreSQL tests (42 new lifecycle cases), clean schema lint, 38 app unit tests, 109 real Trash/restore HTTP assertions, 124 existing project assertions, 10 session checks, 13 prototype tests, strict typecheck and production build passed. Existing project race can produce 124 or 125 assertions by lock order. Whitespace checks passed.
- Browser: empty Trash → create/save source → Move to Trash → Cancel retains it → confirm removes active card → private Trash shows saved title/revision → Restore removes Trash card → reopen source with original idea/notes and revision 4. Desktop 1280px and mobile 390px showed no horizontal overflow; screenshots inspected under `design/qa/m3c2/`. Targeted layout checks only, not a full accessibility/device audit.
- New migration applied locally and DB types regenerated. Disposable users/drafts cleaned up, owned app/Supabase stopped with volumes retained. No providers, rendering, cloud provisioning, public publishing or root prototype changes. Independent review/source-security QA remains pending; see [handoff](QA_M3C2_HANDOFF.md).
- Changes remain uncommitted; remind the founder to commit/push after review. Next slice: M3c3 editable draft preferences; AI planning remains M4.

### Independent M3c1 QA — November 7, 2026

- Tested uncommitted duplication and preview repair against `15f3654`; [independent QA report](QA_M3C_REVIEW.md). No new reproducible defects found in tested scope; no application fixes made.
- Passed browser source → duplicate → revision-1 copy with saved idea/notes, copy-only edits with unchanged source, stale library rejection, refresh and successful retry against updated source.
- **QA-04 independently closed:** differing multiline reference notes are visible on recovery cards before restoration; chosen preview matched restored/saved/reloaded fields. Desktop/mobile preview inspection passed at actual 1280px and 390px widths, without horizontal overflow.
- Passed 36 app unit tests, 13 prototype tests, 91 PostgreSQL tests, 124 project HTTP assertions and 10 session checks (**274 total**), schema lint, production build, strict typecheck and whitespace validation. Race-dependent project assertion count was 124 in this run.
- Removed disposable browser/integration fixtures and discarded remaining pending QA copy, reset viewport and stopped owned app/Supabase services with volumes retained. No provider calls or publication.
- Separate source/security review and broader release checks remain pending. Commit and push reviewed M3c1/QA changes to `dev` when approved.

### M3c1 — Duplicate idea drafts and QA-04 · November 7, 2026

- Fixed QA-04: every recovery card now shows labelled idea and reference-note previews, with explicit empty placeholders and scrollable long text. Pending records and restore/discard behavior are unchanged.
- Added authenticated `POST /api/v1/projects/:id/duplicate` and atomic `duplicate_idea_project` RPC. Command accepts only expectedRevision plus the existing idempotency header. Active ownership, exact saved revision and an undeleted source are checked under lock. Copy starts at revision 1 with title `Copy of …`, saved idea/notes/duration/audience/tone/settings, a new identity and recomputed hash. Source/history are preserved. No jobs, approvals, generated artifacts, social connections or local pending copies are cloned.
- Idempotent retries return the same original copy acknowledgement for 24 hours, even after subsequent source/copy edits. Changed key/body returns 409. A new command for a stale source returns revision conflict. Repeated clicks within one button are blocked; uncertain retries keep the same key. The library uses separate card links and buttons, without nested interactive elements.
- **Checks:** 91 PostgreSQL tests (27 new duplicate cases), schema lint clean, 36 app unit tests, 125 real project HTTP assertions, 10 session checks, 13 prototype tests, strict typecheck and production build passed. Duplicate/save race assertion count can vary by one depending on which transaction obtains the lock first. Whitespace checks passed.
- Browser: create/save source → library duplicate → copy opens at revision 1 with notes → edit/autosave copy → library/source unchanged. For QA-04, two pending copies with identical blank titles/idea text and different notes were generated by pausing autosave with title validation; reopening visibly showed both distinct note previews before restore/discard. Desktop 1280px and mobile 390px measurements had no horizontal overflow. Evidence under `design/qa/m3c/`; mobile screenshots are scaled captures, not a full mobile visual sign-off.
- Disposable browser/server test identities/projects removed; pending browser fixture copies discarded through the UI. Local app and Supabase stopped, database volumes retained. No providers, rendering, deployment or publishing; root prototype unchanged. New migration applied locally and generated DB types updated.
- Independent QA/source review remains pending; [handoff](QA_M3C_HANDOFF.md). Changes remain uncommitted. Next slice: M3c2 safe delete/restore, followed by M3c3 draft preferences.

### Independent M3b QA — November 7, 2026

- Tested uncommitted autosave/recovery against `97a42e1`; [independent QA report](QA_M3B_REVIEW.md). Found **QA-04 (P3)**: recovery cards omit pending reference notes, so copies differing only in notes cannot be meaningfully previewed before restoration. Notes themselves were retained; no source fix made.
- Passed browser typing during delayed PATCH, lost successful response with newer typing, explicit reopening recovery/replay, persisted latest content, separate pending copies, two-tab conflict comparison and explicit keep-local resolution. Final fixture revisions were 1–8 without duplicate replay revisions.
- Ctrl-click preserved the source editor and the subsequent ordinary-link warning remained active. Native dialog cancellation was inconclusive. Mobile override did not change the measured viewport; mobile remains unverified in this pass.
- Passed 35 app unit tests, 73 project HTTP assertions, 10 session checks and 13 prototype regressions (**131 total**), production build, typecheck and whitespace validation. Database tests/lint not rerun: schema unchanged.
- Removed disposable identity/project/revisions/profile, discarded listed QA recovery copies, reset viewport and stopped owned app/proxy/Supabase services with volumes retained. No provider calls or publication.
- Next: fix/retest QA-04 and finish outstanding source/mobile/browser checks. Commit and push the reviewed M3b slice and QA evidence to `dev` when approved.

### M3b — Autosave and pending-edit recovery · November 7, 2026

- Title, idea and reference notes autosave after 900ms idle, with Save now available. One mutation at a time; newer keystrokes remain editable and queue behind the acknowledged snapshot. Saved appears only for confirmed current content. Reverting during a request still queues a compensating save if necessary.
- Each editor mount uses an independent localStorage record under its authenticated owner/project. Local text and uncertain operation key/body/base revision survive reopening. Recovery requires an explicit restore/discard choice before autosave proceeds. Invalid/mismatched records are ignored. No credentials are stored. A replacement must be written before retiring the recovered source; quota/unavailable storage produces a warning.
- Network/5xx/invalid-response failures retain the original operation for exact idempotent replay, including after reopening. Up to four attempts use 1/2/4s delays, then manual retry; mutation timeout 30s. Online events resume pending work. Session/validation errors pause automatic retry. Conflicts pause writes, fetch the latest saved copy for comparison, and require explicit discard-local or replace-saved choice with another revision check.
- **Verification:** 35 app unit tests (21 autosave scenarios), 73 real local project HTTP assertions (including lost successful response → replay → newer queued edit and persisted offline recovery), 10 existing session checks, 13 prototype tests, production build and strict typecheck passed. No database changes; database tests/lint were not rerun for M3b.
- Browser verified an initial transport-binding failure preserved pending text; fixed the browser adapter and rebuilt. Reopening offered that copy, explicit restore autosaved it, and a later edit autosaved without clicking Save. Two-tab conflict preserved the rejected tab's text, displayed the saved copy, and explicit keep-mine saved a new revision that survived reload. Desktop 1280px and mobile 390px had no horizontal overflow; evidence in `design/qa/m3b/`.
- **Limits:** browser-local recovery is not an encrypted vault or cross-device offline app. The page itself still requires server access to open. Clearing browser storage/using another device loses unsynced local copies; storage failures show a warning. Copies can persist across sign-out for the same owner's next sign-in. Other signed-in owners do not hydrate them, but local device/origin access is not an authorization boundary. No cross-tab merge or lease; separate copies and server conflicts prevent silent replacement. Native leave prompts are best-effort; recovery is the fallback.
- Disposable test users/drafts removed; local services stopped with database volumes retained. No provider calls, media rendering, schema/credential changes, deployment or publishing. Root prototype preserved. Source/security review and independent M3b QA remain pending; see [handoff](QA_M3B_HANDOFF.md).

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

Next: **M4b — execute saved brainstorming requests and persist validated replies and failures.** Independent QA-05 retest and source/security checks remain tracked in [QA_M3D_HANDOFF.md](QA_M3D_HANDOFF.md). Generation-state filters, account-wide defaults and named voice catalog/samples remain later work.

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

- November 7, 2026: Fixed QA-05 search history/input synchronization, added three regressions and verified browser Back/Forward in both libraries. Founder authorized committing/pushing M3d, repair and independent QA evidence to `dev`.

- November 7, 2026: Implemented M3d title search, verified filtered pagination/lifecycle flows and fixed Clear search retaining an unsubmitted input. M3 feature implementation is complete; review/commit checkpoint precedes M4 AI planning.

- November 7, 2026: Founder approved committing/pushing M3c3 and its independent QA report/evidence to `dev`. Independent QA reported 508 passing tests/assertions and no new defects. Publication checks exclude credentials/env files, rendered video/audio, dependencies and build outputs. Separate source/security review remains pending.

- November 7, 2026: Implemented M3c3 editable draft preferences with autosave/recovery and legacy request compatibility. Recorded approved title search explicitly as M3d before completing the private-library milestone. No live voice/provider calls.

- November 7, 2026: Founder approved committing/pushing M3c2 and its independent QA report/evidence to `dev`. Independent QA reported 427 passing tests/assertions and no new defects. Publication checks exclude credentials/env files, rendered video/audio, dependencies and build outputs. Separate source/security review remains pending.

- November 7, 2026: Implemented M3c2 private Trash/restoration with lifecycle revision fencing and integration/browser verification. No hard-delete or purge; editable preferences are next.

- November 7, 2026: Founder approved committing/pushing M3c1 and its independent QA report/evidence to `dev`. Independent QA reported 274 passing tests/assertions, no new defects, and QA-04 closed. Publication checks exclude credentials/env files, rendered video/audio, dependencies and build outputs. Separate source/security review remains pending.

- November 7, 2026: Implemented M3c1 saved-draft duplication and fixed/retested QA-04 recovery note previews. Deletion/restore and preferences remain separate upcoming slices.

- November 7, 2026: Founder approved committing/pushing M3b and its independent QA report/evidence to `dev`. QA-04 (P3, missing notes preview) remains documented and unfixed; no notes loss was reported. Credentials/env files, dependencies, rendered video/audio and build outputs remain excluded.

- November 7, 2026: Implemented M3b autosave, persisted pending copies, retry serialization and explicit conflict recovery. No database changes; M3c draft operations/preferences remain next.

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
