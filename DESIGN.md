# 局域网共享文件夹系统 · 设计规范

## 🎨 设计风格：Linear 风格

### 色彩系统

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#0F1011` | 主背景（深黑偏蓝） |
| `--bg-secondary` | `#16181D` | 次级背景（卡片/面板） |
| `--bg-tertiary` | `#1E2027` | 三级背景（输入框/hover） |
| `--border` | `#2A2D37` | 边框色 |
| `--border-subtle` | `#22262F` | 细分隔线 |
| `--text-primary` | `#EDEDEF` | 主文字 |
| `--text-secondary` | `#8A8D93` | 次级文字 |
| `--text-tertiary` | `#5C5F66` | 占位符/禁用 |
| `--accent` | `#6142D9` | 主强调色（靛蓝紫） |
| `--accent-hover` | `#7151E5` | 强调 hover |
| `--accent-subtle` | `rgba(97,66,217,0.12)` | 强调背景 |
| `--success` | `#10B981` | 成功/在线 |
| `--warning` | `#F59E0B` | 警告/上传中 |
| `--error` | `#EF4444` | 错误/离线 |

### 字体

- **Display/Heading**: Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif
- **Body**: Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif
- **Mono**（日志/路径）: JetBrains Mono, SF Mono, monospace

### 圆角与间距

- **圆角**: 6px（按钮/输入框/卡片）
- **间距基准**: 4px 网格

### 组件风格

#### 按钮
```css
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.09);
border-radius: 6px;
```
Hover: `rgba(255,255,255,0.08)`
Primary: `--accent` 背景 + 白色文字

#### 卡片
```css
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: 6px;
box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 
            0 2px 8px rgba(0,0,0,0.2);
```

#### 输入框
```css
background: var(--bg-tertiary);
border: 1px solid var(--border);
border-radius: 6px;
```

---

## 📄 页面清单

### Host A 管理端（5 页）

| # | 页面 | 路径 | 功能描述 |
|---|------|------|----------|
| 1 | **登录页** | `/login` | 管理员登录（账号+密码） |
| 2 | **仪表盘** | `/dashboard` | 统计概览（在线主机/总文件/流量/告警） |
| 3 | **用户管理** | `/users` | 用户列表/新建/编辑/禁用 |
| 4 | **文件夹管理** | `/folders` | 共享文件夹目录/新建/编辑/删除 |
| 5 | **权限配置** | `/permissions` | 用户↔文件夹权限矩阵 |
| 6 | **审计日志** | `/logs` | 操作日志（上传/下载/删除/登录） |

### Host B/C/D 客户端（3 页）

| # | 页面 | 路径 | 功能描述 |
|---|------|------|----------|
| 1 | **客户端登录** | `/client/login` | 客户端用户登录 |
| 2 | **文件浏览器** | `/client/browse` | 浏览/搜索/下载/上传 |
| 3 | **我的记录** | `/client/history` | 我的下载/上传历史 |

---

## 🔧 技术栈

### Host A 服务端
- **运行时**: Node.js 18+ / Electron
- **框架**: Express.js / Fastify
- **数据库**: SQLite（权限/用户/日志）
- **文件服务**: Static file serving + 上传处理
- **实时**: WebSocket（在线状态）

### Host B/C/D 客户端
- **Electron** 或 **Web 浏览器**
- **通信**: HTTP REST API + WebSocket

---

## 📱 响应式策略

管理端优先桌面端（1280px+），客户端支持移动端（768px+）
