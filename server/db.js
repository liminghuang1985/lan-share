/**
 * 数据库模块 - 使用 sql.js (SQLite in WebAssembly)
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'lanshare.db');

let db = null;

/**
 * 初始化数据库
 */
async function initialize() {
  const SQL = await initSqlJs();
  
  // 确保 data 目录存在
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // 加载或创建数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    createTables();
    seedData();
  }
  
  // 每分钟自动保存
  setInterval(() => {
    save();
  }, 60000);
  
  console.log('  数据库初始化完成');
}

/**
 * 保存数据库到文件
 */
function save() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * 创建表结构
 */
function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT DEFAULT '',
      department TEXT DEFAULT '',
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'readonly')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'disabled')),
      host_name TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      last_login TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      path TEXT NOT NULL,
      description TEXT DEFAULT '',
      size_bytes INTEGER DEFAULT 0,
      file_count INTEGER DEFAULT 0,
      user_count INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      folder_id INTEGER NOT NULL,
      can_read INTEGER DEFAULT 0,
      can_write INTEGER DEFAULT 0,
      granted_by INTEGER,
      granted_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (folder_id) REFERENCES folders(id),
      UNIQUE(user_id, folder_id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      ip_address TEXT DEFAULT '',
      status TEXT DEFAULT 'success',
      details TEXT,
      created_at TEXT NOT NULL
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`);
}

/**
 * 填充初始数据
 */
function seedData() {
  const now = new Date().toISOString();
  const adminPassword = bcrypt.hashSync('admin123', 10);
  
  // 创建管理员
  db.run(`INSERT INTO users (username, password, display_name, email, department, role, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['admin', adminPassword, '张伟', 'admin@company.com', 'IT部', 'admin', 'active', now, now]);
  
  const users = [
    ['lina', 'IT部', '李娜', 'lina@company.com', 'user'],
    ['wangfang', '人事部', '王芳', 'wangfang@company.com', 'user'],
    ['liuyang', '财务部', '刘洋', 'liuyang@company.com', 'user'],
    ['chenming', '市场部', '陈明', 'chenming@company.com', 'user'],
    ['zhoujie', 'IT部', '周杰', 'zhoujie@company.com', 'readonly'],
    ['wuting', '市场部', '吴婷', 'wuting@company.com', 'readonly'],
  ];
  
  for (const [username, dept, displayName, email, role] of users) {
    const password = bcrypt.hashSync('123456', 10);
    db.run(`INSERT INTO users (username, password, display_name, email, department, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password, displayName, email, dept, role, 'active', now, now]);
  }
  
  // 创建文件夹
  const folders = [
    ['公开资料', 'D:/共享文件/公开资料', '公司公开发布的文件资料'],
    ['项目文档', 'D:/共享文件/项目文档', '各项目相关的文档资料'],
    ['人事档案', 'D:/共享文件/人事档案', '员工人事信息'],
    ['财务数据', 'D:/共享文件/财务数据', '财务相关敏感数据'],
    ['市场分析', 'D:/共享文件/市场分析', '市场调研和分析报告'],
    ['IT技术文档', 'D:/共享文件/IT技术文档', '技术文档和知识库'],
  ];
  
  for (const [name, folderPath, desc] of folders) {
    db.run(`INSERT INTO folders (name, path, description, created_by, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      [name, folderPath, desc, 1, now]);
  }
  
  // 设置权限
  const adminId = 1;
  for (let folderId = 1; folderId <= 6; folderId++) {
    db.run(`INSERT INTO permissions (user_id, folder_id, can_read, can_write, granted_by, granted_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, folderId, 1, 1, adminId, now]);
  }
  
  // 普通用户权限
  const userPermissions = [
    { userId: 2, folders: [[1,1,1],[2,1,1],[5,1,1],[6,1,1]] },
    { userId: 3, folders: [[1,1,1],[2,1,0],[3,0,0]] },
    { userId: 4, folders: [[1,1,1],[2,1,1],[4,1,1]] },
    { userId: 5, folders: [[1,1,1],[5,1,1]] },
    { userId: 6, folders: [[1,1,0],[5,1,0]] },
    { userId: 7, folders: [[1,1,0],[5,1,0]] },
  ];
  
  for (const { userId, folders } of userPermissions) {
    for (const [folderId, canRead, canWrite] of folders) {
      db.run(`INSERT INTO permissions (user_id, folder_id, can_read, can_write, granted_by, granted_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, folderId, canRead, canWrite, adminId, now]);
    }
  }
  
  // 种子审计日志
  const actions = ['login', 'download', 'upload', 'view_folder'];
  const users_for_log = [
    { id: 1, username: 'admin' },
    { id: 2, username: 'lina' },
    { id: 3, username: 'wangfang' },
    { id: 4, username: 'liuyang' },
  ];
  
  for (let i = 0; i < 20; i++) {
    const user = users_for_log[Math.floor(Math.random() * users_for_log.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const hoursAgo = Math.floor(Math.random() * 48);
    const logTime = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const ips = ['192.168.1.101', '192.168.1.102', '192.168.1.103', '192.168.1.104'];
    
    db.run(`INSERT INTO audit_logs (user_id, username, action, file_path, ip_address, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, action, action === 'download' ? '项目文档/需求文档.docx' : null,
       ips[Math.floor(Math.random() * ips.length)], 'success', logTime]);
  }
  
  save();
}

/**
 * 执行查询 (SELECT) - 返回数组
 */
function prepare(sql) {
  return {
    all: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      let result = null;
      if (stmt.step()) result = stmt.getAsObject();
      stmt.free();
      return result;
    },
    run: (...params) => {
      db.run(sql, params);
      save();
      return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0 };
    }
  };
}

// 审计日志 helper
const auditLog = (userId, username, action, details = {}) => {
  const now = new Date().toISOString();
  const filePath = details.filePath || null;
  const fileSize = details.fileSize || 0;
  const ipAddress = details.ipAddress || '';
  
  db.run(`INSERT INTO audit_logs (user_id, username, action, file_path, file_size, ip_address, status, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, action, filePath, fileSize, ipAddress, 'success', JSON.stringify(details), now]);
  save();
};

module.exports = {
  initialize,
  prepare,
  save,
  auditLog,
  get db() { return db; }
};
