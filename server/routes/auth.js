/**
 * 认证相关 API 路由
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticate, createSession, destroySession, auditLog } = require('../auth');

const router = express.Router();

// 用户登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '请提供用户名和密码' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (user.status === 'disabled') {
      return res.status(401).json({ error: '账号已被禁用' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 生成 Token
    const token = generateToken(user);
    
    // 记录会话
    createSession(user.id, token, req.ip, req.headers['x-host-name'] || 'unknown');
    
    // 更新主机状态
    if (req.headers['x-host-name']) {
      const { updateHostStatus } = require('../auth');
      updateHostStatus(req.headers['x-host-name'], req.ip, 'online');
    }
    
    // 审计日志
    auditLog(user.id, user.username, 'login', {
      ipAddress: req.ip,
      hostName: req.headers['x-host-name'] || 'unknown'
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        department: user.department,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登出
router.post('/logout', authenticate, (req, res) => {
  try {
    // 审计日志
    auditLog(req.user.id, req.user.username, 'logout', {
      ipAddress: req.ip
    });
    
    // 删除会话
    destroySession(req.token);
    
    res.json({ success: true });
  } catch (err) {
    console.error('登出错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, email, department, role, status, last_login
      FROM users WHERE id = ?
    `).get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 验证 Token
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { jwt } = require('jsonwebtoken');
    const { JWT_SECRET } = require('../auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(decoded.id);
    
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ valid: false });
    }
    
    res.json({ valid: true, user });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
