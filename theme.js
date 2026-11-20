(() => {
  const key = 'listening-room-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* 存储不可用时仍按系统主题显示。 */ }

  /** 同步主题、浏览器背景和按钮状态，不重载播放器或学习资料。 */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131209' : '#f7f7f2');
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
  }

  /** 无手动偏好时跟随系统，否则使用用户已经选择的主题。 */
  function applyPreference() {
    applyTheme(preference || (system.matches ? 'dark' : 'light'));
  }

  /** 绑定常驻主题按钮；写入失败时保持当前主题并提示实际结果。 */
  function bindThemeControls() {
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        preference = button.dataset.themeChoice;
        let saved = true;
        try { localStorage.setItem(key, preference); } catch { saved = false; }
        applyPreference();
        const status = document.querySelector('#theme-status');
        status.textContent = `已切换为${preference === 'dark' ? '深色' : '浅色'}模式${saved ? '' : '；浏览器无法保存主题，刷新后将跟随系统'}`;
        status.classList.toggle('theme-warning', !saved);
        status.classList.toggle('sr-only', saved);
      });
    });
    applyPreference();
  }

  applyPreference();
  system.addEventListener('change', applyPreference);
  document.addEventListener('DOMContentLoaded', bindThemeControls, { once: true });
})();
