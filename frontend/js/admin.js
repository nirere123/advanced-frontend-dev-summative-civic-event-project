/* ---------- dashboard + users (admin) ---------- */
function dashboard() {
  api('GET', EP.dash).done(r => { const d = one(r), items = Object.entries(d).filter(([, v]) => typeof v === 'number'), max = Math.max(1, ...items.map(i => i[1]));
    $m.html(`<h1 class="text-2xl font-bold text-brand mb-3">Admin dashboard</h1><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">${items.map(([k, v]) => `<div class="rounded p-4 bg-brand text-white"><p class="text-sm capitalize">${esc(k.replace(/_/g, ' '))}</p><p class="text-3xl font-bold text-gold">${v}</p></div>`).join('')}</div>
    <h2 class="font-bold mt-6 mb-2">Overview</h2><div role="img" aria-label="Bar chart of dashboard totals" class="space-y-2">${items.map(([k, v]) => `<div class="flex items-center gap-2 text-sm"><span class="w-40 capitalize">${esc(k.replace(/_/g, ' '))}</span><div class="bg-gold h-4 rounded" style="width:${v / max * 70}%"></div>${v}</div>`).join('')}</div>`); }).fail(m => err(m, dashboard));
}
function users() {
  const load = () => api('GET', EP.users).done(r => { $m.html(`<h1 class="text-2xl font-bold text-brand mb-3">Users</h1><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-ink text-gold"><th class="p-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
    ${arr(r).map(u => `<tr class="border-b"><td class="p-2">${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.is_active ? 'Active' : 'Disabled'}</td><td><button class="${u.is_active ? BD : B1} tg" data-id="${u.id}" data-a="${u.is_active ? 0 : 1}">${u.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}</tbody></table></div>`);
    $('.tg').on('click', function () { api('PATCH', EP.users + '/' + $(this).data('id') + '/status', { is_active: !!$(this).data('a') }).done(() => { toast('User updated'); load(); }).fail(fail); }); }).fail(m => err(m, load)); load(); // no role editing, by design
}

