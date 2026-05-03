/**
 * 权限管理 API 路由
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin, auditLog } = require('../auth');

const router = express.Router();

// 获取权限矩阵
router.get('/matrix', authenticate, requireAdmin, (req, res) => {
  try {
    const folders = db.prepare('SELECT * FROM folders ORDER BY name').all();
    const users = db.prepare('SELECT id, username, display_name, department FROM users WHERE status = ? ORDER BY username').all('active');
    
    const permissions = db.prepare(`
      SELECT user_id, folder_id, can_read, can_write, granted_at, granted_by
      FROM permissions
    `).all();
    
    // 构建矩阵
    const matrix = {};
    for (const user of users) {
      matrix[user.id] = { ...user, folders: {} };
      for (const folder of folders) {
        matrix[user.id].folders[folder.id] = { canRead: false, canWrite: false };
      }
    }
    
    for (const perm of permissions) {
      if (matrix[perm.user_id] && matrix[perm.user_id].folders[perm.folder_id]) {
        matrix[perm.user_id].folders[perm.folder_id] = {
          canRead: !!perm.can_read,
          canWrite: !!perm.can_write,
          grantedAt: perm.granted_at
        };
      }
    }
    
    res.json({ folders, users, matrix });
  } catch (err) {
    console.error('获取权限矩阵错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 设置用户权限
router.post('/set', authenticate, requireAdmin, (req, res) => {
  try {
    const { userId, folderId, canRead, canWrite } = req.body;
    
    if (!userId || !folderId) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    
    if (!user || !folder) {
      return res.status(404).json({ error: '用户或文件夹不存在' });
    }
    
    const existing = db.prepare('SELECT id FROM permissions WHERE user_id = ? AND folder_id = ?')
      .get(userId, folderId);
    
    if (existing) {
      db.prepare(`
        UPDATE permissions SET can_read = ?, can_write = ?, granted_at = ?
        WHERE user_id = ? AND folder_id = ?
      `).run(canRead ? 1 : 0, canWrite ? 1 : 0, new Date().toISOString(), userId, folderId);
    } else {
      db.prepare(`
        INSERT INTO permissions (user_id, folder_id, can_read, can_write, granted_by, granted_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, folderId, canRead ? 1 : 0, canWrite ? 1 : 0, req.user.id, new Date().toISOString());
    }
    
    auditLog(req.user.id, req.user.username, 'set_permission', { userId, folderId, canRead, canWrite });
    
    res.json({ success: true });
  } catch (err) {
    console.error('设置权限错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量设置权限
router.post('/batch', authenticate, requireAdmin, (req, res) => {
  try {
    const { userId, permissions: perms } = req.body;
    
    if (!userId || !perms || !Array.isArray(perms)) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    for (const perm of perms) {
      const existing = db.prepare('SELECT id FROM permissions WHERE user_id = ? AND folder_id = ?')
        .get(userId, perm.folderId);
      
      if (existing) {
        db.prepare(`UPDATE permissions SET can_read = ?, can_write = ?, granted_at = ?
                    WHERE user_id = ? AND folder_id = ?`)
          .run(perm.canRead ? 1 : 0, perm.canWrite ? 1 : 0, new Date().toISOString(), userId, perm.folderId);
      } else {
        db.prepare(`INSERT INTO permissions (user_id, folder_id, can_read, can_write, granted_by, granted_at)
                    VALUES (?, ?, ?, ?, ?, ?)`)
          .run(userId, perm.folderId, perm.canRead ? 1 : 0, perm.canWrite ? 1 : 0, req.user.id, new Date().toISOString());
      }
    }
    
    auditLog(req.user.id, req.user.username, 'batch_permission', { userId, count: perms.length });
    
    res.json({ success: true });
  } catch (err) {
    console.error('批量设置权限错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户权限
router.delete('/:userId/:folderId', authenticate, requireAdmin, (req, res) => {
  try {
    const { userId, folderId } = req.params;
    
    db.prepare('DELETE FROM permissions WHERE user_id = ? AND folder_id = ?').run(userId, folderId);
    
    auditLog(req.user.id, req.user.username, 'delete_permission', { userId, folderId });
    
    res.json({ success: true });
  } catch (err) {
    console.error('删除权限错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
