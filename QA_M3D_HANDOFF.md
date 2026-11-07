# M3d — private project title search

Implemented against `b9b6947` on November 7, 2026. Independent QA and source/security review pending. This finishes planned M3 feature implementation; it does not constitute release/security sign-off or implement M4.

Post-review QA-05 repair: independent QA found Back could restore results while leaving a later input value. Fixed with a controlled input, applied-query synchronization and pageshow/popstate synchronization immediately plus the next frame after browser restoration. Added three event/timing/cleanup tests; 52 app tests and 153 search assertions plus build/typecheck pass. Actual browser Back/Forward in Projects/Trash, unfiltered history, focus/Tab persistence, mobile layout, ordinary typing and Clear search passed implementation retest. Independent repair retest is pending. Evidence: `back-query-fixed.png` and `back-query-fixed-mobile.png` in the search QA directory. No database/API changes for the repair; the original full-suite results below precede it.

## Flow and contract

Projects/Trash → Search titles → Search or Enter → filtered saved titles → Older drafts / First page → Clear search. New query submission omits the previous cursor. Dedicated view-switch links and lifecycle action returns retain the normalized search. Native GET forms work without a new client search controller. Empty query clears filtering; no matches display a distinct message without claiming the whole library is empty.

GET project API accepts q (raw maximum 140 UTF-16 units), trims outer whitespace and rejects embedded ASCII controls, duplicate/unknown parameters. Search is title-only literal case-insensitive substring matching via PostgreSQL lower/strpos. Wildcards/punctuation are literal; no SQL string construction. Accent folding, fuzzy/stemmed matching, relevance ranking and live-as-you-type search are not implemented.

The new authenticated-only pinned-search-path RPC verifies active ownership inside the database, filters owner/state/title before ordering/limit, and returns full active documents or summary-only Trash entries. Existing no-query list RPCs and v1 cursors remain compatible. Nonempty-search cursors bind the exact normalized query plus active/Trash view; different query/case/view requires restarting the list. These are validated positions, not security capabilities. Sorting remains updatedAt/id descending, and lists remain live across edits/renames/lifecycle changes.

## Verification performed

- **197 PostgreSQL tests**, including **33 new search cases**: case/substring, trim, title-only scope, literal percent/underscore/backslash/SQL-looking input, Unicode/emoji, page traversal, input bounds, active/Trash ownership, summary-only results, rename/restore movement and inactive denial. DB lint clean; local migration/types updated.
- **49 app tests**, including three new normalization/cursor/link tests. **153 search HTTP assertions** use matching records older than 22 newer unrelated records, exercise all matching pages, cross-query/view cursors, different owners, strict queries, SSR page links and no-match messages, renames and Trash/restoration.
- Existing project **124**, Trash **109**, preferences **42**, session **10**, prototype **13** checks/tests passed. Project race can report 124/125 by lock order. Production build, strict typecheck and whitespace checks pass.
- Browser fixture: 22 matching Moon titles, one unrelated Ocean title and one matching Trash title. Verified 20 + 2 searched pages, query retained in Older/First links, new unmatched search resets pagination, Clear search, filtered Move→Trash→Restore, and resulting refreshed views. Query remained in URL and controls after lifecycle returns.
- Browser found Clear search left a dirty unsubmitted input value after a client navigation; fixed by keying the search form on applied view/query. After rebuilding, reproduced the sequence (search moon → type unsubmitted Saturn → Clear): URL became `/projects`, input empty, unrelated title returned.
- Desktop 1280px and mobile 390px measured without horizontal overflow. Mobile ocean query showed only its matching card; inspected screenshots under `design/qa/m3d/`. Targeted checks, not a full screen-reader/device matrix.

## Independent review checks

1. Search/Enter, no-match/empty states, clear after both submitted and unsubmitted changes, Back/Forward, keyboard focus and mobile layout.
2. More than 20 matches mixed with newer nonmatches; page through all results and change query/case/view. First-page action must retain search; cursors from another search/view must fail safely.
3. Literal `%`, `_`, backslash, quotes, plus/ampersand, Unicode/emoji and long/invalid queries. No wildcard broadening or creative-body search.
4. Two owners with identical titles, inactive sessions, direct RPC access and summary-only Trash. Search cannot broaden ownership or ordinary Trash visibility.
5. Rename, duplicate, move and restore matching drafts from filtered/stale pages. Query should survive relevant lifecycle/view returns and refresh correctly after writes.

## Limits and cleanup

Searches scan owned rows with current owner/state access paths; high-volume latency/soak and index tuning have not been benchmarked. No global results, query history storage, full-text ranking, new status-generation filters or provider calls. Account defaults/named voice catalogs remain later work. Earlier security/release limitations remain open.

Disposable API/browser users and seeded projects removed; QA tab/viewport cleaned up. Owned app/Supabase services stopped with database volumes retained. No real user data, credentials, provider calls, video renders, cloud migrations, deployment or root prototype source changes. Changes are uncommitted; review and commit/push reminder applies. Next milestone: M4 AI planning in small slices.
