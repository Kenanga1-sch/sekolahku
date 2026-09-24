const API_BASE = '/api';
const MAX_TEXT_PREVIEW = 5 * 1024 * 1024;

function getToken() {
  const ls = localStorage.getItem('token');
  if (ls) return ls;
  const m = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function setToken(t) {
  if (t) {
    localStorage.setItem('token', t);
    document.cookie = 'token=' + encodeURIComponent(t) + '; path=/; SameSite=Lax';
  } else {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

function authHeaders(extra) {
  const h = extra || {};
  const token = getToken();
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function apiFetch(path, options) {
  options = options || {};
  options.headers = authHeaders(options.headers || {});
  const res = await fetch(path, options);
  if (res.status === 401) {
    setToken('');
    location.href = '/login';
    throw new Error('unauthorized');
  }
  return res;
}

const state = {
  files: [],
  currentParentId: null,
  path: [],
  selected: [],
  clipboard: null,
  searchMode: false,
  searchQuery: '',
  viewMode: 'list',
  view: 'root',
  pageHasMore: false,
  pageTotal: 0,
  pageOffset: 0,
};

let marqueeMoved = false;

function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getIcon(file, size = 28) {
  if (file.is_folder) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#fbbc04"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  const colors = {
    pdf: '#ea4335', doc: '#4285f4', docx: '#4285f4',
    xls: '#34a853', xlsx: '#34a853', ppt: '#ff6d01', pptx: '#ff6d01',
    jpg: '#fbbc04', jpeg: '#fbbc04', png: '#fbbc04', gif: '#fbbc04',
    mp4: '#ff6d01', mp3: '#ff6d01', zip: '#34a853', rar: '#34a853',
    txt: '#5f6368', md: '#5f6368', csv: '#34a853', json: '#5f6368',
  };
  const color = colors[ext] || '#5f6368';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>`;
}

const SVG_STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  download: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  rename: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  delete: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>`,
  restore: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M15 18l-6-6 6-6"/></svg>`,
  folder: `<svg width="18" height="18" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  file: `<svg width="16" height="16" viewBox="0 0 24 24" ${SVG_STROKE}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg>`,
};

const TOAST_ICONS = {
  success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>`,
  error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
};

async function fetchTrash() {
  const res = await apiFetch(`${API_BASE}/trash`);
  if (!res.ok) throw new Error('Gagal mengambil trash');
  return res.json();
}

async function restoreFile(id) {
  const res = await apiFetch(`${API_BASE}/trash/${id}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error('Gagal memulihkan file');
}

async function restoreAllFromTrash() {
  const res = await apiFetch(`${API_BASE}/trash/restore-all`, { method: 'POST' });
  if (!res.ok) throw new Error('Gagal memulihkan semua');
}

async function permanentDeleteFile(id) {
  const res = await apiFetch(`${API_BASE}/trash/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Gagal menghapus permanen');
}

async function emptyTrash() {
  const res = await apiFetch(`${API_BASE}/trash`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Gagal mengosongkan trash');
}

async function fetchFiles(parentId, offset) {
  const params = new URLSearchParams();
  if (parentId) params.set('parent_id', parentId);
  if (offset) params.set('offset', offset);
  const res = await apiFetch(`${API_BASE}/files?${params.toString()}`);
  if (!res.ok) throw new Error('Gagal mengambil file');
  const total = parseInt(res.headers.get('X-Total-Count') || '', 10);
  const hasMore = res.headers.get('X-Has-More') === 'true';
  const items = await res.json();
  return { items, total, hasMore };
}

async function createFolder(name, parentId) {
  const res = await apiFetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId }),
  });
  if (!res.ok) throw new Error('Gagal membuat folder');
  return res.json();
}

async function renameFile(id, name) {
  const res = await apiFetch(`${API_BASE}/files/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Gagal mengganti nama');
  return res.json();
}

async function deleteFile(id) {
  const res = await apiFetch(`${API_BASE}/files/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Gagal menghapus');
}

async function createShareLink(id) {
  const res = await apiFetch(`${API_BASE}/files/${id}/share`, { method: 'POST' });
  if (!res.ok) throw new Error('Gagal membuat link');
  return res.json();
}

async function copyFiles(ids, targetId) {
  const res = await apiFetch(`${API_BASE}/files/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, target_id: targetId }),
  });
  if (!res.ok) throw new Error('Gagal menyalin');
}

async function moveFiles(ids, targetId) {
  const res = await apiFetch(`${API_BASE}/files/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, target_id: targetId }),
  });
  if (!res.ok) throw new Error('Gagal memindahkan');
}

async function downloadFile(id) {
  const res = await apiFetch(`${API_BASE}/files/${id}/download`);
  if (!res.ok) throw new Error('Gagal download');
  return res;
}

function showToast(msg, typeOrDuration, duration) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  let type = typeOrDuration;
  if (typeof typeOrDuration === 'number' || typeOrDuration == null) {
    duration = typeof typeOrDuration === 'number' ? typeOrDuration : 3000;
    type = null;
  }
  if (!type) {
    const s = String(msg);
    if (/^(Error|Gagal)|terputus|HTTP /.test(s)) type = 'error';
    else if (/selesai|berhasil|dipulihkan|disalin|dipindahkan|dikosongkan|dihapus/.test(s)) type = 'success';
    else type = 'info';
  }
  if (!duration) duration = 3000;
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span class="toast-msg"></span>`;
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

const uploadSession = {
  active: false,
  cancelled: false,
  failed: false,
  bytes: 0,
  totalBytes: 0,
  filesDone: 0,
  filesTotal: 0,
  fileBytes: [],
  fileSizes: [],
  rows: [],
  xhrs: new Set(),
  lastTime: 0,
  lastBytes: 0,
  speed: 0,
};

function showUploadProgress() {
  const container = document.getElementById('uploadProgress');
  if (container) container.classList.remove('hidden');
}

function hideUploadProgress() {
  const container = document.getElementById('uploadProgress');
  if (container) container.classList.add('hidden');
}

function buildUploadRows(names) {
  const list = document.getElementById('uploadProgressList');
  if (!list) return;
  list.innerHTML = '';
  uploadSession.rows = names.map((name) => {
    const row = document.createElement('div');
    row.className = 'upload-item';
    row.innerHTML = `
      <span class="upload-item-icon">${ICONS.file}</span>
      <div class="upload-item-main">
        <span class="upload-item-name"></span>
        <div class="upload-item-bar"><div class="upload-item-fill"></div></div>
      </div>
      <span class="upload-item-pct">0%</span>`;
    row.querySelector('.upload-item-name').textContent = name;
    row.querySelector('.upload-item-name').title = name;
    list.appendChild(row);
    return {
      row,
      fill: row.querySelector('.upload-item-fill'),
      pct: row.querySelector('.upload-item-pct'),
    };
  });
}

function initUploadSession(names, sizes) {
  uploadSession.active = true;
  uploadSession.cancelled = false;
  uploadSession.failed = false;
  uploadSession.bytes = 0;
  uploadSession.totalBytes = sizes.reduce((s, x) => s + x, 0);
  uploadSession.filesDone = 0;
  uploadSession.filesTotal = names.length;
  uploadSession.fileBytes = new Array(names.length).fill(0);
  uploadSession.fileSizes = sizes;
  uploadSession.xhrs.clear();
  uploadSession.lastTime = Date.now();
  uploadSession.lastBytes = 0;
  uploadSession.speed = 0;
  const bar = document.getElementById('uploadProgressBar');
  if (bar) bar.classList.remove('done');
  buildUploadRows(names);
  showUploadProgress();
  renderUploadProgress();
}

function renderUploadProgress() {
  const { totalBytes, bytes, filesDone, filesTotal, speed } = uploadSession;
  const percent = totalBytes > 0 ? Math.min(100, Math.round((bytes / totalBytes) * 100)) : 0;
  const bar = document.getElementById('uploadProgressBar');
  const pctEl = document.getElementById('uploadProgressPercent');
  const filesEl = document.getElementById('uploadProgressFiles');
  const bytesEl = document.getElementById('uploadProgressBytes');
  const speedEl = document.getElementById('uploadProgressSpeed');
  const title = document.getElementById('uploadProgressTitle');
  if (bar) bar.style.width = percent + '%';
  if (pctEl) pctEl.textContent = percent + '%';
  if (filesEl) filesEl.textContent = `${filesDone}/${filesTotal} selesai`;
  if (bytesEl) bytesEl.textContent = `${formatSize(bytes)} / ${formatSize(totalBytes)}`;
  if (speedEl) speedEl.textContent = speed > 0 ? formatSize(speed) + '/s' : '';
  if (title) title.textContent = uploadSession.failed ? 'Upload gagal' : (uploadSession.cancelled ? 'Upload dibatalkan' : `Mengupload ${filesTotal} file`);
}

function updateUploadSession(deltaBytes) {
  uploadSession.bytes += deltaBytes;
  if (uploadSession.bytes < 0) uploadSession.bytes = 0;
  if (uploadSession.bytes > uploadSession.totalBytes) uploadSession.bytes = uploadSession.totalBytes;
  const now = Date.now();
  const dt = now - uploadSession.lastTime;
  if (dt >= 500) {
    uploadSession.speed = (uploadSession.bytes - uploadSession.lastBytes) / (dt / 1000);
    uploadSession.lastTime = now;
    uploadSession.lastBytes = uploadSession.bytes;
  }
  renderUploadProgress();
}

function setFileUploading(index) {
  const r = uploadSession.rows[index];
  if (!r) return;
  r.row.className = 'upload-item uploading';
}

function setFileProgress(index, loaded, total) {
  const r = uploadSession.rows[index];
  if (!r) return;
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  r.fill.style.width = pct + '%';
  r.pct.textContent = pct + '%';
}

function setFileDone(index) {
  const r = uploadSession.rows[index];
  if (!r) return;
  r.fill.style.width = '100%';
  r.pct.textContent = '100%';
  r.row.className = 'upload-item done';
  uploadSession.filesDone++;
  renderUploadProgress();
}

function setFileError(index) {
  const r = uploadSession.rows[index];
  if (!r) return;
  r.row.className = 'upload-item error';
  r.pct.textContent = '✕';
}

function setUploadDone() {
  const bar = document.getElementById('uploadProgressBar');
  const pct = document.getElementById('uploadProgressPercent');
  if (bar) { bar.style.width = '100%'; bar.classList.add('done'); }
  if (pct) pct.textContent = '100%';
  const title = document.getElementById('uploadProgressTitle');
  if (title) title.textContent = 'Upload selesai';
}

function cancelUpload() {
  uploadSession.cancelled = true;
  uploadSession.active = false;
  for (const xhr of uploadSession.xhrs) {
    try { xhr.abort(); } catch (_) {}
  }
  uploadSession.xhrs.clear();
}

function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  const count = document.getElementById('selectionCount');
  const isTrash = state.view === 'trash';
  const restoreBtn = document.getElementById('restoreSelBtn');
  const copyBtn = document.getElementById('copyBtn');
  const cutBtn = document.getElementById('cutBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  if (restoreBtn) restoreBtn.classList.toggle('hidden', !isTrash);
  if (copyBtn) copyBtn.classList.toggle('hidden', isTrash);
  if (cutBtn) cutBtn.classList.toggle('hidden', isTrash);
  if (deleteBtn) deleteBtn.title = isTrash ? 'Hapus permanen' : 'Hapus (Delete)';
  if (state.selected.length > 0) {
    bar.classList.remove('hidden');
    count.textContent = state.selected.length + ' dipilih';
  } else {
    bar.classList.add('hidden');
  }
}

function extractServerError(xhr, fallback) {
  try {
    const data = JSON.parse(xhr.responseText);
    if (data && data.error) return data.error;
  } catch (_) {}
  const text = (xhr.responseText || '').trim();
  if (text) return text;
  return fallback + ' (HTTP ' + xhr.status + ')';
}

function uploadFileXHR(file, parentId, itemIndex) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    if (parentId) fd.append('parent_id', parentId);

    const xhr = new XMLHttpRequest();
    uploadSession.xhrs.add(xhr);
    xhr.open('POST', `${API_BASE}/files`);
    if (getToken()) xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());

    setFileUploading(itemIndex);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && uploadSession.active) {
        const prev = uploadSession.fileBytes[itemIndex];
        const delta = e.loaded - prev;
        uploadSession.fileBytes[itemIndex] = e.loaded;
        setFileProgress(itemIndex, e.loaded, file.size);
        updateUploadSession(delta);
      }
    });

    let settled = false;
    const finish = (ok, errMsg) => {
      if (settled) return;
      settled = true;
      uploadSession.xhrs.delete(xhr);
      if (ok) {
        const delta = file.size - uploadSession.fileBytes[itemIndex];
        uploadSession.fileBytes[itemIndex] = file.size;
        setFileDone(itemIndex);
        updateUploadSession(delta);
        resolve();
      } else {
        setFileError(itemIndex);
        if (typeof console !== 'undefined' && console.error) {
          console.error('[upload] failed', { name: file.name, size: file.size, status: xhr.status, statusText: xhr.statusText, response: (xhr.responseText || '').slice(0, 500) });
        }
        renderUploadProgress();
        reject(new Error(errMsg));
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 || xhr.status === 201) finish(true);
        else {
          let msg = extractServerError(xhr, `Gagal upload: ${file.name}`);
          if (xhr.status === 0) msg = `Gagal upload: ${file.name} (Koneksi terputus / dibatalkan browser / HTTP 0)`;
          finish(false, uploadSession.cancelled ? 'Upload dibatalkan' : msg);
        }
      }
    };
    xhr.onerror = () => finish(false, uploadSession.cancelled ? 'Upload dibatalkan' : `Gagal upload: ${file.name} (Koneksi terputus / HTTP 0)`);
    xhr.onabort = () => finish(false, 'Upload dibatalkan');
    xhr.timeout = 0;
    xhr.send(fd);
  });
}

async function runUploadQueue(items) {
  if (!items.length) return;
  const names = items.map(it => it.name);
  const sizes = items.map(it => it.file.size);
  initUploadSession(names, sizes);

  const failed = [];
  let idx = 0;
  const CONCURRENCY = 3;
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (true) {
        if (uploadSession.cancelled) return;
        const i = idx++;
        if (i >= items.length) break;
        try {
          await uploadFileXHR(items[i].file, items[i].parentId, i);
        } catch (err) {
          uploadSession.failed = true;
          failed.push({ name: items[i].name, error: err.message });
        }
      }
    })());
  }

  await Promise.all(workers);

  setUploadDone();
  setTimeout(hideUploadProgress, 900);

  if (!uploadSession.cancelled && failed.length > 0) {
    const list = failed.map(f => f.name).join(', ');
    showToast(`Upload: ${items.length - failed.length} berhasil, ${failed.length} gagal (${list})`, 5000);
  }
  return failed;
}

async function uploadWithProgress(files, parentId) {
  const items = Array.from(files).map(file => ({ file, parentId, name: file.name }));
  const failed = await runUploadQueue(items);
  return failed && failed.length > 0;
}

function triggerUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const hadFailure = await uploadWithProgress(e.target.files, state.currentParentId);
      if (!hadFailure) showToast('Upload selesai');
      loadFiles(state.currentParentId);
    } catch (err) {
      showToast(err.message);
    }
  };
  input.click();
}

function readDirectoryEntries(entry) {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const entries = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function readEntryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkDroppedEntry(entry, parentPath, files, folders) {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    files.push({ file: await readEntryFile(entry), rel: path });
    return;
  }
  if (!entry.isDirectory) return;
  folders.add(path);
  const children = await readDirectoryEntries(entry);
  for (const child of children) {
    await walkDroppedEntry(child, path, files, folders);
  }
}

async function collectDroppedContent(dataTransfer) {
  const entries = Array.from(dataTransfer.items || [])
    .map(item => typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null)
    .filter(Boolean);

  if (entries.length) {
    const files = [];
    const folders = new Set();
    for (const entry of entries) {
      await walkDroppedEntry(entry, '', files, folders);
    }
    return { files, folders: [...folders] };
  }

  return {
    files: Array.from(dataTransfer.files || []).map(file => ({ file, rel: file.webkitRelativePath || file.name })),
    folders: [],
  };
}

async function uploadFolderStructure(items, parentId, droppedFolders = []) {
  const folderCache = new Map([['', parentId]]);
  const folderPaths = new Set();
  const uploadItems = [];

  const addFolderPath = (path) => {
    const parts = path.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      folderPaths.add(parts.slice(0, i).join('/'));
    }
  };

  droppedFolders.forEach(addFolderPath);
  for (const { file, rel } of items) {
    const parts = rel.split('/').filter(Boolean);
    const folderPath = parts.slice(0, -1).join('/');
    if (folderPath) addFolderPath(folderPath);
    uploadItems.push({ file, folderPath, name: rel });
  }

  for (const path of [...folderPaths].sort((a, b) => a.split('/').length - b.split('/').length)) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const created = await createFolder(name, folderCache.get(parentPath));
    folderCache.set(path, created.id);
  }

  const failed = await runUploadQueue(uploadItems.map(it => ({ file: it.file, parentId: folderCache.get(it.folderPath), name: it.name })));
  return failed && failed.length > 0;
}

function renderEmptyState() {
  const isTrash = state.view === 'trash';
  const icon = isTrash
    ? `<svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>`
    : `<svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/></svg>`;
  const cta = isTrash
    ? ''
    : `<button class="empty-cta" id="emptyUploadBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M12 12v9M8 15l4-4 4 4"/></svg>Upload File</button>`;
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${isTrash ? 'Trash kosong' : 'Folder kosong'}</div>
    <div class="empty-sub">${isTrash ? 'File yang dihapus akan muncul di sini.' : 'Upload file atau buat folder untuk memulai.'}</div>
    ${cta}
  </div>`;
}

function renderFiles(files) {
  const container = document.getElementById('fileList');
  if (files.length === 0) {
    container.innerHTML = renderEmptyState();
    const cta = document.getElementById('emptyUploadBtn');
    if (cta) cta.addEventListener('click', triggerUpload);
    updateSelectionBar();
    return;
  }

  const isList = container.classList.contains('list-view');
  let html = '';
  files.forEach(file => {
    const selected = state.selected.includes(file.id) ? 'selected' : '';
    const actions = state.view === 'trash'
      ? `<button class="action-btn" data-action="restore" title="Pulihkan">${ICONS.restore}</button><button class="action-btn action-delete" data-action="permanent-delete" title="Hapus permanen">${ICONS.delete}</button>`
      : `<button class="action-btn" data-action="download" title="Download">${ICONS.download}</button><button class="action-btn" data-action="rename" title="Ganti nama">${ICONS.rename}</button><button class="action-btn" data-action="share" title="Bagikan">${ICONS.share}</button><button class="action-btn action-delete" data-action="delete" title="Hapus">${ICONS.delete}</button>`;
    const sizeLabel = file.is_folder
      ? (isList ? '-' : 'Folder')
      : formatSize(file.size);
    const isImage = (file.mime_type || '').startsWith('image/');
    const iconContent = (!isList && isImage && state.view !== 'trash')
      ? `<img class="thumb" data-id="${file.id}" src="${API_BASE}/files/${file.id}/thumb" alt="" loading="lazy">`
      : `<div class="icon">${getIcon(file)}</div>`;
    html += `
      <div class="file-item ${selected}" data-id="${file.id}" data-folder="${file.is_folder}" draggable="${state.view !== 'trash'}">
        ${iconContent}
        <div class="name">${escapeHTML(file.name)}</div>
        <div class="size">${sizeLabel}</div>
        ${isList ? `<div class="updated">${formatDate(file.updated_at)}</div>` : ''}
        <div class="actions">${actions}</div>
      </div>
    `;
  });
  container.innerHTML = html;
  attachFileItemEvents();
  updateSelectionBar();
}

function attachFileItemEvents() {
  const container = document.getElementById('fileList');
  container.querySelectorAll('.file-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.actions')) return;
      const id = el.dataset.id;
      toggleSelection(id, e);
    });

    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.actions')) return;
      const id = el.dataset.id;
      const isFolder = el.dataset.folder === 'true';
      if (state.view !== 'trash' && isFolder) {
        navigateInto(id);
      } else if (state.view !== 'trash') {
        previewFile(id);
      }
    });

    el.addEventListener('contextmenu', (e) => {
      if (state.view === 'trash') return;
      e.preventDefault();
      const id = el.dataset.id;
      if (!state.selected.includes(id)) {
        state.selected = [id];
        paintSelection();
      }
      showContextMenu(e.clientX, e.clientY, id);
    });
  });

  container.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.file-item').dataset.id;
      const action = btn.dataset.action;
      handleQuickAction(action, id);
    });
  });

  container.querySelectorAll('img.thumb').forEach(img => {
    img.addEventListener('error', () => {
      const file = state.files.find(f => f.id === img.dataset.id);
      if (!file) return;
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.innerHTML = getIcon(file);
      img.replaceWith(icon);
    });
  });
}

function initMarqueeSelection() {
  const container = document.getElementById('fileList');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let additive = false;
  let rectEl = null;
  let suppressClick = false;

  const computeIds = () => {
    const rect = rectEl.getBoundingClientRect();
    const ids = [];
    container.querySelectorAll('.file-item').forEach(item => {
      const r = item.getBoundingClientRect();
      const hit = rect.left < r.right && rect.right > r.left &&
                  rect.top < r.bottom && rect.bottom > r.top;
      if (hit) ids.push(item.dataset.id);
    });
    return ids;
  };

  const paint = (ids) => {
    container.querySelectorAll('.file-item').forEach(item => {
      item.classList.toggle('selected', ids.includes(item.dataset.id));
    });
  };

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (state.view === 'trash') return;
    if (e.target.closest('.actions')) return;

    const startOnItem = !!e.target.closest('.file-item');
    if (startOnItem && !(e.shiftKey || e.ctrlKey || e.metaKey)) return;

    startX = e.clientX;
    startY = e.clientY;
    marqueeMoved = false;
    additive = e.shiftKey || e.ctrlKey || e.metaKey;
    rectEl = null;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  container.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!e.target.closest('.file-item') && !e.target.closest('.actions')) {
      state.selected = [];
      paintSelection();
    }
  }, true);

  const onMove = (ev) => {
    if (!marqueeMoved &&
        Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 4) return;
    if (!marqueeMoved) {
      marqueeMoved = true;
      rectEl = document.createElement('div');
      rectEl.id = 'selectionRect';
      document.body.appendChild(rectEl);
    }
    ev.preventDefault();
    const x = Math.min(startX, ev.clientX);
    const y = Math.min(startY, ev.clientY);
    rectEl.style.left = x + 'px';
    rectEl.style.top = y + 'px';
    rectEl.style.width = Math.abs(ev.clientX - startX) + 'px';
    rectEl.style.height = Math.abs(ev.clientY - startY) + 'px';
    paint(computeIds());
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    if (!marqueeMoved) {
      if (rectEl) { rectEl.remove(); rectEl = null; }
      marqueeMoved = false;
      return;
    }
    marqueeMoved = false;

    const ids = computeIds();
    if (rectEl) { rectEl.remove(); rectEl = null; }

    if (ids.length === 0) {
      if (!additive) {
        state.selected = [];
        paint([]);
      }
    } else if (additive) {
      const set = new Set(state.selected);
      ids.forEach(id => {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      });
      state.selected = [...set];
      paint(state.selected);
    } else {
      state.selected = ids;
      paint(ids);
    }
    updateSelectionBar();
    suppressClick = true;
  };
}

function paintSelection() {
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('selected', state.selected.includes(el.dataset.id));
  });
  updateSelectionBar();
}

function toggleSelection(id, e) {
  if (e.shiftKey) {
    const items = Array.from(document.querySelectorAll('.file-item'));
    const startIdx = items.findIndex(i => i.dataset.id === id);
    const lastIdx = items.findIndex(i => state.selected.includes(i.dataset.id));
    if (lastIdx === -1) {
      state.selected = [id];
      return;
    }
    const [min, max] = [Math.min(startIdx, lastIdx), Math.max(startIdx, lastIdx)];
    state.selected = items.slice(min, max + 1).map(i => i.dataset.id);
  } else if (e.ctrlKey || e.metaKey) {
    const idx = state.selected.indexOf(id);
    if (idx > -1) {
      state.selected.splice(idx, 1);
    } else {
      state.selected.push(id);
    }
  } else {
    state.selected = [id];
  }
  paintSelection();
}

function navigateInto(id) {
  state.currentParentId = id;
  state.searchMode = false;
  state.selected = [];
  document.getElementById('searchInput').value = '';
  loadFiles(id);
}

async function runBatchDelete(ids) {
  let success = 0;
  const failed = [];
  for (const id of ids) {
    try {
      await deleteFile(id);
      success++;
    } catch (err) {
      failed.push(err.message);
    }
  }
  state.selected = [];
  if (state.view === 'trash') loadTrash();
  else loadFiles(state.currentParentId);

  if (failed.length === 0) {
    showToast(`${success} item dihapus`);
  } else {
    showToast(`${success} dihapus, ${failed.length} gagal`);
  }
}

function isTextFile(file) {
  const mime = (file.mime_type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const textMimes = [
    'text/', 'application/json', 'application/javascript',
    'application/xml', 'application/x-sh', 'application/x-yaml',
    'application/sql', 'application/toml',
  ];
  if (textMimes.some(m => mime.startsWith(m))) return true;
  const textExts = ['txt', 'md', 'csv', 'json', 'js', 'mjs', 'ts', 'jsx', 'tsx',
    'css', 'html', 'htm', 'xml', 'yml', 'yaml', 'ini', 'conf', 'log', 'sh',
    'bat', 'ps1', 'py', 'go', 'rs', 'c', 'cpp', 'h', 'java', 'sql', 'toml',
    'env', 'gitignore', 'svg', 'tex', 'rtf', 'tsv'];
  return textExts.includes(name.split('.').pop());
}

function isOfficeFile(file) {
  const name = (file.name || '').toLowerCase();
  return /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(name);
}

function renderFallbackPreview(file) {
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="preview-fallback">
      <div class="preview-icon">${getIcon(file, 64)}</div>
      <div class="preview-name">${escapeHTML(file.name)}</div>
      <div class="preview-meta">${formatSize(file.size)}${file.mime_type ? ' · ' + escapeHTML(file.mime_type) : ''}</div>
      ${isOfficeFile(file) ? '<div class="preview-note">Preview inline untuk dokumen Office belum didukung.</div>' : ''}
      <a class="download-link" href="${API_BASE}/files/${file.id}/download" download>${ICONS.download} Download ${escapeHTML(file.name)}</a>
    </div>
  `;
}

function previewMetaBar(file) {
  return `<div class="preview-meta-bar">
    <span class="pm-name">${escapeHTML(file.name)}</span>
    <span class="pm-meta">${formatSize(file.size)}${file.mime_type ? ' · ' + escapeHTML(file.mime_type) : ''}</span>
  </div>`;
}

async function previewFile(id) {
  const file = state.files.find(f => f.id === id);
  if (!file || file.is_folder) return;

  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  const mime = (file.mime_type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
  const isText = isTextFile(file);

  body.innerHTML = '<div class="preview-loading"><div class="spinner"></div>Memuat preview...</div>';
  modal.classList.remove('hidden');

  if (isImage) {
    body.innerHTML = `${previewMetaBar(file)}<img src="${API_BASE}/files/${file.id}/download" alt="${escapeHTML(file.name)}" style="display:block;margin:auto;max-width:100%;max-height:calc(100% - 60px);border-radius:8px;" loading="lazy" />`;
    return;
  }

  if (isVideo) {
    body.innerHTML = `${previewMetaBar(file)}<video controls src="${API_BASE}/files/${file.id}/download" style="max-width:100%;max-height:calc(100% - 60px);"></video>`;
    return;
  }

  if (isPdf) {
    body.innerHTML = `<iframe src="${API_BASE}/files/${id}/download" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>`;
    return;
  }

  if (isAudio) {
    body.innerHTML = `${previewMetaBar(file)}<audio controls style="width:100%;" src="${API_BASE}/files/${id}/download"></audio>`;
    return;
  }

  if (isText) {
    if (file.size > MAX_TEXT_PREVIEW) {
      body.innerHTML = `<div class="preview-fallback">
        <div class="preview-icon">${getIcon(file, 64)}</div>
        <div class="preview-name">${escapeHTML(file.name)}</div>
        <div class="preview-meta">${formatSize(file.size)}</div>
        <div class="preview-note">File teks terlalu besar untuk preview (maks ${formatSize(MAX_TEXT_PREVIEW)}). Silakan download.</div>
        <a class="download-link" href="${API_BASE}/files/${file.id}/download" download>${ICONS.download} Download ${escapeHTML(file.name)}</a>
      </div>`;
      return;
    }
    try {
      const res = await downloadFile(id);
      const text = await res.text();
      body.innerHTML = `<pre class="text-preview">${escapeHTML(text)}</pre>`;
      return;
    } catch (err) {
      body.innerHTML = `<p>Gagal preview: ${escapeHTML(err.message)}</p>`;
      return;
    }
  }

  renderFallbackPreview(file);
}

function showContextMenu(x, y, id) {
  const menu = document.getElementById('contextMenu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');
  menu.dataset.targetId = id;
}

function hideContextMenu() {
  document.getElementById('contextMenu').classList.add('hidden');
}

function pickFolder(title) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      modalEl.removeEventListener('click', onBackdrop);
      const closeBtn = modalEl.querySelector('.close');
      if (closeBtn) closeBtn.removeEventListener('click', onClose);
      modalEl.classList.add('hidden');
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    const onBackdrop = (e) => { if (e.target === modalEl) done(null); };
    const onClose = () => done(null);

    const modalEl = document.getElementById('modal');
    const body = document.getElementById('modalBody');
    body.innerHTML = '<div class="picker-title">' + escapeHTML(title) + '</div><div class="picker-list"><div class="picker-loading">Memuat folder...</div></div>';
    modalEl.classList.remove('hidden');
    document.addEventListener('keydown', onKey);
    modalEl.addEventListener('click', onBackdrop);
    const closeBtn = modalEl.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', onClose);

    apiFetch(`${API_BASE}/folders/all`)
      .then(res => res.json())
      .then((folders) => {
        const byId = new Map(folders.map(f => [f.id, f]));
        const depthMap = {};
        const getDepth = (id) => {
          if (depthMap[id] !== undefined) return depthMap[id];
          const f = byId.get(id);
          const d = f && f.parent_id ? getDepth(f.parent_id) + 1 : 0;
          depthMap[id] = d;
          return d;
        };
        let html = '<div class="picker-title">' + escapeHTML(title) + '</div><div class="picker-list">';
        html += '<div class="picker-item" data-id=""><span class="picker-folder-icon">' + ICONS.folder + '</span>My Drive</div>';
        for (const f of folders) {
          const pad = getDepth(f.id) * 20 + 12;
          html += `<div class="picker-item" data-id="${f.id}" style="padding-left:${pad}px"><span class="picker-folder-icon">${ICONS.folder}</span>${escapeHTML(f.name)}</div>`;
        }
        html += '</div>';
        body.innerHTML = html;
        body.querySelectorAll('.picker-item').forEach(el => {
          el.onclick = () => done(el.dataset.id === '' ? '' : el.dataset.id);
        });
      })
      .catch(() => done(null));
  });
}

async function showShareDialog(file) {
  const modalEl = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  let token = file.share_token;
  if (!token) {
    try {
      const result = await createShareLink(file.id);
      token = result.share_token;
    } catch (err) {
      showToast(err.message);
      return;
    }
  }
  const shareUrl = `${window.location.origin}/s/${token}`;

  body.innerHTML = `
    <div class="picker-title">Bagikan "${escapeHTML(file.name)}"</div>
    <div class="share-box">
      <input type="text" id="shareUrlInput" readonly value="${escapeHTML(shareUrl)}" />
    </div>
    <div class="share-actions">
      <button class="modal-btn primary" id="copyShareBtn">Salin Link</button>
      <button class="modal-btn danger" id="revokeShareBtn">Cabut Link</button>
      <button class="modal-btn" id="closeShareBtn">Tutup</button>
    </div>`;
  modalEl.classList.remove('hidden');

  const finish = () => modalEl.classList.add('hidden');

  document.getElementById('copyShareBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link disalin ke clipboard');
    } catch (_) {
      const input = document.getElementById('shareUrlInput');
      input.select();
      document.execCommand('copy');
      showToast('Link disalin ke clipboard');
    }
    finish();
  };

  document.getElementById('revokeShareBtn').onclick = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/files/${file.id}/share`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal mencabut link');
      showToast('Link share dicabut');
      finish();
      refreshCurrentView();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('closeShareBtn').onclick = finish;
}

async function handleQuickAction(action, id) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;

  switch (action) {
    case 'open':
      if (file.is_folder) {
        navigateInto(id);
      } else {
        previewFile(id);
      }
      break;
    case 'rename': {
      const name = await showCustomPrompt('Ganti Nama', file.name, 'Masukkan nama baru untuk item ini.');
      if (name && name !== file.name) {
        await renameFile(id, name);
        refreshCurrentView();
      }
      break;
    }
    case 'delete': {
      const ok = await showCustomConfirm('Hapus File', `Apakah Anda yakin ingin menghapus "${file.name}"?`);
      if (ok) {
        await deleteFile(id);
        refreshCurrentView();
      }
      break;
    }
    case 'restore':
      try {
        await restoreFile(id);
        showToast('File berhasil dipulihkan');
        loadTrash();
      } catch (err) {
        showToast(err.message);
      }
      break;
    case 'permanent-delete': {
      const ok = await showCustomConfirm('Hapus Permanen', `Apakah Anda yakin ingin menghapus permanen "${file.name}"? Tindakan ini tidak dapat dibatalkan.`);
      if (ok) {
        try {
          await permanentDeleteFile(id);
          showToast('File dihapus permanen');
          loadTrash();
        } catch (err) {
          showToast(err.message);
        }
      }
      break;
    }
    case 'share': {
      await showShareDialog(file);
      break;
    }
    case 'download': {
      const a = document.createElement('a');
      a.href = `${API_BASE}/files/${id}/download`;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      break;
    }
    case 'copy':
      state.clipboard = { ids: state.selected.length > 1 ? [...state.selected] : [id], action: 'copy' };
      showToast('Disalin. Tekan Ctrl+V untuk tempel.');
      break;
    case 'move': {
      const targetId = await pickFolder('Pilih folder tujuan');
      if (targetId === null) break;
      const ids = state.selected.length > 1 ? [...state.selected] : [id];
      try {
        await moveFiles(ids, targetId === '' ? undefined : targetId);
        showToast('Item dipindahkan');
      } catch (err) {
        showToast(err.message);
      }
      state.selected = [];
      loadFiles(state.currentParentId);
      break;
    }
    case 'paste':
      if (!state.clipboard) {
        showToast('Tidak ada file yang disalin');
        return;
      }
      if (state.clipboard.action === 'copy') {
        await copyFiles(state.clipboard.ids, state.currentParentId);
      } else if (state.clipboard.action === 'move') {
        await moveFiles(state.clipboard.ids, state.currentParentId);
      }
      if (state.clipboard.action === 'move') {
        state.clipboard = null;
      }
      loadFiles(state.currentParentId);
      break;
  }
}

function setTrashActionsVisible(visible) {
  const restoreAll = document.getElementById('restoreAllBtn');
  const empty = document.getElementById('emptyTrashBtn');
  const search = document.getElementById('searchInput');
  if (restoreAll) restoreAll.classList.toggle('hidden', !visible);
  if (empty) empty.classList.toggle('hidden', !visible);
  if (search) search.style.display = visible ? 'none' : '';
}

function buildSkeletonHtml() {
  const container = document.getElementById('fileList');
  const isGrid = container && container.classList.contains('grid-view');
  if (isGrid) {
    let html = '';
    for (let i = 0; i < 10; i++) {
      html += `<div class="skeleton-card"><div class="sk sk-thumb"></div><div class="sk sk-icon-lg"></div><div class="sk sk-name" style="width:70%;height:12px;"></div><div class="sk sk-size"></div></div>`;
    }
    return html;
  }
  let html = '';
  for (let i = 0; i < 8; i++) {
    html += `<div class="skeleton-item"><div class="sk sk-icon"></div><div class="sk sk-name"></div><div class="sk sk-size"></div><div class="sk sk-updated"></div></div>`;
  }
  return html;
}

function setLoading(on) {
  const container = document.getElementById('fileList');
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', on);
  if (on && container) {
    container.innerHTML = buildSkeletonHtml();
  }
}

async function loadFiles(parentId) {
  state.view = 'root';
  try {
    setLoading(true);
    setTrashActionsVisible(false);
    const page = await fetchFiles(parentId, 0);
    state.files = page.items || [];
    state.pageTotal = page.total || state.files.length;
    state.pageHasMore = !!page.hasMore;
    state.pageOffset = 0;
    renderFiles(state.files);
    updateLoadMore();
    await updateBreadcrumb(parentId);
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function updateLoadMore() {
  const wrap = document.getElementById('loadMoreWrap');
  const btn = document.getElementById('loadMoreBtn');
  if (!wrap || !btn) return;
  const show = state.view === 'root' && !state.searchMode && state.pageHasMore;
  wrap.classList.toggle('hidden', !show);
  if (show) btn.textContent = `Muat lebih banyak (${state.files.length}/${state.pageTotal})`;
}

async function loadMore() {
  const next = state.files.length;
  try {
    const page = await fetchFiles(state.currentParentId, next);
    state.files = state.files.concat(page.items || []);
    state.pageTotal = page.total || state.files.length;
    state.pageHasMore = !!page.hasMore;
    state.pageOffset = next;
    renderFiles(state.files);
    updateLoadMore();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadTrash() {
  state.view = 'trash';
  state.currentParentId = null;
  state.selected = [];
  try {
    setLoading(true);
    setTrashActionsVisible(true);
    state.files = (await fetchTrash()) || [];
    renderFiles(state.files);
    const container = document.getElementById('breadcrumb');
    if (container) container.innerHTML = '<span style="font-weight: 500;">Trash</span>';
    updateSelectionBar();
    updateLoadMore();
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function refreshCurrentView() {
  if (state.searchMode) reloadSearch();
  else if (state.view === 'trash') loadTrash();
  else loadFiles(state.currentParentId);
}

async function reloadSearch() {
  const q = (state.searchQuery || '').trim();
  if (!q) {
    loadFiles(state.currentParentId);
    return;
  }
  try {
    setLoading(true);
    const res = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Gagal mencari');
    renderSearchResults(await res.json());
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

async function renderSearchResults(files) {
  const container = document.getElementById('fileList');
  if (!files.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>
      <div class="empty-title">Tidak ada hasil</div>
      <div class="empty-sub">Tidak ditemukan file atau folder untuk pencarian "${escapeHTML(state.searchQuery || '')}".</div>
    </div>`;
    updateSelectionBar();
    updateLoadMore();
    return;
  }

  const grouped = {};
  for (const file of files) {
    const path = file.path || 'My Drive';
    (grouped[path] = grouped[path] || []).push(file);
  }

  let html = '';
  for (const path of Object.keys(grouped)) {
    html += `<div class="search-group"><span class="search-path">${escapeHTML(path)}</span></div>`;
    for (const file of grouped[path]) {
      const selected = state.selected.includes(file.id) ? 'selected' : '';
      const isImage = (file.mime_type || '').startsWith('image/');
      const iconContent = isImage
        ? `<img class="thumb" data-id="${file.id}" src="${API_BASE}/files/${file.id}/thumb" alt="" loading="lazy">`
        : `<div class="icon">${getIcon(file)}</div>`;
      const actions = `<button class="action-btn" data-action="download" title="Download">${ICONS.download}</button><button class="action-btn" data-action="rename" title="Ganti nama">${ICONS.rename}</button><button class="action-btn" data-action="share" title="Bagikan">${ICONS.share}</button><button class="action-btn action-delete" data-action="delete" title="Hapus">${ICONS.delete}</button>`;
      html += `
        <div class="file-item ${selected}" data-id="${file.id}" data-folder="${file.is_folder}" draggable="true">
          ${iconContent}
          <div class="name">${escapeHTML(file.name)}</div>
          <div class="size">${file.is_folder ? 'Folder' : formatSize(file.size)}</div>
          <div class="actions">${actions}</div>
        </div>
      `;
    }
  }
  container.innerHTML = html;
  state.files = files;
  attachFileItemEvents();
  updateSelectionBar();
  updateLoadMore();
}

async function updateBreadcrumb(parentId) {
  const container = document.getElementById('breadcrumb');
  if (!container) return;

  if (!parentId) {
    state.path = [{ id: null, name: 'My Drive' }];
  } else {
    // Build path by walking parents or tracking history
    const pathStack = [];
    let curr = parentId;
    while (curr) {
      try {
        const res = await apiFetch(`${API_BASE}/files/${curr}`);
        if (!res.ok) break;
        const file = await res.json();
        pathStack.unshift({ id: file.id, name: file.name });
        curr = file.parent_id;
      } catch (e) {
        break;
      }
    }
    pathStack.unshift({ id: null, name: 'My Drive' });
    state.path = pathStack;
  }

  let html = '';
  if (state.path.length > 1) {
    const prevFolder = state.path[state.path.length - 2];
    html += `<button id="backBtn" class="btn secondary" title="Kembali">${ICONS.back}</button>`;
  }

  state.path.forEach((item, index) => {
    if (index > 0) html += ' <span style="color: var(--text-secondary); margin: 0 4px;">/</span> ';
    if (index === state.path.length - 1) {
      html += `<span style="font-weight: 500;">${item.name}</span>`;
    } else {
      html += `<a href="#" data-id="${item.id || ''}" class="breadcrumb-link" style="color: var(--primary); text-decoration: none;">${item.name}</a>`;
    }
  });

  container.innerHTML = html;

  const backBtn = document.getElementById('backBtn');
  if (backBtn && state.path.length > 1) {
    const parentItem = state.path[state.path.length - 2];
    backBtn.addEventListener('click', () => {
      navigateInto(parentItem.id);
    });
  }

  container.querySelectorAll('.breadcrumb-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.dataset.id || null;
      navigateInto(id || null);
    });
  });
}

function setupDragAndDrop() {
  const container = document.getElementById('fileList');

  container.addEventListener('dragstart', (e) => {
    if (marqueeMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const item = e.target.closest('.file-item');
    if (!item) return;
    const id = item.dataset.id;
    if (!state.selected.includes(id)) {
      state.selected = [id];
      renderFiles(state.files);
    }
    e.dataTransfer.setData('text/plain', JSON.stringify(state.selected));
    item.classList.add('dragging');
  });

  container.addEventListener('dragend', (e) => {
    const item = e.target.closest('.file-item');
    if (item) item.classList.remove('dragging');
    container.querySelectorAll('.file-item').forEach(i => i.classList.remove('drop-target'));
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    container.querySelectorAll('.file-item').forEach(i => i.classList.remove('drop-target'));
    if (target && target.dataset.folder === 'true') {
      target.classList.add('drop-target');
    }
    container.classList.add('drag-over');
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    container.querySelectorAll('.file-item').forEach(i => i.classList.remove('drop-target'));

    const targetFolder = e.target.closest('.file-item');
    let targetId = state.currentParentId;

    if (targetFolder && targetFolder.dataset.folder === 'true') {
      targetId = targetFolder.dataset.id;
    }

    const draggedData = e.dataTransfer.getData('text/plain');
    if (draggedData) {
      try {
        const ids = JSON.parse(draggedData);
        if (ids.length > 0) {
          if (targetId && ids.includes(targetId)) return; // Can't move into itself
          await moveFiles(ids, targetId);
          loadFiles(state.currentParentId);
          return;
        }
      } catch (err) {
        // Not internal drag, might be external files upload
      }
    }

    try {
      const dropped = await collectDroppedContent(e.dataTransfer);
      if (!dropped.files.length && !dropped.folders.length) return;
      const isFolderDrop = dropped.folders.length > 0 || dropped.files.some(x => x.rel.includes('/'));
      let hadFailure;
      if (isFolderDrop) {
        hadFailure = await uploadFolderStructure(dropped.files, targetId, dropped.folders);
      } else {
        hadFailure = await uploadWithProgress(dropped.files.map(x => x.file), targetId);
      }
      hideUploadProgress();
      loadFiles(state.currentParentId);
      if (!hadFailure) showToast('Upload selesai');
    } catch (err) {
      hideUploadProgress();
      showToast(err.message || 'Gagal membaca folder yang dijatuhkan');
    }
  });

  // Cegah browser membuka/menavigasi file yang di-drop (capture phase window
  // agar berjalan sebelum default action), mis. folder yang di-drag. Tanpa
  // stopPropagation supaya handler upload di container tetap menerima event.
  window.addEventListener('dragover', (e) => { e.preventDefault(); }, true);
  window.addEventListener('drop', (e) => { e.preventDefault(); }, true);
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}

function setupDropOverlay() {
  const overlay = document.getElementById('dropOverlay');
  if (!overlay) return;

  let dragDepth = 0;
  const hide = () => {
    dragDepth = 0;
    overlay.classList.add('hidden');
  };

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (state.view === 'trash') return;
    const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    if (hasFiles) {
      dragDepth++;
      overlay.classList.remove('hidden');
    }
  }, true);

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (dragDepth > 0) dragDepth--;
    if (dragDepth <= 0) hide();
  }, true);

  window.addEventListener('drop', hide, true);
  window.addEventListener('dragend', hide, true);
}

// Init
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    applyTheme(saved);
    return;
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  }
}

async function initAuthCheck() {
  try {
    const res = await fetch(`${API_BASE}/config`, { headers: authHeaders() });
    if (res.status === 401) {
      setToken('');
      location.href = '/login';
      return false;
    }
    const cfg = await res.json();
    if (cfg.auth_required && !getToken()) {
      location.href = '/login';
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  const ok = await initAuthCheck();
  if (!ok) return;

  const savedView = localStorage.getItem('viewMode') || 'list';
  setViewMode(savedView);

  loadFiles(null);
  setupDragAndDrop();
  setupDropOverlay();

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.querySelector('.sidebar nav').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-view]');
    if (!li) return;
    document.querySelectorAll('.sidebar nav li').forEach(i => i.classList.remove('active'));
    li.classList.add('active');
    if (li.dataset.view === 'trash') {
      loadTrash();
    } else {
      loadFiles(null);
    }
  });

  document.getElementById('clearSelectionBtn').addEventListener('click', () => {
    state.selected = [];
    renderFiles(state.files);
    updateSelectionBar();
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    state.clipboard = { ids: [...state.selected], action: 'copy' };
    showToast('Disalin. Tekan Ctrl+V untuk tempel.');
  });

  document.getElementById('cutBtn').addEventListener('click', () => {
    state.clipboard = { ids: [...state.selected], action: 'move' };
    showToast('Memotong. Tekan Ctrl+V untuk tempel.');
  });

  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (state.selected.length === 0) return;
    if (state.view === 'trash') {
      const ok = await showCustomConfirm('Hapus Permanen', `Apakah Anda yakin ingin menghapus permanen ${state.selected.length} item dari Trash? File di Telegram juga akan dihapus.`);
      if (!ok) return;
      let success = 0;
      const failed = [];
      for (const id of state.selected) {
        try {
          await permanentDeleteFile(id);
          success++;
        } catch (err) {
          failed.push(err.message);
        }
      }
      state.selected = [];
      loadTrash();
      showToast(failed.length === 0 ? `${success} item dihapus permanen` : `${success} dihapus, ${failed.length} gagal`);
      return;
    }
    const ok = await showCustomConfirm('Hapus Item', `Apakah Anda yakin ingin menghapus ${state.selected.length} item yang dipilih?`);
    if (!ok) return;
    await runBatchDelete([...state.selected]);
  });

  document.getElementById('restoreSelBtn').addEventListener('click', async () => {
    if (state.selected.length === 0) return;
    let success = 0;
    const failed = [];
    for (const id of state.selected) {
      try {
        await restoreFile(id);
        success++;
      } catch (err) {
        failed.push(err.message);
      }
    }
    state.selected = [];
    refreshCurrentView();
    showToast(failed.length === 0 ? `${success} item dipulihkan` : `${success} dipulihkan, ${failed.length} gagal`);
  });

  document.getElementById('restoreAllBtn').addEventListener('click', async () => {
    const ok = await showCustomConfirm('Pulihkan Semua', 'Pulihkan seluruh item dari Trash?', 'Pulihkan', 'primary');
    if (!ok) return;
    try {
      await restoreAllFromTrash();
      showToast('Seluruh item dipulihkan');
      loadTrash();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('emptyTrashBtn').addEventListener('click', async () => {
    const ok = await showCustomConfirm('Kosongkan Trash', 'Semua item di Trash akan dihapus permanen. File di Telegram juga akan ikut terhapus. Lanjutkan?', 'Kosongkan');
    if (!ok) return;
    try {
      await emptyTrash();
      showToast('Trash dikosongkan');
      loadTrash();
    } catch (err) {
      showToast(err.message);
    }
  });

   document.getElementById('uploadBtn').addEventListener('click', triggerUpload);

  document.getElementById('uploadFolderBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.onchange = async (e) => {
      if (!e.target.files || e.target.files.length === 0) return;
      try {
        const items = Array.from(e.target.files).map(f => ({ file: f, rel: f.webkitRelativePath || f.name }));
        const hadFailure = await uploadFolderStructure(items, state.currentParentId);
        if (!hadFailure) showToast('Upload folder selesai');
        loadFiles(state.currentParentId);
      } catch (err) {
        hideUploadProgress();
        showToast(err.message);
      }
    };
    input.click();
  });

  document.getElementById('uploadCancelBtn').addEventListener('click', () => {
    if (uploadSession.active) cancelUpload();
  });

  document.getElementById('newFolderBtn').addEventListener('click', async () => {
    const name = await showCustomPrompt('Buat Folder Baru', 'Folder Baru', 'Beri nama untuk folder baru Anda.');
    if (name) {
      createFolder(name, state.currentParentId).then(() => loadFiles(state.currentParentId));
    }
  });

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);

  let searchTimeout = null;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);
    if (!q) {
      state.searchMode = false;
      state.searchQuery = '';
      loadFiles(state.currentParentId);
      return;
    }
    state.searchMode = true;
    state.searchQuery = q;
    searchTimeout = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Gagal mencari');
        const files = await res.json();
        renderSearchResults(files);
      } catch (err) {
        showToast(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);
  });

  function setViewMode(mode) {
    const container = document.getElementById('fileList');
    container.classList.toggle('list-view', mode === 'list');
    container.classList.toggle('grid-view', mode === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
    state.viewMode = mode;
    localStorage.setItem('viewMode', mode);
    renderFiles(state.files);
  }

  document.getElementById('listViewBtn').addEventListener('click', () => setViewMode('list'));
  document.getElementById('gridViewBtn').addEventListener('click', () => setViewMode('grid'));

  initMarqueeSelection();

  document.getElementById('contextMenu').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action) {
      const id = e.target.closest('.context-menu').dataset.targetId;
      handleQuickAction(action, id);
      hideContextMenu();
    }
  });

  document.addEventListener('click', hideContextMenu);

  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal').classList.add('hidden');
    }
  });

  document.getElementById('modal').querySelector('.close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
  });

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      const dlg = document.getElementById('customDialog');
      if (!dlg || dlg.classList.contains('hidden')) {
        document.getElementById('modal').classList.add('hidden');
      }
    }
    if (e.key === 'Delete' && state.selected.length > 0) {
      e.preventDefault();
      const ok = await showCustomConfirm('Hapus Item', `Apakah Anda yakin ingin menghapus ${state.selected.length} item yang dipilih?`);
      if (ok) {
        await runBatchDelete([...state.selected]);
      }
    }
    if (e.key === 'F2' && state.selected.length === 1 && state.view !== 'trash') {
      e.preventDefault();
      const id = state.selected[0];
      const file = state.files.find(f => f.id === id);
      if (file) handleQuickAction('rename', id);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && state.view !== 'trash') {
      e.preventDefault();
      e.stopPropagation();
      state.selected = state.files.map(f => f.id);
      paintSelection();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && state.selected.length > 0) {
      state.clipboard = { ids: [...state.selected], action: 'copy' };
      showToast('Disalin. Tekan Ctrl+V untuk tempel.');
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x' && state.selected.length > 0) {
      state.clipboard = { ids: [...state.selected], action: 'move' };
      showToast('Memotong. Tekan Ctrl+V untuk tempel.');
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && state.clipboard && state.view !== 'trash') {
      e.preventDefault();
      const action = state.clipboard.action;
      if (action === 'copy') {
        copyFiles(state.clipboard.ids, state.currentParentId).then(() => loadFiles(state.currentParentId));
      } else if (action === 'move') {
        moveFiles(state.clipboard.ids, state.currentParentId).then(() => {
          state.clipboard = null;
          loadFiles(state.currentParentId);
        });
      }
    }
  });
});