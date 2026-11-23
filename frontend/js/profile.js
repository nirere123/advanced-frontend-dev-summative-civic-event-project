/* ---------- profile ---------- */
function profile() {
  const u = Auth.user;
  $m.html(`<form id="f" class="max-w-md mx-auto space-y-3"><h1 class="text-2xl font-bold text-brand">My profile</h1>${field('full_name', 'Full name')}${field('email', 'Email', 'email')}
    <p>Role: <strong>${esc(u.role)}</strong> (read-only)</p><button class="${B1}">Save changes</button></form>`); $('#full_name').val(u.full_name); $('#email').val(u.email);
  $('#f').on('submit', e => { e.preventDefault(); api('PUT', EP.users + '/' + u.id, { full_name: $('#full_name').val(), email: $('#email').val() }).done(() => {
    const nu = { ...u, full_name: $('#full_name').val(), email: $('#email').val() }; Auth.save(Auth.token, nu, !!localStorage.getItem('token')); toast('Profile updated'); nav(); })
    .fail((m, x) => fail(x && x.status === 409 ? 'That email is already in use.' : m)); });
}
