/**
 * LAN Share Client · 全局应用逻辑
 * 主题切换 + Toast通知 + 路由守卫
 */

// ============ 主题管理 ============

const Theme = {
  STORAGE_KEY: 'ls_theme',

  init() {
    // 读取本地保存的主题，默认为 dark
    const saved = localStorage.getItem(this.STORAGE_KEY) || 'dark';
    this.apply(saved);
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this._updateToggleIcon(theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  },

  _updateToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const icon = btn.querySelector('.theme-icon');
    if (!icon) return;
    icon.innerHTML = theme === 'dark'
      ? `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`;
  }
};

// ============ Toast 通知 ============

function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
  };

  toast.innerHTML = `${iconMap[type] || ''}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ 路由守卫 ============

// 需要登录的页面，初始化时调用
async function requireAuth() {
  const token = localStorage.getItem('ls_token');
  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    const data = await Api.verify();
    if (!data.valid) {
      redirectToLogin();
      return false;
    }
    return true;
  } catch (e) {
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  localStorage.removeItem('ls_token');
  window.location.href = '10-client-login.html';
}

function redirectToBrowse() {
  window.location.href = '11-client-browse.html';
}

// 获取当前登录用户（从 localStorage）
function getCurrentUser() {
  try {
    const data = localStorage.getItem('ls_user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('ls_user', JSON.stringify(user));
}

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
});
