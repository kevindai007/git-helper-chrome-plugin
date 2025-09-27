// content.js
// Injects an "AI Review" button on GitLab MR pages and shows a side panel with results.

(function () {
  const BTN_ID = 'gl-ai-review-btn';
  const PANEL_ID = 'gl-ai-review-panel';
  const STYLE_ID = 'gl-ai-review-style';

  const isMrPage = () => location.hostname === 'gitlab.com' && /\/merge_requests\//.test(location.pathname);

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid rgba(0,0,0,0.1);
        background: #1f883d;
        color: #fff;
        font-size: 13px;
        cursor: pointer;
      }
      #${BTN_ID}:hover { filter: brightness(0.95); }

      #${PANEL_ID} {
        position: absolute;
        z-index: 9999;
        min-width: 380px;
        max-width: 640px;
        max-height: 60vh;
        overflow: auto;
        padding: 12px 14px;
        border-radius: 8px;
        border: 1px solid rgba(0,0,0,0.12);
        box-shadow: 0 6px 24px rgba(0,0,0,0.18);
        background: #fff;
        color: #1f2328;
        font-size: 13px;
        line-height: 1.45;
        display: none;
      }

      #${PANEL_ID}.visible { display: block; }

      .gl-ai-review-header {
        display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;
      }
      .gl-ai-review-title { font-weight:600; }
      .gl-ai-review-close { cursor:pointer; border:none; background:transparent; font-size:16px; line-height:1; }

      .gl-ai-loading { display:flex; align-items:center; gap:8px; color:#57606a; }
      .gl-ai-spinner {
        width: 14px; height: 14px; border: 2px solid #e1e4e8; border-top-color: #1f883d; border-radius: 50%;
        animation: gl-ai-spin 0.9s linear infinite;
      }
      @keyframes gl-ai-spin { to { transform: rotate(360deg); } }

      .gl-ai-content { white-space: pre-wrap; }
      .gl-ai-error { color:#d1242f; white-space: pre-wrap; }
    `;
    document.documentElement.appendChild(style);
  }

  // Utility: is element visible on page
  function isVisible(el) {
    if (!el) return false;
    const rects = el.getClientRects();
    if (!rects || rects.length === 0) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  // Find the visible Edit button element on the MR header area
  function findEditButton() {
    const roots = [
      document.querySelector('.detail-page-header'),
      document.querySelector('[data-testid="issuable-header"], header.qa-issuable-header'),
      document.querySelector('.js-issuable-actions'),
      document,
    ].filter(Boolean);

    // Prefer the header edit button (not the dropdown item)
    const prioritized = [
      '[data-testid="edit-title-button"]',
      'a.js-issuable-edit',
      'a[aria-label="Edit merge request"]',
      'button[aria-label="Edit merge request"]',
    ];
    for (const root of roots) {
      for (const sel of prioritized) {
        const el = root.querySelector(sel);
        if (
          el &&
          isVisible(el) &&
          !el.closest('.gl-new-dropdown-panel, .dropdown-menu, [data-testid="base-dropdown-menu"]')
        ) return el;
      }
    }

    // Fallbacks if above are not found/visible
    const fallbacks = [
      'a[title="Edit merge request"]',
      'button[title="Edit merge request"]',
      'a[href$="/edit"]',
      'a[title="Edit"], button[title="Edit"]',
      'button, a'
    ];
    for (const root of roots) {
      for (const sel of fallbacks) {
        const nodes = root.querySelectorAll(sel);
        for (const n of nodes) {
          const text = (n.textContent || '').trim().toLowerCase();
          const title = (n.getAttribute('title') || '').trim().toLowerCase();
          const aria = (n.getAttribute('aria-label') || '').trim().toLowerCase();
          const href = (n.getAttribute('href') || '').toLowerCase();
          if (
            text === 'edit' ||
            title === 'edit' ||
            aria === 'edit merge request' ||
            /\/edit$/.test(href)
          ) {
            if (
              isVisible(n) &&
              !n.closest('.gl-new-dropdown-panel, .dropdown-menu, [data-testid="base-dropdown-menu"]')
            ) return n;
          }
        }
      }
    }
    return null;
  }

  function createUi(beforeEl) {
    if (document.getElementById(BTN_ID)) return; // already exists

    // Button
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'AI Review';
    btn.title = 'Analyze this Merge Request with AI';

    // Positioning wrapper to help place panel next to button
    const wrapper = document.createElement('span');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="gl-ai-review-header">
        <div class="gl-ai-review-title">AI Review</div>
        <button class="gl-ai-review-close" title="Close">×</button>
      </div>
      <div class="gl-ai-body">
        <div class="gl-ai-loading"><span class="gl-ai-spinner"></span><span>Ready</span></div>
        <div class="gl-ai-content" style="display:none;"></div>
        <div class="gl-ai-error" style="display:none;"></div>
      </div>
    `;
    wrapper.appendChild(panel);

    // Insert right before the Edit button
    try {
      beforeEl.insertAdjacentElement('beforebegin', wrapper);
    } catch (_) {
      // As a last resort, append to body top-right
      wrapper.style.position = 'fixed';
      wrapper.style.top = '12px';
      wrapper.style.right = '12px';
      wrapper.style.zIndex = '9999';
      document.body.appendChild(wrapper);
    }

    const closeBtn = panel.querySelector('.gl-ai-review-close');
    const loadingEl = panel.querySelector('.gl-ai-loading');
    const contentEl = panel.querySelector('.gl-ai-content');
    const errorEl = panel.querySelector('.gl-ai-error');

    function showPanel() {
      // Place panel under/right of the button
      panel.classList.add('visible');
      // Try to keep panel within viewport
      requestAnimationFrame(() => {
        const rect = btn.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const top = rect.height + 6;
        let left = 0;
        if (rect.left + panelRect.width > window.innerWidth - 16) {
          left = Math.max(-panelRect.width + rect.width, -rect.left + 16);
        }
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
      });
    }

    function hidePanel() {
      panel.classList.remove('visible');
    }

    closeBtn.addEventListener('click', hidePanel);

    btn.addEventListener('click', async () => {
      ensureStyles();
      showPanel();
      // Reset states
      loadingEl.style.display = 'flex';
      loadingEl.querySelector('span:last-child').textContent = 'Analyzing…';
      contentEl.style.display = 'none';
      contentEl.textContent = '';
      errorEl.style.display = 'none';
      errorEl.textContent = '';

      const mrUrl = location.href;

      try {
        const resp = await chrome.runtime.sendMessage({ type: 'analyze_mr', mrUrl });
        if (!resp || !resp.ok) {
          const errMsg = (resp && resp.error) || 'Unknown error';
          throw new Error(errMsg);
        }
        const data = resp.data || {};
        const status = data.status;
        const analysis = data.analysisResult || '';

        loadingEl.style.display = 'none';
        if (status === 'success') {
          contentEl.style.display = 'block';
          contentEl.textContent = analysis || 'No analysis returned.';
        } else {
          errorEl.style.display = 'block';
          errorEl.textContent = data.errorMessage || 'Analysis failed.';
        }
      } catch (e) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = `Request failed: ${e.message || e}`;
      }
    });
  }

  function ensureUi() {
    if (!isMrPage()) return;
    ensureStyles();
    const editEl = findEditButton();
    if (editEl) createUi(editEl);
  }

  // Initial run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUi);
  } else {
    ensureUi();
  }

  // Observe DOM changes in case GitLab swaps headers dynamically
  const mo = new MutationObserver(() => {
    if (isMrPage() && !document.getElementById(BTN_ID)) {
      ensureUi();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Watch for SPA-style URL changes (pushState/replaceState)
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  function onUrlChange() { setTimeout(() => ensureUi(), 50); }
  history.pushState = function () { origPushState.apply(this, arguments); onUrlChange(); };
  history.replaceState = function () { origReplaceState.apply(this, arguments); onUrlChange(); };
  window.addEventListener('popstate', onUrlChange);
})();
