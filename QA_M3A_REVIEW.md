# Independent M3a QA — November 7, 2026

Scope: uncommitted private idea draft library/manual-save changes against `3ab7908`. Tested production Next.js, local Supabase, real browser UI and disposable local accounts. No application source fixes made.

## Result

No new reproducible defects found in the checks performed. Source/security review, durable unsaved recovery, and broader release testing remain separate work.

The working tree changed during this pass: a modified-link navigation fix and three regression tests were added by other work. The latest **14 unit tests and production build passed** after that change. Browser evidence below predates that fix; it does not verify the newly changed modified-click behavior.

## Manual browser evidence

| Check | Result |
| --- | --- |
| Empty library → New draft | Creates one owned draft with acknowledged revision 1 |
| Edit title, idea and reference notes → Save draft | Acknowledges revision 2; Save disabled when clean |
| Reload | All saved fields persist |
| Rename in tab A | Acknowledges revision 3 |
| Save different text from stale tab B | Shows conflict, preserves tab B text, offers Reload saved version |
| Click Settings with unsaved conflicting text → dismiss confirm | Remains on editor with unsaved text intact |
| Reload saved version → accept confirm | Restores tab A's title/content and revision 3 |
| Library → reopen card | Card and reopened fields show current saved content |
| Lose successful save response → retry unchanged | Retains unsaved fields after fetch error; retry acknowledges revision 4 without an extra revision |
| Further ordinary edit/save | Acknowledges revision 5 |
| Basic keyboard/label check | Title Tab moves to idea; all three labels target their fields |
| Desktop editor | Visually inspected at actual 1280px without horizontal overflow |
| Mobile editor measurement | Actual 390 × 844, scroll width 375px; no horizontal overflow. Screenshot failed; no mobile visual pass claimed |

Lost-response method: an ignored local proxy forwarded requests to the unchanged production app, consumed the first PATCH response, then destroyed the browser connection. Upstream completion was HTTP 200. Browser showed `Failed to fetch`, retained text and unsaved status; retry acknowledged revision 4. Final database history was exactly **1, 2, 3, 4, 5** after a further save.

[Saved editor evidence](design/qa/m3a/independent-save-retry.png).

## Automated supporting checks

| Command | Result |
| --- | --- |
| `npm run app:test` | Initially 11/11; latest rerun 14/14 including navigation fix |
| `npm test` | 13/13 prototype regressions passed |
| `npm run db:test` | 64/64 real PostgreSQL tests passed |
| `npm run app:test:projects` | 64/64 local project HTTP assertions passed |
| `npm run app:test:integration` | 10/10 existing session checks passed |
| `npm run db:lint` | No schema warnings/errors |
| `npm run app:build` | Passed initially and after late navigation fix; includes TypeScript compilation |
| `npm run app:typecheck` | Passed before late navigation fix |
| `git diff --check` | Passed |

**165 distinct tests/assertions passed**, plus schema lint/build/typecheck/whitespace checks. API coverage includes foreign/anonymous/inactive identities, origin/body validation, idempotent creation/save replay, changed-key conflicts, concurrent creation/saves, revision history, pagination and GET without writes. Database/API tests preceded the client-only navigation fix.

## Limits and cleanup

- Native ordinary-link confirm cancellation was directly observed on the earlier build. Reload/close warning handling remained inconclusive: an attempted reload retained edited text, but the dialog API returned no observable beforeunload dialog. No reliable reload/close protection claim.
- Browser Back/Forward and durable offline/unsaved recovery remain documented M3b limitations. This feature explicitly uses manual saving.
- Exact dropped-response browser test covered unchanged retry; edit-after-ambiguous-save browser retry was not separately exercised. Stale edits and changed request bodies are covered in integration checks.
- No full accessibility/screen-reader audit, multi-device/browser matrix, high-load soak or independent security review. Latest navigation fix needs targeted browser verification; mobile visual QA remains pending.
- Signup/recovery integrations were not rerun: current changes concern drafts; session tests were rerun as the auth regression check.
- Removed browser fixture identity, draft/revisions and profile. Integration suites removed their own fixtures. Owned app servers, temporary proxy and Supabase stopped; volumes retained. Viewport reset. Ignored helper scripts/logs remain under `.cache/`.
- No existing user data changed, provider requests, video renders, cloud provisioning, commits or pushes. Root prototype and concurrent implementation work preserved.

Next: targeted browser review of the modified-link fix and remaining native/mobile checks; complete separate source review before the next approved implementation slice.
