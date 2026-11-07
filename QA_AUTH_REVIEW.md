# Independent auth QA — November 7, 2026

Scope: uncommitted signup/email-confirmation/password-recovery changes and QA-03 repair against commit `6a5b4b6`. Tested production Next.js at 127.0.0.1:3000, local Supabase, and Mailpit. Application source was not changed.

## Result

No new reproducible defects found within the checks below. **QA-03 independently retested and closed:** stopping Supabase now produces temporary-unavailability guidance for sign-in and reset requests, with no access granted. This is a scoped QA result, not a full security/code-review or production-release approval.

## Manual browser checks

| Flow | Result |
| --- | --- |
| Signup password mismatch | Useful error, email retained, passwords cleared |
| Corrected signup | Opens Check email; no studio access granted by signup alone in integration checks |
| Local confirmation email | Explainova template delivered to the disposable account |
| Email confirmation GET | Opens clean `/confirm-email` URL with explicit confirmation button |
| Explicit confirmation | Opens Projects under the newly created account |
| Sign-out after confirmation | Returns to sign-in |
| Forgot-password navigation and request | Generic receipt; local recovery email delivered |
| Recovery email GET | Opens clean `/reset-password` URL with empty password fields |
| Malformed recovery token | No password form; fresh-link and sign-in navigation provided |
| Desktop signup/sign-in | Visually inspected at 1280px |
| Mobile reset form | Visually inspected at actual 390 × 844; scroll width 375px, no horizontal overflow; both labels target their fields |
| Signup keyboard navigation | Tab from email reaches password |
| Real Supabase outage | Sign-in and forgot-password show temporary-unavailability guidance; password clears on failed sign-in |

Evidence: [fixed outage](design/qa/auth-independent-outage-fixed.png), [mobile reset form](design/qa/auth-independent-reset-mobile.png).

## Automated supporting evidence

| Command | Result |
| --- | --- |
| `npm run app:test` | 7/7 auth policy/error tests passed |
| `npm run app:test:integration` | 10/10 session checks passed |
| `npm run app:test:signup` | 14/14 signup/confirmation checks passed |
| `npm run app:test:recovery` | 17/17 recovery checks passed |
| `npm run db:test` | 29/29 PostgreSQL isolation/integrity checks passed |
| `npm test` | 13/13 prototype regressions passed |
| `npm run app:build` | Passed |
| `npm run app:typecheck` | Passed |
| `git diff --check` | Passed |

Total: **90 automated tests/checks passed**, plus build/typecheck/whitespace validation. Live suites exercise real HTML Server Actions, Supabase, and local mail. Recovery coverage includes mismatch without token consumption, cross-origin rejection, different signed-in-user isolation, new-password success/old-password rejection, refresh-session revocation, same-password handling, expired/reused/unissued-token rejection, and inactive-profile denial. Confirmation coverage includes no confirmation on GET, duplicate-account safety, resend/replacement, and actual provider-token expiry.

## Limits and cleanup

- Password changes were exercised through HTTP integration forms with disposable accounts; no password changes were entered through browser automation.
- Mobile visual evidence is for the reset form. Signup was visually inspected at desktop width; attempts to apply mobile sizing to that separate tab did not change its observed 1280px width, so no mobile-signup pass is claimed here.
- No full accessibility audit, hosted SMTP/deliverability check, natural JWT expiry wait, multi-tab/reset concurrency stress test, exhaustive rate-limit test, or fault injection between verification/update/revocation.
- Existing access JWTs may remain valid until expiry after refresh-session revocation; immediate access-token revocation was not claimed or tested.
- The root prototype UI was not retested; its 13 automated regression tests passed.
- One disposable account created through the signup UI was removed with its profile. All integration fixtures were cleaned up by their suites. Local emails remain in Mailpit for deleted fixtures.
- Temporary viewport override reset. QA production app and Supabase services stopped, database volumes retained. Ignored CLI logs/QA helper scripts remain under `.cache/`.
- No real accounts changed, external mail sent, provider calls made, media rendered, commits created, or changes pushed. Preexisting uncommitted implementation work preserved.

Next: finish the separate source/security review from AUTH_REVIEW_CHECKLIST.md, address any findings, then commit/push the reviewed auth slice before M3.
