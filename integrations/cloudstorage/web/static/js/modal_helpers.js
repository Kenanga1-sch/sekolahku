const dialog = {
  el: () => document.getElementById('customDialog'),
  icon: () => document.getElementById('customDialogIcon'),
  title: () => document.getElementById('customDialogTitle'),
  body: () => document.getElementById('customDialogBody'),
  input: () => document.getElementById('customDialogInput'),
  submit: () => document.getElementById('customDialogSubmit'),
  cancel: () => document.getElementById('customDialogCancel'),
};

function setDialogIcon(type) {
  const icon = dialog.icon();
  icon.className = 'custom-dialog-icon' + (type === 'danger' ? ' danger' : type === 'warning' ? ' warning' : '');
  icon.innerHTML = type === 'danger'
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
    : type === 'warning'
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>';
}

function openDialog() {
  const d = dialog.el();
  d.classList.remove('hidden');
  requestAnimationFrame(() => d.classList.add('show'));
}

function closeDialog() {
  const d = dialog.el();
  d.classList.remove('show');
  setTimeout(() => d.classList.add('hidden'), 200);
}

function showCustomPrompt(title, defaultValue = '', message = '') {
  return new Promise((resolve) => {
    setDialogIcon('prompt');
    dialog.title().textContent = title;
    dialog.body().textContent = message;
    dialog.body().style.display = message ? '' : 'none';
    const input = dialog.input();
    input.style.display = '';
    input.value = defaultValue;

    const finish = (val) => { closeDialog(); resolve(val); };
    dialog.submit().className = 'custom-dialog-btn primary';
    dialog.submit().textContent = 'OK';
    dialog.submit().onclick = () => finish(input.value);
    dialog.cancel().onclick = () => finish(null);

    openDialog();
    input.focus();
    input.select();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(input.value);
      if (e.key === 'Escape') finish(null);
    };
  });
}

function showCustomConfirm(title, message, confirmText = 'Hapus', type = 'danger') {
  return new Promise((resolve) => {
    setDialogIcon(type);
    dialog.title().textContent = title;
    dialog.body().textContent = message;
    dialog.body().style.display = '';
    dialog.input().style.display = 'none';
    dialog.input().value = '';

    dialog.submit().className = 'custom-dialog-btn ' + (type === 'danger' ? 'danger' : 'primary');
    dialog.submit().textContent = confirmText;

    openDialog();
    dialog.submit().onclick = () => { closeDialog(); resolve(true); };
    dialog.cancel().onclick = () => { closeDialog(); resolve(false); };
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dialog.el().classList.contains('hidden')) {
    closeDialog();
  }
});
