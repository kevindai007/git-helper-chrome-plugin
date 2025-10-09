// mr_describe.js
// Adds an "AI Generate" button next to the Description label on GitLab New MR page.

(function () {
  const BTN_ID = 'gl-ai-generate-desc-btn';
  const STYLE_ID = 'gl-ai-generate-style';
  const isNewMrPage = () => /\/(?:-\/)?merge_requests\/new(?:$|[/?#])/.test(location.pathname + location.search);

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#${BTN_ID}{margin-left:8px}.gl-ai-gen-inline{display:inline-flex;align-items:center;gap:6px}.gl-ai-gen-msg{margin-left:8px;font-size:12px;color:#57606a}.gl-ai-gen-msg.err{color:#d1242f}`;
    document.documentElement.appendChild(style);
  }

  function findDescriptionLabel() {
    let label = document.querySelector('label.gl-block[for="merge_request_description"]');
    if (label) return label;
    label = document.querySelector('label[for="merge_request_description"]');
    if (label) return label;
    const allLabels = Array.from(document.querySelectorAll('label'));
    return allLabels.find(l => (l.textContent || '').trim() === 'Description') || null;
  }

  function setTextareaValue(textarea, value) {
    try { textarea.value = value; textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
  }

  function setProseMirrorText(pmEl, text) {
    if (!pmEl) return false;
    try {
      pmEl.focus();
      const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(pmEl); sel.removeAllRanges(); sel.addRange(range);
      const ok = document.execCommand('insertText', false, text);
      if (!ok) pmEl.textContent = text;
      pmEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch { return false; }
  }

  function fillDescription(value) {
    let updated = false;
    const ta = document.querySelector('textarea#merge_request_description, textarea[name="merge_request[description]"]');
    if (ta) { setTextareaValue(ta, value); updated = true; }
    const pm = document.querySelector('[data-testid="content_editor_editablebox"] .ProseMirror, .tiptap.ProseMirror.rte-text-box[contenteditable="true"]');
    if (pm) updated = setProseMirrorText(pm, value) || updated;
    return updated;
  }

  function createButton() {
    if (document.getElementById(BTN_ID)) return;
    ensureStyles();
    const label = findDescriptionLabel(); if (!label) return;
    const container = document.createElement('span'); container.className = 'gl-ai-gen-inline';
    const btn = document.createElement('button'); btn.id = BTN_ID; btn.type = 'button'; btn.textContent = 'AI Generate'; btn.className = 'gl-button btn btn-md'; btn.title = 'Generate description with AI';
    const msg = document.createElement('span'); msg.className = 'gl-ai-gen-msg'; msg.style.display = 'none';
    container.appendChild(btn); container.appendChild(msg);
    try { label.insertAdjacentElement('beforeend', container); } catch { label.parentElement && label.parentElement.appendChild(container); }

    let doing = false;
    let correlationId = null;
    let agg = '';

    function getEditorElements() {
      const pm = document.querySelector('[data-testid="content_editor_editablebox"] .ProseMirror, .tiptap.ProseMirror.rte-text-box[contenteditable="true"]');
      const ta = document.querySelector('textarea#merge_request_description, textarea[name="merge_request[description]"]');
      return { pm, ta };
    }

    const writer = {
      cleared: false,
      pm: null,
      ta: null,
      ensure() { const { pm, ta } = getEditorElements(); this.pm = pm; this.ta = ta; return !!(pm || ta); },
      clear() {
        this.ensure();
        if (this.ta) { this.ta.value = ''; try { this.ta.dispatchEvent(new Event('input', { bubbles: true })); } catch {} }
        if (this.pm) {
          try {
            this.pm.focus();
            const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(this.pm); sel.removeAllRanges(); sel.addRange(range);
            document.execCommand('delete', false);
            this.pm.dispatchEvent(new Event('input', { bubbles: true }));
          } catch {}
        }
        this.cleared = true;
      },
      appendChunk(chunk) {
        this.ensure();
        if (this.ta) {
          this.ta.value += chunk;
          try { this.ta.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
        }
        if (this.pm) {
          try {
            this.pm.focus();
            const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(this.pm); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
            let handled = false;
            try {
              const ev = new InputEvent('beforeinput', { data: chunk, inputType: 'insertText', bubbles: true, cancelable: true });
              handled = this.pm.dispatchEvent(ev) === false || ev.defaultPrevented;
            } catch {}
            if (!handled) {
              const ok = document.execCommand('insertText', false, chunk);
              if (!ok) {
                this.pm.appendChild(document.createTextNode(chunk));
              }
            }
            try { this.pm.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
          } catch {}
        }
      },
      setText(text) {
        this.ensure();
        if (this.ta) {
          this.ta.value = text;
          try { this.ta.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
        }
        if (this.pm) {
          try {
            this.pm.focus();
            const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(this.pm); sel.removeAllRanges(); sel.addRange(range);
            let handled = false;
            try {
              const ev = new InputEvent('beforeinput', { data: text, inputType: 'insertReplacementText', bubbles: true, cancelable: true });
              handled = this.pm.dispatchEvent(ev) === false || ev.defaultPrevented;
            } catch {}
            if (!handled) {
              const okDel = document.execCommand('delete', false);
              const okIns = document.execCommand('insertText', false, text);
              if (!okDel || !okIns) { this.pm.textContent = text; }
            }
            try { this.pm.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
          } catch { try { this.pm.textContent = text; } catch {} }
        }
      }
    };
    const onEvent = (evt) => {
      if (!evt || evt.type !== 'describe_mr_event') return;
      // If we haven't received correlationId yet, adopt the first incoming one.
      if (!correlationId) {
        correlationId = evt.correlationId || null;
      }
      if (!correlationId || evt.correlationId !== correlationId) return;
      const { eventType, data } = evt;
      if (eventType === 'start') {
        msg.textContent = 'Generating…';
        if (!writer.cleared) writer.clear();
      } else if (eventType === 'delta') {
        const chunk = String(data || '');
        agg += chunk;
        msg.textContent = 'Generating…';
        msg.style.display = 'inline';
        if (!writer.cleared) writer.clear();
        writer.appendChunk(chunk);
      } else if (eventType === 'error') {
        msg.textContent = `Failed: ${data && data.message ? data.message : 'Unknown error'}`;
        msg.classList.add('err');
        cleanup(true);
      } else if (eventType === 'done') {
        const finalText = (data && data.description) ? data.description : agg;
        agg = finalText;
        writer.setText(finalText);
        msg.textContent = 'Description inserted';
        cleanup(false);
      }
    };
    const onMessage = (evt) => onEvent(evt);

    function cleanup(error) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      try { chrome.runtime.sendMessage({ type: 'describe_mr_abort', correlationId }); } catch {}
      correlationId = null;
      btn.disabled = false;
      doing = false;
      setTimeout(() => { msg.style.display = 'none'; if (!error) msg.classList.remove('err'); }, 2000);
      chrome.runtime.onMessage.removeListener(onMessage);
      window.removeEventListener('beforeunload', onUnload);
    }
    function onUnload() { if (correlationId) { try { chrome.runtime.sendMessage({ type: 'describe_mr_abort', correlationId }); } catch {} } }

    btn.addEventListener('click', async () => {
      if (doing) return; doing = true; btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Generating…'; msg.style.display = 'inline'; msg.classList.remove('err'); msg.textContent = '';
      agg = '';
      try {
        const mrNewUrl = location.href;
        chrome.runtime.onMessage.addListener(onMessage);
        window.addEventListener('beforeunload', onUnload);
        const resp = await chrome.runtime.sendMessage({ type: 'describe_mr_start', mrNewUrl });
        if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Failed to start stream');
        correlationId = resp.correlationId;
      } catch (e) {
        msg.textContent = `Failed: ${e && e.message ? e.message : e}`; msg.classList.add('err');
        btn.disabled = false; doing = false; chrome.runtime.onMessage.removeListener(onMessage); window.removeEventListener('beforeunload', onUnload);
      } finally {
        btn.textContent = 'AI Generate';
      }
    });
  }

  function ensureUi() { if (!isNewMrPage()) return; createButton(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi); else ensureUi();
  const mo = new MutationObserver(() => { if (isNewMrPage() && !document.getElementById(BTN_ID)) ensureUi(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  const origPushState = history.pushState; const origReplaceState = history.replaceState; function onUrlChange() { setTimeout(() => ensureUi(), 50); }
  history.pushState = function () { origPushState.apply(this, arguments); onUrlChange(); };
  history.replaceState = function () { origReplaceState.apply(this, arguments); onUrlChange(); };
  window.addEventListener('popstate', onUrlChange);
})();
