# M3c1 — saved-draft duplication and recovery preview fix

Implemented against `15f3654` on November 7, 2026. Independent review/QA pending. This slice implements duplication only; delete/restore and draft preferences follow separately.

## Behavior and contract

Projects → Duplicate draft → new owned draft, `Copy of …`, revision 1, saved idea/reference notes/duration/audience/tone/settings preserved. Copy and source save independently. Card navigation and duplicate buttons are separate accessible controls. Stale source revisions show a refresh action. The action copies persisted content; unsaved local edits and source history are excluded. The database schema currently has no runtime/approval/publishing children; future modules must continue excluding them.

POST `/api/v1/projects/:id/duplicate` requires exact JSON `{expectedRevision}` and Idempotency-Key. Same-owner active lifecycle and undeleted source checks are inside a pinned-search-path authenticated-only RPC. Source share lock gives an exact revision snapshot. Retry is resolved before checking a now-newer source, returns the original copy acknowledgement, and never makes another project within 24 hours. Changed body/key conflict and missing/foreign/stale/inactive errors follow the project API contract. Unicode title truncation preserves whole codepoints while enforcing the browser's 140 UTF-16-unit maximum.

QA-04: recovery cards now preview all recoverable creative fields, including labelled reference notes and explicit empty placeholders. Scrollable long notes remain plain escaped text. No storage or recovery-command format changed.

## Evidence

- 91 real PostgreSQL tests: existing 64 plus 27 duplication cases (ownership, input, replay, stale source, independent revisions/edits, settings, Unicode title, tombstones/inactive owners).
- Database lint clean; generated types updated from local applied migration.
- 36 app tests, 125 project HTTP assertions, 10 session integration checks, 13 root prototype tests, strict typecheck and production build passed. The save/copy race adds an assertion when copying wins, so total project assertions can vary by one between successful runs.
- HTTP tests cover concurrent duplicate replay, independent commands, bad inputs/origins/keys, GET denial, source/copy independent editing, original acknowledgement after later edits, stale source, settings and exact snapshot behavior while saving concurrently.
- Browser created a source with notes, duplicated via library, opened fresh revision 1, edited/autosaved the copy, and observed the source unchanged. For QA-04, two identical title/idea local copies with different notes were created by blank-title validation pausing autosave; reopening showed both notes before any restore/discard. These were fixture copies and were discarded through the UI afterward.
- Actual desktop 1280px and mobile 390px measurements showed no horizontal overflow for the checked views. Screenshots in `design/qa/m3c/`, including copied editor and distinct recovery notes. Captures may be scaled/stale immediately after client transitions; authoritative browser content/values were also checked. No full mobile/accessibility audit claimed.

## Independent review checks

1. Duplicate a fresh, edited and long-Unicode-title draft. Confirm preserved creative inputs, fresh identity/revision and source independence.
2. Drop a successful duplicate response and retry unchanged: one copy, original acknowledgement. Confirm new command keys intentionally create separate copies.
3. Save the source in another tab after loading the library, then duplicate the old card. Confirm conflict and Refresh library; refresh and retry successfully.
4. Exercise cross-user/inactive/deleted-source denial directly through both app API and Supabase RPC; check no forged ownership fields.
5. Check two recovery copies differing only in reference notes, including empty/long/multiline notes. Confirm previews match the chosen restored copy on desktop/mobile and keyboard navigation reaches each restore action.
6. Review future-module guard: when jobs/storyboards/approvals/media arrive, duplication must continue to copy creative inputs only.

## Cleanup and limits

Only local migration/services were used. Disposable users/source/copy drafts removed. Browser fixture pending copies discarded; owned tabs/viewport overrides cleaned up. Local app/Supabase stopped with database volumes retained. No provider calls, video rendering, external publication or root prototype changes. No revision browser, duplication of unsaved work, delete/restore or preference controls in this slice. Prior auth/security review limits remain pending.

Changes remain uncommitted. Next: review, commit/push reminder, then M3c2 safe deletion/restore.
