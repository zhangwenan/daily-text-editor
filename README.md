# Daily Text Editor

极简日记文本编辑器，类似聊天窗口界面，基于 Electron 开发，支持 Windows 10+。

## 功能

- 启动自动创建当日 `YYYYMMDD.md` 文件（如 `20260530.md`）
- 输入内容后按 Enter 或点击发送，自动记录日期时间（精确到秒）
- 上方展示历史消息，双击任意消息可编辑日期和内容
- Enter 保存编辑，Esc 取消，失焦自动保存
- 设置按钮可配置存储目录

## 文件格式示例

```markdown
# 2026-05-30

2026-05-30 10:43:00
今天完成了项目文档

2026-05-30 14:20:15
明天开始开发新功能
```

## Windows 打包步骤

### 第一步：安装 Node.js

下载安装 Node.js v20 或更高版本：https://nodejs.org/
安装后在 CMD 中验证：
```
node --version
npm --version
```

### 第二步：安装依赖

将 `text-editor` 文件夹复制到 Windows 电脑，进入该目录，运行：
```
npm install
```

### 第三步：打包 exe

```
npm run dist
```

打包完成后，exe 文件在 `dist/` 目录下，文件名为 `Daily Text Editor.exe`（单文件便携版）。

### 开发模式（可选）

```
npm start
```

## 项目文件说明

| 文件 | 说明 |
|------|------|
| `main.js` | 主进程：窗口管理、文件读写、IPC 通信 |
| `preload.js` | 预加载脚本：安全暴露 API 到渲染进程 |
| `index.html` | 主界面 |
| `style.css` | 样式 |
| `renderer.js` | 渲染进程：界面交互逻辑 |
| `package.json` | 项目配置 |
| `pack.bat` | Windows 一键打包脚本 |

## 使用 pack.bat 一键打包

双击运行 `pack.bat`，按提示操作即可自动完成依赖安装 + 打包。

## Git 凭证配置（重要）

本项目的 GitHub Token 已存储在 **macOS 钥匙串（Keychain）** 中，无需在配置文件中保存 Token。

### Token 失效时如何更新

1. 登录 GitHub，生成新的 Personal Access Token（Classic）
   - 路径：Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 权限：勾选 `repo`
   - 复制生成的 Token（仅显示一次）

2. 在终端执行以下命令，更新钥匙串中的 Token：
   ```bash
   echo "protocol=https
   host=github.com
   username=zhangwenan
   password=新的Token" | git credential approve
   ```

3. 验证是否生效：
   ```bash
   cd /Users/zhangwenan/CodeBuddy/20260529164258/text-editor
   git pull origin main
   ```
   如果无需输入密码即拉取成功，说明 Token 已生效。

### 查看钥匙串中的凭证

在 macOS「钥匙串访问」应用中：
- 搜索：`github.com`
- 条目名称：`github.com`
- 用户名：`zhangwenan`

### 注意事项

- ⚠️ 不要将 Token 写入代码或配置文件中
- ⚠️ 如果 Token 泄露，立即在 GitHub 设置中撤销
- ✅ 钥匙串中的凭证对所有本地 Git 仓库生效
