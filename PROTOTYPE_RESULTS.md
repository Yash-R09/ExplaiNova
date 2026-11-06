# Explainova local prototype — test results

Date: November 5, 2026

## Delivered

- Minimal local planning/storyboard/render interface at http://127.0.0.1:4310.
- Optional Gemini planning adapter, editable scenes, Male/Female local voices, explicit storyboard approval, local saves, cached narration, MP4 and SRT output.
- Authored water-cycle sample: `outputs/sample/4451d619772fd4ae/video.mp4`.
- Corresponding captions, composition JSON, preview image, and a frame at 24 seconds in the same output directory.

## Verified

- Node.js 24.14.0; Windows installed Microsoft David Desktop (Male) and Microsoft Zira Desktop (Female).
- Sample generated using Zira; 51.904-second container runtime, 51.9-second video, 1080 × 1920 H.264 and AAC audio, approximately 5.1 MB.
- Full video/audio decode passed with bundled FFmpeg. Metadata inspected with FFprobe.
- Opening preview and 24-second frame visually inspected: readable text, diagram, and captions without visible overlap in those frames.
- Five automated tests pass: schema/input validation; caption boundaries; voice cache invalidation; real timestamp bounds; HTTP save/load, origin protection, and approval enforcement.
- Initial speech-event timestamps exceeded WAV runtime when Windows chose its default audio format. Explicit 16 kHz PCM output corrected the mismatch; bounds validation now rejects invalid timing.
- Installed Chrome requires Remotion's `chrome-for-testing` mode; this configuration rendered successfully without downloading another browser.

## Not yet verified or implemented

- Live Gemini planning was not exercised: no Gemini API key was configured. The sample is authored, not model-generated.
- Male voice is detected and selectable but a full male-narrated MP4 has not been rendered in this run.
- Animation is scene-driven; arbitrary phrase-level semantic animation remains unimplemented.
- No listening-based narration review or frame-by-frame synchronization audit was performed. Word-event timing and decoder checks are not a substitute for that review.
- Browser UI functionality has HTTP integration coverage, not full click-through browser automation coverage.
- No multi-user dashboard, auth, cloud storage, publishing, production queue, or billing was built.
- Exact target duration fitting, cloud speech provider adapters, music, scene-image storyboard previews, multi-tab conflict handling, and broad scene-type coverage remain future work.

## Founder review gate

Review the sample's teaching clarity, style, motion, narration, and captions. Add a Gemini key locally if you want to test new AI storyboards. Improve the local prototype based on those results before deciding whether to build the full application.
