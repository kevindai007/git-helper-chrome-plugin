// content.js
// Injects an "AI Review" button on GitLab MR pages and shows a side panel with results.

(function () {
  const BTN_ID = 'gl-ai-review-btn';
  const PANEL_ID = 'gl-ai-review-panel';
  const STYLE_ID = 'gl-ai-review-style';

  // Consider any GitLab MR path (project/-/merge_requests or project/merge_requests)
  const isMrPage = () => /\/(?:-\/)?merge_requests\//.test(location.pathname);

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
        position: fixed;
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

      .gl-ai-content { white-space: normal; }
      .gl-ai-error { color:#d1242f; white-space: pre-wrap; }

      /* Structured rendering for findings */
      .gl-ai-section-title { font-weight:600; margin: 6px 0; }
      .gl-ai-summary { margin: 6px 0 10px; white-space: pre-wrap; }
      .gl-ai-findings { margin: 6px 0; padding: 0; }
      .gl-ai-finding { list-style: none; margin: 10px 0; padding: 10px; border: 1px solid #eaeef2; border-radius: 6px; }
      .gl-ai-finding-header { display:flex; align-items:center; gap:8px; font-weight:600; }
      .gl-ai-index { display:inline-block; min-width: 20px; text-align:center; padding: 0 6px; border-radius: 999px; font-size: 12px; line-height: 18px; color:#111; background:#e2e8f0; }
      .gl-ai-badge { display:inline-block; padding: 0 6px; border-radius: 999px; font-size: 12px; line-height: 18px; color:#222; background:#eaeef2; text-transform: capitalize; }
      .gl-ai-badge.low { background:#d7f0e5; color:#03543f; }
      .gl-ai-badge.medium { background:#fff4cf; color:#92400e; }
      .gl-ai-badge.high { background:#fde2e2; color:#9b1c1c; }
      .gl-ai-badge.critical { background:#fbd5d5; color:#7f1d1d; }
      .gl-ai-meta { color:#57606a; font-size:12px; }
      .gl-ai-file { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
      .gl-ai-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size:12px;
        color:#24292f;
        background:#f6f8fa;
        border:1px solid #d0d7de;
        padding:8px;
        border-radius:6px;
        white-space: pre;
        overflow:auto;
      }
      @media (prefers-color-scheme: dark) {
        .gl-ai-code {
          color:#c9d1d9;
          background:#0d1117;
          border-color:#30363d;
        }
      }

      /* (Removed special remediation block; reuse .gl-ai-code for visibility) */
      .gl-ai-subtitle { font-weight:600; margin: 8px 0 4px; }
      .gl-ai-apply { margin-left:auto; height: 24px; padding: 0 8px; border-radius: 6px; border: 1px solid #d0d7de; background:#f6f8fa; color:#24292f; font-size:12px; cursor:pointer; }
      .gl-ai-apply:hover { filter: brightness(0.97); }
      .gl-ai-apply[disabled] { opacity: 0.6; cursor: default; }
      .gl-ai-apply[data-status="0"] { background: #000; color: #fff; border-color: #000; }
      .gl-ai-apply[data-status="0"]:hover { background: #333; }
      .gl-ai-apply[data-status="1"] { background: #ccc; color: #000; border-color: #ccc; cursor: default; }
      @media (prefers-color-scheme: dark) {
        .gl-ai-apply { background:#161b22; color:#c9d1d9; border-color:#30363d; }
        .gl-ai-apply[data-status="0"] { background: #000; color: #fff; border-color: #000; }
        .gl-ai-apply[data-status="0"]:hover { background: #333; }
        .gl-ai-apply[data-status="1"] { background: #ccc; color: #000; border-color: #ccc; }
      }
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
    // Adopt GitLab button classes for native look while keeping our ID styles as fallback
    btn.className = 'gl-button btn btn-md btn-confirm';

    // Positioning wrapper to help place panel next to button
    const wrapper = document.createElement('span');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.marginRight = '8px';
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

    let onReposition = null;
    let resizeObs = null;
    function repositionPanel() {
      const margin = 12; // keep inside viewport
      const gap = 6; // gap from button
      const rect = btn.getBoundingClientRect();

      // Ensure it's measurable
      const pr = panel.getBoundingClientRect();
      let panelWidth = pr.width || 420;
      let panelHeight = pr.height || 200;

      // Default below-left aligned to button
      let top = rect.bottom + gap;
      let left = rect.left;

      // Horizontal clamp
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - panelWidth);
      }
      if (left < margin) left = margin;

      // Vertical flip if overflow
      if (top + panelHeight > window.innerHeight - margin) {
        const above = rect.top - gap - panelHeight;
        if (above >= margin) {
          top = above;
        } else {
          // Not enough space above or below; clamp to viewport with max height
          top = Math.max(margin, Math.min(top, window.innerHeight - margin - panelHeight));
          panel.style.maxHeight = `calc(100vh - ${2 * margin}px)`;
        }
      }

      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
    }

    function attachReposition() {
      if (onReposition) return;
      onReposition = () => { if (panel.classList.contains('visible')) repositionPanel(); };
      window.addEventListener('resize', onReposition, { passive: true });
      window.addEventListener('scroll', onReposition, { passive: true, capture: true });
      // Observe panel size changes (content updates) to keep it in view
      if ('ResizeObserver' in window && !resizeObs) {
        resizeObs = new ResizeObserver(() => {
          if (panel.classList.contains('visible')) repositionPanel();
        });
        resizeObs.observe(panel);
      }
    }

    function detachReposition() {
      if (!onReposition) return;
      window.removeEventListener('resize', onReposition, { passive: true });
      window.removeEventListener('scroll', onReposition, { passive: true, capture: true });
      onReposition = null;
      if (resizeObs) { try { resizeObs.disconnect(); } catch (_) {} resizeObs = null; }
    }

    function showPanel() {
      // Make panel visible for measurement, but hidden to avoid flicker
      panel.classList.add('visible');
      panel.style.visibility = 'hidden';
      requestAnimationFrame(() => {
        repositionPanel();
        panel.style.visibility = '';
        attachReposition();
      });
    }

    function hidePanel() {
      panel.classList.remove('visible');
      detachReposition();
    }

    closeBtn.addEventListener('click', hidePanel);

    // Delegate clicks for Apply buttons inside the panel content
    contentEl.addEventListener('click', async (e) => {
      const t = e.target;
      if (!t || !(t instanceof Element)) return;
      const btn = t.closest('.gl-ai-apply');
      if (!btn) return;
      if (btn.getAttribute('data-status') === '1' || btn.getAttribute('data-loading') === '1') return;
      e.preventDefault();
      const findingId = btn.getAttribute('data-finding-id');
      if (!findingId) return;
      const prev = btn.textContent;
      btn.setAttribute('data-loading', '1');
      btn.textContent = 'Applying…';
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'adopt_change', findingId, pageUrl: location.href });
        if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Failed');
        btn.textContent = 'Applied';
        btn.setAttribute('data-status', '1');
      } catch (err) {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = prev; btn.removeAttribute('data-loading'); repositionPanel(); }, 1400);
      } finally {
        btn.removeAttribute('data-loading');
        repositionPanel();
      }
    });

    btn.addEventListener('click', async () => {
      ensureStyles();
      // Toggle: if visible, hide and stop
      if (panel.classList.contains('visible')) {
        hidePanel();
        return;
      }
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
        const analysis = data.analysisResult;

        loadingEl.style.display = 'none';
        if (status === 'success') {
          contentEl.style.display = 'block';
          // Render new structured payload, with backward compatibility for string
          const html = renderAnalysisHtml(analysis);
          contentEl.innerHTML = html;
          // Reposition after content expands
          repositionPanel();
        } else {
          errorEl.style.display = 'block';
          errorEl.textContent = data.errorMessage || 'Analysis failed.';
          repositionPanel();
        }
      } catch (e) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = `Request failed: ${e.message || e}`;
        repositionPanel();
      }
    });
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderAnalysisHtml(analysis) {
    if (!analysis) return 'No analysis returned.';
    if (typeof analysis === 'string') {
      return `<pre class="gl-ai-code">${escapeHtml(analysis)}</pre>`;
    }
    // Assume object with schemaVersion, promptType, findings[], summaryMarkdown
    const parts = [];
    if (analysis.summaryMarkdown) {
      parts.push(`<div class="gl-ai-section-title">Summary</div>`);
      parts.push(`<div class="gl-ai-summary">${escapeHtml(analysis.summaryMarkdown)}</div>`);
    }
    const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
    if (findings.length > 0) {
      parts.push(`<div class="gl-ai-section-title">Findings (${findings.length})</div>`);
      parts.push('<ul class="gl-ai-findings">');
      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const sev = (f.severity || '').toLowerCase();
        const title = escapeHtml(f.title || '');
        const ruleId = f.ruleId ? escapeHtml(f.ruleId) : '';
        const category = escapeHtml(f.category || '');
        const loc = f.location || {};
        const file = escapeHtml(loc.file || '');
        const lineType = loc.lineType ? String(loc.lineType) : '';
        const startLine = loc.startLine != null ? String(loc.startLine) : '';
        const anchorId = loc.anchorId ? String(loc.anchorId) : '';
        const anchorSide = loc.anchorSide ? String(loc.anchorSide) : '';
        const range = startLine ? `${startLine}` : '';
        const description = escapeHtml(f.description || '');
        const evidence = f.evidence ? `<div class="gl-ai-subtitle">Evidence</div><pre class="gl-ai-code">${escapeHtml(f.evidence)}</pre>` : '';
        const remParts = [];
        if (f.remediation && f.remediation.steps) {
          remParts.push(`<div class=\"gl-ai-subtitle\">Remediation</div><pre class=\"gl-ai-code\">${escapeHtml(f.remediation.steps)}</pre>`);
        }
        if (f.remediation && f.remediation.diff) {
          remParts.push(`<div class=\"gl-ai-subtitle\">Suggested Diff</div><pre class=\"gl-ai-code\">${escapeHtml(f.remediation.diff)}</pre>`);
        }
        const remediation = remParts.join('');
        const tags = Array.isArray(f.tags) && f.tags.length ? `<div class="gl-ai-meta">Tags: ${f.tags.map(escapeHtml).join(', ')}</div>` : '';
        const confidence = f.confidence != null ? `<div class="gl-ai-meta">Confidence: ${escapeHtml(f.confidence)}</div>` : '';
        const meta = [ruleId && `Rule: ${ruleId}`, category && `Category: ${category}`].filter(Boolean).join(' • ');
        const lineMetaParts = [];
        if (range) lineMetaParts.push(`Line: ${escapeHtml(range)}`);
        if (lineType) lineMetaParts.push(`Type: ${escapeHtml(lineType)}`);
        if (anchorSide) lineMetaParts.push(`Side: ${escapeHtml(anchorSide)}`);
        const lineMeta = lineMetaParts.length ? `<div class="gl-ai-meta">${lineMetaParts.join(' • ')}</div>` : '';

        parts.push(`
          <li class="gl-ai-finding" data-finding-id="${escapeHtml(f.id || '')}" data-anchor-id="${escapeHtml(anchorId)}" data-anchor-side="${escapeHtml(anchorSide)}" data-line-type="${escapeHtml(lineType)}" data-start-line="${escapeHtml(startLine)}">
            <div class="gl-ai-finding-header">
              <span class="gl-ai-index">${i + 1}</span>
              <span class="gl-ai-badge ${sev}">${escapeHtml(sev || 'info')}</span>
              <span>${title}</span>
              ${(() => {
                if (!f.id) return '';
                const st = Number(f.status);
                const applied = st === 1;
                const label = applied ? 'Applied' : 'Apply';
                return `<button class="gl-ai-apply" data-finding-id="${escapeHtml(f.id)}" data-status="${applied ? '1' : '0'}">${label}</button>`;
              })()}
            </div>
            ${meta ? `<div class="gl-ai-meta">${escapeHtml(meta)}</div>` : ''}
            ${file ? `<div class="gl-ai-meta">File: <span class="gl-ai-file">${file}${range ? ':' + range : ''}</span></div>` : ''}
            ${lineMeta}
            ${description ? `<div class="gl-ai-summary">${description}</div>` : ''}
            ${evidence}
            ${remediation}
            ${tags}
            ${confidence}
          </li>
        `);
      }
      parts.push('</ul>');
    }
    return parts.join('');
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
