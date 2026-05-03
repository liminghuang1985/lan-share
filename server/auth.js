/**
 * 认证与授权中间件
 */
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'lan-share-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 Token 中间件
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 检查用户是否仍然存在且状态正常
    const user = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    if (user.status === 'disabled') {
      return res.status(401).json({ error: '账号已被禁用' });
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期' });
    }
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 读取权限中间件 (文件夹级别)
function requireRead(req, res, next) {
  const folderId = req.params.folderId;
  if (!folderId) return next();
  
  if (req.user.role === 'admin') return next();
  
  const perm = db.prepare(
    'SELECT can_read FROM permissions WHERE user_id = ? AND folder_id = ?'
  ).get(req.user.id, folderId);
  
  if (!perm || !perm.can_read) {
    return res.status(403).json({ error: '没有读取该文件夹的权限' });
  }
  next();
}

// 写入权限中间件
function requireWrite(req, res, next) {
  const folderId = req.params.folderId;
  if (!folderId) return next();
  
  if (req.user.role === 'admin') return next();
  
  const perm = db.prepare(
    'SELECT can_write FROM permissions WHERE user_id = ? AND folder_id = ?'
  ).get(req.user.id, folderId);
  
  if (!perm || !perm.can_write) {
    return res.status(403).json({ error: '没有写入该文件夹的权限' });
  }
  next();
}

// 记录审计日志 (调用 db 模块的 auditLog)
function auditLog(userId, username, action, details = {}) {
  if (db.auditLog) {
    db.auditLog(userId, username, action, details);
  }
}

// 创建会话
function createSession(userId, token, ipAddress, hostName) {
  // 简化版: 不使用 sessions 表，仅记录最后登录
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login = ?, ip_address = ?, host_name = ? WHERE id = ?')
    .run(now, ipAddress || '', hostName || '', userId);
}

// 删除会话
function destroySession(token) {
  // JWT 无状态，不需要清理
}

// 更新主机状态
function updateHostStatus(hostName, ipAddress, status) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM users WHERE host_name = ?').get(hostName);
  if (existing) {
    db.prepare('UPDATE users SET status = ?, ip_address = ?, last_login = ? WHERE host_name = ?')
      .run(status, ipAddress, now, hostName);
  }
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticate,
  requireAdmin,
  requireRead,
  requireWrite,
  auditLog,
  createSession,
  destroySession,
  updateHostStatus
};
