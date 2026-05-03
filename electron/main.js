const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const log = require('electron-log');

// 日志配置
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('LAN Share Electron 启动...');

// 配置文件路径（用户数据目录，不随安装位置变化）
const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfig = {
  port: 3002,
  storagePath: 'D:/共享文件',
  autoStartServer: true,
  openAdminOnStart: true,
  minimizeToTray: true,
  jwtSecret: 'lan-share-default-secret-change-me'
};

let mainWindow = null;
let tray = null;
let serverProcess = null;
let config = { ...defaultConfig };

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...defaultConfig, ...userConfig };
      log.info('配置文件加载成功:', config);
    } else {
      // 首次运行，写入默认配置
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      log.info('已创建默认配置文件:', configPath);
    }
  } catch (e) {
    log.error('配置文件加载失败:', e.message);
  }
}

// 启动 Node.js 服务器
function startServer() {
  const isProd = app.isPackaged;
  let serverDir, nodeCmd;

  if (isProd) {
    // 打包后：服务器在 resources/server 目录
    serverDir = path.join(process.resourcesPath, 'server');
    nodeCmd = process.execPath;
  } else {
    // 开发模式：服务器在 ../server 目录
    serverDir = path.join(__dirname, '..', 'server');
    nodeCmd = 'node';
  }

  // 检查服务器目录
  if (!fs.existsSync(path.join(serverDir, 'app.js'))) {
    log.error('服务器目录不存在:', serverDir);
    return false;
  }

  // 设置环境变量
  const env = {
    ...process.env,
    PORT: config.port,
    FILE_STORAGE_PATH: config.storagePath,
    JWT_SECRET: config.jwtSecret
  };

  // Windows 上用 cmd /c 启动
  if (process.platform === 'win32') {
    serverProcess = spawn('cmd.exe', ['/c', 'node', 'app.js'], {
      cwd: serverDir,
      env,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    serverProcess = spawn(nodeCmd, ['app.js'], {
      cwd: serverDir,
      env,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    log.info('[Server]', msg);
    // 检测服务器启动成功
    if (msg.includes('局域网共享文件夹管理系统')) {
      setTimeout(() => {
        if (config.openAdminOnStart && mainWindow) {
          mainWindow.loadURL(`http://localhost:${config.port}/admin/01-login.html`);
        }
      }, 500);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    log.error('[Server Error]', data.toString().trim());
  });

  serverProcess.on('exit', (code) => {
    log.warn('[Server] 进程退出，code:', code);
    if (code !== 0 && code !== null) {
      setTimeout(startServer, 3000); // 3秒后重启
    }
  });

  return true;
}

// 停止服务器
function stopServer() {
  if (serverProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
    } else {
      serverProcess.kill('SIGTERM');
    }
    serverProcess = null;
  }
}

// 创建主窗口（无边框简洁窗口）
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LAN Share 管理后台',
    backgroundColor: '#050510',
    show: false, // 等服务器启动后再显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // 开发模式加载本地文件，生产模式加载 http
  const isProd = app.isPackaged;
  if (!isProd) {
    mainWindow.loadFile(path.join(__dirname, '..', 'admin', '01-login.html'));
  }
  // else: 等服务器启动回调里 loadURL

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('管理窗口已显示');
  });

  // 关闭按钮行为
  if (config.minimizeToTray) {
    mainWindow.on('close', (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
        mainWindow.hide();
        return false;
      }
    });
  } else {
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
}

// 创建系统托盘
function createTray() {
  // 创建一个简单的 16x16 图标
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let icon;

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // 没有图标文件，创建一个纯色图标
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEZSURBVDiNpZOxSgNBFEXPm+wmFhYWVhaClYWNjY2NjYWNhYWFhYWFYGFhYWFhYWEhWFhYWFhYWFgIFhYWgq2FhYVgY2Fh4R+xMDu7m9kNsrDgC8PMnPnmzcy9M/MOKBSK/ynYwYIFCxYsWLBgwYIFC8cL/AH+AQGWd8GCBU8WzA6u3s/6LvgJLFjwbMEMuLNgwYIFCxYsWLBg4T8IZsH9BQuO8H/wB/gDLLBgwYIFCxYsWLBg4X8IZsCCBQsWLFjwbMEM+AIWLFg4X+AP8Af4AxYsWLBgwYIFCxb+A2AGLFiwYMGCBQv/AzAD FixItGDBggULFixYsGDBwn8QzIAFCxYsWLBg4XwYAB4sWLBwvg8DAAAAAElFTkSuQmCC') : icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `LAN Share (端口 ${config.port})`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '打开管理后台',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '打开客户端',
      click: () => {
        shell.openExternal(`http://localhost:${config.port}/client/10-client-login.html`);
      }
    },
    { type: 'separator' },
    {
      label: '重启服务器',
      click: () => {
        stopServer();
        startServer();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        stopServer();
        app.quit();
      }
    }
  ]);

  tray.setToolTip(`LAN Share - 端口 ${config.port}`);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC 通信
ipcMain.handle('get-config', () => config);
ipcMain.handle('get-server-url', () => `http://localhost:${config.port}`);
ipcMain.handle('restart-server', () => {
  stopServer();
  return startServer();
});
ipcMain.handle('open-client', () => {
  shell.openExternal(`http://localhost:${config.port}/client/10-client-login.html`);
});
ipcMain.handle('open-admin', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// 应用事件
app.whenReady().then(() => {
  log.info('Electron 应用就绪');
  loadConfig();
  createTray();

  if (config.autoStartServer) {
    const ok = startServer();
    if (!ok) {
      log.error('服务器启动失败');
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 非 macOS，留后台运行
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServer();
  log.info('LAN Share 退出');
});

// 全局异常处理
process.on('uncaughtException', (err) => {
  log.error('未捕获异常:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('未处理 Promise 拒绝:', reason);
});
