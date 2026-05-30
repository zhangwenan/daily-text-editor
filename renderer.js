// ========== DOM 元素 ==========
const messagesEl = document.getElementById('messages');
const inputText = document.getElementById('input-text');
const btnSend = document.getElementById('btn-send');
const btnSettings = document.getElementById('btn-settings');
const modalOverlay = document.getElementById('modal-overlay');
const btnModalClose = document.getElementById('btn-modal-close');
const btnSelectDir = document.getElementById('btn-select-dir');
const btnSaveConfig = document.getElementById('btn-save-config');
const currentPathEl = document.getElementById('current-path');

let currentSaveDir = '';
let tempSelectedDir = '';
let allMessages = []; // 保存当前消息列表，用于编辑时定位索引

// ========== 初始化 ==========
async function init() {
  const result = await window.api.getConfig();
  currentSaveDir = result.saveDir || '';
  if (currentSaveDir) {
    await loadMessages();
  } else {
    showEmptyState('请先通过右上角「设置」选择文件存储目录');
  }
}

// ========== 加载消息 ==========
async function loadMessages() {
  const result = await window.api.loadToday();
  if (!result.success) {
    showEmptyState(result.error || '加载失败');
    allMessages = [];
    return;
  }
  allMessages = result.messages || [];
  renderMessages(allMessages);
}

function renderMessages(messages) {
  messagesEl.innerHTML = '';
  if (messages.length === 0) {
    showEmptyState('今天还没有记录，在下方输入内容开始吧！');
    return;
  }
  // 按时间正序展示（最早的在上，最新的在底部）
  for (let i = 0; i < messages.length; i++) {
    const el = createMessageElement(messages[i], i);
    messagesEl.appendChild(el);
  }
  // 滚动到底部
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessageElement(msg, index) {
  const el = document.createElement('div');
  el.className = 'message-item';
  el.dataset.index = index;
  el.innerHTML = `
    <div class="message-date">${escapeHtml(msg.date)}</div>
    <div class="message-text">${escapeHtml(msg.text)}</div>
  `;

  // 双击进入编辑模式（编辑单条）
  el.addEventListener('dblclick', () => enterEditSingle(el, index, msg));
  return el;
}

function showEmptyState(text) {
  messagesEl.innerHTML = `<div class="empty-state">${text}</div>`;
}

// ========== 编辑单条消息 ==========
function enterEditSingle(el, index, msg) {
  el.classList.add('editing');

  el.innerHTML = `
    <div class="message-date">${escapeHtml(msg.date)}（双击日期可修改，Enter 保存，Esc 取消）</div>
    <input type="text" class="edit-date-input" value="${escapeHtml(msg.date)}" style="width:100%;border:1px solid #ccc;border-radius:4px;padding:4px 8px;margin-bottom:6px;font-size:13px;font-family:monospace;">
    <textarea class="edit-textarea" id="edit-ta-${index}">${escapeHtml(msg.text)}</textarea>
  `;

  const dateInput = el.querySelector('.edit-date-input');
  const textarea = el.querySelector(`#edit-ta-${index}`);
  textarea.focus();

  const saveEdit = async (e) => {
    if (e && e.type === 'keydown' && e.key !== 'Enter') return;
    if (e && e.type === 'keydown') e.preventDefault();

    const newDate = dateInput.value.trim();
    const newText = textarea.value;
    if (!newDate) {
      alert('日期不能为空');
      return;
    }
    const result = await window.api.updateMessage(index, newDate, newText);
    if (result.success) {
      await loadMessages(); // 重新加载
    } else {
      alert('保存失败：' + result.error);
    }
  };

  const cancelEdit = () => {
    loadMessages();
  };

  // Enter 保存（textarea 内）
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      saveEdit(e);
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  });

  dateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveEdit(e);
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  });

  // 失去焦点自动保存
  textarea.addEventListener('blur', () => {
    if (el.classList.contains('editing')) {
      saveEdit();
    }
  });
}

// ========== 发送消息 ==========
async function sendMessage() {
  const text = inputText.value.trim();
  if (!text) return;

  if (!currentSaveDir) {
    alert('请先设置存储目录！');
    return;
  }

  btnSend.disabled = true;
  const result = await window.api.appendMessage(text);
  btnSend.disabled = false;

  if (result.success) {
    inputText.value = '';
    inputText.focus();
    // 重新加载消息（保证顺序正确）
    await loadMessages();
    // 滚动到底部
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    alert('发送失败：' + result.error);
  }
}

// ========== 设置弹窗 ==========
btnSettings.addEventListener('click', async () => {
  tempSelectedDir = currentSaveDir;
  currentPathEl.textContent = currentSaveDir || '未设置';
  modalOverlay.classList.remove('hidden');
});

btnModalClose.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
});

btnSelectDir.addEventListener('click', async () => {
  const dir = await window.api.selectDirectory();
  if (dir) {
    tempSelectedDir = dir;
    currentPathEl.textContent = dir;
  }
});

btnSaveConfig.addEventListener('click', async () => {
  if (!tempSelectedDir) {
    alert('请先选择目录！');
    return;
  }
  await window.api.saveConfig({ saveDir: tempSelectedDir });
  currentSaveDir = tempSelectedDir;
  modalOverlay.classList.add('hidden');
  await loadMessages();
});

// ========== 事件绑定 ==========
btnSend.addEventListener('click', sendMessage);

inputText.addEventListener('keydown', (e) => {
  // Enter 发送（不含 Shift，支持多行输入用 Shift+Enter）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ========== 工具函数 ==========
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 启动 ==========
init();
