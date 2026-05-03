/**
 * 文件夹管理 API 路由
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin, auditLog } = require('../auth');

const router = express.Router();

// 获取文件夹列表
router.get('/', authenticate, (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let where = '';
    let params = [];
    
    if (search) {
      where = 'WHERE name LIKE ? OR description LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM folders ${where}`).get(...params).count;
    
    const folders = db.prepare(`
      SELECT f.*, u.username as creator_name,
             (SELECT COUNT(*) FROM permissions WHERE folder_id = f.id) as user_count
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      ${where}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
    
    res.json({ folders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('获取文件夹列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个文件夹
router.get('/:id', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT f.*, u.username as creator_name
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `).get(req.params.id);
    
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    // 获取文件夹权限
    const permissions = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.department
      FROM permissions p
      JOIN users u ON p.user_id = u.id
      WHERE p.folder_id = ?
    `).all(req.params.id);
    
    res.json({ folder, permissions });
  } catch (err) {
    console.error('获取文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建文件夹
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, path, description } = req.body;
    
    if (!name || !path) {
      return res.status(400).json({ error: '请填写必填项' });
    }
    
    const existing = db.prepare('SELECT id FROM folders WHERE name = ?').get(name);
    if (existing) {
      return res.status(400).json({ error: '文件夹名称已存在' });
    }
    
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO folders (name, path, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, path, description || '', req.user.id, now);
    
    auditLog(req.user.id, req.user.username, 'create_folder', { folderId: result.lastInsertRowid, name });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('创建文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新文件夹
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, path, description } = req.body;
    const folderId = req.params.id;
    
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (name) { updates.push('name = ?'); params.push(name); }
    if (path) { updates.push('path = ?'); params.push(path); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有更新内容' });
    }
    
    params.push(folderId);
    db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    auditLog(req.user.id, req.user.username, 'update_folder', { folderId, updates: req.body });
    
    res.json({ success: true });
  } catch (err) {
    console.error('更新文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除文件夹
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const folderId = req.params.id;
    
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    // 删除权限
    db.prepare('DELETE FROM permissions WHERE folder_id = ?').run(folderId);
    // 删除文件夹
    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    
    auditLog(req.user.id, req.user.username, 'delete_folder', { folderId, name: folder.name });
    
    res.json({ success: true });
  } catch (err) {
    console.error('删除文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
