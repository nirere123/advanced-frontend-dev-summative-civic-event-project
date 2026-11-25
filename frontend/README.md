# CivicEvents — Frontend

Accessible, responsive frontend for the **CivicEvents+** city events & services portal.
Built with **HTML, Tailwind CSS (CDN) and jQuery only** — no build step.

---

## 1. Quick start

### Prerequisites
| Tool | Why |
|------|-----|
| Node.js 18+ | runs the backend and a static file server |
| PostgreSQL 15+ | database used by the backend |

### Step 1 — Database
```bash
# create the database (psql or pgAdmin)
psql -U postgres -h localhost -p 5432 -c 'CREATE DATABASE "civic-events-db";'

# create tables + load demo data
cd backend
psql -U postgres -d civic-events-db -h localhost -p 5432 -f ./migrations/001_create_tables.sql
psql -U postgres -d civic-events-db -h localhost -p 5432 -f ./migrations/002_seed_data.sql
```
> On Windows, psql lives in `C:\Program Files\PostgreSQL\16\bin\` if it isn't on your PATH.

### Step 2 — Backend API
`backend/.env` must match your PostgreSQL credentials:
```env
DB_USER=postgres
DB_PASS=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=civic-events-db
JWT_SECRET=<any long random string>
```
```bash
cd backend
npm install
npm run dev          # or: npm start
```
The API listens on **http://localhost:4000** (health check: http://localhost:4000/health).
Uploaded files are served from `http://localhost:4000/uploads/...`.

### Step 3 — Frontend
The backend base URL is configured in **one place**, `frontend/js/config.js`:
```js
window.CIVIC_API_BASE = 'http://localhost:4000';   // no trailing slash, no /api
```
Serve the `frontend/` folder with any static server (opening the files via `file://` is not recommended):
```bash
cd frontend
npx serve -l 5500 .          # or: python -m http.server 5500
```
Open **http://localhost:5500**. The backend enables CORS for all origins, so any port works.
VS Code's "Live Server" extension also works.

### Demo accounts (from `002_seed_data.sql`)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@civicevents.test | Admin@1234 |
| User | jane@civicevents.test | User@1234 |

New sign-ups are always normal users.

---

## 2. Project structure
```
frontend/
├── index.html                 Landing page
├── pages/                     One HTML page per screen
│   ├── login / signup         Authentication
│   ├── dashboard              Admin dashboard (admins) · personal dashboard (users)
│   ├── users                  Admin: user management
│   ├── events / event-detail / event-form / my-registrations
│   ├── announcements / announcement-detail / announcement-form
│   ├── promos / promo-detail / promo-form
│   ├── notifications          Inbox + detail (?id=)
│   ├── profile                My profile
│   └── search                 Global search results
├── js/
│   ├── config.js              Backend base URL  ← edit this
│   ├── api.js                 Endpoints, Auth context, api() helper, cache, notification read-state
│   ├── permissions.js         ROLE GUARDS: isAdmin / isUser / requireLogin / requireAdmin
│   ├── core.js                Shared UI: nav, notification drawer, toasts, modals, forms, boot()
│   ├── auth.js  events.js  announcements.js  promos.js
│   ├── notifications.js  admin.js  profile.js  home.js
│   └── tailwind-config.js     Theme colours (purple / black / gold / white)
├── css/styles.css             Focus ring, skeletons, animations, star rating, caption styling
└── assets/logo.svg
```
Every page loads scripts in the same order: `config → api → permissions → core → page module`,
then calls `boot(guard, render)`.

---

## 3. Role-based access guards (where to find them)
| Layer | Location | What it does |
|-------|----------|--------------|
| Page guard | bottom `<script>` of every page → `boot()` in `js/core.js` | `{auth:1}` redirects anonymous users to login; `{admin:1}` shows a 403 screen to non-admins; `{guest:1}` sends signed-in users away from login/signup |
| Guard functions | `js/permissions.js` | `requireLogin()`, `requireAdmin()`, `isAdmin()`, `isUser()`, `showAdminControls()` — documented at the top of the file |
| Navigation | `renderNav()` in `js/core.js` | Dashboard/Admin links only rendered for admins |
| Components | every module, marked with `ROLE GUARD` comments | Create/Edit/Delete/Publish buttons only rendered when `isAdmin()`; Register & Feedback only when `isUser()` |

These guards are for **UX only**. The backend's `authenticate` + `authorize(['admin'])` middleware is the real
security boundary — hidden actions are still rejected with 401/403 if called directly.

Admins **cannot** change user roles from the UI (only enable/disable).

---

## 4. Auth & token handling
* Login stores `{ token, user: {id, full_name, email, role} }`.
* **Session-only (default):** `sessionStorage` — cleared when the tab closes.
* **"Keep me signed in":** `localStorage` — persists across restarts; less safe on shared computers
  because anything with access to the browser profile (or an XSS bug) can read it.
* Every protected request sends `Authorization: Bearer <token>` (see `api()` in `js/api.js`).
* The JWT `exp` claim is checked on page load and every 30 s; a 401 from the API also signs the user out
  with a "session expired" message.

---

## 5. Features → API endpoints
| Feature | Endpoints |
|---------|-----------|
| Sign up / Login | `POST /api/auth/signup`, `POST /api/auth/login` |
| Events | `GET/POST /api/events`, `GET/PUT/DELETE /api/events/:id` (multipart, file key `image`) |
| Registrations | `POST /api/event-registrations/register`, `POST /api/event-registrations/cancel`, `GET /api/event-registrations/my-registrations`, `GET /api/event-registrations/event/:id/attendees` (admin) |
| Feedback | `POST /api/event-feedback`, `PUT /api/event-feedback/:id`, `GET /api/event-feedback/my-feedback`, `GET /api/event-feedback/event/:id` (admin) |
| Announcements | `GET/POST /api/announcements` (file key `audio`), `GET/PUT/DELETE /api/announcements/:id`, `PATCH …/publish`, `PATCH …/unpublish` |
| Promos | `GET/POST /api/promos` (file key `video`, `caption_text`), `GET/PUT/DELETE /api/promos/:id`, `PATCH …/publish`, `PATCH …/unpublish` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/:id`, `DELETE /api/notifications/:id` (admin) |
| Dashboard | `GET /api/dashboard/admin` (admin), `GET /api/dashboard/me` |
| Users | `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/enable`, `PATCH /api/users/:id/disable` (admin), `GET/PATCH /api/users/profile/me` |

---

## 6. UX & accessibility highlights
* Semantic landmarks, skip link, labelled inputs, `aria-describedby` error messages, `aria-live` toasts,
  keyboard-accessible modals/drawer (focus trap, Esc to close), visible gold focus ring.
* Mobile-first responsive layouts, collapsible nav, admin sidebar that becomes tabs on small screens.
* Skeleton loaders, empty states, error states with **Retry**, button spinners, upload progress bars.
* Client-side validation (password strength meter, date ranges, file type/size checked before upload).
* Optimistic UI (delete, publish, enable/disable, mark notification read) with automatic revert on failure.
* Lists of promos/announcements cached in `sessionStorage`; any create/update/delete invalidates the cache.
* Video thumbnails lazy-loaded with `IntersectionObserver`; promos have captions **on by default** plus a transcript.
* Accessible custom audio player: play/pause, seek, ±10 s, volume, mute, speed, keyboard shortcuts.
* `prefers-reduced-motion` respected.

---

## 7. Notes about the provided backend
These are backend limitations the frontend works around (the backend was not modified):
* **Notification read state** — there is no "mark as read" endpoint, so read/unread is stored per user in
  `localStorage`.
* **Broadcast notifications** — there is no `POST /api/notifications` route; broadcasts are created by the
  backend automatically when an admin creates an event, announcement or promo.
* **Event feedback list** — `GET /api/event-feedback/event/:id` is admin-only, so normal users see their own
  review; the average rating & full list are shown to admins.
* **Event `published` flag** — sent by the form, but the backend's events model ignores it (events are always
  published).
* **Re-registering** after cancelling returns 409 (the registration row already exists); the UI explains this.
* **Announcement audio** cannot be replaced on update (backend ignores the file), so the edit form only edits
  title/published.
* Upload limits mirror the backend: images 2 MB (jpg/png/gif), audio 5 MB (mp3/wav/m4a/ogg), video 8 MB (mp4/mov/avi/mkv).
