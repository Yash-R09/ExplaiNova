# Explainova — V1 Product Requirements Document

- **Product name:** Explainova
- **Version:** 1.3 — local prototype approval gate
- **Date:** November 4, 2026
- **Status:** Final edited PRD for founder review; implementation has not started
- **Owner:** Product founder
- **Primary platform:** Responsive web application; desktop-first authoring
- **Primary output:** English, vertical 9:16, 1080p animated educational videos, 30–90 seconds

## 1. Executive summary

Explainova helps adult creators turn a learning idea into an original animated educational video. AI develops the explanation and a combined script/storyboard. After reviewing that storyboard, the creator generates a video with narration, synchronized motion graphics, and captions. They can correct individual scenes, download the result, or approve it for immediate or scheduled publishing.

Each user has a private dashboard and connects their own YouTube channel and Instagram account. Explainova does not publish through a shared platform-owned social account. Supabase Auth and Postgres manage identity and application records; Cloudflare R2 stores media files.

The product should feel simple even though production involves multiple stages. The primary authoring flow is **Plan → Storyboard → Video**. Script approval is part of storyboard review, not a separate wizard. Publishing appears as an action on the completed video.

V1 prioritizes understandable explanations, reliable production, saved work, and easy corrections. It does not promise viral distribution, monetization eligibility, revenue, universal factual accuracy, or arbitrary studio-quality animation from any prompt.

## 2. Product goals and boundaries

### 2.1 Goals

1. Produce a coherent 30–90-second educational explainer from a short idea.
2. Synchronize meaningful visual actions with narration, rather than place unrelated imagery behind speech.
3. Minimize mandatory input and navigation steps.
4. Preserve user work and successful intermediate outputs through failures and revisions.
5. Enable original content creation with creator review before generation and publishing.
6. Support YouTube Shorts as the primary destination and Instagram Reels as secondary distribution.
7. Validate the production workflow with minimal initial service spend.

### 2.2 Non-goals for V1

- Children-directed videos, toddler content, nursery rhymes, singing, or musical animation.
- Customer billing, subscriptions, payments, credits, pricing plans, or user-facing API-cost estimates.
- Revenue or audience-performance analytics and monetization predictions.
- Videos longer than 90 seconds, landscape output, or multilingual authoring.
- Advanced 3D scenes, photorealistic generated footage, avatars, custom voice cloning, or character continuity across episodes.
- Professional multitrack timeline editing, frame-by-frame authoring, or arbitrary code editing.
- Bulk creation, unattended idea-to-publish automation, or automated factual approval.
- Team roles, client approvals, multiple brand workspaces, public developer API, or mobile-native apps.
- Website crawling, PDF ingestion, or automatic article-to-video ingestion; users can paste reference text in V1.

## 3. Users and use cases

### 3.1 Primary users

- Independent educational creators explaining science, technology, history, geography, and practical concepts.
- Educators and subject experts sharing short lessons for a general audience.
- Small educational publishers creating consistently styled social videos.

Users are adults. The dashboard and V1 creation modes are not designed for children or child-directed productions. General educational content must still be assessed honestly for its actual audience when published.

### 3.2 Core jobs to be done

- “I know the subject but need help choosing an engaging explanation.”
- “I have a script and want AI to turn it into a visual explanation.”
- “I want to fix one incorrect sentence or scene without losing the rest.”
- “I want my drafts saved and generation to continue when I close the tab.”
- “I want to approve a finished video and schedule it to my channel.”

### 3.3 Example project

Input: “Explain how a refrigerator moves heat, for beginners, in 60 seconds.”

Output: A short opening question, a coherent explanation across approximately six scenes, moving heat-flow arrows and labeled components, synchronized English narration and captions, and a concise conclusion. The explanation should remain scientifically defensible at the selected level of simplification.

## 4. Product principles

- **Few steps:** defaults first; advanced controls are optional and inline.
- **One review surface:** scene visuals and narration are reviewed together.
- **Purposeful motion:** animations clarify the concept or direct attention.
- **Creator control:** edits are reversible where possible; publication always requires approval of a specific finished version.
- **Visible state:** saved status, progress, errors, and recovery actions are explicit.
- **Reliable foundations:** structured scene specifications and tested components drive production.
- **Original educational value:** reusable styling is acceptable; interchangeable low-value content is not the intended output.

## 5. Information architecture and screens

| Surface | Required content and actions |
| --- | --- |
| Authentication | Sign up, login, logout, password reset, verification/recovery states |
| Dashboard | Create video, project library, search, status filters, rename, duplicate, delete |
| Plan | Idea chat, pasted script/reference text, compact duration/audience/tone/style/voice settings |
| Storyboard | Scene previews, narration, motion plan, approximate timings, edits, voice sample, approve and create |
| Video | Player, captions, scene list, edit prompt, revision controls, download and publishing actions |
| Publishing panel | Destination, editable metadata, account/audience/disclosure checks, date/time/timezone, status |
| Settings | Saved style, logo, fonts/colors, default voice/captions, connected accounts |

Desktop receives the complete authoring experience. Mobile must support login, project browsing, progress, preview, download, and basic text edits with usable layouts; sophisticated scene arrangement can remain desktop-optimized.

## 6. End-to-end user flows

### 6.1 New user: idea to downloaded video

1. Sign up and enter the dashboard; do not require social connection or payment.
2. Select Create video; create a saved draft immediately.
3. Enter an idea. AI proposes an angle and learning objective while supplying defaults.
4. Optionally discuss or modify the idea; select 30, 60, or 90 seconds.
5. Select Create storyboard.
6. Review one combined storyboard containing narration, visual previews, motion descriptions, and approximate timing.
7. Optionally edit scenes or give a global revision instruction; preview the voice sample.
8. Select Approve and create video. The system records the approved storyboard revision.
9. Show background generation progress; the user may leave the screen.
10. Preview the completed video, optionally request corrections, and download MP4 or SRT.

### 6.2 Existing script shortcut

1. Paste a script into Plan and identify it as an existing script.
2. Preserve wording by default; disclose proposed wording changes before approval.
3. Assess whether it fits the duration; offer shortening or a different allowed duration if needed.
4. Generate storyboard directly; no brainstorming conversation is required.
5. Continue through the same review and generation flow.

### 6.3 Revision flow

1. On Storyboard or Video, select a scene or enter a global edit instruction.
2. AI explains the proposed change briefly and updates the editable revision.
3. Changes to narration invalidate affected audio, timing, captions, and dependent visuals.
4. Generate only required stages and affected scenes where technically feasible; final MP4 assembly may rerun.
5. Retain the previous successful video while rendering.
6. Make the new version current only after successful completion; preserve the old downloadable version.
7. Require final preview approval before publishing the new version.

### 6.4 Publish now

1. Select Publish on a completed version and connect a destination if necessary.
2. Review AI-suggested title/description or Instagram caption; edit as desired.
3. Confirm destination account, audience, applicable synthetic-content disclosure, and immediate publication.
4. Record approval tied to the exact video version and metadata.
5. Upload and monitor processing/publication; show a platform link when available.
6. Report per-destination success or failure independently.

### 6.5 Scheduled publication

1. Follow the publishing flow, selecting a future local date/time and explicit timezone.
2. Show the interpreted date/time before confirmation; store the UTC instant plus the selected timezone.
3. Record the approved asset version; later project edits do not silently replace it.
4. Permit canceling or rescheduling before execution, subject to platform state.
5. At execution, validate access and asset availability, publish, reconcile status, and notify in-app.
6. For failed or missed schedules, show recovery options; do not silently publish late after a prolonged outage.

### 6.6 Resume and failure recovery

1. Reopen a project after navigating away, closing the tab, or logging in again.
2. Load the latest server-confirmed saved revision and current job state.
3. If running, display progress from the worker; if failed, show the failed stage and retry action.
4. Retry with persisted valid outputs; do not recreate already successful stages unnecessarily.

## 7. Functional requirements

### 7.1 Accounts and access

- Email/password authentication and password recovery; social publishing OAuth is separate from dashboard login.
- Each user can access only their own projects, assets, jobs, settings, and connections.
- Each dashboard is scoped to the authenticated user. Shared underlying infrastructure must not expose another user's records, media, notifications, or publishing state.
- Use Supabase Auth for identity and Postgres row-level security for user-owned tables, with ownership checks in backend operations and privileged workers.
- Derive the user identity from verified authentication, not a client-supplied owner ID.
- Publishing credentials are never exposed in browser responses or logs.
- Show useful states for expired login, verification required, and failed password reset.

### 7.2 Dashboard and project library

- Create, open, search by title, filter by status, rename, duplicate, and delete projects.
- Display last-updated time, thumbnail when available, duration, and latest generation state.
- Duplication copies creative inputs and settings, but not active jobs or scheduled posts.
- Generation and publication states are displayed separately; a ready video can have a failed Instagram post.
- Destructive deletion requires confirmation and explains effects on pending jobs and schedules.

### 7.3 Idea planning

- Accept an idea, existing script, or pasted reference text.
- AI may suggest angles, hooks, structure, and a learning objective without requiring multiple answers.
- Defaults: English, 60 seconds, general beginners, clear explanatory tone, default 2D style, selected default voice.
- Audience level supports general beginner, intermediate, and advanced presets; no toddler/children presets.
- Enforce reasonable text limits and return actionable messages for excessive input.
- For unsupported child-directed requests, explain V1 scope and offer to reframe for a general audience.
- Treat user-supplied reference text as material, not executable instructions to system tools.

### 7.4 Storyboard and script

- Generate validated structured scene data, including narration, learning purpose, scene type, objects, labels, motion cues, and estimated timing.
- Produce previews with the same visual components intended for final rendering where possible.
- Clearly label previews as illustrative where final timing or artwork can differ.
- Offer approximately 4–10 scenes depending on duration and complexity; this is a planning heuristic, not a fixed UI constraint.
- Support global revisions, manual narration/text edits, scene regeneration, insertion, deletion, and reordering.
- Keep script editing embedded within scene cards.
- Show a voice sample; cache and invalidate it when relevant voice/text settings change.
- Record the exact storyboard revision approved for generation.
- Present references for supported claims when available; never invent citations or imply a claim is verified without evidence.
- Source-grounded work uses pasted material; optional external grounding is enabled only after provider availability is validated.

### 7.5 Animation system

- Initial scene families: labeled illustration, process/flow, comparison, sequence, simple chart, and keyword explanation.
- Initial styles should be a small curated set, proposed as clean flat illustration and diagram-focused motion graphics.
- Animate arrows, paths, highlights, numbers, object movement, and transitions using tested components.
- Chart values must originate from approved content; do not fabricate numeric evidence for decoration.
- Prefer original SVG/React assets; optionally accept uploaded scene images and logos.
- Uploads are validated for type/size and sanitized; safe raster uploads are sufficient for V1.
- Unsupported concepts receive a simpler supported visual treatment or an actionable request to revise; do not silently substitute unrelated footage.
- No arbitrary generated JavaScript is executed as a scene. AI selects validated component types and parameters.

### 7.6 Narration, timing, and music

- Provide a curated English voice list, samples, speech-rate control, supported delivery controls, and pronunciation corrections.
- Provide a clear Male / Female voice selection, followed by available named voices and a playable sample. Map the selection to supported provider voice IDs, not an assumption about a person's identity. Save the preference in user defaults and snapshot the exact voice/provider configuration into each project and video version.
- Changing the voice invalidates the voice sample, narration, alignment, and dependent timing/captions. Preserve the previous successful video while generating the revision. Never silently substitute a different voice if the chosen voice becomes unavailable; ask the user to select an available replacement.
- Founder requirement: for ElevenLabs, select only voices available through the connected account's free-tier API access, now and in future development unless the founder changes this requirement. Do not assume a voice visible in the website/library is usable through the free API. Validate API availability, exclude restricted/paid voices from selectable options, and require reselection if access changes. Voice availability does not grant commercial rights to free-plan output.
- Generate final audio before locking detailed animation timing.
- Derive timestamps from audio/provider alignment, not script-length estimates alone.
- Bind semantic animation cues to narration phrases, then convert cue times to video frames.
- A narration edit invalidates affected timestamps and caption data.
- If audio is outside 30–90 seconds, propose concise rewriting or safe pacing adjustment and request approval of changed wording.
- Allow optional licensed background tracks and mute; automatically reduce music beneath narration.
- Do not depend on generated music or voice cloning in V1.

### 7.7 Captions

- Automatically create editable English captions from the final narration and timing.
- Keep captions distinct from instructional labels in scene data.
- Visual preference from prototype review: omit decorative bottom label pills/tabs and segmented progress bars by default. Keep captions; use explanatory labels only where they help the diagram. Choose colors and visual treatment appropriate to the video's topic rather than reuse one palette for every subject.
- Support readable preset styles, font size, color, emphasis, placement, and optional word highlighting.
- Constrain captions and essential labels to safe areas; provide layout checks for overlap and overflow.
- Reflow captions after text edits; regenerate alignment after actual narration changes.
- Export burned-in captions and a separate SRT file.

### 7.8 Video generation, preview, and export

- Render 1080 × 1920 MP4, proposed 30 fps, with a platform-compatible video/audio configuration verified during the technical spike.
- Show actual runtime and validation status before export/publishing.
- Provide play/pause, scrub, volume, and scene selection.
- Allow chat-driven edits, individual scene revisions, and uploaded image replacement.
- Preserve prior successful outputs; failed revisions must not overwrite them.
- Provide authenticated MP4 and SRT downloads and project-associated assets.
- A downloadable version remains immutable even if the project later changes.

### 7.9 Autosave and reliability

- Save project creation immediately; save edits after a short debounce, proposed at no more than two seconds after typing stops under normal connectivity.
- Indicate Saving, Saved, and Not saved/Retry states. Never claim unsent edits are saved.
- Retain a local pending draft when possible after connection loss; reconcile on reconnect.
- Use revision numbers to detect conflicting edits from multiple tabs; prevent silent overwrites.
- Persist jobs independently of browser sessions; production workers must run on hosted infrastructure.
- Retry transient failures with bounded exponential backoff; do not retry invalid input or revoked access indefinitely.
- Use job idempotency keys, checkpoints, worker leases/heartbeats, and timeouts.
- Cache valid artifacts by input/configuration version and hash; invalidate dependencies after edits.
- Notifications are in-app in V1; no email/SMS requirement.

### 7.10 Saved visual identity

- Save one default profile per user: style, supported font, colors, optional logo, voice, and caption preset.
- Snapshot settings into each project so changing defaults does not alter existing videos unexpectedly.
- Offer an explicit action to apply updated defaults to a project.

### 7.11 Publishing

- YouTube is primary; Instagram Reels remains in V1 scope, with integration permissions validated early.
- Connect/disconnect one account per destination per user initially.
- Every user authorizes their own YouTube channel and Instagram account. No shared account or fallback platform-owned channel is permitted.
- Bind each connection, publication, approved video, and project to the same owner. Revalidate this relationship in the publishing worker, not just the dashboard.
- A social connection belonging to one Explainova user cannot be used by another. If the same external account is already connected to another user, reject the connection with a generic explanation and provide a deliberate disconnect/reconnect recovery process; never silently transfer credentials.
- Reconnecting a different external account must not silently retarget pending posts. Require explicit destination review and approval.
- Use official APIs and OAuth; never collect social account passwords.
- Draft destination-specific metadata and allow editing.
- Confirm actual audience settings rather than assume every educational video is not made for kids.
- Explain applicable platform disclosure options; do not automatically classify every animation as requiring the same disclosure.
- Support immediate publishing, future schedules, cancel/reschedule, status reconciliation, and published links.
- Track each destination independently with retries and deduplication.
- On token expiry/revocation, prompt reconnection without losing the approved post.
- If integration access is unavailable, show the limitation and retain download; this fallback does not count as completion of the integration requirement.

### 7.12 Basic quality checks

- Validate render dimensions, runtime, decodability, audio presence, missing assets, caption ordering, and invalid timings.
- Run deterministic checks for text overflow and missing required scene data.
- Flag factual uncertainty and possible narration/visual mismatch for review where detectable.
- Do not label automated semantic or factual checks as guaranteed verification.
- Block publishing for technical failures; distinguish review warnings from blocking failures.

## 8. System workflow and proposed architecture

### 8.1 Production pipeline

```text
Idea / script / reference text
  → AI planning and validated storyboard specification
  → Preview frames and voice sample
  → Creator approves storyboard revision
  → Final narration
  → Audio timing / alignment
  → Scene assets and narration-linked animation cues
  → Captions and layout validation
  → Preview / MP4 rendering
  → Technical quality checks
  → Ready version
  → Creator approves download/publication version
  → Optional upload, schedule, and status reconciliation
```

Storyboard previews precede final narration; precise timing is finalized after audio generation. If duration correction changes meaning or wording, return the changed content for approval.

### 8.2 Proposed stack, subject to proof of concept

| Responsibility | Initial choice | Notes |
| --- | --- | --- |
| Web app | Next.js, React, TypeScript | Desktop-first responsive dashboard |
| Planning/storyboards | Gemini API | Use a supported low-cost/free-tier model during testing; pin model configuration |
| Speech | Gemini TTS; compare ElevenLabs | Provider adapter; commercial-output rights confirmed before use |
| Timing | Provider alignment or local faster-whisper | Validate against approved script |
| Animation/player/render | Remotion + original SVG/React components | Confirm license eligibility; render compute is separate |
| Authentication | Supabase Auth | User identity, login, recovery, and sessions |
| Application database | Supabase Postgres | Projects, storyboard JSON, revisions, jobs, schedules, connections, and ownership policies |
| Media storage | Cloudflare R2 | Private MP4s, narration, uploaded images, logos, thumbnails, and caption files |
| Background work | Node.js worker + BullMQ-compatible queue | Persisted queue backend and checkpoints |
| Hosting | Local development; hosted worker for pilot | Google Cloud is a candidate, not a committed hosting dependency |
| Publication | YouTube Data API; Meta Instagram API | OAuth, account support, quotas, and reviews verified early |

Do not couple stored projects to one provider response format. Maintain an internal schema and provider adapters. API keys remain server-side. Browser playback and final rendering should use the same versioned composition specification.

### 8.3 Database and media ownership

- Supabase Postgres is the V1 database; MongoDB is not part of the selected stack.
- Store structured relationships in tables and flexible scene/composition specifications in validated JSONB fields.
- Store media bytes in R2; database asset records contain owner, project, object key, size, checksum, type, and lifecycle state.
- Use private R2 buckets with object keys grouped by user/project/version. Prefixes aid organization but are not authorization controls.
- The backend verifies ownership before issuing short-lived signed upload/download links. R2 credentials never reach the browser.
- Supabase row-level security does not protect R2 objects. The media access layer independently enforces authorization for previews, downloads, uploads, worker access, and deletion.
- Platform upload mechanisms may require temporary fetchable media URLs. Issue narrowly scoped URLs with suitable expiry and revoke access where supported; do not make the bucket public.
- Validate that completed uploads match the permitted key, size, and file type before attaching them to a project.
- Workers use trusted asset records, not arbitrary user-submitted URLs. Apply URL validation if fetching external assets is added later.
- Use explicit asset lifecycle states and retryable cleanup to handle database/R2 operations that cannot share one transaction. Periodically remove orphaned temporary files without deleting referenced versions or scheduled assets.
- Production uses persistent R2 media storage. Local temporary render files are disposable and do not replace saved project artifacts.

### 8.4 Internal cost control without customer billing

V1 excludes pricing/credits screens and customer billing. It still needs bounded retries, concurrency limits, output caching, and internal provider usage logs to avoid accidental unbounded spend. Free tiers are development aids, not production availability guarantees.

## 9. Data model and state management

### 9.1 Core entities

| Entity | Important fields |
| --- | --- |
| User | ID, authentication identity, created time |
| User preferences | Default voice/style/caption settings, logo reference |
| Project | Owner, title, idea, audience, target duration, current revision, timestamps |
| Conversation | Project, messages, reference inputs |
| Storyboard revision | Scene specifications, narration, sources/warnings, approval record |
| Scene | Stable ID, position, component type, visual parameters, motion cues, text |
| Asset | Owner/project, type, storage key, checksum, provenance/license metadata |
| Generation job | Input revision, stage, attempt count, checkpoint, error, progress, timestamps |
| Video version | Immutable composition/configuration, artifact references, actual duration, QA status |
| Social connection | Owner ID, provider, external account/channel ID/display name, encrypted credential reference, status |
| Publication | Owner ID, connection ID, approved video version/metadata, UTC schedule/timezone, platform ID, status |

### 9.2 Generation states

`queued → preparing → generating_audio → aligning → building_scenes → rendering → validating → ready`

Any running state can transition to `failed` or `cancel_requested`; cancellation is best effort. Jobs can resume from persisted checkpoints. Cancellation does not promise reversal of upstream provider charges or external publication.

### 9.3 Publication states

`draft → scheduled/queued → uploading → processing → published`

Additional states: `needs_reconnection`, `failed`, `cancelled`, and `unknown_reconciling`. An uncertain provider response must be reconciled before another upload attempt.

## 10. Edge cases and required behavior

| Case | Required behavior |
| --- | --- |
| Empty, unclear, or overly broad idea | Suggest a concrete angle; ask only essential clarifying questions |
| Script too long | Explain fit problem and propose shortening; preserve original |
| Script too short | Offer a shorter target or meaningful expansion, avoiding filler |
| Unsupported language or child-directed request | Explain V1 boundary and offer a supported alternative |
| Contradictory or unsupported factual claims | Flag uncertainty, retain source context, request review |
| Provider returns malformed scene JSON | Validate, retry bounded repair, then surface recoverable failure |
| Provider rate limit/outage | Back off, preserve checkpoints, expose waiting/failure state |
| TTS skips words or mispronounces a term | Detect mismatch where possible; regenerate affected audio or allow correction |
| Audio falls outside allowed runtime | Return for approved revision or safe pacing correction; do not silently truncate |
| Caption text differs from narration | Warn; caption-only edits must not silently change spoken audio |
| Visual contains wrong count/labels | Deterministic constraints where possible and creator correction; no guaranteed semantic detection |
| Image missing or expired download URL | Reload via stored asset key or regenerate affected asset; do not output blank scenes |
| Long captions or labels overlap | Reflow/reposition within limits; block unresolved severe overflow |
| Browser closes during generation | Hosted worker continues; restored UI reads persisted state |
| Worker crashes | Lease expires; recovery resumes without duplicate jobs or corrupt artifacts |
| Duplicate Generate clicks | Return existing active job for the same revision |
| Edit during a render | Save as a new draft revision; running job stays tied to its original inputs |
| Multiple tabs edit the same project | Detect revision conflict and offer reload/retain draft options |
| Offline autosave | Show unsaved status and retain local pending edits where possible |
| User deletes active project | Confirm; cancel pending jobs/schedules where possible and clean assets asynchronously |
| Project already published then deleted | Explain that local deletion does not delete the external post |
| Publication succeeds but callback is lost | Reconcile provider state; do not blindly repeat the upload |
| YouTube succeeds, Instagram fails | Preserve successful result; retry only failed destination |
| Social token expires | Mark reconnection required; retain draft/schedule and notify |
| Scheduled asset edited later | Keep approved scheduled version; require explicit replacement approval |
| Schedule is past or ambiguous local time | Reject past times; explicitly resolve timezone/DST ambiguity |
| Service unavailable at scheduled time | Mark delayed/failed; offer publish now or reschedule rather than silently posting much later |
| User disconnects destination | Explain affected schedules; suspend/cancel them and stop new publishing attempts |
| Upload passes but platform processing rejects it | Surface platform error and retain downloadable original |
| Storage full | Preserve existing files; stop new writes with actionable recovery |
| Free tier or trial ends | Surface provider/configuration failure; never silently switch to a paid project |
| Unauthorized asset URL or project ID | Deny access without revealing another user's data |
| Signed media URL expires during playback | Reauthorize and refresh access for the owner without changing the stored object key |
| External account is already connected to another user | Reject without exposing the other user's identity; require deliberate recovery |
| Reconnection selects a different channel/account | Suspend affected schedules until the user reviews and approves the new destination |
| R2 upload succeeds but database write fails | Reconcile or remove the orphaned object through retryable cleanup |
| Worker receives mismatched project and connection owners | Block publication and record a security-relevant error without exposing credentials |

## 11. Nonfunctional requirements

### Reliability and durability

- A successful server-confirmed save survives normal restarts; backups and recovery must be configured for the deployed environment.
- Browser closure must not terminate hosted jobs. Local prototypes clearly disclose machine availability requirements.
- A job must reach a terminal state or a visible recovery state; no indefinitely spinning status.
- Retry only safe/idempotent operations; reconcile external side effects before retrying.

### Performance targets

These are initial engineering targets to validate on a declared test environment, not launch guarantees:

- Dashboard usable within three seconds on a normal broadband connection, excluding external authentication delays.
- Save acknowledgement within two seconds after a debounced request under normal conditions.
- Generation progress visible within five seconds after job submission.
- Storyboard and final-render latency measured during the spike; establish realistic p50/p95 targets before public release rather than inventing a render-time promise.

### Security and privacy

- TLS, server-side secrets, encrypted social credential storage, per-user database/storage authorization, and signed or authenticated asset access.
- Enforce owner policies in Supabase and test R2 authorization independently. Privileged service credentials bypass normal database protections and must only be used in trusted server/worker paths with explicit checks.
- Validate uploads and provider outputs; sanitize text/SVG handling and disallow arbitrary generated code execution.
- Redact tokens and sensitive text from operational logs.
- Provide deletion of projects/assets and a documented account-deletion process.
- Explain third-party processing and free-tier data-use behavior before public onboarding.
- Limit API scopes to required actions and support credential revocation.

### Accessibility and usability

- Keyboard-accessible primary flows, labeled controls, visible focus, readable contrast, and non-color-only statuses.
- Captions editable before export; no forced background audio.
- Plain-language error messages with a next action.

## 12. Acceptance criteria and test plan

| Area | Acceptance criterion |
| --- | --- |
| Basic flow | A new user can create a project, approve a combined storyboard, render, preview, and download without a separate script screen |
| Duration | Test projects at each target produce valid outputs within the overall 30–90-second range, with actual duration shown |
| Script preservation | Existing-script flow preserves supplied wording unless the creator accepts a change |
| Captions | Exported video includes readable synchronized captions; SRT text/timing matches the approved narration |
| Voice selection | Both Male and Female options offer a working preview and supported voice; the final narration uses the selected voice. Switching voices updates audio/timing while retaining the prior successful video |
| Motion synchronization | On a reviewed sample set, key highlights/actions occur within a proposed ±300 ms of their intended narration cues; captions are checked for visible drift |
| Educational visuals | Reviewed examples show correct counts, labels, direction, and sequence for the explanation |
| Revisions | Changing one scene preserves unrelated inputs and valid artifacts; failed revision leaves prior MP4 available |
| Autosave | Reload after Saved restores the latest server-confirmed content; offline unsaved state is accurately indicated |
| Recovery | Simulated worker/provider failure resumes from checkpoint without duplicate active jobs |
| Access control | A second user cannot read or mutate another user's project, artifacts, or connection |
| Private dashboards | Two test users see separate libraries, settings, notifications, jobs, and schedules across all supported screens |
| Social ownership | Each user's upload targets their own authorized account; cross-user connection IDs and account swapping are rejected |
| R2 isolation | Cross-user signed URL requests and unauthorized asset attachment/deletion are denied; expired links can be safely refreshed |
| Publishing | Approved version uploads successfully to supported test accounts with correct metadata and final state reconciliation |
| Scheduling | A scheduled test post executes at the interpreted time; cancellation and expired-token paths work |
| Partial failures | One destination's failure does not duplicate or erase the other's success |
| Deletion | Project deletion cleans local assets/pending work and does not imply deletion of external posts |

Test with at least ten representative projects across science, technology, and history/geography, including short/long scripts, unusual pronunciation, long labels, and unsupported requests. Include integration tests for job recovery, autosave conflicts, authorization, and publication reconciliation. Conduct human visual/audio QA; structural tests alone cannot establish explanation quality.

## 13. Success metrics

### Primary metric

Weekly active creators who complete at least one video and download or successfully publish it.

### Supporting metrics

- Idea-to-storyboard and storyboard-to-completed-video conversion.
- Time to first completed video and end-to-end generation latency.
- Generation success rate, retry frequency, and jobs needing manual recovery.
- Revision count before acceptance and scene-specific correction patterns.
- Confirmed-save failure/conflict rate.
- Publishing success rate and scheduling delay.
- Returning creators and repeat project creation.
- Internal provider/compute usage per successful video, excluding customer-facing billing.

Do not equate generation volume with customer value or use YouTube revenue as a V1 acceptance criterion. Audience/revenue analytics are deferred.

## 14. Dependencies and validation gates

### Gate A: technical proof before full implementation

Create one 60-second explainer with approximately six scenes, narration, synchronized diagrams/motion, captions, and MP4 export. Perform one narration revision and one visual revision. Measure quality, rendering time, resource use, and provider limitations. Compare Gemini TTS and ElevenLabs using the same scripts.

The immediate build is a local, single-user prototype with a minimal form or CLI, local storyboard approval, local checkpoint files, MP4/SRT export, and voice selection. Do not build the dashboard, authentication, Supabase/R2 infrastructure, social integrations, or production queue for this test. External AI APIs may still be used. Test additional topics and 30/60/90-second targets, then present results to the founder. Full application development is conditional on explicit approval after reviewing the local prototype; all other requirements in this PRD describe that later application.

### Gate B: integration feasibility

Validate YouTube and Instagram account eligibility, OAuth scopes, app review/audit requirements, quotas, scheduling behavior, and error recovery using supported test accounts. Publishing requirements remain in scope until explicitly changed by the founder.

### Gate C: operational readiness

Confirm Remotion license eligibility, commercial speech/asset rights, hosting/storage retention, persistent queues, backup/recovery, provider privacy settings, and free-tier/trial limitations. No promise of unlimited free operation.

## 15. Delivery phases

1. **Local prototype:** Gate A only; founder reviews results before authorizing further work. Publishing integration checks are deferred.
2. **Core authoring:** auth, dashboard, planning, storyboard, saved style, autosave.
3. **Production pipeline:** voice, timing, animation components, captions, preview, rendering, revisions.
4. **Reliability:** checkpoint recovery, conflicts, progress, asset lifecycle, QA, access control.
5. **Distribution:** OAuth, destination metadata, publish now, scheduling, reconciliation.
6. **Pilot:** representative projects and creator testing; resolve acceptance failures before release.

No delivery dates are committed before the spike and integration findings.

## 16. Decisions still to finalize

- Logo, visual identity, and domain/trademark availability for the selected Explainova name.
- Exact initial animation styles and scene component inventory.
- Gemini model IDs and final default speech provider, chosen after quality tests.
- Hosting provider, worker sizing, queue backend, and backup configuration.
- Safe upload/text limits and file retention limits based on measured resources.
- Numerical operational targets after baseline measurements.
- Treatment of missed schedules, proposed default: require confirmation to publish late.
- Detailed privacy/terms wording and supported launch geography.

These decisions do not reopen the approved product direction: general educational explainers, 30–90 seconds, simple three-stage authoring, captions, autosave, reliable generation, and reviewed distribution, with billing deferred.

## 17. Reference documentation

Provider documentation and allowances change. These references inform implementation but are not contractual product promises. Checked during product discussion on November 4, 2026.

- Gemini API billing: https://ai.google.dev/gemini-api/docs/billing/
- Gemini API pricing/models: https://ai.google.dev/gemini-api/docs/pricing
- Google AI Pro benefits: https://support.google.com/googleone/answer/14534406
- Remotion license/pricing: https://www.remotion.dev/docs/license/pricing
- Remotion captions: https://www.remotion.dev/docs/captions/
- ElevenLabs billing/commercial rights: https://elevenlabs.io/docs/overview/administration/billing
- ElevenLabs forced alignment: https://elevenlabs.io/docs/api-reference/forced-alignment/create
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Supabase pricing: https://supabase.com/pricing
- Supabase architecture/access: https://supabase.com/docs/guides/getting-started/the-supabase-way-to-build
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 overview: https://developers.cloudflare.com/r2/how-r2-works/
- BullMQ: https://docs.bullmq.io/
- YouTube uploads: https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- YouTube channel monetization policies: https://support.google.com/youtube/answer/1311392
- Instagram publishing documentation, access/requirements to validate: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/

## 18. Approval checklist

- [ ] V1 scope and explicit exclusions accepted.
- [ ] Three-stage authoring flow accepted.
- [ ] 2D component-based animation approach accepted for V1.
- [ ] General-audience English output and 30–90-second vertical format accepted.
- [ ] YouTube primary and Instagram secondary publishing scope accepted.
- [ ] Private per-user dashboards and individually authorized social accounts accepted; no shared publishing accounts.
- [ ] Supabase Auth/Postgres plus private Cloudflare R2 media storage accepted.
- [ ] Reliability, edge-case handling, and acceptance criteria accepted.
- [ ] Technical proof and unresolved implementation choices acknowledged.

Approval authorizes moving into technical validation and implementation planning. This document itself does not create accounts, enable paid services, or publish content.
