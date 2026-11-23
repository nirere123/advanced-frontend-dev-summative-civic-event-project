/* ---------- auth pages ---------- */

function login() {
  $m.html(`<form id="f" class="max-w-md mx-auto space-y-3"><h1 class="text-2xl font-bold text-brand">Login</h1>${field('email', 'Email', 'email', 'required')}${field('password', 'Password', 'password', 'required')}
  <label><input type="checkbox" id="rem"> Remember me (localStorage; less secure on shared devices)</label><button class="${B1} w-full">Login</button></form>`);
  $('#f').on('submit', e => { e.preventDefault(); const b = $('#f button').prop('disabled', true).text('Signing in...');
    api('POST', EP.login, { email: $('#email').val(), password: $('#password').val() }).done(r => {
      r = r.data || r; Auth.save(r.token, r.user, $('#rem').is(':checked')); toast('Welcome back!'); location.href = P + (isAdmin() ? 'dashboard.html' : 'events.html');
    }).fail(m => { fail(m); b.prop('disabled', false).text('Login'); }); });
}
function strength(p) { return [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter(r => r.test(p)).length; }
function signup() {
  $m.html(`<form id="f" class="max-w-md mx-auto space-y-3"><h1 class="text-2xl font-bold text-brand">Sign up</h1>${field('full_name', 'Full name', 'text', 'required')}${field('email', 'Email', 'email', 'required')}${field('password', 'Password', 'password', 'required')}
  <div class="h-2 bg-gray-200 rounded" aria-hidden="true"><div id="bar" class="h-2 rounded" style="width:0"></div></div><p id="sl" class="text-sm" aria-live="polite"></p>${field('confirm_password', 'Confirm password', 'password', 'required')}
  <button class="${B1} w-full">Create account</button></form>`);
  $('#password').on('input', function () { const s = strength(this.value); $('#bar').css({ width: s * 20 + '%', background: ['#b91c1c', '#b91c1c', '#c8962e', '#c8962e', '#5b21b6', '#15803d'][s] });
    $('#sl').text(['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s]); });
  $('#f').on('submit', e => { e.preventDefault(); const v = id => $('#' + id).val();
    if (strength(v('password')) < 5) return fail('Password needs 8+ chars, upper & lower case, a number and a special character.');
    if (v('password') !== v('confirm_password')) return fail('Passwords do not match.');
    api('POST', EP.signup, { full_name: v('full_name'), email: v('email'), password: v('password'), confirm_password: v('confirm_password') })
      .done(() => { toast('Account created! Please log in.'); location.href = P + 'login.html'; }).fail(fail); });
}

