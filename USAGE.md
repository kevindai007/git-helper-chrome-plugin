# Git Helper Chrome Plugin — Installation & Usage

This guide explains how to load the extension in Chrome and use it on GitLab Merge Request pages.

## Download

- Download the Chrome plugin from: {the_url_of_the_linke}
- If you downloaded a ZIP, unzip it to a folder that contains `manifest.json`.

## Install (Chrome)

1. Open Chrome and go to `chrome://extensions/` (or click the Extensions icon → Manage Extensions).
2. Enable Developer mode (top-right).
3. Click “Load unpacked” and select the folder from the Download step (the one with `manifest.json`).
4. Ensure the extension appears in the list and is enabled.

## Use in GitLab

- Open any GitLab Merge Request page; you should see an “AI Review” button.
- Click it to trigger the review.

## Troubleshooting

- AI Review button not visible:
  - Make sure you selected the extension’s root folder (the one containing `manifest.json`).
  - Refresh the MR page or toggle the extension off/on on `chrome://extensions/`.
  - Confirm you are on a supported GitLab domain and on a Merge Request page.
- Updating the extension:
  - Replace the files in your local folder and click “Update” on `chrome://extensions/`, or remove the old extension and load it again.

