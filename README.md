GitLab AI Review Helper (Chrome Extension)

Overview
- Injects an "AI Review" button on GitLab Merge Request pages.
- On click, shows a small panel, calls a local backend at `http://localhost:8080/api/v1/mr/analyze` with `{ mr_url: <current page URL> }`, and displays the analysis result.
 - Adds an "AI Generate" button next to the Description field on the New Merge Request page to auto-generate and fill a description via `POST http://localhost:8080/api/v1/mr/describe` with `{ mr_new_url: <current page URL> }`.

Icons
- Source icons are under `assets/` (kept for design source control).
- Runtime icons are copied into `icons/` and referenced by `manifest.json`:
  - Extension icons: 16, 32, 48, 128 → `icons/icon_16.png`, `icon_32.png`, `icon_48.png`, `icon_128.png`
  - Toolbar action icons: 16, 24, 32 → `icons/icon_16.png`, `icon_24.png`, `icon_32.png`
  - Note: Chrome requires PNG; SVG is for source only and not referenced in the manifest.

Install (Developer Mode)
- Open Chrome → `chrome://extensions/`.
- Toggle "Developer mode" on (top-right).
- Click "Load unpacked" and select this folder.

Backend API
- Expected endpoint: `POST http://localhost:8080/api/v1/mr/analyze`
- Request body: `{ "mr_url": "https://gitlab.com/.../-/merge_requests/..." }`
- Response JSON example:
  {
    "status": "success",
    "mrUrl": "...",
    "analysisResult": "...markdown/text...",
    "errorMessage": null
  }

- Description generator endpoint: `POST http://localhost:8080/api/v1/mr/describe`
- Request body: `{ "mr_new_url": "https://gitlab.com/.../-/merge_requests/new?..." }`
- Response JSON example:
  {
    "status": "success",
    "mrNewUrl": "...",
    "projectId": 123,
    "sourceBranch": "feature",
    "targetBranch": "main",
    "description": "...markdown...",
    "errorMessage": null
  }

Notes
- The extension runs as a Manifest V3 extension.
- Cross-origin request to `localhost:8080` is performed by the background service worker (to avoid CORS limitations in content scripts). Ensure your backend is running and accessible.
- The content script tries to insert the button near the MR header action buttons; if not found, it adds a floating button in the top-right corner.
 - Backend URL is centralized in `src/config.js` (`BACKEND_BASE`, `ANALYZE_PATH`). Update these if your backend origin/path changes. The manifest still declares `host_permissions` for that origin as required by MV3.
