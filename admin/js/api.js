/**
 * LAN Share Admin · API 调用封装
 * 管理端专用 API（含管理员接口）
 */

const API_BASE = '/api';

// ============ Token 管理 ============
const Token = {
  get() { return localStorage.getItem('ls_admin_token') || null; },
  set(token) { localStorage.setItem('ls_admin_token', token); },
  clear() { localStorage.removeItem('ls_admin_token'); },
  headers() {
    const token = this.get();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};

async function request(method, path, body = null, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...Token.headers()
  };
  const config = { method, headers, ...options };

  if (body !== null && method !== 'GET') {
    if (body instanceof FormData) {
      delete headers['Content-Type'];
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `请求失败 (${res.status})`, res.status);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ============ Admin API ============
const Api = {

  // 认证
  async login(username, password) {
    const data = await request('POST', '/auth/login', { username, password });
    if (data.token) {
      Token.set(data.token);
      setCurrentUser(data.user);
    }
    return data;
  },

  async logout() {
    try { await request('POST', '/auth/logout'); } catch {}
    Token.clear();
  },

  async verify() {
    return request('GET', '/auth/verify');
  },

  async me() {
    return request('GET', '/auth/me');
  },

  // 用户管理
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/users?${qs}`);
  },

  async getUser(id) {
    return request('GET', `/users/${id}`);
  },

  async createUser(data) {
    // API 使用 displayName（camelCase）
    return request('POST', '/users', {
      username: data.username,
      password: data.password,
      displayName: data.display_name,
      email: data.email || '',
      department: data.department || '',
      role: data.role || 'user'
    });
  },

  async updateUser(id, data) {
    // API 使用 camelCase
    const payload = {};
    if (data.display_name !== undefined) payload.displayName = data.display_name;
    if (data.email !== undefined) payload.email = data.email;
    if (data.department !== undefined) payload.department = data.department;
    if (data.role !== undefined) payload.role = data.role;
    if (data.status !== undefined) payload.status = data.status;
    if (data.password) payload.password = data.password;
    return request('PUT', `/users/${id}`, payload);
  },

  async deleteUser(id) {
    return request('DELETE', `/users/${id}`);
  },

  async batchUsers(action, userIds, data) {
    return request('POST', '/users/batch', { action, userIds, data });
  },

  // 文件夹管理
  async getFolders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/folders?${qs}`);
  },

  async getFolder(id) {
    return request('GET', `/folders/${id}`);
  },

  async createFolder(data) {
    return request('POST', '/folders', data);
  },

  async updateFolder(id, data) {
    return request('PUT', `/folders/${id}`, data);
  },

  async deleteFolder(id) {
    return request('DELETE', `/folders/${id}`);
  },

  // 权限管理
  async getPermissionMatrix() {
    return request('GET', '/permissions/matrix');
  },

  async setPermission(userId, folderId, canRead, canWrite) {
    return request('POST', '/permissions/set', { userId, folderId, canRead, canWrite });
  },

  async batchPermission(userId, permissions) {
    return request('POST', '/permissions/batch', { userId, permissions });
  },

  async deletePermission(userId, folderId) {
    return request('DELETE', `/permissions/${userId}/${folderId}`);
  },

  // 审计日志
  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/audit?${qs}`);
  },

  async getAuditStats() {
    return request('GET', '/audit/stats');
  },

  async exportAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/audit/export?${qs}`, {
      headers: { ...Token.headers() }
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError('导出失败', res.status);
    return text; // CSV string
  },

  // 仪表盘统计
  async getDashboardStats() {
    const [users, folders, auditStats] = await Promise.all([
      this.getUsers({ limit: 1 }),
      this.getFolders({ limit: 1 }),
      this.getAuditStats()
    ]);
    const todayCount = (auditStats.todayLogs || []).reduce((sum, item) => sum + (item.count || 0), 0);
    return {
      totalUsers: users.total,
      totalFolders: folders.total,
      todayLogs: todayCount,
      totalLogs: auditStats.totalLogs,
      failedLogins: auditStats.failedLogins
    };
  }
};

// ============ 工具函数 ============
function getCurrentUser() {
  try {
    const data = localStorage.getItem('ls_admin_user');
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function setCurrentUser(user) {
  localStorage.setItem('ls_admin_user', JSON.stringify(user));
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return formatDateShort(isoString);
}
