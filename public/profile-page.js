// Profile sub-page: big avatar (upload / remove) and a display name that turns into an inline,
// expanding text field when the pencil is pressed (same motion as the mail search field).
// Self-contained: app.js passes in what it already has (api, toast, local, ...).

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_EDGE = 512;
const MAX_RAW = 5 * 1024 * 1024; // the server accepts up to ~7 MB of base64 text
const CLOSE_MS = 320;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  pencil: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  check: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  camera: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  back: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
};

/** Shrink a picked image to at most MAX_EDGE px (animated GIFs and small files are kept as they are). */
export function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !TYPES.includes(file.type)) return reject(new Error('type'));
    if (file.size > MAX_RAW) return reject(new Error('size'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const raw = String(reader.result);
      if (file.type === 'image/gif') return resolve(raw);
      const img = new Image();
      img.onerror = () => reject(new Error('read'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1 && file.size < 400 * 1024) return resolve(raw);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const out = canvas.toDataURL('image/webp', 0.88);
          resolve(/^data:image\/(?:png|jpeg|webp);base64,/.test(out) && out.length < raw.length ? out : raw);
        } catch { resolve(raw); }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * ctx = { api, toast, local, getAccount, accountLabel, onChanged, goBack }
 *  - getAccount(): { email, userCode, nickname, avatar }
 *  - onChanged({ nickname, avatar }): app.js refreshes the sidebar and its cached account
 *  - goBack(): leave the page
 * Returns { render(root) }.
 */
export function createProfilePage(ctx) {
  const { api, toast, local, getAccount, accountLabel, onChanged, goBack } = ctx;
  let root = null;
  let closeTimer = 0;

  const q = sel => root.querySelector(sel);
  const initial = account => (accountLabel(account) || 'U').trim().slice(0, 1).toUpperCase();

  function avatarHTML(account) {
    return /^data:image\//.test(account.avatar || '')
      ? `<img src="${esc(account.avatar)}" alt="">`
      : `<span class="pf-initial">${esc(initial(account))}</span>`;
  }

  function template(account) {
    const hasImage = /^data:image\//.test(account.avatar || '');
    const name = accountLabel(account);
    return `<div class="pf">
  <button type="button" class="pf-back">${ICONS.back}<span>${local('返回', '返回', 'Back')}</span></button>
  <div class="pf-card">
    <div class="pf-avatar-zone">
      <button type="button" class="pf-avatar" aria-label="${esc(local('更换头像', '更換頭像', 'Change photo'))}">
        <span class="pf-avatar-img">${avatarHTML(account)}</span>
        <span class="pf-avatar-cam">${ICONS.camera}</span>
        <span class="pf-spinner" aria-hidden="true"></span>
      </button>
      <input class="pf-file" type="file" accept="${TYPES.join(',')}" hidden>
    </div>
    <div class="pf-name-row">
      <h2 class="pf-name" title="${esc(name)}">${esc(name)}</h2>
      <input class="pf-name-input" type="text" maxlength="80" hidden autocomplete="nickname" spellcheck="false" aria-label="${esc(local('昵称', '暱稱', 'Display name'))}" placeholder="${esc(local('输入你的名字', '輸入你的名字', 'Your name'))}">
      <span class="pf-name-tools">
        <button type="button" class="icon-button pf-edit" aria-label="${esc(local('编辑名称', '編輯名稱', 'Edit name'))}">${ICONS.pencil}</button>
        <button type="button" class="icon-button pf-confirm" hidden aria-label="${esc(local('保存', '儲存', 'Save'))}">${ICONS.check}</button>
        <button type="button" class="icon-button pf-cancel" hidden aria-label="${esc(local('取消', '取消', 'Cancel'))}">${ICONS.close}</button>
      </span>
    </div>
    <p class="pf-meta">${esc(account.email || '')}</p>
    <div class="pf-actions">
      <button type="button" class="pf-btn pf-upload">${local('上传新头像', '上載新頭像', 'Upload photo')}</button>
      <button type="button" class="pf-btn ghost pf-remove" ${hasImage ? '' : 'hidden'}>${local('移除头像', '移除頭像', 'Remove photo')}</button>
    </div>
    <p class="pf-hint">${local('支持 PNG、JPEG、WEBP、GIF，大图会自动压缩。', '支援 PNG、JPEG、WEBP、GIF，大圖會自動壓縮。', 'PNG, JPEG, WEBP or GIF. Large images are resized automatically.')}</p>
  </div>
</div>`;
  }

  async function save(patch) {
    const r = await api('profile', { method: 'PATCH', body: patch });
    const next = { ...getAccount(), nickname: r.nickname ?? '', avatar: r.avatar ?? '' };
    onChanged(next);
    return next;
  }

  function paintAvatar(account) {
    q('.pf-avatar-img').innerHTML = avatarHTML(account);
    q('.pf-remove').hidden = !/^data:image\//.test(account.avatar || '');
  }

  // ---- avatar -----------------------------------------------------------
  function wireAvatar() {
    const file = q('.pf-file'), zone = q('.pf-avatar'), avatarBox = q('.pf-avatar-zone');
    const pick = () => file.click();
    zone.onclick = pick;
    q('.pf-upload').onclick = pick;

    const apply = async picked => {
      const before = getAccount();
      let data;
      try { data = await readAvatarFile(picked); } catch (e) {
        toast(e.message === 'size' ? local('图片太大了，请选择 5 MB 以内的图片', '圖片太大了，請選擇 5 MB 以內的圖片', 'That image is too large (max 5 MB).') : local('仅支持 PNG、JPEG、WEBP 或 GIF 图片', '僅支援 PNG、JPEG、WEBP 或 GIF 圖片', 'Only PNG, JPEG, WEBP or GIF images are supported.'));
        return;
      }
      paintAvatar({ ...before, avatar: data });
      avatarBox.classList.add('busy');
      try {
        const next = await save({ avatar: data });
        paintAvatar(next);
        avatarBox.classList.remove('busy');
        avatarBox.classList.remove('pf-pop'); void avatarBox.offsetWidth; avatarBox.classList.add('pf-pop');
        toast(local('头像已更新', '頭像已更新', 'Photo updated'));
      } catch (err) {
        paintAvatar(before);
        avatarBox.classList.remove('busy');
        toast(err.message);
      }
    };
    file.onchange = () => { const f = file.files[0]; file.value = ''; if (f) apply(f); };

    q('.pf-remove').onclick = async () => {
      const before = getAccount();
      avatarBox.classList.add('busy');
      try {
        const next = await save({ avatar: '' });
        paintAvatar(next);
        toast(local('已移除头像', '已移除頭像', 'Photo removed'));
      } catch (err) { paintAvatar(before); toast(err.message); }
      avatarBox.classList.remove('busy');
    };

    for (const type of ['dragenter', 'dragover']) avatarBox.addEventListener(type, e => { e.preventDefault(); avatarBox.classList.add('drop'); });
    for (const type of ['dragleave', 'drop']) avatarBox.addEventListener(type, e => { e.preventDefault(); avatarBox.classList.remove('drop'); });
    avatarBox.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) apply(f); });
  }

  // ---- name -------------------------------------------------------------
  function wireName() {
    const row = q('.pf-name-row'), nameEl = q('.pf-name'), input = q('.pf-name-input');
    const edit = q('.pf-edit'), confirm = q('.pf-confirm'), cancel = q('.pf-cancel');
    let editing = false, saving = false;
    const current = () => String(getAccount().nickname || '').trim();

    const setTools = on => { edit.hidden = on; confirm.hidden = !on; cancel.hidden = !on; };

    function open() {
      if (editing) return;
      editing = true; clearTimeout(closeTimer);
      input.value = current();
      input.hidden = false; setTools(true);
      void input.offsetWidth; // let the browser see width:0 first so the transition runs
      row.classList.add('editing');
      input.focus(); input.select();
    }

    function close() {
      if (!editing) return;
      editing = false;
      row.classList.remove('editing');
      setTools(false);
      closeTimer = setTimeout(() => { if (!editing) input.hidden = true; }, CLOSE_MS);
      edit.focus({ preventScroll: true });
    }

    async function commit() {
      if (saving) return;
      const value = input.value.trim();
      if (value === current()) return close();
      saving = true; row.classList.add('saving'); input.disabled = true; confirm.disabled = true;
      try {
        const next = await save({ nickname: value });
        nameEl.textContent = accountLabel(next);
        nameEl.title = accountLabel(next);
        paintAvatar(next);
        close();
        nameEl.classList.remove('pf-flash'); void nameEl.offsetWidth; nameEl.classList.add('pf-flash');
        toast(local('名称已更新', '名稱已更新', 'Name updated'));
      } catch (err) {
        toast(err.message);
        row.classList.remove('pf-shake'); void row.offsetWidth; row.classList.add('pf-shake');
      } finally {
        saving = false; row.classList.remove('saving'); input.disabled = false; confirm.disabled = false;
        if (editing) input.focus();
      }
    }

    edit.onclick = open;
    confirm.onclick = commit;
    cancel.onclick = close;
    nameEl.ondblclick = open;
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    };
    // leaving the field without changing anything folds it back, like the mail search
    row.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!editing || saving || row.contains(document.activeElement)) return;
        if (input.value.trim() === current()) close();
      }, 0);
    });
  }

  return {
    render(target) {
      root = target;
      clearTimeout(closeTimer);
      root.innerHTML = template(getAccount());
      q('.pf-back').onclick = goBack;
      wireAvatar();
      wireName();
    },
  };
}
