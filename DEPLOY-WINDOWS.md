# LAN Share · Windows 11 部署指南

## 系统要求

- Windows 11
- Node.js 18+（[下载地址](https://nodejs.org/)）
- 待共享的文件夹已创建在本地磁盘

---

## 第一步：在 Windows 11 上准备

### 1.1 安装 Node.js

下载并安装 LTS 版本：https://nodejs.org/

验证安装：
```powershell
node --version
npm --version
```

### 1.2 创建共享文件夹

在 D 盘根目录创建共享文件夹结构：

```
D:\
└── 共享文件\
    ├── 公开资料\
    ├── 项目文档\
    ├── IT技术文档\
    └── ...（根据需要创建）
```

### 1.3 配置文件夹权限

右键文件夹 → 属性 → 共享 → 高级共享：

- 勾选"共享此文件夹"
- 设置共享名（例：`公开资料`）
- 权限：添加你要共享给的用户，设置读取/写入权限

> **注意**：局域网其他用户访问时，使用的是**客户端登录的用户名**，不是 Windows 本地账户。

---

## 第二步：部署服务端

### 2.1 把项目拷贝到 Windows

把 `lan-share` 文件夹拷贝到 Windows 机器，例如：`C:\Apps\lan-share`

### 2.2 安装依赖

打开 PowerShell（管理员）：

```powershell
cd C:\Apps\lan-share\server
npm install
```

### 2.3 配置环境变量

复制配置文件：

```powershell
copy .env.example .env
```

用记事本打开 `.env`，修改以下内容：

```env
PORT=3002
JWT_SECRET=随便写一个随机字符串
FILE_STORAGE_PATH=D:/共享文件
```

### 2.4 创建数据库和初始化数据

```powershell
node db.js
```

成功后会看到：
```
数据库初始化完成
共创建 7 个用户和 6 个文件夹
```

---

## 第三步：启动服务

```powershell
node app.js
```

看到以下输出表示启动成功：

```
局域网共享文件夹管理系统
服务器端口: 3002
  API:         http://localhost:3002/api
  管理后台:     http://localhost:3002/admin
  客户端:       http://localhost:3002/client/10-client-login.html
```

打开浏览器访问 http://localhost:3002/admin 用管理员账号登录：

- 用户名：`admin`
- 密码：`admin123`

---

## 第四步：配置开机自启（可选）

### 方法一：Windows 任务计划程序

1. 打开"任务计划程序" → "创建基本任务"
2. 名称：`LAN Share 服务`
3. 触发器：计算机启动
4. 操作：启动程序
   - 程序：`node`
   - 参数：`app.js`
   - 起始位置：`C:\Apps\lan-share\server`

### 方法二：PM2（推荐）

```powershell
npm install -g pm2
cd C:\Apps\lan-share\server
pm2 start app.js --name lanshare
pm2 startup   # 生成开机自启命令，按提示执行
pm2 save      # 保存当前进程列表
```

---

## 第五步：配置防火墙

让局域网其他电脑能访问本机的 3002 端口。

### 打开 PowerShell（管理员）：

```powershell
# 允许 3002 端口入站
netsh advfirewall firewall add rule name="LAN Share HTTP" dir=in action=allow protocol=TCP localport=3002

# 或者直接关闭防火墙（仅测试用，不推荐）
# Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

### 验证防火墙是否生效：

在同一局域网的其他电脑浏览器打开：`http://电脑IP:3002`

---

## 第六步：给用户分配文件夹权限

1. 用管理员登录 http://电脑IP:3002/admin
2. 进入"权限配置"
3. 勾选每个用户对应文件夹的"读"和"写"权限
4. 点击"保存修改"

---

## 局域网客户端访问

其他电脑的浏览器打开：`http://服务器IP:3002`

用户用自己的账号登录（管理员在后台创建），即可浏览、上传、下载文件。

---

## 常见问题

### Q：客户端登录后看不到任何文件夹
**A**：管理员还没有给你分配权限。进入管理端 → 权限配置，勾选你的用户名对应的文件夹权限。

### Q：上传文件后找不到
**A**：文件存在服务器的 `D:/共享文件/` 对应子文件夹下，用 Windows 文件资源管理器可以直接看到。

### Q：端口被占用
**A**：修改 `.env` 中的 `PORT=3003`，同时更新防火墙规则：
```powershell
netsh advfirewall firewall delete rule name="LAN Share HTTP"
netsh advfirewall firewall add rule name="LAN Share HTTP" dir=in action=allow protocol=TCP localport=3003
```

### Q：外网能访问吗？
**A**：默认只限于局域网。如需外网访问，需要做端口映射或 VPN，不建议直接暴露到公网。
