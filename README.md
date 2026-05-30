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
