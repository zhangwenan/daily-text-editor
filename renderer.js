// ========== DOM 元素 ==========
const messagesEl = document.getElementById('messages');
const inputText = document.getElementById('input-text');
const btnSend = document.getElementById('btn-send');
const btnSettings = document.getElementById('btn-settings');
const btnOpenDir = document.getElementById('btn-open-dir');
const modalOverlay = document.getElementById('modal-overlay');
const btnModalClose = document.getElementById('btn-modal-close');
const btnSelectDir = document.getElementById('btn-select-dir');
const btnSaveConfig = document.getElementById('btn-save-config');
const currentPathEl = document.getElementById('current-path');
const btnUploadImg = document.getElementById('btn-upload-img');
const fileInput = document.getElementById('file-input');
const imagePreview = document.getElementById('image-preview');

let currentSaveDir = '';
let tempSelectedDir = '';
let allMessages = []; // 保存当前消息列表，用于编辑时定位索引
let pendingImages = []; // 待发送的图片（base64 数组）

// ========== 初始化 ==========
async function init() {
  // 动态设置应用标题
  const appName = await window.api.getAppName();
  const titleEl = document.getElementById('app-title');
  if (titleEl) {
    titleEl.textContent = appName;
  }

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

  const isEmpty = !msg.text.trim() && (!msg.images || msg.images.length === 0);

  let imagesHtml = '';
  if (msg.images && msg.images.length > 0) {
    imagesHtml = '<div class="message-images">';
    msg.images.forEach((imgPath, imgIdx) => {
      const fileName = imgPath.split('/').pop().split('\\').pop();
      imagesHtml += `
        <div class="message-thumb-wrapper">
          <img class="message-thumb" src="file://${imgPath}" alt="${fileName}" onclick="window.showLightbox('${imgPath.replace(/'/g, "\\'")}')">
          <button class="message-thumb-remove" onclick="window.deleteImage(${index}, ${imgIdx})" title="删除图片">×</button>
        </div>
      `;
    });
    imagesHtml += '</div>';
  }

  // 如果是空消息，显示删除按钮（右侧）
  const deleteBtnHtml = isEmpty ? `<button class="message-delete-btn" onclick="window.deleteEmptyMessage(${index})" title="删除">×</button>` : '';

  el.innerHTML = `
    <div class="message-date">${escapeHtml(msg.date)}</div>
    <div class="message-text">${escapeHtml(msg.text)}</div>
    ${imagesHtml}
    ${deleteBtnHtml}
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

// ========== 图片处理 ==========

// 将 base64 数据转换为 Blob
function base64ToBlob(base64Data) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}

// 处理粘贴事件（截图）
document.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  let hasImage = false;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        hasImage = true;
        await addImageToPending(file);
      }
    }
  }
  // 如果粘贴了图片，聚焦到输入框
  if (hasImage) {
    inputText.focus();
  }
});

// 点击上传按钮选择图片
btnUploadImg.addEventListener('click', () => {
  fileInput.click();
});

// 文件选择变化
fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    await addImageToPending(file);
  }
  // 清空 input，允许重复选择同一文件
  fileInput.value = '';
});

// 将图片添加到待发送列表
async function addImageToPending(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    pendingImages.push(base64);
    renderImagePreview();
    // 自动聚焦到输入框，方便直接按回车发送
    inputText.focus();
  };
  reader.readAsDataURL(file);
}

// 渲染图片预览
function renderImagePreview() {
  if (pendingImages.length === 0) {
    imagePreview.classList.add('hidden');
    imagePreview.innerHTML = '';
    return;
  }

  imagePreview.classList.remove('hidden');
  imagePreview.innerHTML = '';

  pendingImages.forEach((imgData, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-item';
    wrapper.innerHTML = `
      <img src="${imgData}" alt="预览${index + 1}">
      <button class="preview-remove" data-index="${index}" title="删除图片">×</button>
    `;
    imagePreview.appendChild(wrapper);
  });

  // 绑定移除按钮
  imagePreview.querySelectorAll('.preview-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      pendingImages.splice(idx, 1);
      renderImagePreview();
      // 删除后聚焦到输入框
      inputText.focus();
    });
  });
}

// ========== 删除历史消息中的图片 ==========
window.deleteImage = async function(msgIndex, imgIndex) {
  const appName = await window.api.getAppName();
  const confirmed = await window.api.showConfirmDialog(appName, '确定要删除这张图片吗？');
  if (!confirmed.confirmed) return;

  const result = await window.api.deleteImage(msgIndex, imgIndex);
  if (result.success) {
    await loadMessages(); // 重新加载
  } else {
    alert('删除失败：' + result.error);
  }
};

// ========== 删除空消息（无需确认）==========
window.deleteEmptyMessage = async function(msgIndex) {
  const result = await window.api.deleteEmptyMessage(msgIndex);
  if (result.success) {
    await loadMessages(); // 重新加载
  } else {
    alert('删除失败：' + result.error);
  }
};

// ========== 发送消息 ==========
async function sendMessage() {
  const text = inputText.value.trim();
  if (!text && pendingImages.length === 0) return;

  if (!currentSaveDir) {
    alert('请先设置存储目录！');
    return;
  }

  btnSend.disabled = true;

  // 发送文字和图片
  const result = await window.api.appendMessage(text, pendingImages);

  btnSend.disabled = false;

  if (result.success) {
    inputText.value = '';
    pendingImages = [];
    renderImagePreview();
    inputText.focus();
    // 重新加载消息（保证顺序正确）
    await loadMessages();
    // 滚动到底部
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    alert('发送失败：' + result.error);
  }
}

// ========== 打开存储目录 ==========
btnOpenDir.addEventListener('click', async () => {
  if (!currentSaveDir) {
    alert('请先设置存储目录！');
    return;
  }
  await window.api.openDirectory(currentSaveDir);
});

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

// 刷新按钮
document.getElementById('btn-refresh').addEventListener('click', async () => {
  if (!currentSaveDir) {
    alert('请先设置存储目录！');
    return;
  }
  await loadMessages();
});

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

// ========== 灯箱功能（点击图片放大）==========
window.showLightbox = function(imgPath) {
  // 创建灯箱遮罩
  let lightbox = document.getElementById('lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.className = 'lightbox hidden';
    lightbox.innerHTML = '<img id="lightbox-img" src="" alt="放大图片">';
    document.body.appendChild(lightbox);

    // 点击关闭
    lightbox.addEventListener('click', () => {
      lightbox.classList.add('hidden');
    });
  }

  const lightboxImg = document.getElementById('lightbox-img');
  lightboxImg.src = `file://${imgPath}`;
  lightbox.classList.remove('hidden');
};

// ========== 启动 ==========
init();
