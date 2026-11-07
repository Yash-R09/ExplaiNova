# M3c3 — editable draft preferences

Implemented November 7, 2026 against `1aa7f8e`. Independent review/QA pending. This slice adds per-draft preferences; no provider calls, named voice catalog/samples or account-wide defaults.

## Workflow and scope

Open draft → optionally expand Video preferences → choose target 30/60/90s, beginner/intermediate/advanced audience, clear/conversational/direct tone and male/female narration preference → existing autosave/Save now → reload. Captions and topic-adaptive 2D visuals are required defaults, not disabled choices. The voice label explicitly describes a saved type preference; it does not claim a free-tier named voice has been verified or connected. Actual provider IDs/samples/entitlement checks arrive in later planning/narration work, respecting the founder's free-tier restriction.

Preferences participate in dirty detection, serialized snapshots, acknowledgement checks, offline records and conflicts. Recovery cards and saved-version comparison show all settings before the user chooses. Text-only changes preserve the saved voice. Duplicate and Trash/restore preserve preferences and historical snapshots.

## Compatibility and authorization

- New migration replaces validator/append/create/save functions with unchanged public signatures and explicit existing grants. SQL and API accept only voice male/female, captions true and theme topic; reject arbitrary provider IDs or ownership/settings injection. Partial nested settings merge against the locked current snapshot.
- New snapshot hashes include normalized settings; old history stays immutable. Create without settings retains its prior normalized request hash for preexisting idempotency keys. Save hashes its exact original command as before.
- New local schema 2 keeps the owner/project key prefix. Schema-1 text copies inherit currently saved preferences and are labelled as text-only. Their uncertain operation retains exactly its old text-only request key/body even after another reopen; only after acknowledgement can newer preferences queue. A legacy acknowledgement never overwrites newer selected preferences. Recovery sources retire only after durable replacement or confirmed save.
- Draft settings do not mutate profiles/defaults. Ownership/lifecycle validation, revision fences and original-response idempotency remain mandatory. No credentials are stored in local recovery records.

## Verification performed

- **164 PostgreSQL tests**, including **31 new preference cases**: strict settings validation/defaults, partial nested merge, no voice reset on text edits, snapshots/hashes, duplicate/Trash preservation, stale/foreign access, old create hash and legacy save acknowledgement semantics. DB lint clean.
- **46 app unit tests**, including eight new contract/controller tests: preference-only edits, newer choices during in-flight save, distinct pending copies, preference conflicts, legacy text inheritance, exact replay through schema migration and another reopen, malformed preference rejection and defensive view copies.
- **42 new real preference API assertions**: committed-but-dropped preference response, original replay before newer selections, text-only preservation, nested partial merge, offline recovery, duplicate/Trash retention, stale updates, historical settings and actual text-only legacy replay followed by new selections.
- Existing **124 project**, **109 Trash**, **10 session** assertions/checks and **13 root prototype tests** pass. Existing project race can report 124/125 by lock order. Production build, strict typecheck and whitespace checks pass; generated DB types unchanged because public signatures stayed the same.
- Browser saved/reloaded 30s/advanced/conversational/male; another tab saved 90s/direct/female; stale preference-only change paused and comparison displayed the actual saved selections. Explicit saved-version choice worked. Two pending copies with identical blank title/idea but different length/voice were created by validation pausing autosave; recovery showed their distinct summaries. Restoring 30s/male, correcting title and saving persisted at revision 5. Remaining fixture copy explicitly discarded. Actual 1280px desktop and 390px mobile controls showed no horizontal overflow; inspected screenshots under `design/qa/m3c3/`.

## Independent checks to perform

1. Exercise every preset, select changes during delayed/failed saves, undo a preference while a snapshot is in flight, and verify exact acknowledged selections on reload.
2. Drop a successful preference response and retry after changing more settings; verify original replay followed by one new revision, without lost typing/choices.
3. Recover schema-1 text-only and uncertain-operation records from the prior build. Confirm old request bodies remain unchanged, inherited preferences are labelled and newer choices survive replay. Test another reload while still uncertain.
4. Recover two copies differing only in settings; inspect summaries and explicitly restore/discard each. Repeat stale preference conflicts, partial API settings, duplicate and Trash/restore.
5. Check cross-owner/inactive denial, invalid/null/unknown settings, mandatory caption/topic validation, keyboard/labels, long text/recovery layout and screen-reader announcements.

## Cleanup and remaining work

Started Docker Desktop hidden because it was stopped; used local Supabase only. Disposable users/projects and browser pending copies removed; owned app/Supabase stopped with database volumes retained, QA tabs/viewport cleaned up. No provider requests, rendering, external publication, cloud migrations or root prototype source changes. Full accessibility/device/load/security review remains outstanding; old release limitations still apply.

Changes are uncommitted; commit/push reminder applies. Approved PRD §7.2 title search remains a small M3d slice before calling the private-library milestone complete. AI brainstorming/storyboards remain M4; account defaults and named free-tier voice catalog/previews are later work.
