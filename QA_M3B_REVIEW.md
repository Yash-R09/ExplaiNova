# Independent M3b QA — November 7, 2026

Scope: uncommitted autosave/pending-edit recovery changes against `97a42e1`. Tested production Next.js, local Supabase, disposable local identities and real browser UI. No application fixes made.

Implementation follow-up (M3c1, November 7): QA-04 has been fixed by adding labelled reference-note previews and empty states to recovery cards. Implementation browser testing observed two copies with identical titles/ideas but distinct notes before choosing a copy. This is a follow-up note, not an independent retest; the original finding/evidence below is preserved. See `QA_M3C_HANDOFF.md`.

## Finding QA-04 · P3 · Recovery previews omit pending reference notes

Reproduction:

1. Open the same saved draft in two tabs with identical title and idea text.
2. Make different reference-note edits in each tab while PATCH requests fail.
3. Reopen the draft in a third tab.

Actual: two recovery cards show the same title and idea text, plus timestamps/base revisions. Neither displays its pending reference notes. The disabled editor below shows server notes, not either local copy. Users cannot inspect the meaningful difference before choosing **Restore this copy**.

Expected: show each copy's reference notes, or provide an expandable preview of every recoverable field before restoration/discard. This is a usability issue; notes were retained and restored in testing, and no data loss is claimed.

Location: `apps/web/src/components/idea-draft-editor.tsx:24`, recovery-card rendering. It renders `fields.title` and `fields.brief` but omits `fields.referenceText`.

[Screenshot](design/qa/m3b/independent-recovery-missing-notes.png).

## Browser checks

- Created a private draft and saved without generation/provider activity.
- Delayed PATCH responses by four seconds using an ignored local proxy. Fields remained editable during **Saving…**. Newer typing survived the earlier acknowledgement, queued behind it, and persisted at revision 3 after reload.
- Dropped a successful PATCH response after upstream HTTP 200, then held later PATCH requests at 503. The editor retained newer notes and reported unconfirmed save rather than Saved.
- Reopened the draft; explicit recovery choice appeared with editing/autosave paused. Restoring replayed the uncertain request, then persisted the newer notes. Acknowledged revision 5; no duplicate revisions from replay.
- Separate mounted editors retained two independent notes-only recovery records (QA-04).
- Resumed service and explicitly retried pending work successfully.
- Saved conflicting notes in two tabs: stale save paused, retained local notes, loaded saved revision 7 with its notes for comparison, and saved local notes as revision 8 only after **Replace saved version with my edits**.
- Reload retained the saved notes. The remaining independent local copy was offered separately and was discarded through the UI during cleanup.
- Ctrl-click Settings did not navigate the source editor or show a leave prompt. A subsequent ordinary click still produced the unsaved warning. Dialog dismissal timed out and subsequent navigation state was ambiguous; cancellation is not claimed as verified in this pass.
- Desktop recovery UI was visually inspected at 1280px. Mobile override attempt left the observed viewport at 1280px; mobile validation remains unverified in this pass. Override reset.

Final fixture database history was exactly **1, 2, 3, 4, 5, 6, 7, 8**, consistent with the intentional saves and no duplicate revision for the dropped-response replay.

## Supporting automated checks

| Check | Result |
| --- | --- |
| App unit tests | 35/35 passed, including 21 autosave scenarios |
| Project HTTP integration assertions | 73/73 passed |
| Session integration checks | 10/10 passed |
| Root prototype regressions | 13/13 passed |
| Production build | Passed |
| App typecheck | Passed |
| Diff whitespace check | Passed |

**131 tests/assertions passed.** Unit/integration coverage includes offline restore, owner/project/tab isolation, storage quota errors, bounded retries, timeouts, session failures, ambiguous replay, conflicts and malformed acknowledgements. These automated checks are distinct from the browser scenarios above.

## Limits and cleanup

- Browser failures were simulated at the HTTP proxy; native browser Offline mode was not used. Full offline/reconnect events, blocked browser storage, account-switch isolation and timeout/idempotency-expiry edge cases were covered only where present in automated tests, not independently through the browser.
- No full accessibility audit, mobile visual sign-off, multi-device matrix, soak/concurrency stress testing, or separate source/security review.
- No schema changes in this slice; database tests/lint were not rerun. The previous M3a database results are historical evidence.
- Removed disposable browser account, project/revisions and profile; integration suites removed their own fixtures. Discarded listed browser recovery copies used for QA. Stopped owned app server, proxy and Supabase; volumes retained. Ignored helper scripts/logs remain under `.cache/`.
- No provider calls, video renders, external mail, deployment, commits or pushes. Root prototype and preexisting implementation changes preserved.

Next: fix/retest QA-04, finish outstanding browser/mobile/source-review checks, then proceed with the next approved slice.
