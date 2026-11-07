# Manual QA — November 6, 2026

Scope: current local working tree; Next.js scaffold at 127.0.0.1:3000 and independent prototype at 127.0.0.1:4310. Existing uncommitted implementation changes were preserved. No application fixes made.

## Findings

### QA-01 · P2 · Previous render remains attached visually to a new draft

Reproduction: open a prototype project with a completed render, then select **Load offline sample**.

Actual: the new storyboard is saved, but the previous **ready** status, video player, MP4 link and caption link remain visible. The observed download URL still referenced the original project. Reloading correctly shows the new project as **draft** with no result.

Expected: immediately clear the previous status/result and download links when switching projects. Downloads should represent the selected project and revision.

Location: `web/index.html`, `show()` and sample/generate handlers.

### QA-02 · P3 · Save error remains after successful correction

Reproduction: load a sample, clear Video title, select **Save storyboard**, then enter a valid title and save again.

Actual: **A title of 1–140 characters is required.** remains visible alongside the new successful saved timestamp. Reload confirms the valid title was persisted.

Expected: clear the obsolete validation error after a successful save.

Location: `web/index.html`, `save()` and `message()`.

## Passed checks

- Root app URL redirects to Projects; empty state accurately discloses missing storage/auth.
- New video navigation opens the Plan placeholder with the three-step workflow.
- Publishing, Connected accounts and Settings navigation opens the correct milestone placeholders.
- Unknown route displays recovery UI; Back to projects works.
- Keyboard activation of Skip to content moves focus to main.
- Desktop visual inspection of Projects and Create at an actual 1280 × 720 viewport.
- Prototype restores an existing local project and its completed result.
- Loading an offline sample creates a separate saved draft; existing rendered project was not edited.
- Rendering without approval is blocked with a visible error.
- Editing the title clears approval; successful save/reload preserves the title and draft status.
- Empty title is rejected visibly.
- `npm test`: 7/7 passed. This is automated supporting evidence, separate from manual checks.
- `npm run app:build`: passed, including TypeScript compilation and route generation.

## Limits and test artifacts

- Mobile viewport override was attempted, but the observed viewport remained 1280 × 720; mobile QA is unverified. Temporary override reset.
- Supabase status failed with EPERM while writing CLI telemetry outside the workspace. Database tests were not rerun in this session; previous results in PROJECT_STATUS.md are historical evidence.
- Authentication and SaaS project/generation/publishing flows are unimplemented, not QA failures.
- No new provider requests, synthesis, video render, download-content review, full accessibility audit, or concurrency/recovery stress testing was performed.
- One local draft titled **QA draft — water cycle** was created under ignored outputs; browser restoration now points to this draft. The original rendered project remains on disk.

Recommendation: fix QA-01 first, then QA-02; retest project switching from a rendered project to a new draft before continuing milestone M2b.

## Fix verification — November 7, 2026

The findings above describe the original QA session. Both findings are now fixed, together with the three code-review issues reported against commit `52e3c72`.

- **QA-01:** verified ready video → Load offline sample immediately produces a fresh draft with hidden result, empty player source, and no MP4/SRT URLs.
- **QA-02:** verified blank title → validation failure → corrected title → successful save clears the error; reload preserves the corrected title.
- **Concurrent saves:** per-project operations and client saves are ordered; atomic file writes use unique temporary paths and bounded retries for Windows replacement locks. Tests exercise 64 concurrent writes/readers, eight simultaneous HTTP saves, and failure recovery.
- **Stale renders:** changing narration or voice invalidates current output freshness by hash. Save/read responses omit active media links for stale content; browser checks confirm this survives reload. Earlier output files are retained.
- **Editing during rendering:** all 24 form controls are disabled while a simulated worker is active, including after reload. Saves attempted through HTTP during rendering receive 409. No editor changes can silently trigger rejected autosaves during the normal UI workflow.
- **Verification:** 13/13 automated tests passed; production Next.js build passed. Browser tests used an isolated local server with a simulated worker and existing sample media, not actual generation. No provider calls, synthesis, or new media renders. Database and full mobile/accessibility checks were not repeated.

The temporary QA server is stopped. The normal prototype remains available through `npm start`. These fixes and the prior database slice have not been committed yet.
