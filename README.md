# CivicEvents+ Project

Accessible city events & services portal.

[Watch the CivicEvents demo video](https://youtu.be/OZ95K7QPz5I).

| Folder | Contents |
|--------|----------|
| [`backend/`](backend/README.md) | Provided Node.js + Express + PostgreSQL API (port 4000) |
| [`frontend/`](frontend/README.md) | HTML + Tailwind CSS + jQuery UI — **see its README for setup, backend connection and demo accounts** |
| [`video-demo/`](video-demo/README.md) | Walkthrough video link |

Quick start: set up the database and run the backend (`cd backend && npm install && npm run dev`),
then serve the frontend (`cd frontend && npx serve -l 5500 .`) and open http://localhost:5500.
The API base URL is set in `frontend/js/config.js`.
