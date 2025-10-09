GitLab AI Review Helper (Chrome Extension)

Overview
- Injects an "AI Review" button on GitLab Merge Request pages.
- On click, shows a small panel, calls the backend `POST /api/v1/mr/analyze` with `{ mr_url: <current page URL> }`, and displays the analysis result.
- Adds an "AI Generate" button next to the Description field on the New Merge Request page.
  - Streams description via SSE (Server-Sent Events) from `POST /api/v1/mr/describe` with `{ mr_new_url: <current page URL> }` and progressively fills the editor.

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
- Endpoints (base is selected dynamically by GitLab host):
  - `POST {BASE}/api/v1/mr/analyze`
  - `POST {BASE}/api/v1/mr/describe` (SSE stream: `Accept: text/event-stream`)
- Request body: `{ "mr_url": "https://gitlab.com/.../-/merge_requests/..." }`
- Response JSON example:
  {
    "status": "success",
    "mrUrl": "...",
    "analysisResult": "...markdown/text...",
    "errorMessage": null
  }

- Description generator
- Request body: `{ "mr_new_url": "https://gitlab.com/.../-/merge_requests/new?..." }`
- Response JSON example:
  SSE events:
  - `event: start` data(JSON): `{ status: "IN_PROGRESS", mrNewUrl, correlationId, ts }`
  - `event: delta` data(string): incremental chunk text to append
  - `event: error` data(JSON): `{ message, correlationId, ts }` — stop on error
  - `event: done`  data(JSON): `{ status: "SUCCESS", mrNewUrl, description }`

Backend base selection
- See `src/config.js`:
  - `BACKEND_MAP`: maps GitLab host → backend base, e.g.
    - `gitlab.com` → `http://localhost:8080`
    - `gitlab-ultimate.nationalcloud.ae` → `http://kubernetes.docker.internal:8080`
  - `BACKEND_BASE`: fallback base if no map entry matches.
- The background worker builds URLs per request using the page URL host, so you don't need to edit code when switching between GitLab environments — just adjust `BACKEND_MAP` once.

Permissions
- `manifest.json` must include host permissions for any backend bases you will call. Currently included:
  - `http://localhost:8080/*`
  - `http://kubernetes.docker.internal:8080/*`
  If you add other backends, add them here or use optional host permissions.

Architecture
- Background (MV3 service worker)
  - `src/background.js` — entry that routes messages
  - `src/background/handlers.js` — message handlers per feature (`analyze_mr`, `adopt_change`, `describe_mr`)
  - `src/background/http.js` — small HTTP helpers (POST JSON)
- Config
  - `src/config.js` — backend base mapping per GitLab host, URL builders
- Content scripts
  - `src/content/ai_review.js` — AI Review feature for MR pages
  - `src/content/mr_describe.js` — AI Generate Description for New MR page (SSE streaming UI)

Notes
- Each feature is isolated so you can extend/upgrade independently.
- Add new background handlers and new content scripts without touching existing features.

Notes
- The extension runs as a Manifest V3 extension.
- Cross-origin request to `localhost:8080` is performed by the background service worker (to avoid CORS limitations in content scripts). Ensure your backend is running and accessible.
- The content script tries to insert the button near the MR header action buttons; if not found, it adds a floating button in the top-right corner.
 - Backend URL is centralized in `src/config.js` (`BACKEND_BASE`, `ANALYZE_PATH`). Update these if your backend origin/path changes. The manifest still declares `host_permissions` for that origin as required by MV3.
