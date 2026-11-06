# Explainova — application and local video prototype

The full application is now being built in small milestones alongside the working prototype. See [project status and delivery plan](PROJECT_STATUS.md), [web app setup](apps/web/README.md), and [UI design handoff](UI_DESIGN_SCREEN_MAP.md).

## New application scaffold

```powershell
npm --prefix apps/web ci
npm run app:dev
```

Open **http://127.0.0.1:3000**. The first milestone provides the responsive app shell and first-project view. Authentication, project persistence, generation, and publishing will follow as separate features. The commands and prototype details below still apply to the independent runner on port 4310.

Planning documents: [full application system design](SYSTEM_DESIGN.md), [V1 PRD](PRD.md), and [prototype technical plan](TECHNICAL_DESIGN_AND_PROTOTYPE_PLAN.md). The full app is at scaffold stage; most system-design features remain planned. The renderer described below is the independent local prototype.

Detailed full-app specifications: [API design](API_DESIGN.md) and [database design](DB_DESIGN.md). No production database migrations or full-app endpoints have been deployed.

This is a single-user Windows prototype, not the SaaS dashboard. It renders 30–90-second English explainer videos with local male/female narration and captions. No login, cloud storage, social publishing, or billing is implemented.

## Quick start

Requirements: Windows with English Microsoft desktop speech voices, Node.js 22+ (tested with 24), and Chrome. Remotion licensing terms apply; confirm Free License eligibility for your organization.

```powershell
npm ci
npm start
```

Open **http://127.0.0.1:4310**. Load the offline sample, review its narration and labels, select Male or Female, check approval, and select Create video. Keep the local runner and computer active while rendering. Generation runs independently of the browser tab.

The UI saves the current storyboard locally and restores its project ID from browser storage. Inputs and generated artifacts live under `outputs/`. Do not expose this local server to the internet; there is intentionally no authentication.

## Render the sample directly

```powershell
npm run sample
```

The authored water-cycle demonstration produces approximately 52 seconds of 1080 × 1920 video with Microsoft Zira narration. Output paths are printed when ready. Narration uses Windows speech APIs; restricted execution environments may need approval to access them and launch headless Chrome.

## Optional Gemini planning

Copy `.env.example` to `.env`, add your own `GEMINI_API_KEY`, and restart the server. Set `GEMINI_MODEL` to a model available in your account. Your Gemini consumer subscription does not automatically provide an API key or unlimited API quota. The key stays in the local server process, never browser code.

New-topic planning sends your entered idea to Google's API. An unavailable key/model/quota produces a visible error; the app does not silently enable billing or switch providers. Live Gemini requests have not been validated without a key.

The default model is configurable; provider availability may change. The offline sample requires no API calls. The local UI defaults to Windows narration. A direct ElevenLabs narration adapter is now available for approved storyboards; Gemini TTS is not implemented.

### Direct API video generation

The first API video uses a Gemini storyboard reviewed for scientific clarity, the account-listed premade Alice voice through ElevenLabs Flash v2.5, and Remotion animation. No dashboard is required:

```powershell
node --env-file=.env scripts/api-probe.mjs
node --env-file=.env scripts/first-api-video.mjs plan gemini-3.1-flash-lite
# Review outputs/api-first/storyboard.json before rendering.
node --env-file=.env scripts/first-api-video.mjs render
```

Planning replaces the saved storyboard. Rendering consumes ElevenLabs quota only for uncached narration. Account voice listing does not by itself prove free-tier synthesis access; the synthesis endpoint must accept the selected voice. The first run successfully used Alice without selecting a community/library voice. Requests are not blindly retried, and no billing plan is upgraded. Free-plan narration is for noncommercial testing under ElevenLabs' terms.

Project requirement for the ElevenLabs adapter: use only voices available through the connected account's free-tier API access. Do not select paid/restricted library voices or assume website availability implies API access. Persist this policy in future development; surface unavailable voices and request reselection without silently upgrading or substituting.

Visual defaults from review: no decorative bottom label pills or progress tabs. Match the theme to the topic. The second API test (`scripts/second-api-video.mjs`) demonstrates this with a violet/cyan audio-studio theme, headphone illustration, and animated interference diagrams. These visual components are authored, while Gemini supplies the reviewed storyboard and ElevenLabs the narration.

## What is implemented

- Minimal local Plan → Storyboard → Render interface.
- Optional Gemini-generated structured storyboards with validation.
- Clearly labeled authored sample independent of Gemini.
- Editable scene titles, narration, labels, male/female voice selection, and explicit approval.
- Windows David/Zira voice selection; no silent gender substitution.
- Original animated SVG water-cycle illustration and simpler generic label diagrams.
- Speech-event-based caption timing with an explicit 16 kHz WAV format and timestamp validation.
- Remotion H.264 MP4 rendering and separate SRT export.
- Local stage status, narration caching, resume after failure, and previous version folders.
- Same-origin checks, loopback binding, request limits, and constrained artifact routes.

## Current limitations

- Sample motion is authored by scene type. Arbitrary semantic phrase-to-motion generation is not implemented. Generic scenes illustrate label relationships; they do not generate custom scientific artwork.
- Target duration guides Gemini's word budget. Actual runtime follows speech; renders outside 30–90 seconds fail and request script edits. No silent shortening is performed.
- Captions use synthesis word events, not a separately verified acoustic alignment model. Human review is required.
- The storyboard editor shows structured text and labels, not generated scene-image previews. The finished video has a still preview artifact.
- Editing individual scenes reuses unchanged audio, but the complete MP4 rerenders. Resume reuses valid audio checkpoints, not partial encoded video.
- Reopening restores the latest project. It is not a searchable multi-project dashboard. Avoid simultaneous tabs/processes editing or rendering the same project.
- No hosted queue, authentication, Gemini TTS adapter, revenue analytics, music, or social connections.
- No automated factual verification or guaranteed caption/diagram accuracy. The demo script is authored and must not be described as an AI-generated sample.

## Tests and recovery

```powershell
npm test
```

Tests cover input validation, voice-change cache invalidation, timestamp bounds, caption boundaries, local save/load, request-origin protection, and approval requirements.

For a failed/interrupted job, reopen the local page, review, and render again. Unchanged audio is reused. The old successful output remains in its version folder. If a voice is unavailable, install an English Windows desktop voice or select an installed option. For Chrome errors set `CHROME_PATH` in `.env`. A new render needs no browser download when Chrome is installed.

Provider secrets, output media, and dependencies are excluded from Git. Before building the full app, review sample quality and timing with the founder and obtain approval to proceed.
