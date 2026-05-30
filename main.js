const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

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
// 格式：日期时间行 + 内容行 + 空行
function parseFileContent(content) {
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
      i++;
      // 收集后续非空行作为内容，直到遇到空行或文件结束
      while (i < lines.length && lines[i].trim() !== '') {
        // 如果下一行又是日期，停止
        if (lines[i].match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) break;
        textLines.push(lines[i]);
        i++;
      }
      messages.push({ date: dateStr, text: textLines.join('\n') });
      // 跳过空行
      while (i < lines.length && lines[i].trim() === '') i++;
    } else {
      i++;
    }
  }
  return messages;
}

// 根据消息数组重新生成文件内容
function messagesToContent(messages) {
  const today = new Date();
  const header = `# ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const entries = messages.map(m => `${m.date}\n${m.text}`).join('\n\n');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
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
    const messages = parseFileContent(content);
    return { success: true, messages, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 追加新消息到文件
ipcMain.handle('append-message', (event, text) => {
  const config = loadConfig();
  if (!config.saveDir) return { success: false, error: '请先设置存储目录' };
  try {
    ensureTodayFile(config.saveDir);
    const filePath = getTodayFilePath(config.saveDir);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const entry = `\n${dateStr}\n${text}\n`;
    fs.appendFileSync(filePath, entry, 'utf-8');
    return { success: true, date: dateStr, text };
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
    const messages = parseFileContent(content);
    if (index < 0 || index >= messages.length) {
      return { success: false, error: '消息索引无效' };
    }
    messages[index] = { date: date || messages[index].date, text };
    const newContent = messagesToContent(messages);
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
