/* CivicEvents core: config, auth state, API helper, navigation, shared helpers. Multi-page app (see pages/). */
const API = window.CIVIC_API_BASE;
const P = location.pathname.includes('/pages/') ? '' : 'pages/'; // link prefix for index vs pages/
const EP = { login:'/api/auth/login', signup:'/api/auth/register', events:'/api/events', regs:'/api/event-registrations',
  myRegs:'/api/event-registrations/my-registrations', fb:'/api/event-feedback', ann:'/api/announcements', promos:'/api/promos',
  notes:'/api/notifications', dash:'/api/dashboard/admin', users:'/api/users' };
const $m = $('#main');
const esc = s => $('<i>').text(s ?? '').html();
const abs = u => !u ? '' : /^https?:/.test(u) ? u : API + u;
const arr = r => Array.isArray(r) ? r : (r && (r.data || r.items || r.events || r.rows || r.results)) || [];
const one = r => (r && r.data && !Array.isArray(r.data)) ? r.data : r;
const fmt = d => d ? new Date(d).toLocaleString() : '';
const btn = 'rounded px-3 py-2 font-medium focus-visible:ring-2 ';
const B1 = btn + 'bg-brand text-white hover:bg-purple-900', B2 = btn + 'bg-gold text-ink hover:brightness-110', BD = btn + 'bg-red-700 text-white';
const inp = 'w-full border border-gray-400 rounded px-2 py-2';

/* ---------- auth state: token + {id, full_name, role} ---------- */
const Auth = {
  get token() { return localStorage.getItem('token') || sessionStorage.getItem('token'); },
  get user() { try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch { return null; } },
  save(t, u, persist) { this.clear(); const s = persist ? localStorage : sessionStorage; s.setItem('token', t); s.setItem('user', JSON.stringify(u)); },
  clear() { ['token', 'user'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); }
};
const isAdmin = () => Auth.user && Auth.user.role === 'admin';

function toast(msg, bad) {
  const t = $(`<div class="px-4 py-2 rounded shadow text-white ${bad ? 'bg-red-700' : 'bg-brand'}">${esc(msg)}</div>`).appendTo('#toast');
  setTimeout(() => t.fadeOut(300, () => t.remove()), 4000);
}
function logout(msg) { Auth.clear(); if (msg) toast(msg, true); location.href = P + 'login.html'; }

/* ---------- API helper: Bearer header, 401/403 handling, readable errors ---------- */
function api(method, path, body, form) {
  const o = { method, url: API + path, headers: {} };
  if (Auth.token) o.headers.Authorization = 'Bearer ' + Auth.token;
  if (form) { o.data = body; o.processData = false; o.contentType = false; }
  else if (body) { o.data = JSON.stringify(body); o.contentType = 'application/json'; }
  const d = $.Deferred();
  $.ajax(o).done(d.resolve).fail(x => {
    if (x.status === 401 && Auth.token) { logout('Session expired. Please log in again.'); }
    let m = x.status === 0 ? 'Network error – check your connection.' : x.status === 403 ? 'Forbidden: you do not have permission. Contact an admin.'
      : (x.responseJSON && (x.responseJSON.message || x.responseJSON.error)) || 'Request failed (' + x.status + ')';
    d.reject(m, x);
  });
  return d.promise();
}
const fail = m => { toast(m, true); };
const skel = n => Array.from({ length: n }, () => '<div class="sk h-28 rounded"></div>').join('');
const err = (m, retry) => $m.html(`<p role="alert" class="text-red-700">${esc(m)} <button class="${B2}" id="retry">Retry</button></p>`).find('#retry').on('click', retry);

/* ---------- navigation ---------- */
function nav() {
  const u = Auth.user, a = 'class="hover:text-gold"';
  let h = `<a ${a} href="${P}events.html">Events</a><a ${a} href="${P}announcements.html">Announcements</a><a ${a} href="${P}promos.html">Promos</a>`;
  if (u) {
    h += `<a ${a} href="${P}notifications.html" aria-label="Notifications">🔔<span id="bell" class="ml-1 bg-gold text-ink rounded-full px-2 text-xs">0</span></a>`;
    if (isAdmin()) h += `<a ${a} href="${P}dashboard.html">Dashboard</a><a ${a} href="${P}users.html">Admin: Users</a>`;
    h += `<details class="relative"><summary class="cursor-pointer text-gold">${esc(u.full_name)}</summary><div class="absolute right-0 mt-2 bg-white text-ink rounded shadow p-2 w-44 z-10 space-y-1">
      <a class="block" href="${P}profile.html">My profile</a><a class="block" href="${P}my-registrations.html">My registrations</a><button id="out" class="text-left w-full">Log out</button></div></details>`;
  } else h += `<a ${a} href="${P}login.html">Login</a><a class="${B2}" href="${P}signup.html">Sign up</a>`;
  $('#nav').html(h); $('#out').on('click', () => logout());
  if (u) api('GET', EP.notes).done(r => $('#bell').text(arr(r).filter(n => !n.is_read && !n.read).length));
}
$('#gs').on('submit', e => { e.preventDefault(); location.href = P + 'events.html?q=' + encodeURIComponent($('#q').val()); });


function field(id, label, type = 'text', extra = '') { return `<div><label for="${id}" class="block font-medium">${label}</label><input id="${id}" name="${id}" type="${type}" class="${inp}" ${extra}></div>`; }
function checkFile(f, types, mb) { if (!f) return true; if (!types.some(t => f.type.startsWith(t))) { fail('Invalid file type.'); return false; } if (f.size > mb * 1048576) { fail('File too large (max ' + mb + 'MB).'); return false; } return true; }
function mediaForm(title, key, accept, mb, ep, extra, back) {
  $m.html(`<form id="f" class="max-w-xl mx-auto space-y-3"><h1 class="text-2xl font-bold text-brand">${title}</h1>${field('title', 'Title', 'text', 'required')}${extra}${field(key, key[0].toUpperCase() + key.slice(1) + ' file (max ' + mb + 'MB)', 'file', 'accept="' + accept + '" required')}
    <label><input type="checkbox" id="published"> Published</label><progress id="pr" class="w-full hidden" max="100" value="0" aria-label="Upload progress"></progress><button class="${B1}">Upload</button></form>`);
  $('#f').on('submit', e => { e.preventDefault(); const file = $('#' + key)[0].files[0]; if (!checkFile(file, [accept.split('/')[0]], mb)) return;
    const fd = new FormData(); fd.append('title', $('#title').val()); fd.append(key, file); fd.append('published', $('#published').is(':checked')); ['description', 'caption_text'].forEach(k => $('#' + k).length && fd.append(k, $('#' + k).val()));
    $('#pr').removeClass('hidden'); $.ajax({ url: API + ep, method: 'POST', data: fd, processData: false, contentType: false, headers: { Authorization: 'Bearer ' + Auth.token },
      xhr() { const x = $.ajaxSettings.xhr(); x.upload && x.upload.addEventListener('progress', ev => $('#pr').val(ev.loaded / ev.total * 100)); return x; } })
      .done(() => { toast('Saved! Subscribers will be notified.'); location.href = back; }).fail(x => fail((x.responseJSON && x.responseJSON.message) || 'Upload failed')); });
}

/* ---------- page bootstrap + ROLE GUARDS ----------
   Every page calls boot(guard, render). The guard is enforced here on the client:
   - guard.auth  -> anonymous visitors are redirected to the login page
   - guard.admin -> logged-in non-admins see a 403 message and the page never renders
   nav() also hides admin-only links. This is UX only; the backend enforces real security. */
const qid = () => new URLSearchParams(location.search).get('id');
function boot(g, fn) {
  nav();
  if (g.auth && !Auth.token) { location.href = P + 'login.html'; return; }          // GUARD: must be logged in
  if (g.admin && !isAdmin()) { $m.html('<p role="alert" class="text-red-700 text-lg">403 – This page is for administrators only.</p>'); return; } // GUARD: admin only
  $m.html('<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">' + skel(3) + '</div>'); fn(); $m.focus();
}
