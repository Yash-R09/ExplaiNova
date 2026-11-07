# Independent M3c1 QA — November 7, 2026

Scope: current uncommitted duplicate-draft feature and QA-04 preview repair against `15f3654`. Tested production Next.js, local Supabase and disposable local accounts. No application fixes made.

## Result

No new reproducible defects found in tested flows. **QA-04 independently retested and closed:** two local copies with identical title/idea but different multiline reference notes show their notes before selection; restoring a selected copy restores the matching notes.

## Manual browser checks

- Created a source draft with emoji in its title, idea text and multiline notes; saved revision 2.
- Library duplication opened a fresh project ID at revision 1, with `Copy of …` title and matching saved idea/notes.
- Edited and saved copy-only notes. Reopened source: original notes and source revision were unchanged.
- Loaded library, then changed/saved source in another tab. Duplicate from stale card failed with refresh guidance. **Refresh library**, then duplicate succeeded with the updated source idea in a new revision-1 copy.
- Created two pending browser copies with matching title/idea and differing notes, using blank-title validation to pause autosave. Reopened: both labelled note previews were visible before restore/discard, preserving multiline text.
- Restored the mountain-example copy; editor notes matched that preview. Corrected the blank title, saved, and reloaded: selected notes persisted. Discarded the remaining independent QA copy through the UI.
- Recovery previews visually inspected at desktop 1280px and actual mobile **390 × 844**. Mobile document scroll width **375px**, without horizontal overflow. This is targeted layout QA, not a full device/accessibility audit.

Evidence: [recovery notes fixed](design/qa/m3c/independent-recovery-notes-fixed.png).

## Automated supporting checks

| Check | Result |
| --- | --- |
| App unit tests | 36/36 passed |
| Root prototype regression tests | 13/13 passed |
| Real PostgreSQL tests | 91/91 passed |
| Project HTTP integration assertions | 124/124 passed |
| Session integration checks | 10/10 passed |
| Database lint | No schema warnings/errors |
| Production build | Passed |
| App typecheck | Passed |
| Diff whitespace check | Passed |

**274 tests/assertions passed**, plus lint/build/typecheck/whitespace checks. The project race can add one assertion depending on transaction order; this successful run reported 124, rather than the implementation handoff's 125.

Database/API coverage includes foreign/inactive/deleted-source denial, independent revisions/settings, Unicode title bounds, concurrent duplicate replay, stale source rejection, original acknowledgement after later edits, and duplicate/save races. Duplicate retry/idempotency checks passed through these suites; a dropped duplicate response was not separately injected through the browser in this pass.

## Limits and cleanup

- No full accessibility/screen-reader audit, broad browser/device matrix, high-load soak, natural 24-hour idempotency expiry wait, or separate source/security review.
- Long Unicode titles/settings and direct RPC ownership/error cases were covered by automated suites, not repeated manually in the browser. Delete/restore and editable preferences remain outside this slice.
- Removed the disposable browser identity, source/copy drafts, revision history and profile; integration suites removed their own fixtures. Discarded remaining QA pending-copy data through the UI.
- Reset viewport; stopped owned app and Supabase services with database volumes retained. Ignored CLI logs/helper scripts remain under `.cache/`.
- No real user data changed, provider calls, video renders, cloud provisioning, commits or pushes. Root prototype preserved; its regressions passed.

Next: finish separate source review and outstanding release checks, then commit/push the reviewed slice before the next approved feature.
