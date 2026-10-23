# MediaPipe assets

The runtime copied by `scripts/prepare-mediapipe.mjs` comes from the exact
`@mediapipe/tasks-vision` version in package-lock.json (currently 0.10.21).
The package declares Apache-2.0; `LICENSE` retains the upstream MediaPipe license.
Generated WASM and loader JavaScript are not separately checked into Git.

Pose Landmarker Lite (float16, version 1) is the original Google-hosted model
already used by this application, now served from the application's own origin:

https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Source response MD5 (base64): `BKdd33yBGsehpFIyZt19iA==`.
Verified download SHA-256:
`59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.

The preparation script verifies this SHA-256 before every development start and
production build. Updating the model requires reviewing its source and updating
the expected checksum and runtime cache version together. The model and WASM
contain no student recordings or training records.
