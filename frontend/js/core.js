/* ============================================================================
 * core.js — shared UI building blocks used by every page
 *   formatting helpers · buttons · toasts & flash messages · modal/confirm
 *   navigation (search, bell + unread count, profile menu, admin links)
 *   notification drawer · admin sidebar layout · form & file validation
 *   boot(): page bootstrap that applies the ROLE GUARDS from permissions.js
 * Load order on every page: config.js → api.js → permissions.js → core.js → page module
 * ========================================================================== */

const $m = $('#main');

/* ---------- formatting ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = u => !u ? '' : /^(https?:|blob:|data:)/.test(u) ? u : API + (u.startsWith('/') ? '' : '/') + u;
const fmtDateTime = d => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
const fmtTime = d => d ? new Date(d).toLocaleTimeString(undefined, { timeStyle: 'short' }) : '';
const fmtDuration = s => {
  if (!isFinite(s) || s < 0) return '0:00';
  s = Math.round(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
function relTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps = [[60, 'second'], [3600, 'minute', 60], [86400, 'hour', 3600], [604800, 'day', 86400], [Infinity, 'week', 604800]];
  for (const [limit, unit, div = 1] of steps) if (Math.abs(diff) < limit) return rtf.format(-Math.round(diff / div), unit);
  return fmtDate(d);
}
/** ISO string -> value for <input type="datetime-local"> in the user's local time. */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const truthy = v => v === true || v === 'true' || v === 1 || v === '1';
const isPublished = item => item.published === undefined || item.published === null || truthy(item.published);
const qid = () => new URLSearchParams(location.search).get('id');
const qparam = k => new URLSearchParams(location.search).get(k);

/* ---------- button styles (consistent theme: purple / black / gold / white) ---------- */
const BASE_BTN = 'inline-flex items-center justify-center gap-1 rounded-md font-semibold transition ' +
  'disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold ';
const BTN = {
  primary: BASE_BTN + 'px-4 py-2 bg-brand text-white hover:bg-purple-800',
  gold: BASE_BTN + 'px-4 py-2 bg-gold text-ink hover:brightness-110',
  ghost: BASE_BTN + 'px-4 py-2 border border-brand text-brand bg-white hover:bg-purple-50',
  danger: BASE_BTN + 'px-4 py-2 bg-red-700 text-white hover:bg-red-800',
  sm: 'text-sm !px-3 !py-1.5'
};
const INPUT = 'w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-ink placeholder-gray-500 ' +
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 aria-[invalid=true]:border-red-700';
const CARD = 'bg-white rounded-xl border border-gray-200 shadow-sm';

const badge = (text, tone = 'gray') => {
  const tones = {
    gray: 'bg-gray-100 text-gray-800', purple: 'bg-purple-100 text-purple-900', gold: 'bg-amber-100 text-amber-900',
    green: 'bg-green-100 text-green-900', red: 'bg-red-100 text-red-900', ink: 'bg-ink text-gold'
  };
  return `<span class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.gray}">${esc(text)}</span>`;
};

/* ---------- toasts & cross-page flash messages ---------- */
function toast(msg, type = 'success') {
  const styles = { success: 'bg-brand text-white', error: 'bg-red-700 text-white', info: 'bg-ink text-white' };
  const icon = { success: '✓', error: '⚠', info: 'ℹ' }[type] || '';
  const $t = $(`<div class="toast flex items-start gap-2 rounded-lg px-4 py-3 shadow-lg max-w-sm ${styles[type] || styles.info}"
      role="${type === 'error' ? 'alert' : 'status'}">
      <span aria-hidden="true">${icon}</span><p class="flex-1">${esc(msg)}</p>
      <button class="opacity-80 hover:opacity-100" aria-label="Dismiss notification">✕</button></div>`);
  $t.find('button').on('click', () => $t.remove());
  $('#toasts').append($t);
  setTimeout(() => $t.fadeOut(300, () => $t.remove()), type === 'error' ? 7000 : 4000);
}
/** Show a toast on the NEXT page load (used before redirects). */
function flash(msg, type = 'success') {
  sessionStorage.setItem('ce_flash', JSON.stringify({ msg, type }));
}
function showFlash() {
  const f = sessionStorage.getItem('ce_flash');
  if (!f) return;
  sessionStorage.removeItem('ce_flash');
  try { const { msg, type } = JSON.parse(f); toast(msg, type); } catch (e) { /* ignore */ }
}
const fail = msg => toast(msg, 'error');

let signingOut = false;
function signOut(msg) {
  if (signingOut) return;
  signingOut = true;
  Auth.clear();
  flash(msg || 'You have been logged out.', msg ? 'error' : 'info');
  location.href = P + 'login.html';
}

/* ---------- modal + confirm dialog (accessible: focus trap, Esc, restores focus) ---------- */
function openModal({ title, body, actions = '', wide = false, onClose }) {
  const opener = document.activeElement;
  const $o = $(`<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in">
    <div role="dialog" aria-modal="true" aria-labelledby="modalTitle" class="${CARD} w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-auto p-6 pop-in">
      <div class="flex items-start gap-3 mb-3">
        <h2 id="modalTitle" class="text-xl font-bold text-brand flex-1">${esc(title)}</h2>
        <button data-close class="text-gray-600 hover:text-ink text-xl leading-none" aria-label="Close dialog">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions ? `<div class="mt-6 flex flex-wrap justify-end gap-2">${actions}</div>` : ''}
    </div></div>`);
  const close = () => {
    $o.remove();
    $(document).off('keydown.modal');
    if (opener && opener.focus) opener.focus();
    if (onClose) onClose();
  };
  $o.on('click', e => { if (e.target === $o[0] || $(e.target).closest('[data-close]').length) close(); });
  $(document).on('keydown.modal', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $o.find('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])').filter(':visible');
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.last().focus(); }
      else if (!e.shiftKey && document.activeElement === f.last()[0]) { e.preventDefault(); f.first().focus(); }
    }
  });
  $('body').append($o);
  ($o.find('[data-autofocus]')[0] || $o.find('button,a,input').not('[data-close]')[0] || $o.find('[data-close]')[0]).focus();
  return { $el: $o, close };
}

/** Promise<boolean> replacement for window.confirm() */
function confirmDialog(message, { title = 'Are you sure?', confirmText = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal({
      title,
      body: `<p class="text-gray-800">${esc(message)}</p>`,
      actions: `<button class="${BTN.ghost}" data-close>Cancel</button>
                <button class="${danger ? BTN.danger : BTN.primary}" data-ok data-autofocus>${esc(confirmText)}</button>`,
      onClose: () => { if (!answered) resolve(false); }
    });
    m.$el.find('[data-ok]').on('click', () => { answered = true; m.close(); resolve(true); });
  });
}

/* ---------- loading / empty / error states ---------- */
const skelCards = (n = 3, h = 'h-64') =>
  Array.from({ length: n }, () => `<div class="sk ${h} rounded-xl" aria-hidden="true"></div>`).join('');
const skelRows = (n = 5) =>
  Array.from({ length: n }, () => `<div class="sk h-14 rounded-lg mb-2" aria-hidden="true"></div>`).join('');
const loading = (label = 'Loading…') => `<p class="sr-only" role="status">${esc(label)}</p>`;

function emptyState(icon, title, text = '', action = '') {
  return `<div class="text-center py-12 px-4 ${CARD} col-span-full">
    <p class="text-5xl" aria-hidden="true">${icon}</p>
    <h2 class="mt-3 text-lg font-bold text-ink">${esc(title)}</h2>
    ${text ? `<p class="mt-1 text-gray-700">${esc(text)}</p>` : ''}
    ${action ? `<div class="mt-4">${action}</div>` : ''}</div>`;
}
/** Render an error with a Retry button into $target (network fallback for critical loads). */
function errorState($target, msg, retry) {
  $target.html(`<div role="alert" class="col-span-full rounded-xl border border-red-300 bg-red-50 p-6 text-center">
    <p class="text-4xl" aria-hidden="true">⚠️</p>
    <p class="mt-2 font-semibold text-red-900">${esc(msg)}</p>
    ${retry ? `<button class="${BTN.primary} mt-4" data-retry>↻ Try again</button>` : ''}</div>`);
  if (retry) $target.find('[data-retry]').on('click', retry);
}
function pageHeader(title, subtitle = '', actions = '') {
  return `<div class="flex flex-wrap items-end gap-3 mb-6">
    <div class="flex-1 min-w-[200px]"><h1 class="text-2xl sm:text-3xl font-bold text-brand">${esc(title)}</h1>
    ${subtitle ? `<p class="text-gray-700 mt-1">${esc(subtitle)}</p>` : ''}</div>
    ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ''}</div>`;
}
function setBusy($btn, busy, label) {
  if (busy) {
    $btn.data('label', $btn.html()).prop('disabled', true).attr('aria-busy', 'true')
      .html(`<span class="spinner" aria-hidden="true"></span> ${esc(label || 'Working…')}`);
  } else {
    $btn.prop('disabled', false).removeAttr('aria-busy').html($btn.data('label'));
  }
}

/* ---------- forms ---------- */
/**
 * Labelled input with an error slot wired through aria-describedby.
 * opts: { type, required, value, help, attrs, placeholder, autocomplete }
 */
function field(id, label, opts = {}) {
  const { type = 'text', required = false, value = '', help = '', attrs = '', placeholder = '', autocomplete = '' } = opts;
  const described = [help ? id + '-help' : '', id + '-err'].filter(Boolean).join(' ');
  const control = type === 'textarea'
    ? `<textarea id="${id}" name="${id}" rows="${opts.rows || 4}" class="${INPUT}" aria-describedby="${described}" ${required ? 'required aria-required="true"' : ''} placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`
    : `<input id="${id}" name="${id}" type="${type}" class="${type === 'file' ? 'block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-purple-800 border border-dashed border-gray-400 rounded-md p-2' : INPUT}"
        aria-describedby="${described}" ${required ? 'required aria-required="true"' : ''} value="${esc(value)}"
        ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${attrs}>`;
  return `<div class="space-y-1">
    <label for="${id}" class="block font-semibold text-ink">${esc(label)}${required ? ' <span class="text-red-700" aria-hidden="true">*</span>' : ''}</label>
    ${control}
    ${help ? `<p id="${id}-help" class="text-sm text-gray-700">${help}</p>` : ''}
    <p id="${id}-err" class="text-sm text-red-700 font-medium" aria-live="polite"></p></div>`;
}
function setFieldError(id, msg) {
  $('#' + id).attr('aria-invalid', msg ? 'true' : 'false');
  $('#' + id + '-err').text(msg || '');
}
function clearErrors($form) {
  $form.find('[aria-invalid]').attr('aria-invalid', 'false');
  $form.find('[id$="-err"]').text('');
}
/** Focus the first field flagged invalid. */
function focusFirstError($form) {
  $form.find('[aria-invalid="true"]').first().trigger('focus');
}
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/**
 * Validate a file BEFORE uploading (type + size), mirroring backend multer limits.
 * @returns '' when valid, otherwise an error message
 */
function checkFile(file, { exts, maxMB, kind }) {
  if (!file) return '';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!exts.includes(ext)) return `Unsupported ${kind} type ".${ext}". Allowed: ${exts.join(', ')}.`;
  if (file.size > maxMB * 1024 * 1024) return `File is ${(file.size / 1048576).toFixed(1)} MB — the maximum is ${maxMB} MB.`;
  return '';
}
const FILE_RULES = { // keep in sync with backend/src/middlewares/upload.middleware.js
  image: { exts: ['jpg', 'jpeg', 'png', 'gif'], maxMB: 2, kind: 'image', accept: '.jpg,.jpeg,.png,.gif' },
  audio: { exts: ['mp3', 'wav', 'm4a', 'ogg'], maxMB: 5, kind: 'audio', accept: '.mp3,.wav,.m4a,.ogg' },
  video: { exts: ['mp4', 'mov', 'avi', 'mkv'], maxMB: 8, kind: 'video', accept: '.mp4,.mov,.avi,.mkv' }
};
function progressBar(id) {
  return `<div id="${id}" class="hidden" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
    <div class="flex justify-between text-sm mb-1"><span>Uploading…</span><span data-pct>0%</span></div>
    <div class="h-2 rounded bg-gray-200 overflow-hidden"><div data-bar class="h-2 bg-gold transition-all" style="width:0"></div></div></div>`;
}
function setProgress(id, pct) {
  const $p = $('#' + id).removeClass('hidden').attr('aria-valuenow', pct);
  $p.find('[data-bar]').css('width', pct + '%');
  $p.find('[data-pct]').text(pct + '%');
}
function toggleSwitch(id, label, checked, help = '') {
  return `<div class="flex items-start gap-3">
    <input type="checkbox" id="${id}" name="${id}" class="mt-1 h-5 w-5 accent-brand" ${checked ? 'checked' : ''} ${help ? `aria-describedby="${id}-help"` : ''}>
    <div><label for="${id}" class="font-semibold">${esc(label)}</label>${help ? `<p id="${id}-help" class="text-sm text-gray-700">${esc(help)}</p>` : ''}</div></div>`;
}

/* ---------- navigation ---------- */
function navLink(href, label, extra = '') {
  const here = location.pathname.endsWith('/' + href.split('?')[0].split('/').pop());
  return `<a href="${P}${href}" class="block rounded-md px-3 py-2 hover:bg-white/10 hover:text-gold ${here ? 'text-gold font-semibold' : ''}"
    ${here ? 'aria-current="page"' : ''} ${extra}>${label}</a>`;
}

function renderNav() {
  const u = getCurrentUser();
  let html = navLink('events.html', 'Events') + navLink('announcements.html', 'Announcements') + navLink('promos.html', 'Promos');

  if (u) {
    // ROLE GUARD: admin-only navigation entries
    if (isAdmin()) html += navLink('dashboard.html', 'Dashboard') + navLink('users.html', 'Admin');
    html += `
      <button id="bellBtn" type="button" class="relative rounded-md px-3 py-2 hover:bg-white/10 hover:text-gold text-left"
        aria-haspopup="dialog" aria-controls="drawer" aria-label="Notifications">
        <span aria-hidden="true">🔔</span><span class="md:hidden ml-1">Notifications</span>
        <span id="bellCount" class="hidden absolute -top-0.5 left-6 min-w-[1.25rem] rounded-full bg-gold px-1 text-center text-xs font-bold text-ink"></span>
      </button>
      <div class="relative" id="profileMenu">
        <button id="profileBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="profileList"
          class="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-white/10 w-full">
          <span class="grid h-7 w-7 place-items-center rounded-full bg-gold text-ink text-sm font-bold" aria-hidden="true">${esc((u.full_name || '?').trim()[0].toUpperCase())}</span>
          <span class="max-w-[9rem] truncate">${esc(u.full_name)}</span><span aria-hidden="true">▾</span>
        </button>
        <ul id="profileList" role="menu" class="hidden md:absolute right-0 mt-1 w-56 rounded-lg bg-white text-ink shadow-xl ring-1 ring-black/10 py-1 z-40">
          <li class="px-4 py-2 text-xs text-gray-700 border-b" role="none">Signed in as <strong>${esc(u.role)}</strong></li>
          <li role="none"><a role="menuitem" class="block px-4 py-2 hover:bg-purple-50" href="${P}dashboard.html">${isAdmin() ? 'Admin dashboard' : 'My dashboard'}</a></li>
          <li role="none"><a role="menuitem" class="block px-4 py-2 hover:bg-purple-50" href="${P}profile.html">My profile</a></li>
          ${isUser() ? `<li role="none"><a role="menuitem" class="block px-4 py-2 hover:bg-purple-50" href="${P}my-registrations.html">My registrations</a></li>` : ''}
          <li role="none"><a role="menuitem" class="block px-4 py-2 hover:bg-purple-50" href="${P}notifications.html">Notifications inbox</a></li>
          <li role="none"><button role="menuitem" id="logoutBtn" class="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-800">Log out</button></li>
        </ul>
      </div>`;
  } else {
    html += navLink('login.html', 'Log in') +
      `<a href="${P}signup.html" class="${BTN.gold} ${BTN.sm} md:ml-1">Sign up</a>`;
  }
  $('#nav').html(html);

  // mobile menu toggle
  $('#menuBtn').off('click').on('click', function () {
    const open = $(this).attr('aria-expanded') !== 'true';
    $(this).attr('aria-expanded', open);
    $('#nav').toggleClass('hidden', !open).toggleClass('flex', open);
  });

  // profile dropdown
  const closeMenu = () => { $('#profileList').addClass('hidden'); $('#profileBtn').attr('aria-expanded', 'false'); };
  $('#profileBtn').on('click', e => {
    e.stopPropagation();
    const open = $('#profileList').hasClass('hidden');
    $('#profileList').toggleClass('hidden', !open);
    $('#profileBtn').attr('aria-expanded', open);
    if (open) $('#profileList a').first().trigger('focus');
  });
  $(document).on('click', e => { if (!$(e.target).closest('#profileMenu').length) closeMenu(); });
  $('#profileMenu').on('keydown', e => { if (e.key === 'Escape') { closeMenu(); $('#profileBtn').trigger('focus'); } });
  $('#logoutBtn').on('click', () => signOut());

  $('#bellBtn').on('click', openDrawer);
  if (u) refreshBell();

  // global search -> search results page
  $('#globalSearch').off('submit').on('submit', e => {
    e.preventDefault();
    const q = $('#globalQ').val().trim();
    if (q) location.href = P + 'search.html?q=' + encodeURIComponent(q);
  });
  if (qparam('q') && location.pathname.endsWith('search.html')) $('#globalQ').val(qparam('q'));
}

/** Updates the unread badge in the header. */
function refreshBell(list) {
  const render = l => {
    const n = NoteState.unread(l);
    $('#bellCount').text(n > 99 ? '99+' : n).toggleClass('hidden', n === 0);
    $('#bellBtn').attr('aria-label', `Notifications, ${n} unread`);
  };
  if (list) return render(list);
  api('GET', EP.notifications).done(r => render(asList(r)));
}

/* ---------- notification drawer (slide-in panel) ---------- */
function noteIcon(type) {
  return { event: '📅', announcement: '📢', promo: '🎬', broadcast: '📣' }[type] || '🔔';
}
function noteLink(n) {
  const m = n.metadata || {};
  if (m.event_id) return { href: P + 'event-detail.html?id=' + m.event_id, label: 'Open event' };
  if (m.announcement_id) return { href: P + 'announcement-detail.html?id=' + m.announcement_id, label: 'Listen to announcement' };
  if (m.promo_id) return { href: P + 'promo-detail.html?id=' + m.promo_id, label: 'Watch promo' };
  return null;
}
function openDrawer() {
  const opener = this;
  $('#drawer').remove();
  const $d = $(`<div id="drawer" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50 fade-in" data-close></div>
    <aside role="dialog" aria-modal="true" aria-labelledby="drawerTitle"
      class="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col slide-in">
      <div class="flex items-center gap-2 bg-ink text-white px-4 py-3">
        <h2 id="drawerTitle" class="flex-1 text-lg font-bold">Notifications</h2>
        <button id="markAll" class="text-sm text-gold underline hover:no-underline">Mark all read</button>
        <button data-close class="ml-2 text-xl" aria-label="Close notifications">✕</button>
      </div>
      <div id="drawerList" class="flex-1 overflow-y-auto p-3">${skelRows(4)}${loading('Loading notifications')}</div>
      <div class="border-t p-3 text-center"><a class="text-brand font-semibold underline" href="${P}notifications.html">Open full inbox</a></div>
    </aside></div>`);
  const close = () => { $d.remove(); $(document).off('keydown.drawer'); if (opener) opener.focus(); };
  $d.on('click', '[data-close]', close);
  $(document).on('keydown.drawer', e => { if (e.key === 'Escape') close(); });
  $('body').append($d);
  $d.find('[data-close]').last().trigger('focus');

  const load = () => api('GET', EP.notifications).done(r => {
    const list = asList(r);
    refreshBell(list);
    if (!list.length) return $('#drawerList').html(emptyState('🔕', 'You are all caught up', 'New events, announcements and promos will show up here.'));
    $('#drawerList').html('<ul class="space-y-2">' + list.slice(0, 20).map(n => {
      const read = NoteState.isRead(n);
      return `<li><a href="${P}notifications.html?id=${n.id}" data-id="${n.id}"
        class="note-link block rounded-lg border p-3 hover:bg-purple-50 ${read ? 'border-gray-200' : 'border-l-4 border-l-gold border-gray-200 bg-amber-50/40'}">
        <div class="flex gap-2"><span aria-hidden="true">${noteIcon(n.type)}</span>
        <div class="flex-1 min-w-0"><p class="font-semibold truncate">${esc(n.title)}${read ? '' : ' <span class="sr-only">(unread)</span>'}</p>
        <p class="text-sm text-gray-700 line-clamp-2">${esc(n.message)}</p>
        <p class="text-xs text-gray-600 mt-1"><time datetime="${esc(n.created_at)}">${relTime(n.created_at)}</time> · ${esc(n.type)}</p></div></div></a></li>`;
    }).join('') + '</ul>');
    $('#drawerList .note-link').on('click', function () { NoteState.markRead($(this).data('id')); });
    $('#markAll').off('click').on('click', () => {
      NoteState.markRead(list.map(n => n.id)); // optimistic
      $('#drawerList .note-link').removeClass('border-l-4 border-l-gold bg-amber-50/40');
      refreshBell(list);
      toast('All notifications marked as read');
    });
  }).fail(msg => errorState($('#drawerList'), msg, load));
  load();
}

/* ---------- admin layout: left sidebar on desktop, horizontal tabs on mobile ---------- */
function adminLayout(active, inner) {
  const items = [
    ['dashboard', 'dashboard.html', '📊', 'Overview'],
    ['users', 'users.html', '👥', 'Users'],
    ['notifications', 'notifications.html', '🔔', 'Notifications'],
    ['events', 'events.html', '📅', 'Events'],
    ['announcements', 'announcements.html', '📢', 'Announcements'],
    ['promos', 'promos.html', '🎬', 'Promos']
  ];
  const quick = [['event-form.html', '+ New event'], ['announcement-form.html', '+ New announcement'], ['promo-form.html', '+ New promo']];
  return `<div class="grid gap-6 md:grid-cols-[220px_1fr]">
    <aside aria-label="Admin navigation" class="md:sticky md:top-24 self-start">
      <nav class="${CARD} p-2 flex md:flex-col gap-1 overflow-x-auto">
        <p class="hidden md:block px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-gray-600">Admin</p>
        ${items.map(([k, href, icon, label]) => `<a href="${P}${href}" ${k === active ? 'aria-current="page"' : ''}
          class="whitespace-nowrap flex items-center gap-2 rounded-md px-3 py-2 ${k === active ? 'bg-brand text-white' : 'hover:bg-purple-50 text-ink'}">
          <span aria-hidden="true">${icon}</span>${label}</a>`).join('')}
        <p class="hidden md:block px-3 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-gray-600">Create</p>
        ${quick.map(([href, label]) => `<a href="${P}${href}" class="hidden md:block rounded-md px-3 py-2 text-brand hover:bg-purple-50 font-medium">${label}</a>`).join('')}
      </nav>
    </aside>
    <div id="adminContent" class="min-w-0">${inner}</div></div>`;
}

/* ---------- page bootstrap + ROLE GUARDS ----------
 * Every HTML page ends with:  boot({ auth, admin, guest }, renderFn)
 *   guard.auth  -> requireLogin(): anonymous visitors are redirected to login
 *   guard.admin -> requireAdmin(): non-admins see a 403 screen, page never renders
 *   guard.guest -> login/signup pages: already signed-in users skip to their dashboard
 * Expired JWTs are detected here and the user is signed out with a message.
 */
function boot(guard, render) {
  guard = guard || {};
  if (Auth.token && Auth.expired()) {
    Auth.clear();
    flash('Your session has expired. Please log in again.', 'error');
    if (guard.auth) { location.replace(P + 'login.html'); return; }
  }
  renderNav();
  showFlash();

  if (guard.guest && isLoggedIn()) { location.replace(P + 'dashboard.html'); return; }
  if (guard.auth && !requireLogin()) return;   // GUARD: must be logged in
  if (guard.admin && !requireAdmin()) return;  // GUARD: must be admin

  render();

  // Sign out automatically when the token expires while the page stays open.
  if (isLoggedIn()) setInterval(() => { if (Auth.expired()) signOut('Your session has expired. Please log in again.'); }, 30000);
}
