/* ============================================================================
 * permissions.js — ROLE-BASED ACCESS GUARDS (client side)
 *
 * Two roles exist: "admin" and "user".
 *
 *  ADMIN  can create / edit / delete events, announcements and promos,
 *         publish / unpublish content, view event registrants and all feedback,
 *         manage users (enable / disable only — NEVER change roles),
 *         delete notifications and view the admin dashboard.
 *  USER   can view published content, register / cancel for events,
 *         leave ONE feedback per event, and manage their own profile.
 *
 * Where guards are applied:
 *  1. Page level  — every page calls boot({ auth, admin, guest }, render) in
 *                   core.js, which calls requireLogin() / requireAdmin() below
 *                   BEFORE the page renders.
 *  2. Navigation  — nav() in core.js only renders admin links when isAdmin().
 *  3. Components  — admin buttons are only rendered inside `isAdmin() ? … : ''`
 *                   branches (look for "ROLE GUARD" comments in each module),
 *                   and user-only actions (register, feedback) use isUser().
 *
 * IMPORTANT: these checks are for user experience only. The backend
 * (authenticate + authorize(['admin']) middleware) is the real security
 * boundary; anything hidden here is still rejected by the API with 401/403.
 * ========================================================================== */

/** Logged in with a token that has not expired. */
function isLoggedIn() {
  return !!Auth.token && !Auth.expired();
}

/** { id, full_name, email, role } or null */
function getCurrentUser() {
  return isLoggedIn() ? Auth.user : null;
}

/** ROLE CHECK: true only for administrators. */
function isAdmin() {
  const u = getCurrentUser();
  return !!u && u.role === 'admin';
}

/** ROLE CHECK: true for normal (non-admin) signed-in users. */
function isUser() {
  const u = getCurrentUser();
  return !!u && u.role !== 'admin';
}

/**
 * PAGE GUARD — must be signed in.
 * Anonymous visitors are sent to the login page and returned here afterwards.
 */
function requireLogin() {
  if (isLoggedIn()) return true;
  sessionStorage.setItem('ce_after_login', location.href);
  flash('Please log in to continue.', 'info');
  location.replace(P + 'login.html');
  return false;
}

/**
 * PAGE GUARD — must be an administrator.
 * Signed-in non-admins get a 403 screen with options instead of the page.
 */
function requireAdmin() {
  if (!requireLogin()) return false;
  if (isAdmin()) return true;
  $('#main').html(`
    <section class="max-w-lg mx-auto text-center py-16" role="alert">
      <p class="text-6xl font-bold text-gold" aria-hidden="true">403</p>
      <h1 class="text-2xl font-bold text-brand mt-2">Administrators only</h1>
      <p class="mt-2 text-gray-700">Your account does not have permission to open this page.
        If you need access, contact an administrator at <strong>support@civicevents.example</strong>.</p>
      <div class="mt-6 flex gap-3 justify-center flex-wrap">
        <a class="${BTN.primary}" href="${P}events.html">Browse events</a>
        <a class="${BTN.ghost}" href="${P}dashboard.html">My dashboard</a>
      </div>
    </section>`);
  return false;
}

/**
 * Show/hide static markup marked with .admin-only / .user-only / .auth-only.
 * (Dynamic markup uses isAdmin()/isUser() while rendering.)
 */
function showAdminControls(root) {
  const $r = $(root || document);
  $r.find('.admin-only').toggleClass('hidden', !isAdmin());
  $r.find('.user-only').toggleClass('hidden', !isUser());
  $r.find('.auth-only').toggleClass('hidden', !isLoggedIn());
}
