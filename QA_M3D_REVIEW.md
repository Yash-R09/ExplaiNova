# Independent M3d QA — November 7, 2026

Scope: uncommitted private title search against `b9b6947`. Tested production Next.js, local Supabase and disposable seeded browser/API identities. No application fixes made.

Implementation follow-up: QA-05 was fixed after this independent pass by controlling the input and syncing URL query on pageshow/popstate plus the next animation frame. Three regression tests were added; 52 app tests, 153 search HTTP assertions, build/typecheck pass. Implementation browser retest passed Back/Forward for Projects, unfiltered history and Trash, including after focus/Tab and on mobile. Independent repair retest remains pending; the original finding below is preserved.

## Finding QA-05 · P3 · Back restores results but leaves the next query in the search box

Reproduction in the in-app browser:

1. Search Projects for **Ocean**. URL is `/projects?q=Ocean`, input is Ocean, and Ocean single is shown.
2. Replace the field with **Lunar** and submit. Lunar results appear.
3. Use browser **Back**.

Actual: URL and results return to Ocean, and the status correctly reads **Results for “Ocean”**, but the search input still contains **Lunar**. The inconsistent field persists after focus/Tab and another observation. A second reproduction returned to unfiltered Projects while retaining the subsequent punctuation query in the field. A full reload synchronizes the input again.

Expected: history navigation restores the applied query in the field along with its URL/status/results. Ordinary deliberate unsubmitted edits can remain editable; the problem is restored history state displaying a different query without a new edit.

Impact: confusing UI and easy accidental resubmission of the wrong query. Filtering/ownership remained correct; no data exposure or data loss was observed.

Location to investigate: `apps/web/src/components/library-search.tsx`, uncontrolled `defaultValue={query}` and native GET/history form-state restoration. The keyed form resolves the tested Clear-search case but did not resolve this Back sequence. Synchronize the field with the applied query on history restoration and add a browser regression.

[Screenshot](design/qa/m3d/independent-back-query-mismatch.png).

## Manual browser checks

- Seeded 22 active Lunar titles, one unrelated Ocean title, one punctuation/emoji title and one Lunar Trash entry under a disposable owner. Idea text mentioned Saturn without Saturn in any title.
- Submitted padded uppercase `  LUNAR  ` using Enter: normalized displayed input and case-insensitive matches; 20 on the first page and 2 on the older page, without unrelated titles.
- Older/First-page links retained the normalized query. New Saturn submission removed the old cursor and showed a distinct no-match state, proving title-only scope for this fixture.
- Typed an unsubmitted replacement, then Clear search: URL became `/projects`, input emptied, full view including unrelated titles returned. The documented Clear-search repair passed.
- Searched literal `%_literal\ + & "quote" 🌙`: exactly the intended punctuation/emoji title matched; no wildcard broadening.
- Forward restored the searched result; Back input mismatch reproduced as QA-05.
- Filtered to Lunar note 22, moved it to Trash, switched to filtered Trash, restored it, then returned to Projects. Query survived all relevant lifecycle/view returns; lists/no-match states updated correctly.
- Full reload fixed QA-05. Mobile search controls/results visually inspected at actual **390 × 844**, document scroll width **375px**, without horizontal overflow. Desktop inspected at 1280px. Tab from the search input reached Search.

## Automated supporting checks

| Check | Result |
| --- | --- |
| App unit tests | 49/49 passed |
| Root prototype regressions | 13/13 passed |
| PostgreSQL tests | 197/197 passed |
| Search HTTP assertions | 153/153 passed |
| Existing project assertions | 124/124 passed |
| Trash assertions | 109/109 passed |
| Preference assertions | 42/42 passed |
| Session checks | 10/10 passed |
| Database lint | No schema warnings/errors |
| Production build | Passed |
| App typecheck | Passed |
| Diff whitespace check | Passed |

**697 tests/assertions passed**, plus lint/build/typecheck/whitespace checks. Browser history form restoration is not covered by those passing unit/API suites. Automated coverage includes cross-owner/inactive denial, query/view cursor binding, literal characters, Unicode, old matching rows beyond the unfiltered first page, ordering, rename/lifecycle updates, and summary-only Trash results.

## Limits and cleanup

- No full accessibility/screen-reader or multi-browser/device audit, high-volume search latency benchmark, soak test or separate source/security review.
- Strict invalid queries, cross-query cursor misuse, direct RPC/foreign-owner checks and broader punctuation combinations verified through database/API suites rather than each repeated manually.
- Removed only the disposable browser identity, seeded active/Trash projects, revisions and profile. Integration suites removed their own fixtures. Reset viewport; stopped owned app/Supabase services with volumes retained. Ignored QA helpers/logs remain in `.cache/`.
- No existing user data changed, provider calls, video renders, hosted changes, commits or pushes. Root prototype preserved and regression-tested.

Next: fix/retest QA-05, then complete separate source review/outstanding release checks before the next approved milestone.
