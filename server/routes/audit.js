/**
 * 审计日志 API 路由
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();

// 获取审计日志
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { action, userId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let where = [];
    let params = [];
    
    if (action) { where.push('action = ?'); params.push(action); }
    if (userId) { where.push('user_id = ?'); params.push(userId); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (startDate) { where.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { where.push('created_at <= ?'); params.push(endDate + 'T23:59:59'); }
    
    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereStr}`).get(...params).count;
    
    const logs = db.prepare(`
      SELECT * FROM audit_logs ${whereStr}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
    
    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('获取审计日志错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 导出审计日志
router.get('/export', authenticate, requireAdmin, (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    let where = [];
    let params = [];
    
    if (startDate) { where.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { where.push('created_at <= ?'); params.push(endDate + 'T23:59:59'); }
    
    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    
    const logs = db.prepare(`
      SELECT * FROM audit_logs ${whereStr}
      ORDER BY created_at DESC
      LIMIT 10000
    `).all(...params);
    
    if (format === 'csv') {
      const csv = ['时间,用户,操作,文件路径,IP,状态,详情'];
      for (const log of logs) {
        csv.push(`"${log.created_at}","${log.username}","${log.action}","${log.file_path || ''}","${log.ip_address || ''}","${log.status}","${log.details || ''}"`);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
      return res.send(csv.join('\n'));
    }
    
    res.json({ logs });
  } catch (err) {
    console.error('导出审计日志错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 统计信息
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const todayLogs = db.prepare(`
      SELECT action, COUNT(*) as count FROM audit_logs
      WHERE created_at >= ? GROUP BY action
    `).all(today + 'T00:00:00');
    
    const totalLogs = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
    const failedLogins = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs WHERE action = 'login' AND status = 'failed'
    `).get().count;
    
    res.json({
      todayLogs,
      totalLogs,
      failedLogins,
      date: today
    });
  } catch (err) {
    console.error('获取统计信息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
