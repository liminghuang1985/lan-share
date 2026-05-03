/**
 * LAN Share Admin · 全局逻辑
 * 主题切换 + Toast + 路由守卫 + 共享 UI
 */

// ============ 主题管理 ============
const Theme = {
  STORAGE_KEY: 'ls_admin_theme',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY) || 'dark';
    this.apply(saved);
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this._updateToggleBtn(theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  },

  _updateToggleBtn(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
      ? `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>`;
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

// ============ 路由守卫 ============
async function requireAdmin() {
  const token = Token.get();
  if (!token) {
    redirectToLogin();
    return false;
  }
  try {
    const data = await Api.verify();
    if (!data.valid || data.user?.role !== 'admin') {
      redirectToLogin();
      return false;
    }
    return true;
  } catch {
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  Token.clear();
  window.location.href = '01-login.html';
}

function redirectToDashboard() {
  window.location.href = '02-dashboard.html';
}

// ============ 侧边栏高亮 ============
function highlightNav(filename) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
  });
  const current = document.querySelector(`.nav-item[href="${filename}"]`);
  if (current) current.classList.add('active');
}

// ============ 登出 ============
async function doLogout() {
  await Api.logout();
  showToast('已退出登录', 'success');
  setTimeout(() => redirectToLogin(), 300);
}

// ============ 模态框 ============
function showModal({ title, body, onConfirm, confirmText = '确定', cancelText = '取消', danger = false }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${escapeHtml(title)}</span>
        <button class="btn-icon" onclick="closeModal()">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      <div class="modal-body">
        ${typeof body === 'string' ? body : ''}
        <div class="modal-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-ghost" onclick="closeModal()">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  if (onConfirm) {
    document.getElementById('modal-confirm-btn').onclick = () => { onConfirm(); closeModal(); };
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
}

// ============ 工具 ============
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
});
