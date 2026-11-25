/* ============================================================================
 * admin.js — Dashboards & user management
 *   GET   /api/dashboard/admin        (admin) site-wide statistics
 *   GET   /api/dashboard/me           personal statistics (any user)
 *   GET   /api/users?page=&limit=     (admin) list users
 *   GET   /api/users/:id              (admin) single user
 *   PATCH /api/users/:id/enable       (admin)
 *   PATCH /api/users/:id/disable      (admin)
 * Admins can NOT change a user's role — no control for it exists in the UI.
 * ========================================================================== */

const num = v => Number(v) || 0;

/** dashboard.html: admins get the admin dashboard, users their personal one. */
function dashboard() {
  return isAdmin() ? adminDashboard() : userDashboard(); // ROLE GUARD: choose view by role
}

/* ---------- small chart components (HTML/CSS, accessible) ---------- */
function statTile(label, value, sub = '', href = '') {
  const inner = `<p class="text-sm font-semibold text-gray-700">${esc(label)}</p>
    <p class="text-3xl font-bold text-ink mt-1 tabular-nums" data-stat>${value}</p>
    ${sub ? `<p class="text-xs text-gray-700 mt-1">${sub}</p>` : ''}`;
  return href ? `<a href="${href}" class="${CARD} p-4 block lift border-t-4 border-t-brand">${inner}</a>`
    : `<div class="${CARD} p-4 border-t-4 border-t-brand">${inner}</div>`;
}

/** Horizontal bar chart, one hue; values labelled directly; table view for screen readers. */
function hBarChart(id, title, rows) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<figure class="${CARD} p-5" aria-labelledby="${id}-t">
    <figcaption id="${id}-t" class="font-bold text-ink mb-4">${esc(title)}</figcaption>
    <div aria-hidden="true" class="space-y-3">${rows.map(([label, v]) => `
      <div class="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm group" title="${esc(label)}: ${v}">
        <span class="text-gray-800 truncate">${esc(label)}</span>
        <div class="flex items-center gap-2"><div class="h-3 rounded-r bg-brand group-hover:bg-purple-800 transition-all" style="width:${Math.max(v / max * 85, v ? 1 : 0)}%"></div>
        <span class="font-semibold tabular-nums text-ink">${v}</span></div></div>`).join('')}</div>
    ${chartTable(title, ['Item', 'Count'], rows)}</figure>`;
}

/** Vertical bar chart for a time series (user growth). */
function vBarChart(id, title, rows) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  const body = rows.length ? `<div aria-hidden="true" class="flex items-end gap-2 h-44 border-b border-gray-300 pt-6">${rows.map(([label, v]) => `
      <div class="relative flex-1 h-full flex flex-col justify-end items-center group">
        <span class="text-xs font-semibold tabular-nums mb-1">${v}</span>
        <div class="w-full max-w-[3rem] rounded-t bg-brand group-hover:bg-purple-800 transition-all" style="height:${Math.max(v / max * 100, 2)}%"></div>
        <span class="pointer-events-none absolute -top-2 hidden group-hover:block whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-white shadow">${esc(label)}: ${v} new</span>
      </div>`).join('')}</div>
    <div aria-hidden="true" class="flex gap-2 mt-1">${rows.map(([label]) => `<span class="flex-1 text-center text-xs text-gray-700">${esc(label)}</span>`).join('')}</div>`
    : '<p class="text-gray-700">No sign-ups in the last 6 months.</p>';
  return `<figure class="${CARD} p-5" aria-labelledby="${id}-t"><figcaption id="${id}-t" class="font-bold text-ink">${esc(title)}</figcaption>
    ${body}${chartTable(title, ['Month', 'New users'], rows)}</figure>`;
}

/** Two-part split bar (e.g. active vs disabled) with legend + labels. */
function splitBar(id, title, [aLabel, a], [bLabel, b]) {
  const total = a + b || 1;
  return `<figure class="${CARD} p-5" aria-labelledby="${id}-t"><figcaption id="${id}-t" class="font-bold text-ink mb-4">${esc(title)}</figcaption>
    <div aria-hidden="true" class="flex h-4 gap-[2px] rounded overflow-hidden bg-white">
      <div class="bg-brand" style="width:${a / total * 100}%" title="${esc(aLabel)}: ${a}"></div>
      <div class="bg-gray-400" style="width:${b / total * 100}%" title="${esc(bLabel)}: ${b}"></div></div>
    <ul class="flex flex-wrap gap-4 mt-3 text-sm" aria-hidden="true">
      <li class="flex items-center gap-2"><span class="h-3 w-3 rounded-sm bg-brand"></span>${esc(aLabel)} <strong>${a}</strong> (${Math.round(a / total * 100)}%)</li>
      <li class="flex items-center gap-2"><span class="h-3 w-3 rounded-sm bg-gray-400"></span>${esc(bLabel)} <strong>${b}</strong> (${Math.round(b / total * 100)}%)</li></ul>
    ${chartTable(title, ['Group', 'Count'], [[aLabel, a], [bLabel, b]])}</figure>`;
}

/** Data table behind every chart: hidden visually, toggleable, read by screen readers. */
function chartTable(caption, head, rows) {
  return `<details class="mt-3 text-sm"><summary class="cursor-pointer text-brand font-semibold">Show data table</summary>
    <table class="mt-2 w-full text-left"><caption class="sr-only">${esc(caption)}</caption>
    <thead><tr>${head.map(h => `<th scope="col" class="border-b p-1">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row" class="p-1 font-normal">${esc(r[0])}</th><td class="p-1 tabular-nums">${r[1]}</td></tr>`).join('')}</tbody></table></details>`;
}

/* ===================== Admin dashboard ===================== */
function adminDashboard() {
  let timer;
  $m.html(adminLayout('dashboard', `
    ${pageHeader('Admin dashboard', 'Live overview of the CivicEvents platform.',
      `<span id="updated" class="self-center text-sm text-gray-700" aria-live="polite"></span><button id="refresh" class="${BTN.ghost} ${BTN.sm}">↻ Refresh</button>`)}
    <div id="dash">${'<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">' + skelCards(8, 'h-28') + '</div>'}${loading('Loading dashboard')}</div>`));

  const load = () => {
    $('#refresh').prop('disabled', true);
    $.when(api('GET', EP.adminDashboard), api('GET', EP.notifications).then(r => asList(r), () => $.Deferred().resolve([]).promise()))
      .done((res, notes) => {
        const d = asItem(res) || {};
        const u = d.users || {}, ev = d.events || {};
        const s = {
          users: num(u.total_users), active: num(u.active_users), inactive: num(u.inactive_users),
          events: num(ev.total_events), upcoming: num(ev.upcoming_events), past: num(ev.past_events),
          regs: num((d.registrations || {}).total_registrations), feedback: num((d.feedbacks || {}).total_feedback),
          promos: num((d.promos || {}).total_promos), ann: num((d.announcements || {}).total_announcements),
          notes: num((d.notifications || {}).total_notifications), unread: NoteState.unread(notes)
        };
        const growth = (d.user_growth || []).map(g => [
          new Date(g.month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), num(g.new_users)]);

        $('#dash').html(`
          <div class="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
            ${statTile('Total events', s.events, `${s.upcoming} upcoming · ${s.past} past`, 'events.html')}
            ${statTile('Registrations', s.regs, 'across all events')}
            ${statTile('Users', s.users, `${s.active} active · ${s.inactive} disabled`, 'users.html')}
            ${statTile('Unread notifications', s.unread, `of ${s.notes} total`, 'notifications.html')}
            ${statTile('Promos', s.promos, 'video promos', 'promos.html')}
            ${statTile('Announcements', s.ann, 'audio announcements', 'announcements.html')}
            ${statTile('Feedback received', s.feedback, 'event reviews')}
            ${statTile('Avg. registrations / event', s.events ? (s.regs / s.events).toFixed(1) : '0', 'engagement')}
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            ${hBarChart('content', 'Platform activity (totals)', [['Events', s.events], ['Registrations', s.regs], ['Feedback', s.feedback], ['Promos', s.promos], ['Announcements', s.ann], ['Notifications', s.notes]])}
            ${vBarChart('growth', 'New users per month (last 6 months)', growth)}
            ${splitBar('accounts', 'Account status', ['Active', s.active], ['Disabled', s.inactive])}
            ${splitBar('timing', 'Events by timing', ['Upcoming', s.upcoming], ['Past / other', Math.max(0, s.events - s.upcoming)])}
          </div>`);
        $('#updated').text('Updated ' + fmtTime(new Date()));
      })
      .fail(msg => errorState($('#dash'), msg, load))
      .always(() => $('#refresh').prop('disabled', false));
  };
  $('#refresh').on('click', load);
  load();
  // Charts update when data changes: poll every 60s while the tab is visible.
  timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
  $(window).on('beforeunload', () => clearInterval(timer));
}

/* ===================== Personal dashboard (normal user) ===================== */
function userDashboard() {
  const u = getCurrentUser();
  $m.html(`${pageHeader(`Hello, ${u.full_name.split(' ')[0]} 👋`, 'Here is what is happening for you.')}
    <div id="dash" class="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">${skelCards(4, 'h-28')}</div>
    <section aria-labelledby="nextTitle"><h2 id="nextTitle" class="text-xl font-bold text-brand mb-3">Your upcoming events</h2>
      <div id="next" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${skelCards(3, 'h-24')}</div></section>`);

  const load = () => {
    api('GET', EP.myDashboard).done(res => {
      const d = asItem(res) || {};
      $('#dash').html(
        statTile('Events registered', num((d.registrations || {}).total_registered_events), '', 'my-registrations.html') +
        statTile('Feedback given', num((d.feedbacks || {}).total_feedbacks)) +
        statTile('Announcements', num((d.announcements || {}).total_announcements), '', 'announcements.html') +
        statTile('Promos', num((d.promos || {}).total_promos), '', 'promos.html'));
    }).fail(msg => errorState($('#dash'), msg, load));

    api('GET', EP.myRegs).done(r => {
      const next = asList(r).filter(x => x.status !== 'cancelled' && new Date(x.ends_at || x.starts_at) > new Date())
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 6);
      $('#next').html(next.length ? next.map(x => `<a href="event-detail.html?id=${x.event_id}" class="${CARD} p-4 block lift">
          <p class="font-bold text-brand">${esc(x.title)}</p><p class="text-sm text-gray-700">${fmtDateTime(x.starts_at)}</p>
          <p class="text-sm text-gray-700">📍 ${esc(x.location || '')}</p></a>`).join('')
        : emptyState('🎟️', 'No upcoming registrations', 'Find something to join this week.', `<a class="${BTN.primary}" href="events.html">Browse events</a>`));
    }).fail(msg => errorState($('#next'), msg, load));
  };
  load();
}

/* ===================== Users management (admin) ===================== */
function users() {
  const per = 10;
  let page = 1, list = [], q = '', status = 'all';
  const me = getCurrentUser();

  $m.html(adminLayout('users', `
    ${pageHeader('Users', 'Enable or disable accounts. Roles cannot be changed from the UI.')}
    <div class="${CARD} p-3 mb-4 flex flex-wrap gap-3 items-end">
      <div class="flex-1 min-w-[180px]"><label for="uq" class="block text-sm font-semibold">Search this page</label>
        <input id="uq" type="search" class="${INPUT} !py-1.5" placeholder="Name or email"></div>
      <div><label for="ustatus" class="block text-sm font-semibold">Status</label>
        <select id="ustatus" class="${INPUT} !py-1.5"><option value="all">All</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
    </div>
    <div class="${CARD} overflow-x-auto"><table class="w-full text-left text-sm">
      <caption class="sr-only">Registered users</caption>
      <thead class="bg-ink text-white"><tr>
        <th scope="col" class="p-3">Name</th><th scope="col" class="p-3">Email</th><th scope="col" class="p-3">Role</th>
        <th scope="col" class="p-3">Status</th><th scope="col" class="p-3">Joined</th><th scope="col" class="p-3"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody id="userRows"><tr><td colspan="6" class="p-3">${skelRows(5)}</td></tr></tbody></table></div>
    <nav class="flex items-center justify-center gap-3 mt-4" aria-label="Users pagination">
      <button id="prevPage" class="${BTN.ghost} ${BTN.sm}">← Prev</button><span id="pageInfo" class="text-sm" aria-live="polite"></span>
      <button id="nextPage" class="${BTN.ghost} ${BTN.sm}">Next →</button></nav>`));

  const row = u => `<tr class="border-b hover:bg-purple-50/50">
      <td class="p-3 font-semibold">${esc(u.full_name)}${me && u.id === me.id ? ' <span class="text-xs text-gray-600">(you)</span>' : ''}</td>
      <td class="p-3">${esc(u.email)}</td>
      <td class="p-3">${badge(u.role, u.role === 'admin' ? 'ink' : 'purple')}</td>
      <td class="p-3">${u.is_active ? badge('Active', 'green') : badge('Disabled', 'red')}</td>
      <td class="p-3 whitespace-nowrap">${fmtDate(u.created_at)}</td>
      <td class="p-3"><div class="flex gap-2 justify-end">
        <button class="${BTN.ghost} ${BTN.sm}" data-view="${u.id}" aria-label="View profile of ${esc(u.full_name)}">View</button>
        ${me && u.id === me.id ? '' : `<button class="${u.is_active ? BTN.danger : BTN.primary} ${BTN.sm}" data-toggle="${u.id}"
          aria-label="${u.is_active ? 'Disable' : 'Enable'} ${esc(u.full_name)}">${u.is_active ? 'Disable' : 'Enable'}</button>`}
      </div></td></tr>`;

  const draw = () => {
    const shown = list.filter(u => (!q || `${u.full_name} ${u.email}`.toLowerCase().includes(q))
      && (status === 'all' || (status === 'active' ? u.is_active : !u.is_active)));
    $('#userRows').html(shown.length ? shown.map(row).join('') : `<tr><td colspan="6" class="p-6 text-center text-gray-700">No users found.</td></tr>`);
    $('#pageInfo').text(`Page ${page}`);
    $('#prevPage').prop('disabled', page === 1);
    $('#nextPage').prop('disabled', list.length < per); // backend returns no total: a short page is the last one
  };
  const load = () => {
    $('#userRows').html(`<tr><td colspan="6" class="p-3">${skelRows(5)}</td></tr>`);
    api('GET', `${EP.users}?page=${page}&limit=${per}`).done(r => { list = asList(r); draw(); })
      .fail(msg => errorState($('#userRows').html('<tr><td colspan="6" id="uErr" class="p-3"></td></tr>').find('#uErr'), msg, load));
  };

  $('#uq').on('input', function () { q = this.value.trim().toLowerCase(); draw(); });
  $('#ustatus').on('change', function () { status = this.value; draw(); });
  $('#prevPage').on('click', () => { page--; load(); });
  $('#nextPage').on('click', () => { page++; load(); });

  // Enable / disable — optimistic toggle, reverted if the API call fails.
  $('#userRows').on('click', '[data-toggle]', async function () {
    const u = list.find(x => x.id === $(this).data('toggle')), enable = !u.is_active;
    if (!enable && !await confirmDialog(`Disable ${u.full_name}'s account?`, { title: 'Disable user', confirmText: 'Disable', danger: true })) return;
    u.is_active = enable; draw();
    api('PATCH', `${EP.users}/${u.id}/${enable ? 'enable' : 'disable'}`)
      .done(() => toast(`${u.full_name} ${enable ? 'enabled' : 'disabled'}`))
      .fail(msg => { u.is_active = !enable; draw(); fail(msg); });
  });

  $('#userRows').on('click', '[data-view]', function () {
    const uid = $(this).data('view');
    const m = openModal({ title: 'User profile', body: skelRows(3), actions: `<button class="${BTN.ghost}" data-close>Close</button>` });
    api('GET', `${EP.users}/${uid}`).done(r => {
      const u = asItem(r);
      m.$el.find('.modal-body').html(`<dl class="grid grid-cols-[7rem_1fr] gap-y-2 gap-x-3">
        <dt class="font-semibold">Name</dt><dd>${esc(u.full_name)}</dd>
        <dt class="font-semibold">Email</dt><dd class="break-all">${esc(u.email)}</dd>
        <dt class="font-semibold">Role</dt><dd>${badge(u.role, u.role === 'admin' ? 'ink' : 'purple')} <span class="text-xs text-gray-700">(read-only)</span></dd>
        <dt class="font-semibold">Status</dt><dd>${u.is_active ? badge('Active', 'green') : badge('Disabled', 'red')}</dd>
        <dt class="font-semibold">Joined</dt><dd>${fmtDateTime(u.created_at)}</dd>
        <dt class="font-semibold">Updated</dt><dd>${fmtDateTime(u.updated_at)}</dd>
        <dt class="font-semibold">User ID</dt><dd class="text-xs break-all text-gray-700">${esc(u.id)}</dd></dl>`);
    }).fail(msg => m.$el.find('.modal-body').html(`<p role="alert" class="text-red-800">${esc(msg)}</p>`));
  });
  load();
}
