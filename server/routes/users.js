/**
 * 用户管理 API 路由
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin, auditLog } = require('../auth');

const router = express.Router();

// 获取用户列表
router.get('/', authenticate, (req, res) => {
  try {
    const { search, role, status, department, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let where = [];
    let params = [];
    
    if (search) {
      where.push('(username LIKE ? OR display_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      where.push('role = ?');
      params.push(role);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (department) {
      where.push('department = ?');
      params.push(department);
    }
    
    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereStr}`).get(...params).count;
    
    const users = db.prepare(`
      SELECT id, username, display_name, email, department, role, status,
             host_name, ip_address, last_login, created_at, updated_at
      FROM users ${whereStr}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
    
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个用户
router.get('/:id', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, email, department, role, status,
             host_name, ip_address, last_login, created_at, updated_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 获取用户权限
    const permissions = db.prepare(`
      SELECT p.*, f.name as folder_name
      FROM permissions p
      JOIN folders f ON p.folder_id = f.id
      WHERE p.user_id = ?
    `).all(req.params.id);
    
    res.json({ user, permissions });
  } catch (err) {
    console.error('获取用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建用户
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { username, password, displayName, email, department, role } = req.body;
    
    if (!username || !password || !displayName) {
      return res.status(400).json({ error: '请填写必填项' });
    }
    
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO users (username, password, display_name, email, department, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(username, hashedPassword, displayName, email || '', department || '', role || 'user', now, now);
    
    auditLog(req.user.id, req.user.username, 'create_user', { userId: result.lastInsertRowid, username });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('创建用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { displayName, email, department, role, status, password } = req.body;
    const userId = req.params.id;
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (displayName) { updates.push('display_name = ?'); params.push(displayName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (password) {
      updates.push('password = ?');
      params.push(bcrypt.hashSync(password, 10));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有更新内容' });
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(userId);
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    auditLog(req.user.id, req.user.username, 'update_user', { userId, updates: req.body });
    
    res.json({ success: true });
  } catch (err) {
    console.error('更新用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 删除用户权限
    db.prepare('DELETE FROM permissions WHERE user_id = ?').run(userId);
    // 删除用户
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    auditLog(req.user.id, req.user.username, 'delete_user', { userId, username: user.username });
    
    res.json({ success: true });
  } catch (err) {
    console.error('删除用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量操作
router.post('/batch', authenticate, requireAdmin, (req, res) => {
  try {
    const { action, userIds, data } = req.body;
    
    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    let success = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      try {
        if (action === 'enable') {
          db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
            .run('active', new Date().toISOString(), userId);
        } else if (action === 'disable') {
          db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
            .run('disabled', new Date().toISOString(), userId);
        } else if (action === 'delete') {
          if (parseInt(userId) !== req.user.id) {
            db.prepare('DELETE FROM permissions WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
          }
        } else if (action === 'updateRole' && data?.role) {
          db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
            .run(data.role, new Date().toISOString(), userId);
        }
        success++;
      } catch (e) {
        failed++;
      }
    }
    
    auditLog(req.user.id, req.user.username, 'batch_user', { action, userIds, success, failed });
    
    res.json({ success, failed });
  } catch (err) {
    console.error('批量操作错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
