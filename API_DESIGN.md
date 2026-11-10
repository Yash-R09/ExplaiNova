# Explainova — API Design

**Version:** 1.0 · **Date:** November 6, 2026  
**Status:** Proposed contract for full V1; not implemented by the local prototype  
**Related:** [System design](SYSTEM_DESIGN.md), [database design](DB_DESIGN.md), [PRD](PRD.md)

Implementation note (November 7, 2026): M2b implements only `GET /api/v1/me` in the new web app, backed by verified Supabase sessions and owned profile reads. Remaining endpoints below are planned. The separate root prototype retains its local `/api/*` interface.

## 1. Scope and conventions

Internal dashboard APIs use HTTPS and `/api/v1`. This is not a public developer API. V1 covers private authoring, planning, immutable storyboards, voice selection, generation, assets, and individually authorized publication. Billing and revenue analytics are excluded.

- JSON request/response bodies, UTF-8; timestamps are ISO 8601 UTC, durations in milliseconds, frames integer at 30 fps.
- UUID resource IDs; IDs are not authorization. All resources are scoped to verified user ownership.
- Use camelCase externally and snake_case in Postgres. Examples use symbolic IDs such as `<project-id>`; clients must send real UUIDs.
- Mutation payloads reject unknown properties. Owner IDs, R2 keys, provider secrets, job state, approval actor, and platform IDs are never accepted as client authority.
- Model/voice/component identifiers are server-catalog selections, not arbitrary provider configuration.
- Media is not transported inside JSON. Issue authorized upload/download capabilities instead.
- API responses use `Cache-Control: no-store` for private records, signed URLs, and connections.

### Success and error envelopes

```json
{
  "data": { "id": "<project-id>", "revision": 3 },
  "meta": { "requestId": "<correlation-id>" }
}
```

Lists use `data: []` and `meta: {requestId, nextCursor, hasMore}`. Commands without content return 204. Errors:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "A newer version was saved. Reload or reapply your edits.",
    "retryable": false,
    "correlationId": "<correlation-id>",
    "details": { "currentRevision": 4 }
  }
}
```

| HTTP | Meaning / representative codes |
| --- | --- |
| 400 | Malformed JSON, cursor, or request syntax |
| 401 | SESSION_REQUIRED, SESSION_EXPIRED |
| 403 | CSRF_FAILED, ACTION_FORBIDDEN; do not reveal another owner's resource |
| 404 | RESOURCE_NOT_FOUND for absent or inaccessible owned IDs |
| 409 | REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, INVALID_STATE, CONNECTION_IN_USE |
| 413 | REQUEST_TOO_LARGE |
| 422 | VALIDATION_FAILED, UNSUPPORTED_SCENE, VOICE_UNAVAILABLE, INVALID_SCHEDULE |
| 429 | USER_CONCURRENCY_LIMIT, ADMISSION_LIMIT; include Retry-After when meaningful |
| 503 | TEMPORARILY_UNAVAILABLE; safe retry guidance |

Provider failures after job admission appear in job state, not as a delayed HTTP failure on the original 202 response. Do not return raw provider bodies, credentials, another user's identifiers, or internal stack traces.

## 2. Authentication and request safety

Use Supabase Auth's supported browser/server login and recovery flows; do not build a second password database. Next.js server endpoints verify sessions with the supported Supabase server verification mechanism. The primary web contract is a secure session cookie, with same-origin checks and CSRF protection on mutations.

OAuth callbacks are narrowly scoped exceptions to ordinary session headers: require the short-lived, one-use authorization attempt bound to the initiating user/session, provider, callback, and PKCE verifier where applicable. Provider return parameters do not establish ownership.

No API endpoint accepts a customer-supplied Gemini/ElevenLabs key in V1. Platform keys stay in the secret store. Social access/refresh tokens never appear in API output. Background workers validate relationships using durable owned records.

Account deletion requires recent reauthentication and explicit confirmation; return an owned deletion-operation reference rather than immediately erasing identity while jobs or publications may still be active.

## 3. Concurrency, idempotency, and pagination

### Mutations

- `expectedRevision` is the current project's edit version. Authoring mutations compare and advance it transactionally; a stale value returns 409.
- `expectedVersion` guards mutable settings, connections, or publication records independently.
- `Idempotency-Key` is required for create/command operations that can create work, uploads, approvals, or external side effects; use UUID/random 16–128-character keys. Save requests also carry a key so a lost response does not create another revision.
- Scope keys to owner + operation. Store a canonical request hash and committed response. Same key/body returns the original result; a different body returns 409.
- Record idempotency reservation/result inside the same transaction as the mutation. Do not leave a permanently pending key after rollback.
- Retain interactive request records at least 24 hours as a proposed default. Job/publication durable uniqueness persists beyond that window; exactly-once external side effects are not guaranteed by HTTP idempotency.

### Lists

Use `limit` 1–50 (default 20) and opaque validated `cursor`. Most lists order by `(createdAt DESC, id DESC)`; projects order by `(updatedAt DESC, id DESC)`. Cursors encode sort position and filter fingerprint, not SQL. Changing filters requires a fresh cursor. Lists are live, not snapshot-isolated; a recently updated project can move, so clients deduplicate by ID.

## 4. Resource contracts

### Project

`id, title, revision, targetDurationMs, audienceLevel, tone, currentStoryboardId, currentReadyVideoId, generationSummary, publicationSummary, createdAt, updatedAt, deletedAt`.

Generation and publication summaries are separate. A failed Instagram post does not make a valid MP4 unavailable.

### Storyboard

`id, projectId, inputProjectRevision, schemaVersion, contentHash, title, scenes, theme, voiceSelectionId, captionSettings, warnings, sourceReferences, approval, createdAt`.

Each scene has stable `id`, supported `type`, `title`, `learningPurpose`, `narration`, `estimatedDurationMs`, validated visual parameters, labels, owned asset references, and phrase-anchored cue specifications. Final frame timings belong to the composition after audio alignment. No executable code, arbitrary URLs, or unvalidated SVG strings.

### Job

`id, kind, projectId, inputRevisionId, status, stage, progress, warnings, result, failure, allowedActions, createdAt, updatedAt`.

Kinds: `planning`, `storyboard`, `video`, `voice_sample`. All are stored in the unified `generation_jobs` table. Status: `queued`, `running`, `waiting_retry`, `needs_action`, `failed`, `succeeded`, `cancel_requested`, `cancelled`. A successful video job points to a video version whose state is `ready`; job status itself is not `ready`.

`progress: {percent: null|0..100, completedStages, totalStages}`. Percent is an estimate and may be null; never imply accurate completion time when unavailable.

### Video version

`id, projectId, storyboardId, state, durationMs, width, height, fps, themeSnapshot, voiceSnapshot, qaSummary, createdAt` plus asset IDs. Return media URLs only through access endpoints. States: `building`, `validating`, `ready`, `failed`, `deletion_pending`.

## 5. Endpoint inventory

All paths below are relative to `/api/v1`.

| Method/path | Request purpose | Success |
| --- | --- | --- |
| GET `/me` | Profile and defaults | 200 |
| PATCH `/me/preferences` | Versioned default style/voice/caption settings | 200 |
| DELETE `/me` | Confirm account deletion workflow | 202 |
| GET/POST `/projects` | List / create project | 200 / 201 |
| GET/PATCH/DELETE `/projects/:id` | Read / autosave / soft-delete | 200 / 200 / 202 |
| POST `/projects/:id/duplicate` | Copy creative inputs, no live jobs/posts | 201 |
| POST `/projects/:id/restore` | Restore an owned trashed draft with expected revision | 200 |
| GET `/projects/:id/messages` | Paginated saved planning conversation | 200 |
| POST `/projects/:id/planning-jobs` | Submit user message and planning mode | 202 |
| GET `/projects/:id/planning-jobs` | List the latest 20 saved brainstorm requests and outcomes for an active owned project | 200 |
| GET `/storyboards/:id` | Read immutable storyboard | 200 |
| PATCH `/storyboards/:id` | Save edits as a new immutable storyboard | 201 |
| POST `/storyboards/:id/approve` | Approve exact storyboard hash | 201 |
| GET `/voices` | Allowed Male/Female voice catalog | 200 |
| POST `/voice-samples` | Request cached/generated voice preview | 202 |
| POST `/generation-jobs` | Generate video from approved storyboard | 202 |
| GET `/jobs/:id` | Poll owned work | 200 |
| POST `/jobs/:id/cancel` | Request cancellation | 202 |
| POST `/jobs/:id/retry` | Resume eligible failed work | 202 |
| GET `/projects/:id/video-versions` | List immutable output versions | 200 |
| GET `/video-versions/:id` | Version details and QA | 200 |
| POST `/video-versions/:id/revisions` | Request a scene/global edit via planning | 202 |
| DELETE `/video-versions/:id` | Delete when unreferenced by active work/posts | 202 |
| POST `/assets/upload-intents` | Create owned upload reservation | 201 |
| POST `/assets/:id/complete` | Queue upload validation | 202 |
| GET `/assets/:id` | Upload/validation metadata | 200 |
| POST `/assets/:id/access` | Request scoped read/download link | 200 |
| DELETE `/assets/:id` | Delete if not protected by references | 202 |
| GET `/connections` | List safe connection summaries | 200 |
| GET `/connections/:provider/start` | Begin provider authorization | 302 |
| GET `/connections/:provider/callback` | Validate callback and finish | 303 |
| POST `/connections/:provider/complete` | Confirm an eligible account/channel candidate when required | 201 |
| DELETE `/connections/:id` | Disconnect and suspend pending posts | 202 |
| GET/POST `/publications` | Calendar/list / approve and create post | 200 / 201 |
| GET/PATCH `/publications/:id` | Detail / explicitly reapprove or reschedule | 200 |
| POST `/publications/:id/cancel` | Cancel with expected version | 202 |
| POST `/publications/:id/retry` | Retry confirmed retryable failure | 202 |
| GET `/notifications` | Owned in-app notifications | 200 |
| PATCH `/notifications/:id` | Set read state | 200 |

**Refinement of earlier system overview:** signed asset access uses POST so GET/link-prefetch cannot mint a new capability; cancellation uses explicit command endpoints. These detailed contracts take precedence over abbreviated tables in the system design. Direct provider webhooks are not required initially; if added, use separate signature-verified routes with replay protection.

## 6. Authoring and planning examples

POST accepts `mode: "brainstorm"`, `expectedRevision`, `message`, optional `referenceText`, and an absent or null `baseStoryboardId`. It requires an `Idempotency-Key` and returns a stable admission receipt with `queued` status and a null result. GET accepts no query parameters and returns current records newest first. A record can be `queued`, `running`, `succeeded` with `result: { reply }`, or `failed` with a null result and a sanitized `failureCode`. Submit with the same key and body within the replay window to restart an interrupted attempt after its lease expires. Use a new key for an intentional retry of a terminal failure.

Each owner can submit 10 new brainstorm requests across all projects in a rolling hour. A submission over the limit returns HTTP 429 with `BRAINSTORM_RATE_LIMITED` and a `Retry-After` header in seconds. Exact replays reuse their original receipt without consuming a slot.

### Implemented M3a subset

M3d extends GET `/api/v1/projects` with optional `q`: a title-only case-insensitive literal substring, maximum 140 UTF-16 units in the raw API input, outer whitespace trimmed, embedded ASCII controls rejected. Absent/blank query clears the filter. `%`, `_`, backslash and SQL-looking text are literal, not wildcard/query syntax. Matching follows PostgreSQL lowercase rules, without accent folding/fuzzy relevance. Existing view=drafts/trash, limits and updatedAt/id descending order apply; filtering happens before LIMIT. Unknown/duplicate query parameters return 400. Metadata includes normalized `query`.

Nonempty searches use a cursor containing the exact normalized query and `drafts-search-v1` or `trash-search-v1` fingerprint; query or view changes require a fresh first page. Case changes also require a fresh cursor even though matching is case-insensitive. Empty searches retain compatible `drafts-v1`/`trash-v1` cursors. Cursors are validated positions, not authorization; every request derives the active owner. Trash search remains summary-only. Server page GET forms omit the old cursor when submitting a new query; lifecycle actions preserve the search and reset to its first page.

M3c3 adds per-draft settings to POST/PATCH project inputs: `settings` is a strict partial object supporting `voice: male|female`, `captions: true`, `theme: topic`. Unknown keys/provider IDs, null/arrays, false/string captions or unsupported enums return 422. Create merges defaults; PATCH merges with the saved settings instead of resetting omitted values. Existing targetDurationMs/audienceLevel/tone presets now have UI controls. Account defaults, named voice IDs/previews and provider entitlement checks are outside this slice; a voice type preference does not claim that narration is connected.

Autosave snapshots/recovery/conflict previews include text, length, audience, tone and settings. Local backup schema 2 can recover schema-1 text-only records by inheriting currently saved preferences with an explicit label. A legacy uncertain operation replays its original text-only JSON body/key unchanged before queued preference edits. No-settings create requests retain the pre-M3c3 normalized request hash for existing idempotency keys. Newly saved snapshot hashes include normalized settings; historical snapshots/hashes are not rewritten.

M3c2 implements reversible deletion: DELETE `/api/v1/projects/:id` accepts only `{expectedRevision}` (integer 1–2147483646) with Idempotency-Key, the same origin/JSON/64 KiB limits as other mutations, and returns 202 `{id,revision,status:"trashed",deletedAt}` in the normal data envelope. The project is already hidden from active reads when acknowledged; 202 does not promise a background permanent purge. POST `/api/v1/projects/:id/restore` takes the same command and returns 200 with the restored full draft. There is no hard-delete endpoint or automatic expiry.

Each successful lifecycle transition preserves identity/creative inputs/history and increments revision with a matching snapshot. Fresh stale expectedRevision returns 409 with owned currentRevision. Missing/foreign/wrong-state resources return 404; inactive owners 403. Trashed drafts cannot be normally read, saved, or duplicated. Restoring fences old autosaves because its revision has advanced. Local pending copies are not deleted by these commands; old copies require explicit conflict recovery after restoration.

Project list additionally accepts `view=drafts|trash`, default drafts. Trash responses contain only id/title/revision/deletedAt/updatedAt and use `trash-v1` cursors; active cursors use `drafts-v1`. Cursors cannot cross views. Sorting, limits and no-store rules are unchanged. Authenticated-only Trash RPC is the narrow path to owner summaries; normal table RLS continues to hide trashed rows/history.

Delete and restore have separate owner/project/operation/key idempotency scopes. Same key/body returns its original acknowledgement for 24 hours before current-state validation, even if later commands reversed that state. It never re-executes the old transition. GET/list is authoritative for current state; a new intentional lifecycle action needs a fresh key and current revision. Changed body under a retained key returns IDEMPOTENCY_CONFLICT 409.

M3c1 additionally implements `POST /api/v1/projects/:id/duplicate` with JSON `{expectedRevision: <positive integer>}` (maximum 2147483647) and the existing Idempotency-Key/origin/body limits. Reject unknown fields with 422. Return 201/Location and a new revision-1 draft containing saved title (prefixed `Copy of `, limited to 140 UTF-16 units), brief, referenceText, duration, audience, tone and settings. Source is locked during the snapshot; fresh stale requests return REVISION_CONFLICT 409. Foreign/missing/deleted sources return 404; inactive owners 403. GET is unsupported and cannot create copies.

Same owner/source/key/body retries return the original copy acknowledgement for 24 hours, even if source or copy has since changed. A changed body under that key returns IDEMPOTENCY_CONFLICT 409. A different key represents a new duplication command. Copy excludes source history, local unsaved edits, approvals, jobs, outputs and publishing records. Only the library exposes the action in this slice; it duplicates saved content, not another tab's pending edits.

`GET/POST /api/v1/projects` and `GET/PATCH /api/v1/projects/:id` are implemented locally. Other project commands and AI routes remain planned. M3b uses the same PATCH contract for debounced autosave and manual Save now. The browser serializes requests, persists uncertain request keys/bodies with owner/project-scoped pending text, and replays an uncertain operation before sending newer edits. Conflicts pause autosave for explicit comparison/choice; choosing local text still performs a fresh expectedRevision check. There is no new endpoint or schema in this slice.

- Create accepts an empty object, defaulting to `Untitled idea`, empty idea/notes, 60000ms, beginner, clear, female voice, captions on and topic theme. Save requires `expectedRevision` and at least one authoring field. Allowed fields: title (trimmed, nonblank, max 140), brief (max 6000), referenceText (max 20000), targetDurationMs (30000/60000/90000), audienceLevel (beginner/intermediate/advanced), tone (clear/conversational/direct), and the strict partial settings object above. Unknown top-level fields, including ownership, are rejected.
- POST/PATCH require same-origin JSON with a 64 KiB UTF-8 body maximum, matching Origin/public Host, and an `Idempotency-Key` of 16–128 ASCII letters/digits/underscore/hyphen. No secret/service key is used by app requests.
- Draft responses contain id, title, revision, brief, referenceText, targetDurationMs, audienceLevel, tone, settings, status=`draft`, createdAt, updatedAt. Storyboard/video/publication fields are deferred until those modules exist. All responses are private/no-store.
- List accepts only limit (1–50, default 20), cursor, view (drafts/trash, default drafts), and q (title query). `meta` includes requestId, normalized query, hasMore and nextCursor. The opaque cursor binds view/version, exact nonempty search, update timestamp (including microseconds), and UUID; malformed/cross-view/cross-query cursors return 400. Sorting uses updatedAt/id descending. Lists are live; concurrent edits, renames or lifecycle transitions can move a draft across pages/views, so reopen the first page to refresh.
- Successful create returns 201/Location/revision 1. Successful PATCH returns 200 with the acknowledged snapshot. Reusing the same key/body returns that original snapshot for 24 hours; changing the body returns `IDEMPOTENCY_CONFLICT` 409. A stale expectedRevision returns `REVISION_CONFLICT` 409 and owned currentRevision details, preserving browser text. Missing/foreign/tombstoned projects return 404. Invalid fields return 422, malformed JSON/key/query 400, oversized bodies 413, failed origin 403, temporary failures 503.

### Create project

```http
POST /api/v1/projects
Idempotency-Key: <random-key>
Content-Type: application/json
```

```json
{
  "title": "How noise cancellation works",
  "brief": "Explain opposing sound waves for beginners.",
  "targetDurationMs": 60000,
  "audienceLevel": "beginner",
  "tone": "clear"
}
```

Return 201, `Location: /api/v1/projects/<id>`, revision 1. Allowed durations: 30000/60000/90000; actual output must remain 30000–90000. The prototype's 45-second sample is not another public preset.

### Autosave

```json
{
  "expectedRevision": 3,
  "brief": "Explain why steady engine hum is easier to reduce.",
  "tone": "conversational"
}
```

Return revision 4 and saved timestamp. Partial PATCH changes only allowed authoring fields; it cannot alter old approvals or running job inputs. Debounce in the browser, preserve unsaved edits offline, and show Saved only after acknowledgment.

### Plan or revise

```json
{
  "expectedRevision": 4,
  "mode": "storyboard",
  "message": "Use five scenes and a violet audio-studio theme.",
  "referenceText": "Optional material to ground the explanation.",
  "baseStoryboardId": null
}
```

Modes: `brainstorm`, `storyboard`, `revise`. Revision mode requires an owned base storyboard. Store message and job atomically. Return job with `result: null`; later successful result references suggestions or a storyboard ID. If the project changed meanwhile, preserve the result as a candidate and do not silently replace the current draft.

### Save storyboard edits

PATCH the base storyboard with `{expectedRevision, scenes, theme, voiceSelectionId, captionSettings}`. The server validates the complete proposed scene content, creates a new storyboard ID/hash, and advances the project edit version. Response includes new ID and project revision; the original remains immutable. Approval does not transfer to modified content.

### Approve and generate

POST `/storyboards/:id/approve` with `{expectedRevision, contentHash}`. Return an approval ID tied to owner, hash, and storyboard. POST `/generation-jobs`:

```json
{
  "projectId": "<project-id>",
  "storyboardId": "<storyboard-id>",
  "approvalId": "<approval-id>"
}
```

Verify matching owners/project/hash and asset references. Atomically admit the job, enforce active-video limit, and create outbox work. Return 202 and `Location: /api/v1/jobs/<id>`. Repeated same request/key must not consume provider quota again by creating a duplicate job.

## 7. Voices, generation, and revisions

`GET /voices?presentation=female` returns safe catalog records: `selectionId, displayName, presentation, provider, availability, previewAssetId, verifiedAt`. Only available selections usable under the free-tier API voice policy are selectable; restricted/unknown voices cannot be silently substituted. Listing is not synthesis-access proof. Persist exact provider/model/voice settings server-side at approval.

POST `/voice-samples`: `{projectId, voiceSelectionId, text}`. Limit text, cache by owner/text/voice/configuration, and return an asynchronous job even for cache hits so clients use one result contract. Preview requests count toward admission/provider allowance.

Job stages include `planning`, `previewing`, `generating_audio`, `aligning`, `building_scenes`, `rendering`, `validating`, `persisting`. Errors expose a safe code and `allowedActions`, for example `select_voice`, `revise_script`, `retry`, `reconnect`.

Retry accepts `{expectedJobVersion}` and resumes only unchanged eligible inputs in the same logical job with a new attempt. A content/voice change requires a new storyboard/approval/job. Cancellation is best effort at a safe stage boundary; already accepted provider work may consume quota.

POST video revision: `{expectedRevision, instruction, sceneIds}`. It queues proposed content edits rather than changing a ready MP4. Verify scene IDs belong to the pinned storyboard. Return a planning job; approve its new storyboard before regeneration. Prior successful output remains accessible.

## 8. Assets

POST upload intent:

```json
{
  "projectId": "<project-id>",
  "purpose": "scene_image",
  "fileName": "microphone.png",
  "contentType": "image/png",
  "sizeBytes": 240000
}
```

Return `assetId, uploadUrl, method: PUT, requiredHeaders, expiresAt`. The server generates the R2 key. Never trust filename as a filesystem/object path. Initially accept PNG/JPEG/WebP raster uploads; reject executable/active content. Completion queues inspection; attachment is allowed only after `active` validation state.

POST access: `{purpose: "playback"|"download"}`. Return `url, expiresAt, contentType`. URL is a bearer capability until expiry, not an authenticated user-bound URL. Recheck ownership before each issuance. GET asset metadata never returns raw storage credentials or reusable provider ingestion capabilities.

Deletion fails with 409 `ASSET_IN_USE` while referenced by current revisions, retained videos, jobs, or pending publications; alternatively delete the owning project via its explicit lifecycle. Background cleanup removes only unreferenced assets.

## 9. Social connection flow

Provider values: `youtube`, `instagram`. Start accepts a server-allowlisted `returnTo` local path; no arbitrary redirects. Store authorization attempt before 302 to provider. Callback validates state/PKCE/provider error and creates/reconnects the same external identity, then 303 redirects to safe settings UI.

When channel/account selection is necessary, store an unconfirmed OAuth attempt and available owned candidate IDs server-side. Return the creator to a selection screen; POST `/connections/:provider/complete` with `{attemptId, candidateId}` finalizes it. This route is required only for provider flows exposing multiple eligible destinations. Never assume a Google identity implies the intended YouTube channel.

GET connections returns `id, provider, displayName, externalAccountId, status, version, scopesSummary, expiresAt`; no tokens. One active connection per provider per user, and an external identity cannot be actively shared across users. Generic CONNECTION_IN_USE must not expose the other user's identity.

Disconnect blocks new publication dispatch immediately and requests cancellation/reconciliation of in-flight work. Different-account reconnect does not retarget pending posts. User login does not depend on social connectivity.

## 10. Publications and schedules

Create one publication per destination; a UI crosspost action creates two independent records. Requests explicitly confirm publication approval:

```json
{
  "videoVersionId": "<ready-video-id>",
  "connectionId": "<owned-youtube-connection-id>",
  "metadata": {
    "title": "The science of quiet",
    "description": "A short explanation of active noise cancellation.",
    "audience": "not_made_for_kids",
    "syntheticMediaDisclosure": false
  },
  "schedule": {
    "mode": "scheduled",
    "executeAt": "2026-11-07T12:30:00Z",
    "timeZone": "Asia/Kolkata",
    "localDateTime": "2026-11-07T18:00:00"
  },
  "confirmApproval": true
}
```

Validate timestamp/timezone/local-time agreement; reject ambiguity or past schedule. `mode: now` omits future-time fields and receives server execution time. Display interpreted time before confirmation. Metadata is provider-specific: YouTube title/description/audience/disclosure; Instagram caption. Validate against current provider constraints in its adapter, not assumed universal limits.

Create approval + publication + asset references + outbox in a transaction. External upload does not occur in that transaction. Return 201 with status `scheduled` or `queued`, version 1, approval hash, and interpreted time. Publication requires technical readiness and usable licensing; do not infer rights from voice availability alone.

PATCH accepts `expectedVersion`, proposed metadata/schedule/replacement video, and `confirmApproval: true`. Store a new immutable approval/snapshot and update only if state permits. Reapproval is required for changed destination, video, or metadata; the old snapshot remains auditable. Reject mutation while upload has passed an irreversible boundary and offer explicit recovery.

Statuses: `draft`, `scheduled`, `queued`, `uploading`, `processing`, `published`, `needs_reconnection`, `needs_action`, `unknown_reconciling`, `failed`, `cancel_requested`, `cancelled`. Return `allowedActions` and `publishedUrl` only after confirmation. Retry is forbidden during `unknown_reconciling`; reconcile first to avoid duplicates.

Calendar query: `GET /publications?from=<UTC>&to=<UTC>&status=scheduled&cursor=...`. Use a bounded time interval (proposed maximum 90 days) and paginate. Late-publication grace remains a configurable founder-review policy, not a delivery guarantee.

## 11. Proposed limits and operational rules

| Input/action | Initial proposed limit |
| --- | --- |
| General JSON body | 256 KB; smaller endpoint limits where appropriate |
| Brief/message | 6,000 characters |
| Reference text | 30,000 characters |
| Storyboard | 2–12 scenes; per-scene narration 1–1,000 characters |
| Voice preview | 300 characters |
| Raster upload | 10 MB; dimensions/decompression limits validated server-side |
| Active video generation | One per user; fleet capacity controlled separately |
| List page | 20 default, 50 maximum |

These supersede local prototype limits only when implemented and validated. Apply per-user/IP admission, provider-account quotas, fair scheduling, and bounded previews. Return actionable 429; do not expose internal budget balances or add customer billing.

## 12. Security, test cases, and contract evolution

- Test cross-user access for every resource, signed URL issuance, references, connection selection, and publication command.
- Verify duplicate requests return original results; key/body mismatches and revision conflicts return 409.
- Test provider timeout, model retirement, unavailable voice, malformed scene data, unsupported cue, and render recovery.
- Test callback state replay, invalid redirect, revoked token, different-account reconnection, ambiguous schedule, and partial crosspost success.
- Generate an OpenAPI specification and shared runtime validators during implementation; this document is the human-readable contract, not a generated spec.
- Additive fields can be introduced compatibly. Breaking changes require a versioned endpoint/schema and migration plan. Old jobs retain their pinned input schemas and renderer versions.
- Operator retry/reconciliation endpoints, provider webhooks, and service-to-service renderer commands are private interfaces with separate service authentication, not publicly exposed dashboard routes.

No endpoint in this document should be considered available merely because the local prototype has a similarly named route.
