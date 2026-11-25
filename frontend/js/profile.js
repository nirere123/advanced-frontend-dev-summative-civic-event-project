/* ============================================================================
 * profile.js — My profile
 *   GET   /api/users/profile/me
 *   PATCH /api/users/profile/me   { full_name, email }   (role / is_active are rejected)
 * ========================================================================== */

function profile() {
  $m.html(`${pageHeader('My profile', 'Manage your personal details.')}<div id="profile" class="grid gap-6 lg:grid-cols-3">${skelCards(2, 'h-64')}</div>`);

  const load = () => api('GET', EP.me).done(res => {
    const u = asItem(res);
    Auth.setUser(u); // keep the global auth context in sync

    $('#profile').html(`
      <section class="${CARD} p-6 text-center" aria-labelledby="pTitle">
        <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand text-3xl font-bold text-gold" aria-hidden="true">${esc(u.full_name.trim()[0].toUpperCase())}</div>
        <h2 id="pTitle" class="mt-3 text-xl font-bold">${esc(u.full_name)}</h2>
        <p class="text-gray-700 break-all">${esc(u.email)}</p>
        <dl class="mt-4 text-left grid grid-cols-2 gap-2 text-sm">
          <dt class="font-semibold">Role</dt><dd>${badge(u.role, u.role === 'admin' ? 'ink' : 'purple')}</dd>
          <dt class="font-semibold">Status</dt><dd>${u.is_active ? badge('Active', 'green') : badge('Disabled', 'red')}</dd>
          <dt class="font-semibold">Member since</dt><dd>${fmtDate(u.created_at)}</dd>
        </dl>
        <p class="mt-4 text-xs text-gray-700">Role and account status can only be changed by the system — contact support if something looks wrong.</p>
      </section>
      <form id="profileForm" class="${CARD} p-6 space-y-4 lg:col-span-2" novalidate aria-labelledby="editTitle">
        <h2 id="editTitle" class="text-xl font-bold text-brand">Edit details</h2>
        ${field('full_name', 'Full name', { required: true, value: u.full_name, autocomplete: 'name' })}
        ${field('email', 'Email', { type: 'email', required: true, value: u.email, autocomplete: 'email', help: 'You use this email to log in.' })}
        <div class="grid sm:grid-cols-2 gap-4">
          <div><p class="font-semibold">Role</p><p class="mt-1 rounded-md border bg-gray-100 px-3 py-2 text-gray-800" aria-readonly="true">${esc(u.role)}</p></div>
          <div><p class="font-semibold">Account status</p><p class="mt-1 rounded-md border bg-gray-100 px-3 py-2 text-gray-800" aria-readonly="true">${u.is_active ? 'Active' : 'Disabled'}</p></div>
        </div>
        <div class="flex gap-2"><button class="${BTN.primary}" type="submit">Save changes</button><button class="${BTN.ghost}" type="reset">Undo changes</button></div>
      </form>`);

    $('#profileForm').on('submit', async function (e) {
      e.preventDefault();
      const $f = $(this); clearErrors($f);
      const full_name = $('#full_name').val().trim(), email = $('#email').val().trim();
      let ok = true;
      if (full_name.length < 2) { setFieldError('full_name', 'Please enter your full name.'); ok = false; }
      if (!isEmail(email)) { setFieldError('email', 'Enter a valid email address.'); ok = false; }
      if (!ok) return focusFirstError($f);
      if (full_name === u.full_name && email === u.email) return toast('Nothing to update.', 'info');

      const body = {};
      if (full_name !== u.full_name) body.full_name = full_name;
      if (email !== u.email) {
        if (!await confirmDialog(`Change your login email to ${email}? You will need to use it next time you sign in.`, { title: 'Confirm new email', confirmText: 'Change email' })) return;
        body.email = email;
      }
      const $b = $f.find('[type=submit]'); setBusy($b, true, 'Saving…');
      api('PATCH', EP.me, body).done(r => {
        Auth.setUser(asItem(r));
        toast('Profile updated');
        renderNav(); load();
      }).fail((msg, xhr) => {
        setBusy($b, false);
        if (xhr && xhr.status === 409) { setFieldError('email', 'That email is already used by another account. Please choose a different one.'); $('#email').trigger('focus'); }
        fail(msg);
      });
    });
  }).fail(msg => errorState($('#profile'), msg, load));
  load();
}
