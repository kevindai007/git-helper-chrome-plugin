// Inject shared styles for AI buttons and UI
(function injectSharedStyles() {
  const ID = 'gl-ai-shared-style';
  if (document.getElementById(ID)) return;
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = `
    /* Shared layout-only button styles; colors come from site theme (e.g., GitLab .btn-confirm) */
    .gl-ai-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 10px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      user-select: none;
    }
    .gl-ai-btn:hover { filter: brightness(0.97); }
    .gl-ai-btn:disabled { opacity: 0.6; cursor: default; }
    /* Distinct green (original AI Review color) */
    .gl-ai-btn.gl-ai-btn--confirm {
      background: #1f883d !important;
      color: #ffffff !important;
      border: 1px solid rgba(0,0,0,0.1) !important;
    }
    .gl-ai-btn.gl-ai-btn--confirm:hover { filter: brightness(0.95); }
  `;
  document.documentElement.appendChild(style);
})();
