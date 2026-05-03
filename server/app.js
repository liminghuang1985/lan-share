/**
 * 局域网共享文件夹管理系统 - 主服务器
 * 
 * 启动方式:
 *   node app.js
 * 
 * 环境变量:
 *   PORT=3002
 *   JWT_SECRET=your-secret-key
 *   FILE_STORAGE_PATH=D:/共享文件
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 加载环境变量
require('dotenv').config();

const db = require('./db');
const { authenticate } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/files', require('./routes/files'));

// 根路径 → 客户端登录页
app.get('/', (req, res) => {
  res.redirect('/client/10-client-login.html');
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 静态文件 - 原型页面
app.use('/prototypes', express.static(path.join(__dirname, '../prototypes')));

// 静态文件 - 客户端页面
app.use('/client', express.static(path.join(__dirname, '../client')));

// 静态文件 - 管理后台
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 静态文件 - 上传的文件
const fileStoragePath = process.env.FILE_STORAGE_PATH || 'D:/共享文件';
if (fs.existsSync(fileStoragePath)) {
  app.use('/storage', express.static(fileStoragePath));
}

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
async function start() {
  await db.initialize();
  
  app.listen(PORT, () => {
    console.log('===========================================');
    console.log('  局域网共享文件夹管理系统');
    console.log('===========================================');
    console.log(`  客户端:      http://localhost:${PORT}`);
    console.log(`  管理后台:     http://localhost:${PORT}/admin`);
    console.log(`  原型展示:     http://localhost:${PORT}/prototypes`);
    console.log(`  API 文档:     http://localhost:${PORT}/api/health`);
    console.log(`  文件存储:     ${fileStoragePath}`);
    console.log('===========================================');
    console.log('');
    console.log('  默认管理员账号:');
    console.log('    用户名: admin');
    console.log('    密码:   admin123');
    console.log('');
    console.log('  提示: 修改密码请登录后进入用户管理');
    console.log('===========================================');
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
