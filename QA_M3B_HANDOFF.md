# M3b autosave and recovery — review handoff

Implemented November 7, 2026 against `97a42e1`. Independent source/security review and independent QA remain pending. This report records implementation verification, not an independent sign-off.

## Implemented flow

Sign in → open draft → type → 900ms idle → saving → server acknowledgement → Saved. Typing during a request remains enabled; a newer snapshot queues behind it. Save now flushes immediately. Only one request is active per editor. Native navigation protection remains active while unsaved/uncertain work exists, including modified-click protection from M3a.

Each owner/project/editor mount has an independent localStorage backup. Reopening lists matching valid local copies before autosave begins. Restore uses pending text and replays any uncertain operation with its exact original key/body; a stale base without an uncertain operation pauses for comparison. Discard removes only listed unchanged records. Restored sources are retired after a replacement is durable or the local content is confirmed saved. Another tab's updated record is not deleted.

On network/5xx/unparseable replies: preserve uncertain operation, retry at 1/2/4 seconds (four attempts total), then show manual retry. Saves time out after 30 seconds; comparison after 15. Offline events pause sending; reconnect resumes. Acknowledgement of an older snapshot never overwrites newer typing. Session/validation failures stop automatic retry. Blank title pauses saving until corrected.

On conflict: keep local editor text → load saved version (GET) → show both versions → choose saved or explicitly replace saved with local edits. Replacing still uses the compared revision, so a third save produces another conflict rather than a blind overwrite.

## Verification performed

- **35 app unit tests**, including 21 autosave scenarios: debounce, concurrent typing, compensating revert, exact ambiguous replay, replay after reopening, offline recovery, user/project/tab isolation, stale recovery across reload, explicit conflict choices and racing third save, quota failure, validation recovery, late disposal, bounded retries, expired session, timeout, malformed records and mismatched success acknowledgements.
- **73 real local project integration assertions**. Added controller → actual HTTP → PostgreSQL checks for committed-but-dropped response, same-key replay before queued edits, exact revision count, offline pending notes, explicit reopening recovery and removal after acknowledgement. Existing ownership/concurrency/grants/API validations still pass.
- **10 session integration checks**, **13 root prototype tests**, production build and strict typecheck pass. No schema change; database pgTAP/lint not rerun in this slice.
- Browser: found and fixed unbound browser fetch transport; the failed attempt retained its local copy. Reopened in another tab, restored and autosaved to revision 2. Edited notes without Save to revision 3. Stale tab retained its text on conflict, loaded the saved copy, explicitly chose local text, and saved revision 4; reload retained it. Native unload cancellation remained inconclusive, so reopening used a fresh tab. No claim that all native dialogs were verified.
- Actual 1280px desktop and 390px mobile measured without horizontal overflow; screenshots under `design/qa/m3b/`. These are targeted checks, not a full accessibility audit.

## Independent QA to run

1. Type rapidly and continue typing during a deliberately delayed PATCH. Confirm no keystrokes disappear and the newest snapshot eventually reaches Saved.
2. Drop the response after a successful PATCH, change the text, then retry/reload. Confirm the original request replays once and the newer text follows with exactly one additional revision.
3. Take the browser offline, edit all fields, reopen after connectivity returns, and explicitly restore. Also verify storage blocked/quota failure gives a warning without blocking server saves.
4. Open two tabs, save competing edits, compare both copies, test each explicit choice and a third racing save. Unsynced copies from separate mounts must remain separate.
5. Sign out and use another account: its editor must never offer the first owner's recovery copies. Sign back in as the first owner to recover them. Include project-to-project isolation and Back/Forward navigation.
6. Check modified link clicks, ordinary cancellation, close/reload warnings, screen-reader save/error announcements, long reference text, and conflict/recovery controls on mobile.
7. Simulate expired sessions, four failed retries, malformed JSON, 30-second timeout, 24-hour idempotency expiry and a fresh conflict; confirm unsaved text is retained and no permanent error is labelled Saved.

## Limits and cleanup

Local pending copies are unencrypted same-origin browser data, not an authorization boundary against someone with device/origin access. They survive sign-out for later recovery by the same owner. Clearing storage or changing browser/device loses unsynced copies. Opening the page still needs the server; no service worker, background closed-tab sync, cross-device pending sync, automatic merge, backup expiry cleanup, revision browser or cross-tab lease is implemented. Old invalid entries are ignored rather than silently deleted; quota failures are visible.

Disposable local test users/projects were removed; owned app/Supabase services stopped and volumes retained. No AI requests, renders, deployments, publishing or prototype source changes. Next feature after review: M3c draft operations/preferences, delivered in small slices. Commit/push reminder applies; this work is uncommitted.
