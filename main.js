const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 应用名称常量（修改此处即可全局生效）
const APP_NAME = '盯盘速记';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

// ========== 配置相关 ==========
function ensureConfigDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return { saveDir: '' };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { saveDir: '' };
  }
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ========== 文件相关 ==========
function getTodayFilePath(saveDir) {
  const today = new Date();
  const fileName = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.md`;
  return path.join(saveDir, fileName);
}

function ensureTodayFile(saveDir) {
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }
  const filePath = getTodayFilePath(saveDir);
  if (!fs.existsSync(filePath)) {
    const today = new Date();
    const header = `# ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}\n\n`;
    fs.writeFileSync(filePath, header, 'utf-8');
  }
  return filePath;
}

// 解析文件内容为消息数组
// 格式：日期时间行 + 内容行 + 图片引用 + 空行
function parseFileContent(content, baseDir) {
  const messages = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // 跳过标题行和空行
    if (!line || line.startsWith('#') || line.trim() === '') {
      i++;
      continue;
    }
    // 日期时间行：匹配 YYYY-MM-DD HH:MM:SS
    const dateMatch = line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    if (dateMatch) {
      const dateStr = line;
      const textLines = [];
      const imagePaths = [];
      i++;

      // 收集后续非空行作为内容，直到遇到空行或文件结束
      while (i < lines.length && lines[i].trim() !== '') {
        // 如果下一行又是日期，停止
        if (lines[i].match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) break;

        // 检查是否是图片引用 ![alt](path)
        const imgMatch = lines[i].match(/^!\[.*?\]\((.*?)\)$/);
        if (imgMatch) {
          let imgPath = imgMatch[1];
          // 如果是相对路径，转换为绝对路径
          if (!path.isAbsolute(imgPath)) {
            imgPath = path.join(baseDir, imgPath);
          }
          // 检查文件是否存在
          if (fs.existsSync(imgPath)) {
            imagePaths.push(imgPath);
          }
        } else {
          textLines.push(lines[i]);
        }
        i++;
      }

      messages.push({
        date: dateStr,
        text: textLines.join('\n'),
        images: imagePaths.length > 0 ? imagePaths : undefined
      });
      // 跳过空行
      while (i < lines.length && lines[i].trim() === '') i++;
    } else {
      i++;
    }
  }
  return messages;
}

// 根据消息数组重新生成文件内容
function messagesToContent(messages, baseDir) {
  const today = new Date();
  const header = `# ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const entries = messages.map(m => {
    let entry = m.date;
    if (m.text) {
      entry += `\n${m.text}`;
    }
    // 添加图片引用
    if (m.images && m.images.length > 0) {
      for (const imgPath of m.images) {
        const relativePath = path.relative(baseDir, imgPath);
        entry += `\n![image](${relativePath})`;
      }
    }
    return entry;
  }).join('\n\n');
  return header + '\n\n' + entries + '\n';
}

// ========== 窗口 ==========
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  // macOS: 确保窗口标题正确显示
  mainWindow.setTitle(APP_NAME);
  mainWindow.on('page-title-updated', (e, title) => {
    if (title !== APP_NAME) {
      e.preventDefault();
      mainWindow.setTitle(APP_NAME);
    }
  });

  // 开发时可打开开发者工具
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ========== IPC ==========

// 获取配置
ipcMain.handle('get-config', () => loadConfig());

// 获取应用名称
ipcMain.handle('get-app-name', () => APP_NAME);

// 保存配置
ipcMain.handle('save-config', (event, config) => {
  saveConfig(config);
  return true;
});

// 选择目录
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 加载今日文件内容
ipcMain.handle('load-today', () => {
  const config = loadConfig();
  if (!config.saveDir || !fs.existsSync(config.saveDir)) {
    return { success: false, error: '请先设置存储目录' };
  }
  try {
    ensureTodayFile(config.saveDir);
    const filePath = getTodayFilePath(config.saveDir);
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = parseFileContent(content, path.dirname(filePath));
    return { success: true, messages, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 保存 base64 图片到日期图片目录
function saveImage(base64Data, saveDir) {
  // 创建图片目录：YYYYMMDDimgs
  const today = new Date();
  const dirName = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}imgs`;
  const imgDir = path.join(saveDir, dirName);

  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  // 生成唯一文件名
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `${timestamp}_${random}.png`;
  const filePath = path.join(imgDir, fileName);

  // 去除 base64 前缀（如果有）
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// 追加新消息到文件
ipcMain.handle('append-message', (event, text, images) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    ensureTodayFile(config.saveDir);
    const filePath = getTodayFilePath(config.saveDir);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 保存图片
    const savedImages = [];
    if (images && images.length > 0) {
      for (const imgData of images) {
        const savedPath = saveImage(imgData, config.saveDir);
        savedImages.push(savedPath);
      }
    }

    // 构建文件条目
    let entry = `\n${dateStr}\n`;
    if (text) {
      entry += `${text}\n`;
    }
    // 添加图片 Markdown 引用
    for (const imgPath of savedImages) {
      const relativePath = path.relative(path.dirname(filePath), imgPath);
      entry += `![image](${relativePath})\n`;
    }

    fs.appendFileSync(filePath, entry, 'utf-8');
    return { success: true, date: dateStr, text, images: savedImages };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 删除消息中的图片
ipcMain.handle('delete-image', (event, { msgIndex, imgIndex }) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    const filePath = getTodayFilePath(config.saveDir);
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = parseFileContent(content, path.dirname(filePath));

    if (msgIndex < 0 || msgIndex >= messages.length) {
      return { success: false, error: '消息索引无效' };
    }

    const msg = messages[msgIndex];
    if (!msg.images || imgIndex < 0 || imgIndex >= msg.images.length) {
      return { success: false, error: '图片索引无效' };
    }

    // 删除图片文件
    const imgPath = msg.images[imgIndex];
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }

    // 从数组中移除
    msg.images.splice(imgIndex, 1);

    // 如果消息为空（无文字 + 无图片），删除整条消息
    if (!msg.text.trim() && (!msg.images || msg.images.length === 0)) {
      messages.splice(msgIndex, 1);
    }

    // 重新保存文件
    const newContent = messagesToContent(messages, path.dirname(filePath));
    fs.writeFileSync(filePath, newContent, 'utf-8');

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 更新单条消息（根据索引）
ipcMain.handle('update-message', (event, { index, date, text }) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    const filePath = getTodayFilePath(config.saveDir);
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = parseFileContent(content, path.dirname(filePath));
    
    // 如果索引无效，静默返回成功（消息可能已被删除）
    if (index < 0 || index >= messages.length) {
      return { success: true };
    }
    
    messages[index] = { date: date || messages[index].date, text, images: messages[index].images };

    // 如果消息为空（无文字 + 无图片），删除整条消息
    if (!text.trim() && (!messages[index].images || messages[index].images.length === 0)) {
      messages.splice(index, 1);
    }

    const newContent = messagesToContent(messages, path.dirname(filePath));
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 删除空消息（无需确认）
ipcMain.handle('delete-empty-message', (event, { msgIndex }) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    const filePath = getTodayFilePath(config.saveDir);
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = parseFileContent(content, path.dirname(filePath));

    if (msgIndex < 0 || msgIndex >= messages.length) {
      return { success: false, error: '消息索引无效' };
    }

    // 直接删除，无需确认
    messages.splice(msgIndex, 1);

    // 重新保存文件
    const newContent = messagesToContent(messages, path.dirname(filePath));
    fs.writeFileSync(filePath, newContent, 'utf-8');

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 读取完整文件内容（用于全文编辑）
ipcMain.handle('read-file', () => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    const filePath = getTodayFilePath(config.saveDir);
    if (!fs.existsSync(filePath)) return { success: true, content: '' };
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 保存完整文件内容
ipcMain.handle('save-file', (event, content) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    const filePath = getTodayFilePath(config.saveDir);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 获取图片
ipcMain.handle('get-image-dir', (event, dateStr) => {
  const config = loadConfig();
  if (!config.saveDir) return null;
  // dateStr 格式：YYYY-MM-DD
  const dateParts = dateStr.split(' ')[0].split('-');
  const dirName = `${dateParts[0]}${dateParts[1]}${dateParts[2]}imgs`;
  return path.join(config.saveDir, dirName);
});

// 打开目录
ipcMain.handle('open-directory', (event, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return { success: false, error: '目录不存在' };
  }
  shell.openPath(dirPath);
  return { success: true };
});

// 显示确认对话框
ipcMain.handle('show-confirm-dialog', async (event, { title, message }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: title || APP_NAME,
    message: message || '确定要执行此操作吗？',
    buttons: ['取消', '确定'],
    defaultId: 1,
    cancelId: 0,
  });
  return { confirmed: result.response === 1 };
});
