// content_new_mr.js
// Adds an "AI Generate" button next to the Description label on GitLab New MR page
// and fills the editor with the generated description from backend.

(function () {
  const BTN_ID = 'gl-ai-generate-desc-btn';
  const STYLE_ID = 'gl-ai-generate-style';

  const isNewMrPage = () => /\/(?:-\/)?merge_requests\/new(?:$|[/?#])/.test(location.pathname + location.search);

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} { margin-left: 8px; }
      .gl-ai-gen-inline { display:inline-flex; align-items:center; gap:6px; }
      .gl-ai-gen-msg { margin-left: 8px; font-size: 12px; color: #57606a; }
      .gl-ai-gen-msg.err { color: #d1242f; }
    `;
    document.documentElement.appendChild(style);
  }

  function findDescriptionLabel() {
    // Primary selector as provided
    let label = document.querySelector('label.gl-block[for="merge_request_description"]');
    if (label) return label;
    // Fallbacks
    label = document.querySelector('label[for="merge_request_description"]');
    if (label) return label;
    // Try to locate by text content "Description"
    const allLabels = Array.from(document.querySelectorAll('label'));
    return allLabels.find(l => (l.textContent || '').trim() === 'Description') || null;
  }

  function setTextareaValue(textarea, value) {
    try {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) { /* no-op */ }
  }

  function setProseMirrorText(pmEl, text) {
    if (!pmEl) return false;
    try {
      // Focus editor
      pmEl.focus();
      // Select all existing content
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pmEl);
      sel.removeAllRanges();
      sel.addRange(range);
      // Try to insert as plain text (preserves newlines -> paragraphs)
      const ok = document.execCommand('insertText', false, text);
      if (!ok) {
        // Fallback: clear and set textContent
        pmEl.textContent = text;
      }
      // Fire input event to notify frameworks
      pmEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function fillDescription(value) {
    let updated = false;
    // Update underlying textarea if present
    const ta = document.querySelector('textarea#merge_request_description, textarea[name="merge_request[description]"]');
    if (ta) { setTextareaValue(ta, value); updated = true; }

    // Update ProseMirror editor if present
    const pm = document.querySelector('[data-testid="content_editor_editablebox"] .ProseMirror, .tiptap.ProseMirror.rte-text-box[contenteditable="true"]');
    if (pm) {
      const ok = setProseMirrorText(pm, value);
      updated = ok || updated;
    }

    return updated;
  }

  function createButton() {
    if (document.getElementById(BTN_ID)) return; // already present
    ensureStyles();

    const label = findDescriptionLabel();
    if (!label) return;

    const container = document.createElement('span');
    container.className = 'gl-ai-gen-inline';

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'AI Generate';
    btn.className = 'gl-button btn btn-md';
    btn.title = 'Generate description with AI';

    const msg = document.createElement('span');
    msg.className = 'gl-ai-gen-msg';
    msg.style.display = 'none';

    container.appendChild(btn);
    container.appendChild(msg);

    try {
      label.insertAdjacentElement('beforeend', container);
    } catch (_) {
      label.parentElement && label.parentElement.appendChild(container);
    }

    let doing = false;
    btn.addEventListener('click', async () => {
      if (doing) return;
      doing = true;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Generating…';
      msg.style.display = 'inline';
      msg.classList.remove('err');
      msg.textContent = '';

      try {
        const mrNewUrl = location.href;
        const resp = await chrome.runtime.sendMessage({ type: 'describe_mr', mrNewUrl });
        if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Unknown error');
        const data = resp.data || {};
        const description = data.description || '';
        if (!description) throw new Error('No description returned');
        const ok = fillDescription(description);
        if (!ok) {
          msg.textContent = 'Inserted to clipboard target not found';
          msg.classList.add('err');
        } else {
          msg.textContent = 'Description inserted';
        }
      } catch (e) {
        msg.textContent = `Failed: ${e && e.message ? e.message : e}`;
        msg.classList.add('err');
      } finally {
        btn.textContent = prev;
        btn.disabled = false;
        doing = false;
        // Hide status after a moment
        setTimeout(() => { msg.style.display = 'none'; msg.textContent = ''; msg.classList.remove('err'); }, 3000);
      }
    });
  }

  function ensureUi() {
    if (!isNewMrPage()) return;
    createButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUi);
  } else {
    ensureUi();
  }

  const mo = new MutationObserver(() => {
    if (isNewMrPage() && !document.getElementById(BTN_ID)) {
      ensureUi();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // React to SPA URL changes
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  function onUrlChange() { setTimeout(() => ensureUi(), 50); }
  history.pushState = function () { origPushState.apply(this, arguments); onUrlChange(); };
  history.replaceState = function () { origReplaceState.apply(this, arguments); onUrlChange(); };
  window.addEventListener('popstate', onUrlChange);
})();

