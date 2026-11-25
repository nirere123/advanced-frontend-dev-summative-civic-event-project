/* ============================================================================
 * notifications.js — In-app notifications inbox & detail
 *   GET    /api/notifications          broadcast (recipient_id = null) + targeted to me
 *   GET    /api/notifications/:id      detail
 *   DELETE /api/notifications/:id      (admin)
 * Read/unread is tracked client-side (NoteState in api.js) because the backend
 * has no mark-as-read endpoint; updates are optimistic and reverted on failure.
 * Broadcasts are created by the backend automatically whenever an admin creates
 * an event, announcement or promo.
 * ========================================================================== */

function notifications() {
  const id = qid();
  return id ? notificationDetail(id) : notificationInbox();
}

/** Wrap in admin sidebar for admins, plain page for users. */
const notesLayout = html => isAdmin() ? adminLayout('notifications', html) : html;

function notificationInbox() {
  const admin = isAdmin();
  let all = [], filter = 'all', type = '', q = '';

  $m.html(notesLayout(`
    ${pageHeader('Notifications', 'Updates about new events, announcements and promos.', `<button id="markAllRead" class="${BTN.ghost} ${BTN.sm}">✓ Mark all as read</button>`)}
    ${admin ? /* ROLE GUARD: admin-only delete form */ `
      <form id="adminDeleteForm" class="${CARD} p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_auto] items-end" aria-labelledby="adminDelTitle">
        <div><h2 id="adminDelTitle" class="font-bold text-brand mb-2">Admin · delete a notification</h2>
          <label for="delSelect" class="block text-sm font-semibold">Notification</label>
          <select id="delSelect" class="${INPUT}" required><option value="">Choose a notification…</option></select></div>
        <button class="${BTN.danger}" type="submit">Delete</button>
        <p class="text-sm text-gray-700 sm:col-span-2">Broadcasts are sent automatically when you create events, announcements or promos. Deleting removes it for every user.</p>
      </form>` : ''}
    <div class="${CARD} p-3 mb-4 flex flex-wrap gap-3 items-end">
      <div role="group" aria-label="Read filter" class="flex gap-1">
        ${[['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([k, l]) =>
          `<button data-filter="${k}" aria-pressed="${k === filter}" class="${BTN.sm} ${k === filter ? BTN.primary : BTN.ghost}">${l}</button>`).join('')}
      </div>
      <div><label for="ntype" class="block text-sm font-semibold">Type</label>
        <select id="ntype" class="${INPUT} !py-1.5"><option value="">All types</option></select></div>
      <div class="flex-1 min-w-[160px]"><label for="nq" class="block text-sm font-semibold">Search</label>
        <input id="nq" type="search" class="${INPUT} !py-1.5" placeholder="Search notifications"></div>
    </div>
    <p id="noteCount" class="text-sm text-gray-700 mb-2" aria-live="polite"></p>
    <ul id="noteList" class="space-y-2">${skelRows(5)}</ul>`));

  const visible = () => all.filter(n => {
    const read = NoteState.isRead(n);
    return (filter === 'all' || (filter === 'unread' ? !read : read))
      && (!type || n.type === type)
      && (!q || `${n.title} ${n.message}`.toLowerCase().includes(q));
  });

  const row = n => {
    const read = NoteState.isRead(n);
    return `<li class="${CARD} p-4 flex gap-3 items-start ${read ? '' : 'border-l-4 border-l-gold'}" data-row="${n.id}">
      <span class="text-2xl" aria-hidden="true">${noteIcon(n.type)}</span>
      <div class="flex-1 min-w-0">
        <a href="notifications.html?id=${n.id}" class="font-bold text-brand hover:underline" data-open="${n.id}">${esc(n.title)}</a>
        ${read ? '' : badge('New', 'gold')}<span class="sr-only">${read ? '' : ' (unread)'}</span>
        <p class="text-gray-800 line-clamp-2">${esc(n.message)}</p>
        <p class="text-xs text-gray-600 mt-1"><time datetime="${esc(n.created_at)}" title="${esc(fmtDateTime(n.created_at))}">${relTime(n.created_at)}</time>
          · ${esc(n.type)} ${n.recipient_id ? '· sent to you' : '· broadcast'}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-1">
        <button class="${BTN.ghost} ${BTN.sm}" data-toggle-read="${n.id}">${read ? 'Mark unread' : 'Mark read'}</button>
        ${admin ? `<button class="${BTN.danger} ${BTN.sm}" data-delete="${n.id}" aria-label="Delete notification ${esc(n.title)}">Delete</button>` : ''}
      </div></li>`;
  };

  const draw = () => {
    const list = visible();
    $('#noteCount').text(`${list.length} notification${list.length === 1 ? '' : 's'} · ${NoteState.unread(all)} unread`);
    $('#noteList').html(list.length ? list.map(row).join('')
      : `<li>${emptyState('🔕', filter === 'unread' ? 'No unread notifications' : 'No notifications', 'You are all caught up.')}</li>`);
    $('[data-filter]').each(function () {
      const on = $(this).data('filter') === filter;
      $(this).attr('aria-pressed', on).attr('class', `${BTN.sm} ${on ? BTN.primary : BTN.ghost}`);
    });
    $('#delSelect').html('<option value="">Choose a notification…</option>' +
      all.map(n => `<option value="${n.id}">${esc(n.title)} — ${fmtDate(n.created_at)}</option>`).join(''));
    refreshBell(all);
  };

  const load = () => api('GET', EP.notifications).done(r => {
    all = asList(r);
    const types = [...new Set(all.map(n => n.type).filter(Boolean))];
    $('#ntype').html('<option value="">All types</option>' + types.map(t => `<option>${esc(t)}</option>`).join(''));
    draw();
  }).fail(msg => errorState($('#noteList'), msg, load));

  /** Admin delete, optimistic with revert on failure. */
  const remove = async nid => {
    const n = all.find(x => x.id === nid);
    if (!n || !await confirmDialog(`Delete “${n.title}” for all users?`, { title: 'Delete notification', confirmText: 'Delete', danger: true })) return;
    const backup = all.slice();
    all = all.filter(x => x.id !== nid); draw();
    api('DELETE', EP.notifications + '/' + nid).done(() => toast('Notification deleted'))
      .fail(msg => { all = backup; draw(); fail(msg); });
  };

  $m.on('click', '[data-filter]', function () { filter = $(this).data('filter'); draw(); });
  $m.on('change', '#ntype', function () { type = this.value; draw(); });
  $m.on('input', '#nq', function () { q = this.value.trim().toLowerCase(); draw(); });
  $m.on('click', '[data-open]', function () { NoteState.markRead($(this).data('open')); });
  $m.on('click', '[data-toggle-read]', function () {
    const n = all.find(x => x.id === $(this).data('toggle-read'));
    const wasRead = NoteState.isRead(n);
    if (wasRead) NoteState.markUnread(n.id);
    else if (!NoteState.markRead(n.id)) return fail('Could not save read state on this device.'); // revert = no change
    draw();
  });
  $('#markAllRead').on('click', () => {
    if (!NoteState.markRead(all.map(n => n.id))) return fail('Could not save read state on this device.');
    draw(); toast('All notifications marked as read');
  });
  $m.on('click', '[data-delete]', function () { remove($(this).data('delete')); });
  $('#adminDeleteForm').on('submit', e => {
    e.preventDefault();
    const nid = $('#delSelect').val();
    if (!nid) return fail('Choose a notification to delete.');
    remove(nid);
  });
  load();
}

function notificationDetail(id) {
  $m.html(notesLayout(`<div class="sk h-48 rounded-xl">${loading()}</div>`));
  api('GET', EP.notifications + '/' + id).done(res => {
    const n = asItem(res), link = noteLink(n);
    NoteState.markRead(n.id); // opening a notification marks it read
    refreshBell();
    $m.html(notesLayout(`
      <nav aria-label="Breadcrumb" class="text-sm mb-4"><a class="text-brand underline" href="notifications.html">Notifications</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(n.title)}</span></nav>
      <article class="${CARD} p-6 max-w-2xl">
        <div class="flex items-start gap-3"><span class="text-4xl" aria-hidden="true">${noteIcon(n.type)}</span>
          <div><h1 class="text-2xl font-bold text-brand">${esc(n.title)}</h1>
          <p class="text-sm text-gray-700">${fmtDateTime(n.created_at)} · ${badge(n.type, 'purple')} ${n.recipient_id ? badge('Personal', 'gold') : badge('Broadcast', 'gray')}</p></div></div>
        <p class="mt-4 text-lg whitespace-pre-line">${esc(n.message)}</p>
        <div class="mt-6 flex flex-wrap gap-2">
          ${link ? `<a class="${BTN.primary}" href="${link.href}">${link.label} →</a>` : ''}
          <a class="${BTN.ghost}" href="notifications.html">Back to inbox</a>
          ${isAdmin() ? /* ROLE GUARD */ `<button id="delNote" class="${BTN.danger}">Delete</button>` : ''}
        </div>
      </article>`));
    $('#delNote').on('click', async () => {
      if (!await confirmDialog('Delete this notification for all users?', { title: 'Delete notification', confirmText: 'Delete', danger: true })) return;
      api('DELETE', EP.notifications + '/' + id).done(() => { flash('Notification deleted'); location.href = 'notifications.html'; }).fail(fail);
    });
  }).fail(msg => errorState($m, msg, () => notificationDetail(id)));
}
