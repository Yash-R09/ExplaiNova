# Independent M3c3 QA — November 7, 2026

Scope: uncommitted editable draft preferences against `1aa7f8e`. Tested production Next.js, local Supabase and disposable browser/API identities. No application source changes made.

## Result

No new reproducible defects found in tested flows. Separate source/security review and broader release checks remain pending.

## Manual browser evidence

- New draft starts with 60s, beginner, clear and female preferences; preference section is initially collapsed.
- Chose 30s, advanced, conversational and male, then saved. Reload and expansion retained all four selections at revision 2.
- Changed only preferences in the first tab to 90s/intermediate/direct/female and saved revision 3. A stale second tab attempted 60s/clear; its save paused with a conflict and retained its local selections.
- Saved-version comparison displayed the actual remote 90s/intermediate/direct/female values, plus captions included/topic-adaptive visuals. Explicit saved-version choice restored those values.
- Created two pending records with identical blank title/idea but different 30s/male and 60s/female choices, using blank-title validation to pause autosave. Reopening displayed both distinct preference summaries before restoration.
- Restored the 30s/male copy, corrected its title and saved revision 4. Clean reload retained the chosen settings; remaining independent local copy was offered separately and explicitly discarded during cleanup.
- Mobile expanded controls visually inspected at actual **390 × 844**, document scroll width **375px**, without horizontal overflow. All seven editor/control labels target their inputs. Tab from Target length reaches Audience level.
- UI clearly describes voice as a saved preference and says available voices/samples arrive when narration is connected. No provider call or entitlement claim was tested.

Evidence: [mobile preferences](design/qa/m3c3/independent-preferences.png).

## Automated supporting checks

| Check | Result |
| --- | --- |
| App unit tests | 46/46 passed |
| Root prototype regressions | 13/13 passed |
| Real PostgreSQL tests | 164/164 passed |
| Preference HTTP assertions | 42/42 passed |
| Existing project HTTP assertions | 124/124 passed |
| Trash/restore HTTP assertions | 109/109 passed |
| Session checks | 10/10 passed |
| Database lint | No schema warnings/errors |
| Production build | Passed |
| App typecheck | Passed |
| Diff whitespace check | Passed |

**508 tests/assertions passed**, plus lint/build/typecheck/whitespace checks. Automated coverage includes partial settings merge, text-only preservation, legacy request replay/local schema migration, preference-only pending copies, changed selections during a save, rejected unsupported settings, ownership, duplicate/Trash preservation, historical snapshots and idempotency.

## Limits and cleanup

- Delayed/dropped preference responses and schema-1 uncertain records were tested through existing controller/live API suites; not separately injected through the browser in this pass.
- Duplication/Trash preference retention and invalid/direct-RPC/foreign-owner cases verified by database/API suites rather than repeated manually through browser controls.
- No full screen-reader/accessibility audit, multi-device/browser matrix, storage-quota browser injection, high-load soak or separate source/security review.
- Named voice catalog, voice samples, account-wide defaults and real generation remain outside this slice. Title search remains planned.
- Removed disposable browser identity, project/revisions and profile; suites removed their fixtures. Discarded remaining listed pending-copy fixture through the UI. Viewport reset; owned app/Supabase stopped with database volumes retained. Ignored QA helpers/logs remain under `.cache/`.
- No existing user data changed, provider requests, video renders, hosted resources, commits or pushes. Root prototype preserved and regression-tested.

Next: complete separate source review/outstanding release checks, then commit/push the reviewed preference slice before the next approved feature.
