# M3c2 — private Trash and restoration

Implemented November 7, 2026 against `584a8b5`. Independent review/QA pending. Scope is reversible deletion of saved idea drafts; there is no permanent deletion or background purge.

## Workflow

Projects → Move to Trash → inline confirmation or Cancel → confirmed DELETE → source disappears from active library. Trash link → own paginated summaries → Restore draft → Trash row disappears → Projects → reopen restored content. No lifecycle actions are exposed inside the unsaved editor in this slice.

Both commands require exact JSON `{expectedRevision}` (1–2147483646), same origin/Host, JSON/body limits and Idempotency-Key. DELETE acknowledges 202 with id/revision/status=trashed/deletedAt. Restore POST returns full draft, 200. Active and Trash cursors are bound to their view; unknown/duplicate queries are rejected. Trash includes only id/title/revision/deletedAt/updatedAt, never creative text.

The active profile is locked and the owned project row is locked for update inside a pinned-search-path authenticated RPC. Every lifecycle transition advances edit_version and inserts a matching unchanged creative snapshot; restoring preserves id, title, idea, notes, preferences, content_hash and history. Old authoring requests cannot overwrite the newly restored head. Normal RLS/detail/save/duplicate continue to hide/refuse Trash. Client table writes and private helper execution remain denied.

An identical key/body replay returns the original acknowledgement without reapplying the transition, even after later delete/restore cycles. It is not a claim about current state: read GET/list for that. Different body with retained key is 409. Fresh wrong-state/missing/foreign resources are 404; stale version is 409; inactive owner 403. UI retains its operation key for uncertain retry and reloads the relevant view on acknowledgement.

## Verification performed

- **133 PostgreSQL tests**, including **42 new lifecycle checks**: grants/ownership, input constraints, no forged state fields, Trash invisibility, summary-only access, saved content/settings/hash/history preservation, lifecycle version fences, state reversal replays and inactive owners. Schema lint clean. Migration applied locally and types regenerated.
- **109 real Trash/restore HTTP assertions**: anonymous/foreign/inactive access, same-origin/key validation, concurrent same-key commands, detail/editor/save/duplicate blocking, summary schema, restored content, pre-delete autosave fencing, retained local pending records/conflict resolution, paging/cross-view cursor validation and save/delete race.
- Existing **124 project HTTP assertions**, **10 session checks**, **38 app tests**, **13 root prototype tests**, production build and strict typecheck passed. Existing project race can report 124 or 125 assertions by transaction order. Whitespace check passed.
- Browser verified empty Trash, create/save source, confirmation Cancel, actual move, active empty state, private Trash summary, Restore, empty Trash afterward, library reopen with unchanged idea/notes and revision 4. Desktop 1280px and actual mobile 390 × 844 showed no horizontal overflow; inspected screenshots under `design/qa/m3c2/`.

## Independent review checklist

1. Confirm ordinary move, Cancel, restore and empty states; use long/multiline/Unicode titles and multiple Trash pages on desktop/mobile.
2. Hold an old editor open, delete/restore in another tab, then save old edits. Confirm no silent overwrite, old local copies remain recoverable, and explicit conflict choice uses the restored revision.
3. Save in another tab after loading a library card; confirm stale deletion is rejected and Refresh view is offered. Repeat stale restoration/state-change races.
4. Drop a successful delete/restore response and retry unchanged. Confirm original acknowledgement and no extra lifecycle revision. Repeat old request after the opposite transition; original replay must not reverse newer state.
5. Attempt normal GET/PATCH/duplicate/direct-table reads on Trash, cross-user/inactive API/RPC access, and cursor reuse between active/Trash lists. Check errors do not disclose foreign resources.
6. Keyboard/screen-reader focus and status/error handling, mobile confirmation controls, network timeout and session expiry still need full independent coverage.

## Limits and cleanup

No purge/retention expiry, permanent deletion, account deletion, bulk actions, Trash creative preview, or runtime/media/post cancellation. Saved drafts stay in Trash in the current version. Future generation/publishing modules must add active-work/reference handling before using this lifecycle with those resources. Browser-local unsaved copies are retained; they are not part of server restoration and remain device/storage dependent. Previous auth/source-security/release checks remain pending.

Disposable local accounts/drafts/history removed, browser tab/viewport cleaned up, owned app/Supabase stopped with volumes retained. No provider requests, media rendering, cloud changes, deployment or root prototype edits. Changes remain uncommitted; remind the founder to commit/push after review. Next feature is M3c3 editable draft preferences, followed by M4 AI planning.
