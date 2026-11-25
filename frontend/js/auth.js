/* ============================================================================
 * auth.js — Login & Sign up pages
 * POST /api/auth/login   { email, password }            -> { data: { token, user } }
 * POST /api/auth/signup  { full_name, email, password }  -> 201
 * ========================================================================== */

function authShell(title, subtitle, inner) {
  return `<div class="grid md:grid-cols-2 gap-0 max-w-4xl mx-auto ${CARD} overflow-hidden">
    <div class="hidden md:flex flex-col justify-between bg-brand text-white p-8">
      <div><p class="text-gold font-bold tracking-wide uppercase text-sm">CivicEvents</p>
      <h2 class="text-3xl font-bold mt-2">Your city, <span class="text-gold">within reach.</span></h2>
      <p class="mt-3 text-purple-100">Register for community events, listen to city announcements and watch captioned promos.</p></div>
      <ul class="space-y-2 text-purple-100 text-sm"><li>✓ Accessible by keyboard &amp; screen reader</li><li>✓ Captions on every promo</li><li>✓ Instant in-app notifications</li></ul>
    </div>
    <div class="p-6 sm:p-8"><h1 class="text-2xl font-bold text-brand">${esc(title)}</h1><p class="text-gray-700 mb-6">${subtitle}</p>${inner}</div></div>`;
}

function passwordField(id, label, autocomplete) {
  return `<div class="space-y-1">
    <label for="${id}" class="block font-semibold">${esc(label)} <span class="text-red-700" aria-hidden="true">*</span></label>
    <div class="relative">
      <input id="${id}" type="password" class="${INPUT} pr-20" required aria-required="true" autocomplete="${autocomplete}" aria-describedby="${id}-err ${id === 'password' ? 'pwRules' : ''}">
      <button type="button" class="pwToggle absolute right-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand px-2 py-1"
        data-for="${id}" aria-pressed="false" aria-label="Show password">Show</button>
    </div>
    <p id="${id}-err" class="text-sm text-red-700 font-medium" aria-live="polite"></p></div>`;
}
function bindPasswordToggles() {
  $('.pwToggle').on('click', function () {
    const $i = $('#' + $(this).data('for'));
    const show = $i.attr('type') === 'password';
    $i.attr('type', show ? 'text' : 'password');
    $(this).text(show ? 'Hide' : 'Show').attr('aria-pressed', show).attr('aria-label', show ? 'Hide password' : 'Show password');
  });
}

/* ---------- Login ---------- */
function login() {
  $m.html(authShell('Welcome back', `New here? <a class="text-brand font-semibold underline" href="signup.html">Create an account</a>`, `
    <form id="loginForm" class="space-y-4" novalidate>
      ${field('email', 'Email', { type: 'email', required: true, autocomplete: 'email', value: qparam('email') || '' })}
      ${passwordField('password', 'Password', 'current-password')}
      <div class="rounded-md bg-gray-50 border p-3">
        ${toggleSwitch('remember', 'Keep me signed in on this device', false,
          'Uses localStorage so you stay signed in after closing the browser. Leave unticked on shared or public computers — the session will then end when you close the tab (sessionStorage).')}
      </div>
      <button class="${BTN.primary} w-full" type="submit">Log in</button>
    </form>`));
  bindPasswordToggles();
  $('#email').trigger('focus');

  $('#loginForm').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this); clearErrors($f);
    const email = $('#email').val().trim(), password = $('#password').val();
    let ok = true;
    if (!isEmail(email)) { setFieldError('email', 'Enter a valid email address.'); ok = false; }
    if (!password) { setFieldError('password', 'Enter your password.'); ok = false; }
    if (!ok) return focusFirstError($f);

    const $b = $f.find('[type=submit]'); setBusy($b, true, 'Signing in…');
    api('POST', EP.login, { email, password })
      .done(res => {
        const { token, user } = asItem(res);
        Auth.save(token, user, $('#remember').is(':checked'));
        flash(`Welcome back, ${user.full_name}!`);
        const back = sessionStorage.getItem('ce_after_login');
        sessionStorage.removeItem('ce_after_login');
        location.href = back && !/login|signup/.test(back) ? back : P + 'dashboard.html';
      })
      .fail((msg, xhr) => {
        setBusy($b, false);
        if (xhr && xhr.status === 401) { setFieldError('password', 'Incorrect email or password.'); $('#password').trigger('focus'); }
        fail(msg);
      });
  });
}

/* ---------- Sign up ---------- */
const PW_RULES = [
  ['len', 'At least 8 characters', p => p.length >= 8],
  ['lower', 'A lowercase letter', p => /[a-z]/.test(p)],
  ['upper', 'An uppercase letter', p => /[A-Z]/.test(p)],
  ['num', 'A number', p => /\d/.test(p)],
  ['special', 'A special character (e.g. ! @ # $)', p => /[\W_]/.test(p)]
];
const passwordScore = p => PW_RULES.filter(r => r[2](p)).length;

function signup() {
  $m.html(authShell('Create your account', `Already registered? <a class="text-brand font-semibold underline" href="login.html">Log in</a>`, `
    <form id="signupForm" class="space-y-4" novalidate>
      ${field('full_name', 'Full name', { required: true, autocomplete: 'name' })}
      ${field('email', 'Email', { type: 'email', required: true, autocomplete: 'email' })}
      ${passwordField('password', 'Password', 'new-password')}
      <div>
        <div class="h-2 rounded bg-gray-200 overflow-hidden" aria-hidden="true"><div id="pwBar" class="h-2 transition-all" style="width:0"></div></div>
        <p class="text-sm mt-1">Strength: <strong id="pwLabel" aria-live="polite">—</strong></p>
        <ul id="pwRules" class="mt-2 grid sm:grid-cols-2 gap-x-4 text-sm">
          ${PW_RULES.map(r => `<li data-rule="${r[0]}" class="text-gray-700"><span aria-hidden="true">○</span> ${r[1]}<span class="sr-only"> — not met</span></li>`).join('')}
        </ul>
      </div>
      ${passwordField('confirm_password', 'Confirm password', 'new-password')}
      <button class="${BTN.primary} w-full" type="submit">Create account</button>
    </form>`));
  bindPasswordToggles();
  $('#full_name').trigger('focus');

  $('#password').on('input', function () {
    const p = this.value, s = passwordScore(p);
    const colors = ['#e5e7eb', '#b91c1c', '#b91c1c', '#c8962e', '#7c3aed', '#15803d'];
    $('#pwBar').css({ width: (s / 5 * 100) + '%', background: colors[s] });
    $('#pwLabel').text(p ? ['Very weak', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s] : '—');
    PW_RULES.forEach(([k, , test]) => {
      const ok = test(p);
      $(`[data-rule="${k}"]`).toggleClass('text-green-800 font-medium', ok).toggleClass('text-gray-700', !ok)
        .find('span[aria-hidden]').text(ok ? '✓' : '○').end().find('.sr-only').text(ok ? ' — met' : ' — not met');
    });
  });

  $('#signupForm').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this); clearErrors($f);
    const v = id => $('#' + id).val();
    let ok = true;
    if (v('full_name').trim().length < 2) { setFieldError('full_name', 'Please enter your full name.'); ok = false; }
    if (!isEmail(v('email').trim())) { setFieldError('email', 'Enter a valid email address.'); ok = false; }
    if (passwordScore(v('password')) < 5) { setFieldError('password', 'Password must meet all the requirements below.'); ok = false; }
    if (v('password') !== v('confirm_password')) { setFieldError('confirm_password', 'Passwords do not match.'); ok = false; }
    if (!ok) return focusFirstError($f);

    const $b = $f.find('[type=submit]'); setBusy($b, true, 'Creating account…');
    // NOTE: role is never sent — new accounts are always normal users.
    api('POST', EP.signup, { full_name: v('full_name').trim(), email: v('email').trim(), password: v('password') })
      .done(() => {
        flash('Account created! Please log in with your new credentials.');
        location.href = 'login.html?email=' + encodeURIComponent(v('email').trim());
      })
      .fail((msg, xhr) => {
        setBusy($b, false);
        if (xhr && xhr.status === 409) { setFieldError('email', 'An account with this email already exists.'); $('#email').trigger('focus'); }
        fail(msg);
      });
  });
}
