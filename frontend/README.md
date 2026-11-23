# CivicEvents – Frontend
Accessible city events & services portal. Built with **HTML, Tailwind CSS (CDN) and jQuery** only.
Purple / black / gold / white theme. All frontend code lives in this `frontend/` folder.

## Structure
```
frontend/
├── index.html            Landing page
├── pages/                One HTML page per screen (login, signup, events, event-detail, event-form,
│                         my-registrations, announcements(+detail/form), promos(+detail/form),
│                         notifications, profile, dashboard, users)
├── js/
│   ├── config.js         API base URL  <-- edit this
│   ├── core.js           Auth state, api() helper, nav, ROLE GUARDS (boot), shared helpers
│   ├── auth.js events.js announcements.js promos.js notifications.js admin.js profile.js home.js
├── css/styles.css        Focus ring + skeleton loader styles
└── assets/logo.svg
```

## Run locally
1. **Backend:** follow the backend README (`npm install`, create `.env`, run migrations/seed, `npm start`).
2. **Connect:** set the backend URL in `js/config.js`:
   ```js
   window.CIVIC_API_BASE = 'http://localhost:5000';
   ```
3. **Serve the frontend** (any static server):
   ```bash
   cd frontend
   npx serve .          # or: python3 -m http.server 5500
   ```
   Open the printed URL (e.g. http://localhost:5500). Make sure the backend allows that origin (CORS).

## Environment / config
No build step or `.env` is needed on the frontend. The only setting is `CIVIC_API_BASE` in `js/config.js`.
API endpoint paths are in the `EP` object at the top of `js/core.js` – adjust them if the backend differs.

## Role-based access guards
- `boot(guard, render)` in `js/core.js` runs on every page: `{auth:1}` redirects anonymous users to login,
  `{admin:1}` shows a 403 message to non-admins. Each page declares its guard in its own `<script>` at the bottom.
- `nav()` in `js/core.js` hides admin-only links; admin buttons (edit/delete/new) are rendered only when `isAdmin()`.
- These are UX guards only – the backend remains the source of truth for security.

## Auth & tokens
Token + `{id, full_name, role}` are stored in `sessionStorage` by default, or `localStorage` when
"Remember me" is ticked (persistent, but more exposed on shared devices). Sent as `Authorization: Bearer <token>`.
A 401 response signs the user out and redirects to login.
