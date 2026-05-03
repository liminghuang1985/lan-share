# LAN Share · Electron 桌面版

将管理端打包成 Windows 单文件 .exe，同时运行服务器 + 打开管理界面。

## 功能

- 双击 .exe 自动启动服务器（Node.js 内嵌）
- 自动打开管理端浏览器窗口
- 系统托盘运行（关窗口后后台继续）
- 局域网其他电脑用浏览器访问客户端

## 快速开始

### 方式一：直接运行（开发模式）
```bash
npm install
npm start
```

### 方式二：打包 Windows .exe
```bash
npm run build:win
# 输出: dist/LAN-Share-Setup-*.exe
```

## 配置文件

首次运行会在同目录下生成 `config.json`：

```json
{
  "port": 3002,
  "storagePath": "D:/共享文件",
  "autoStartServer": true,
  "openAdminOnStart": true,
  "minimizeToTray": true,
  "jwtSecret": "change-me-in-production"
}
```

修改配置后重启应用生效。

## 客户端访问

局域网内其他电脑浏览器打开：`http://电脑IP:3002`

## 打包后目录结构

```
dist/
├── LAN-Share-Setup-1.0.0.exe   ← 分发安装包（推荐）
└── LAN-Share-1.0.0.exe          ← 免安装单文件
```
