# M3a private idea drafts — review and QA handoff

Implemented November 7, 2026. This is the manual-save foundation, not the completed autosave milestone. Independent review is pending. The separate auth source/security review remains pending too.

Review follow-up: fixed the modified-link P2 by ignoring modified/non-primary gestures and retaining dirty state after an ordinary warning is accepted until the editor unmounts. Added three targeted tests; 14 app unit tests and production build pass. Earlier integration/browser results below predate this client-only fix. Manually verify Ctrl/Cmd-click opens another tab without prompting, then reload the original unsaved editor and confirm it still warns; also cancel an ordinary link warning and check the text remains.

## Scope

Sign in → Projects → New draft → title, idea, reference notes → Save draft → library → reopen. Renaming uses the title field and Save draft. Creating a draft is explicit POST; navigating to `/create` does not create one. Each user owns separate projects. No AI, rendering, social accounts, billing, or prototype changes.

## Evidence

- 64 PostgreSQL pgTAP tests pass, including 35 new project cases. Schema lint has no warnings/errors.
- 64 local HTTP integration assertions pass: anonymous/foreign/inactive users, origin/body validation, original-response replay, changed-key conflict, parallel same-key creation, competing saves, revision history, cursor paging, and GET without writes.
- 11 app unit tests, 10 existing session integration checks, and 13 root prototype tests pass. Strict typecheck and production build pass.
- Browser: create, save idea/notes, reload, return to library, reopen, rename/save. At 1280px desktop and 390px mobile, no horizontal overflow. Viewport screenshots in `design/qa/m3a/`; disposable browser account and its drafts were removed afterward.

## Review targets

- Migration `20261107000100_private_idea_projects.sql`: explicit authenticated-only RPC grants, pinned search path, active-owner locking, composite head/ownership foreign keys, direct-write denial, row locks and scoped idempotency.
- Project route handlers: independent session checks, safe errors, no-store, same-origin Host/Origin check, bounded streamed JSON, no caller-supplied ownership.
- Client editor: acknowledge saved revision only after success, freeze fields during request, retain command key on unchanged retry, preserve text on conflict/failure. No fake generated outputs.

## Manual checks still needed

1. In an ordinary browser, change unsaved text and cancel a sidebar/link navigation and reload/close prompt. Automation could not reliably observe the native confirmation, so cancellation is not claimed as verified. Browser Back/Forward protection is incomplete until M3b durable recovery.
2. Simulate a dropped save response, retry unchanged text, then edit and retry; check the acknowledged revision and conflict behavior.
3. Open two tabs, save conflicting edits, retain text from the rejected tab, then reload the saved version explicitly.
4. Inspect keyboard navigation, screen-reader announcements and error focus in a full accessibility pass.

## Intentional limitations and next slice

Unsaved changes are memory-only and may be lost if the page/browser exits. This UI explicitly says manual saving. M3b adds debounced autosave, serialized queues, owner-scoped pending edits, offline/retry states and conflict recovery. Duplicate/delete and editable presets follow separately. No revision-history browser, scheduled idempotency cleanup or deployed load/security audit yet. No live providers were called.
