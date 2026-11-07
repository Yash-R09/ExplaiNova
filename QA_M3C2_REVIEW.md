# Independent M3c2 QA — November 7, 2026

Scope: uncommitted reversible Trash/restore changes against `584a8b5`. Tested production Next.js and local Supabase with disposable identities. No application source fixes made.

## Result

No new reproducible defects found within the tested flows. Separate source/security review and broader release checks remain outstanding.

## Manual browser checks

| Flow | Result |
| --- | --- |
| Empty Trash | Honest empty state with return navigation |
| Create/save source | Emoji title, idea and multiline reference notes saved at revision 2 |
| Move to Trash → Cancel | Confirmation dismissed; active draft retained |
| Confirm move | Active card disappears; Trash summary shows title and revision 3 |
| Open trashed editor directly | Not-found recovery page; no creative fields exposed |
| Restore | Trash becomes empty; restored record retains identity and saved creative content at revision 4 |
| Old pre-Trash editor attempts save after restore | Conflict blocks silent overwrite; unsaved local notes remain available |
| Compare restored version | Shows revision 4 and original idea/multiline notes; explicit saved-version choice restores them in editor |
| Reload restored editor | Original title/idea/notes and revision 4 persist |
| Stale Restore from another tab | Action disabled after safe current-state message; Refresh view shows empty Trash |
| Desktop Trash/editor | Visually inspected at 1280px |
| Mobile populated Trash | Visually inspected at actual 390 × 844; scroll width 390px, no horizontal overflow |

Evidence: [restored content](design/qa/m3c2/independent-restored-content.png).

## Supporting automated checks

| Check | Result |
| --- | --- |
| App unit tests | 38/38 passed |
| Root prototype regressions | 13/13 passed |
| PostgreSQL isolation/integrity tests | 133/133 passed |
| Trash/restore HTTP assertions | 109/109 passed |
| Existing project HTTP assertions | 124/124 passed |
| Session integration checks | 10/10 passed |
| Database lint | No schema warnings/errors |
| Production build | Passed |
| App typecheck | Passed |
| Diff whitespace check | Passed |

**427 tests/assertions passed**, plus lint/build/typecheck/whitespace validation. Database/API suites cover ownership/lifecycle denial, Trash invisibility, preserved content/history/settings/hash, revision fencing, same-key replay across opposite transitions, parallel commands, cross-view cursors/pagination and save/delete races. The existing project race can produce 124 or 125 assertions; this run reported 124.

## Limits and cleanup

- No separately injected dropped lifecycle response in the browser; idempotent replay/concurrency verified by live database/API suites. No natural 24-hour expiry wait, browser timeout/session-expiry injection, or full load/security audit.
- Multiple-page Trash pagination, long titles/settings and cross-user/direct-RPC denial exercised in automated suites rather than repeated through the browser.
- Mobile inspection covered populated Trash; not a full mobile editor/confirmation/accessibility audit. No screen-reader audit or broad browser/device matrix.
- Permanent deletion/purge is intentionally absent. Local pending copies are separate from server restoration and remain subject to the documented browser-storage limits.
- Removed disposable browser identity, project/revision history and profile; integration suites cleaned their fixtures. Rejected old editor changes were explicitly discarded in favor of the saved version, clearing that test's pending copy.
- Reset viewport; stopped owned app/Supabase services, retaining database volumes. Ignored CLI logs/helper scripts remain under `.cache/`.
- No existing user data changed, provider requests, video renders, external publication, commits or pushes. Root prototype preserved and regression-tested.

Next: finish separate source review/outstanding release checks, then commit/push the reviewed lifecycle slice before the next approved feature.
