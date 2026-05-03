/**
 * LAN Share Client · API 调用封装
 * 所有接口调用通过这里发出，自动携带 Token
 */

const API_BASE = '/api';

// ============ Token 管理 ============

const Token = {
  get() {
    return localStorage.getItem('ls_token') || null;
  },

  set(token) {
    localStorage.setItem('ls_token', token);
  },

  clear() {
    localStorage.removeItem('ls_token');
  },

  headers() {
    const token = this.get();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};

// ============ 底层请求 ============

async function request(method, path, body = null, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...Token.headers()
  };

  const config = { method, headers, ...options };

  if (body !== null && method !== 'GET') {
    // 文件上传不走 JSON
    if (body instanceof FormData) {
      delete headers['Content-Type'];
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, config);

  // 下载接口直接返回 Response
  if (options.download) return res;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `请求失败 (${res.status})`, res.status);
  }

  return data;
}

// ============ 自定义错误 ============

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ============ API 方法 ============

const Api = {

  // -------- 认证 --------
  async login(username, password) {
    const data = await request('POST', '/auth/login', { username, password });
    if (data.token) Token.set(data.token);
    return data;
  },

  async logout() {
    try {
      await request('POST', '/auth/logout');
    } catch (e) {
      // 忽略错误
    }
    Token.clear();
  },

  async me() {
    return request('GET', '/auth/me');
  },

  async verify() {
    return request('GET', '/auth/verify');
  },

  // -------- 文件夹 --------
  async getFolders(type = 'read') {
    return request('GET', `/files/folders?type=${type}`);
  },

  async browseFolder(folderId) {
    return request('GET', `/files/browse/${folderId}`);
  },

  // -------- 文件操作 --------
  async uploadFile(folderId, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const token = Token.get();

      xhr.open('POST', `${API_BASE}/files/upload/${folderId}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(new ApiError(data.error || `上传失败 (${xhr.status})`, xhr.status));
          }
        } catch (e) {
          reject(new ApiError(`解析响应失败`, xhr.status));
        }
      };

      xhr.onerror = () => reject(new ApiError('网络错误'));
      xhr.send(formData);
    });
  },

  // 下载文件
  downloadFile(folderId, filePath, fileName) {
    const token = Token.get();
    const url = `${API_BASE}/files/download/${folderId}/${encodeURIComponent(filePath)}`;

    const a = document.createElement('a');
    a.href = `${url}?token=${encodeURIComponent(token)}`;
    a.download = fileName;
    // 用 fetch + blob 方式触发下载（避免 token 出现在 URL）
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        // fallback: 直接打开链接
        window.open(url, '_blank');
      });
  },

  // -------- 历史记录 --------
  async getHistory(page = 1, limit = 20) {
    return request('GET', `/files/history?page=${page}&limit=${limit}`);
  }
};

// ============ 工具函数 ============

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
  const now = new Date();
  const diff = now - d;

  // 24小时内显示相对时间
  if (diff < 86400000) {
    const h = Math.floor(diff / 3600000);
    if (h < 1) {
      const m = Math.floor(diff / 60000);
      return m < 1 ? '刚刚' : `${m}分钟前`;
    }
    return `${h}小时前`;
  }

  // 7天内显示星期
  if (diff < 604800000) {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return days[d.getDay()] + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 更早显示日期
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(name, isDirectory) {
  if (isDirectory) return 'folder';
  const ext = name.split('.').pop().toLowerCase();
  const iconMap = {
    pdf: 'pdf', doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel',
    ppt: 'ppt', pptx: 'ppt',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    txt: 'text', md: 'text', json: 'text', xml: 'text', html: 'text', css: 'text', js: 'text',
    jsx: 'code', ts: 'code', tsx: 'code', vue: 'code',
    py: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code',
    exe: 'exe', dll: 'exe',
  };
  return iconMap[ext] || 'file';
}
