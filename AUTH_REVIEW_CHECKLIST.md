# Explainova — Authentication review and QA handoff

Date: November 7, 2026

Status: M2a–M2d implemented; [independent scoped QA passed](QA_AUTH_REVIEW.md), separate source/security review pending. The founder authorized committing this checkpoint on November 7, 2026. Review the **complete auth diff since `6a5b4b6`**, including all added source/test files. Do not start M3 until auth findings have been reviewed.

## Local setup

Start Docker Desktop, then from the repository root:

```powershell
npm ci
npm --prefix apps/web ci
npm run db:start
npm run db:configure-app
npm run app:dev
```

App: http://127.0.0.1:3000 · local inbox: http://127.0.0.1:54324 · local Studio: http://127.0.0.1:54323.

No real API keys or hosted services are needed for auth QA. Use disposable `example.test` accounts. The root `.env` still belongs to the separate video prototype. The local stack is stopped at handoff; volumes are preserved. See [database setup](supabase/README.md) for Docker port-binding limits.

For production-mode QA, use `npm run app:build` and `npm --prefix apps/web start` instead of the dev server. Stop the existing server before reusing port 3000.

## Automated checks

Run with app and local Supabase available where required:

```powershell
npm run app:test
npm run app:typecheck
npm run app:test:integration
npm run app:test:signup
npm run app:test:recovery
npm test
```

Latest results: 7 auth policy/error tests; 10 session integration checks; 14 signup/confirmation integration checks; 17 recovery integration checks; 13 prototype tests. Production build/typecheck passed. Database SQL is unchanged from M2a; its previous 29 pgTAP tests are historical evidence, not a new run in M2d. Use `npm run db:test` to rerun them during independent QA.

Integration suites exercise the real HTML Server Action forms, Supabase, and Mailpit. They remove only their disposable identities/profiles. Expiry tests backdate the confirmation/recovery timestamp of one generated fixture. Test emails remain in the local inbox with links for deleted fixtures. Do not point these suites at a hosted or shared production database.

## Code review focus

- [Session data layer](apps/web/src/lib/session.ts): request-scoped verification with Auth and current owned active-profile checks. Do not authorize from embedded cookie user fields or client owner IDs.
- [Proxy](apps/web/src/proxy.ts): refresh-cookie propagation, private no-store headers, anonymous redirects, and repeated authorization at data/action boundaries.
- [Supabase clients](apps/web/src/lib/supabase/server.ts) and [configuration](apps/web/src/lib/supabase/config.ts): no service/provider secrets in app/public configuration; secure-cookie flag matches HTTPS app origin.
- [Signup](apps/web/src/app/sign-up/actions.ts), [confirmation](apps/web/src/app/confirm-email/actions.ts), and [email-link landing](apps/web/src/app/auth/confirm/route.ts): validation, generic duplicate responses, safe redirects, scoped HttpOnly staging, no verification on GET, token cleanup.
- [Reset request](apps/web/src/app/forgot-password/actions.ts), [recovery landing](apps/web/src/app/auth/recovery/route.ts), [password action](apps/web/src/app/reset-password/actions.ts), and [isolated recovery client](apps/web/src/lib/supabase/recovery.ts): no ordinary browser session can substitute for an email token; recovering Alice while Bob is signed in must not modify Bob or replace his cookies.
- Password validation runs before consuming the token. Verification and password update run in one action using an in-memory recovery session. Recovery access/refresh tokens and passwords are never returned to the browser, persisted in app rows, or included in action state/logs.
- [Error classification](apps/web/src/lib/auth-errors.ts): returned SDK transport/5xx errors are not credential errors. Preserve pending-input recovery without echoing passwords or raw provider details.
- Shared [email-link/password rules](apps/web/src/lib/confirmation-policy.ts): bounded token shape/time window; provider verification is authoritative. Cookie timestamps are not a replacement for server-side token expiry.

## Manual QA matrix

| Area | Expected behavior |
| --- | --- |
| Signup | Weak/mismatched inputs rejected, email retained, passwords cleared; duplicate response does not disclose an existing account |
| Confirmation | Local email uses Explainova template; GET opens a clean URL without consuming token; explicit confirmation opens the owned studio |
| Invalid confirmation | Missing, expired, used, malformed, unsupported-type links fail closed with a fresh-link path |
| Login | Wrong credentials generic; valid credentials follow an allowed destination; external `next` is ignored |
| Sessions | Reload/navigation preserve valid identity; anonymous/corrupted/expired contexts do not expose another profile |
| Logout | Returns to sign-in; Back or direct studio URL does not bypass authentication |
| Reset request | Existing/unknown addresses get generic receipt; request alone does not sign in or change a password |
| Reset landing | GET stages only an HttpOnly, path-scoped ten-minute token; URL/form contain no token; no password field is prefilled |
| Reset validation | Weak/mismatched passwords do not consume the emailed token |
| Reset success | New password works, old password fails, previous refresh sessions are revoked, normal login is required afterward |
| Different signed-in user | Recovering Alice while Bob is signed in changes Alice only and preserves Bob's browser identity |
| Missing/replayed proof | Ordinary login alone, unissued tokens, expired/used tokens, and unsupported URL purposes cannot reset a password |
| Account lifecycle | Missing/inactive owned profile blocks app recovery and studio access |
| Cross-origin POST | Framework origin protections reject reset submissions from an unrelated origin |
| Outage | Login/request/confirmation/recovery show retry guidance; uncertain post-verification updates do not claim success or definite failure |
| Responsive/accessibility | Inspect desktop and 390px mobile, keyboard labels/focus, disabled pending controls, live status messages, and overflow |

## Deliberate behavior and verification limits

- A link is consumed when Supabase verifies it. Validation happens first; if a later password update is rejected, the user must request a fresh link. A temporary/ambiguous update error explicitly suggests trying the new password or requesting a fresh link. The app does not store a reusable recovery session to hide this tradeoff.
- Successful resets request global refresh-session revocation. Existing access JWTs may remain valid until provider expiry; immediate revocation of every access token is not claimed. If revocation cannot be confirmed after a successful password change, the success page says so rather than reporting a failed password change.
- Unsupported URL types are rejected. Actual email-proof validation is delegated to Supabase `verifyOtp`; there is no separate app-issued token-purpose registry. Do not assume all provider email-OTP classes are cryptographically disjoint solely because the URL says `recovery`.
- Developer browser checks covered request feedback, malformed-link recovery, clean reset-form rendering, 390px overflow, navigation, and actual backend outage. Password changes were exercised through the real HTTP integration forms with disposable credentials, not entered through computer-use automation. Subsequent [independent QA](QA_AUTH_REVIEW.md) passed its documented scope; broader manual coverage and separate source/security review remain pending.
- SMTP deliverability, natural JWT-lifetime expiry, simultaneous refresh/reset races, provider-wide rate-limit exhaustion, failures exactly between provider verification and update/revocation, and a full accessibility audit remain independent review/release checks. Local templates/rate limits do not configure hosted mail.

## After review

Record actionable findings with reproduction steps, severity, and file/line references. Fix/retest them, update [project status](PROJECT_STATUS.md), then commit/push the reviewed auth slice to `dev`. The next product feature is M3 private idea drafts and autosave.
