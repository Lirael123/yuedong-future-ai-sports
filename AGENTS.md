# 跃动未来 deployment and maintenance

This repository contains an existing React/TypeScript/Vite/PWA application. Reuse
the application in `src/`; do not generate a replacement website, change its visual
design, remove existing code, or substitute the fixed reference video.

- Runtime: Node.js 22 and npm. Install with `npm ci` and preserve the lockfile.
- `npm run dev` starts the existing Vite app on the requested platform port.
- `npm run build` produces `dist`. Its prebuild copies the exact locked MediaPipe
  WASM files and verifies the committed model checksum. Do not disable checks.
- GitHub Pages defaults to `/yuedong-future-ai-sports/`. Independent Coze hosting
  uses `VITE_BASE_PATH=/`; never change the original repository's production base
  globally to repair a separate deployment.
- Keep `public/reference/standing-long-jump-v1.mp4` and its existing motion template.
- Student videos and pose detection stay in the browser. Send only the five
  anonymous teaching fields specified in `coze/WORKFLOW.md` to the server.
- Keep Coze tokens exclusively in backend Secrets. Reuse `coze-proxy/worker.js`
  for `/coach`; do not embed tokens or OAuth credentials in Vite variables.
- A configured URL or project ID does not prove a live workflow. Test the real
  endpoint and preserve explicit errors; do not fabricate teaching replies,
  pose landmarks, diagnostic scores, or deployment links.

Required checks before release: `npm run type-check`, `npm run test:yuedong`,
`npm run test:mediapipe`, `npm run test:coze`, production builds for both base paths,
browser smoke checks, and an authorized real standing-jump MP4 through pose
detection, four-stage diagnosis, actual Coze guidance, training and saved records.
Use a preview before publishing. Verify the actual final URL after deployment.
Run Safari checks on Safari; a narrow Chromium viewport is not Safari validation.
Keep changes in `feature/coze-hosting-deployment` in the original repository.
Never push these changes directly to its `main` or deploy its Pages automatically.
