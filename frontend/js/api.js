/* ============================================================================
 * api.js — data layer
 *  - EP:      every backend endpoint used by the app (matches backend/src/routes)
 *  - Auth:    global auth context { token, user: {id, full_name, email, role} }
 *  - api():   jQuery AJAX wrapper that attaches "Authorization: Bearer <token>",
 *             turns 4xx/5xx/network failures into readable messages and signs
 *             the user out when the token is expired (401).
 *  - Cache:   small sessionStorage cache for lists (promos, announcements…),
 *             automatically invalidated by any POST/PUT/PATCH/DELETE.
 *  - NoteState: per-user "read" state for notifications (optimistic UI).
 * ========================================================================== */

const API = (window.CIVIC_API_BASE || 'http://localhost:4000').replace(/\/+$/, '');

/** Link prefix: index.html lives one level above /pages. */
const P = location.pathname.includes('/pages/') ? '' : 'pages/';

const EP = {
  login: '/api/auth/login',
  signup: '/api/auth/signup',

  events: '/api/events',

  regRegister: '/api/event-registrations/register',
  regCancel: '/api/event-registrations/cancel',
  myRegs: '/api/event-registrations/my-registrations',
  attendees: id => `/api/event-registrations/event/${id}/attendees`, // admin only

  feedback: '/api/event-feedback',
  myFeedback: '/api/event-feedback/my-feedback',
  eventFeedback: id => `/api/event-feedback/event/${id}`, // admin only on the provided backend

  announcements: '/api/announcements',
  promos: '/api/promos',
  notifications: '/api/notifications',

  adminDashboard: '/api/dashboard/admin', // admin only
  myDashboard: '/api/dashboard/me',

  users: '/api/users',            // admin only
  me: '/api/users/profile/me'
};

/* ---------------------------------------------------------------------------
 * Auth context.
 * Session-only login  -> sessionStorage (cleared when the tab closes).
 * "Remember me" login -> localStorage (survives restarts, but any script on the
 * page / anyone using the device can read it — less safe on shared computers).
 * ------------------------------------------------------------------------- */
const Auth = {
  get token() {
    return localStorage.getItem('ce_token') || sessionStorage.getItem('ce_token');
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('ce_user') || sessionStorage.getItem('ce_user'));
    } catch (e) {
      return null;
    }
  },
  get persistent() {
    return !!localStorage.getItem('ce_token');
  },
  save(token, user, persist) {
    this.clear();
    const store = persist ? localStorage : sessionStorage;
    store.setItem('ce_token', token);
    store.setItem('ce_user', JSON.stringify(Auth.pick(user)));
  },
  /** Update the cached user (e.g. after a profile edit) in whichever store holds the token. */
  setUser(user) {
    const store = this.persistent ? localStorage : sessionStorage;
    store.setItem('ce_user', JSON.stringify(Auth.pick({ ...this.user, ...user })));
  },
  clear() {
    ['ce_token', 'ce_user'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    Cache.clear();
  },
  pick(u) {
    u = u || {};
    return { id: u.id, full_name: u.full_name, email: u.email, role: u.role };
  },
  /** Read the JWT "exp" claim so we can sign out before the server rejects us. */
  expired() {
    const t = this.token;
    if (!t) return false;
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 <= Date.now() : false;
    } catch (e) {
      return true; // malformed token -> treat as expired
    }
  }
};

/* ---------------------------------------------------------------------------
 * Tiny list cache (sessionStorage). Keys are API paths.
 * ------------------------------------------------------------------------- */
const Cache = {
  prefix: 'ce_cache:',
  get(key) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(this.prefix + key));
      if (hit && hit.exp > Date.now()) return hit.value;
    } catch (e) { /* ignore */ }
    return null;
  },
  set(key, value, ttlMs) {
    try {
      sessionStorage.setItem(this.prefix + key, JSON.stringify({ value, exp: Date.now() + ttlMs }));
    } catch (e) { /* storage full / disabled: caching is optional */ }
  },
  /** Remove every cached entry whose path starts with `pathPrefix`. */
  bust(pathPrefix) {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(this.prefix + pathPrefix))
      .forEach(k => sessionStorage.removeItem(k));
  },
  clear() {
    this.bust('');
  }
};

/** Convert a failed jqXHR into a human friendly message. */
function apiErrorMessage(xhr) {
  if (!xhr || xhr.status === 0) return 'Network error — cannot reach the server. Check that the backend is running and try again.';
  const body = xhr.responseJSON || {};
  if (xhr.status === 403) return body.message && !/insufficient/i.test(body.message)
    ? body.message
    : 'You do not have permission to do that. Please contact an administrator if you think this is a mistake.';
  if (Array.isArray(body.errors) && body.errors.length) return body.errors.map(e => e.message || e.msg).join(' ');
  if (xhr.status === 404) return body.message || 'Not found.';
  if (xhr.status === 409) return body.message || 'That already exists.';
  if (xhr.status === 413) return 'The file is too large for the server.';
  if (xhr.status >= 500) {
    if (/foreign key/i.test(body.message || '')) return 'This item is still linked to other records (e.g. registrations) and cannot be removed.';
    if (/File too large/i.test(body.message || '')) return 'The file is too large for the server.';
    return body.message && !/syntax|relation|column|violates/i.test(body.message)
      ? body.message
      : 'The server ran into a problem. Please try again in a moment.';
  }
  return body.message || body.error || `Request failed (${xhr.status}).`;
}

/**
 * Call the backend.
 * @param {string} method  GET | POST | PUT | PATCH | DELETE
 * @param {string} path    e.g. EP.events or EP.events + '/' + id
 * @param {object|FormData} [body]  JSON body or FormData for uploads
 * @param {object} [opts]  { onProgress(percent) } for uploads
 * @returns jQuery promise: .done(response) / .fail(message, xhr)
 */
function api(method, path, body, opts = {}) {
  const ajax = { method, url: API + path, headers: {}, dataType: 'json' };

  // Attach the bearer token to every protected request.
  if (Auth.token) ajax.headers.Authorization = 'Bearer ' + Auth.token;

  if (body instanceof FormData) {
    ajax.data = body;
    ajax.processData = false;   // let the browser build multipart/form-data
    ajax.contentType = false;
    if (opts.onProgress) {
      ajax.xhr = () => {
        const x = $.ajaxSettings.xhr();
        if (x.upload) x.upload.addEventListener('progress', ev => {
          if (ev.lengthComputable) opts.onProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        return x;
      };
    }
  } else if (body !== undefined && body !== null) {
    ajax.data = JSON.stringify(body);
    ajax.contentType = 'application/json';
  }

  // Writes make cached lists stale (e.g. creating a promo invalidates /api/promos).
  if (method !== 'GET') Cache.bust(path.split('/').slice(0, 3).join('/'));

  const d = $.Deferred();
  $.ajax(ajax)
    .done(res => d.resolve(res))
    .fail(xhr => {
      // Expired/invalid token on a protected request -> sign out with a message.
      if (xhr.status === 401 && Auth.token) {
        signOut('Your session has expired. Please log in again.');
      }
      d.reject(apiErrorMessage(xhr), xhr);
    });
  return d.promise();
}

/** GET with a short-lived cache (lists that rarely change). */
function cachedGet(path, ttlMs = 60 * 1000) {
  const hit = Cache.get(path);
  if (hit) return $.Deferred().resolve(hit).promise();
  return api('GET', path).done(res => Cache.set(path, res, ttlMs));
}

/** Backwards-compatible helper (original signature): apiRequest('/events', 'GET'). */
function apiRequest(endpoint, method = 'GET', data = null) {
  return api(method, '/api' + endpoint, data);
}

/** Normalise list / item responses ({status, data: [...]}) */
const asList = r => Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
const asItem = r => (r && r.data && !Array.isArray(r.data)) ? r.data : r;

/* ---------------------------------------------------------------------------
 * Notification read-state.
 * The provided backend has no "mark as read" endpoint, so read IDs are kept
 * per user in localStorage. UI updates optimistically.
 * ------------------------------------------------------------------------- */
const NoteState = {
  key() {
    return 'ce_read:' + ((Auth.user && Auth.user.id) || 'anon');
  },
  ids() {
    try { return new Set(JSON.parse(localStorage.getItem(this.key())) || []); } catch (e) { return new Set(); }
  },
  isRead(n) {
    return !!n.read || this.ids().has(n.id);
  },
  markRead(ids) {
    const s = this.ids();
    [].concat(ids).forEach(id => s.add(id));
    try {
      localStorage.setItem(this.key(), JSON.stringify([...s]));
      return true;
    } catch (e) {
      return false;
    }
  },
  markUnread(id) {
    const s = this.ids();
    s.delete(id);
    localStorage.setItem(this.key(), JSON.stringify([...s]));
  },
  unread(list) {
    return list.filter(n => !this.isRead(n)).length;
  }
};
