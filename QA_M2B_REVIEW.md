# Uncommitted M2b QA — November 7, 2026

Tested the current working tree against production Next.js and local Supabase. Scope: new sign-in/out, route protection, session/profile checks, and supporting auth configuration. No application fixes made.

## Finding — QA-03 · P3 · Backend outage is reported as a credential problem

Reproduction:

1. Build/start the app with valid local Supabase configuration.
2. Stop local Supabase while leaving the app running.
3. Submit a syntactically valid email and nonempty password on `/sign-in`.

Actual: **Unable to sign in. Check your credentials and email confirmation.** The service is offline; changing credentials cannot resolve this. Email is retained and password clears correctly.

Expected: a temporary-unavailability message with retry guidance. Keep invalid-credential messages generic, but distinguish transport/service failures.

Source: `apps/web/src/app/sign-in/actions.ts`, `signIn()`, error handling after `signInWithPassword()`. Every returned error except HTTP 429 uses the credential message, including returned network errors. The catch-only unavailable message does not cover this reproduced path.

Evidence: [outage screenshot](design/qa/m2b-auth-outage.png).

## Manual browser results

| Check | Result |
| --- | --- |
| Anonymous Settings visit redirects with `/settings` return target | Pass |
| Wrong password shows generic error, retains email, clears password | Pass |
| Correct password returns to original Settings destination | Pass |
| Authenticated reload preserves session | Pass |
| Projects navigation and signed-in identity display | Pass |
| Sign-out returns to sign-in; browser Back does not expose studio content | Pass |
| External `next=https://example.com` falls back to local Projects on successful sign-in | Pass |
| Active session with profile switched to pending is denied on reload | Pass |
| Desktop sign-in visual layout at 1280px | Pass |
| Projects and sign-in mobile layout at confirmed 390 × 844 viewport | Pass; document scroll width 375px, no horizontal overflow |
| Auth service unavailable | Fail: QA-03; access remains denied |

## Supporting automated checks

- Auth policy/configuration unit tests: **2/2 passed**.
- Live local session integration checks: **10/10 passed**, including two-user identity isolation, owner-override rejection, anonymous rejection, no-store responses, corrupt cookies, expired cookie-envelope refresh, inactive profile and missing-profile denial.
- Prototype regression tests: **13/13 passed**.
- Production build, app typecheck, and `git diff --check`: passed.

## Limitations and cleanup

- Integration refresh check expires the cookie envelope, not a signed JWT's natural lifetime. Multi-tab refresh races, rate-limit exhaustion, full accessibility audit, and broader browser/device coverage were not tested.
- Signup/confirmation/recovery UI is explicitly deferred and was not treated as broken functionality.
- Existing prototype QA repairs were covered by regression tests; the prototype UI was not retested in this M2b review.
- Created and removed one disposable local browser identity/profile; integration fixtures also cleaned up successfully. No real user accounts changed.
- Temporary viewport reset. Production app and local Supabase services started for QA were stopped; database volumes retained.
- No provider calls, video generation, hosted services, deployment, commits, or pushes performed. Preexisting uncommitted changes preserved.

Recommendation: correct QA-03 and retest outage/retry behavior before marking the error-state review complete. No access-control failure was observed in the checks performed.

## QA-03 resolution — November 7, 2026

Fixed during M2c. The sign-in action now classifies returned transport/retryable and server failures separately from invalid credentials. A regression test exercises the SDK's returned `AuthRetryableFetchError` shape, not just a thrown exception. Browser retest with local Supabase stopped showed **Sign-in is temporarily unavailable. Please try again later.** Email stayed populated, password cleared, and no access was granted. Credential/throttling messages remain generic and distinct.

[Fixed-outage evidence](design/qa/m2c-outage-fixed.jpg). The finding above is retained as historical QA evidence and is now resolved.
