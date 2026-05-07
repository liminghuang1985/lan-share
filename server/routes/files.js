/**
 * 文件管理 API 路由
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireRead, requireWrite, auditLog } = require('../auth');

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.FILE_STORAGE_PATH || 'D:/共享文件';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// 获取用户可访问的文件夹
router.get('/folders', authenticate, (req, res) => {
  try {
    const { type } = req.query;
    
    let query;
    if (type === 'read' || type === 'write') {
      query = `
        SELECT f.*, p.can_read, p.can_write
        FROM folders f
        JOIN permissions p ON f.id = p.folder_id
        WHERE p.user_id = ? AND p.can_read = 1
        ORDER BY f.name
      `;
    } else {
      query = `
        SELECT f.*, p.can_read, p.can_write
        FROM folders f
        JOIN permissions p ON f.id = p.folder_id
        WHERE p.user_id = ?
        ORDER BY f.name
      `;
    }
    
    const folders = db.prepare(query).all(req.user.id);
    res.json({ folders });
  } catch (err) {
    console.error('获取文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 浏览文件夹内容
router.get('/browse/:folderId', authenticate, requireRead, (req, res) => {
  try {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    // 检查权限
    const perm = db.prepare('SELECT can_read FROM permissions WHERE user_id = ? AND folder_id = ?')
      .get(req.user.id, req.params.folderId);
    
    if (!perm || !perm.can_read) {
      return res.status(403).json({ error: '没有读取权限' });
    }
    
    // 支持 subPath 参数进入子文件夹
    const subPath = req.query.subPath || '';
    const basePath = folder.path;
    const browsePath = subPath ? path.join(basePath, subPath) : basePath;
    
    let files = [];
    
    try {
      const entries = fs.readdirSync(browsePath, { withFileTypes: true });
      files = entries.map(entry => {
        const entrySubPath = subPath ? `${subPath}/${entry.name}` : entry.name;
        const fullPath = path.join(browsePath, entry.name);
        let stats = null;
        try { stats = fs.statSync(fullPath); } catch (e) {}
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stats ? stats.size : 0,
          modified: stats ? stats.mtime.toISOString() : null,
          subPath: entrySubPath
        };
      });
    } catch (e) {
      console.error('读取文件夹错误:', e);
    }
    
    res.json({ folder, files, currentPath: subPath });
  } catch (err) {
    console.error('浏览文件夹错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 上传文件
router.post('/upload/:folderId', authenticate, requireWrite, upload.single('file'), (req, res) => {
  try {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    auditLog(req.user.id, req.user.username, 'upload', {
      filePath: req.file.originalname,
      fileSize: req.file.size,
      folderName: folder.name
    });
    
    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (err) {
    console.error('上传文件错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 下载文件
router.get('/download/:folderId/*', authenticate, requireRead, (req, res) => {
  try {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    const filePath = req.params[0];
    const fullPath = path.join(folder.path, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    auditLog(req.user.id, req.user.username, 'download', {
      filePath: filePath,
      fileSize: fs.statSync(fullPath).size,
      folderName: folder.name
    });
    
    res.download(fullPath);
  } catch (err) {
    console.error('下载文件错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取下载历史
router.get('/history', authenticate, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE user_id = ? AND action IN ('download', 'upload')
    `).get(req.user.id).count;
    
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE user_id = ? AND action IN ('download', 'upload')
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset);
    
    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('获取历史错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
