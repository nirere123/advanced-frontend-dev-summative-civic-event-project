/* ============================================================================
 * home.js — Landing page (public). Upcoming events are shown once signed in,
 * because the backend requires authentication for every content endpoint.
 * ========================================================================== */

function home() {
  const u = getCurrentUser();
  $m.html(`
    <section class="relative overflow-hidden rounded-2xl bg-ink text-white px-6 py-14 sm:px-12 text-center">
      <div class="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#5b21b6,transparent_55%),radial-gradient(circle_at_80%_80%,#c8962e,transparent_45%)]" aria-hidden="true"></div>
      <div class="relative">
        <p class="text-gold font-semibold uppercase tracking-widest text-sm">Accessible city events &amp; services</p>
        <h1 class="mt-3 text-4xl sm:text-5xl font-bold">Your city. <span class="text-gold">Your events.</span></h1>
        <p class="mt-4 max-w-xl mx-auto text-gray-200">Find community events, listen to announcements and watch captioned promos — all in one accessible place.</p>
        <div class="mt-8 flex gap-3 justify-center flex-wrap">
          ${u ? `<a class="${BTN.gold}" href="${P}events.html">Browse events</a><a class="${BTN.ghost}" href="${P}dashboard.html">${isAdmin() ? 'Admin dashboard' : 'My dashboard'}</a>`
            : `<a class="${BTN.gold}" href="${P}signup.html">Create a free account</a><a class="${BTN.ghost}" href="${P}login.html">Log in</a>`}
        </div>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-3 my-10" aria-label="Features">
      ${[['📅', 'Events', 'events.html', 'Register in one click, get reminders and share feedback.'],
         ['📢', 'Announcements', 'announcements.html', 'Listen to audio updates with transcripts.'],
         ['🎬', 'Promos', 'promos.html', 'Watch short videos with captions on by default.']]
        .map(([i, t, h, d]) => `<a href="${P}${h}" class="${CARD} p-6 lift block border-t-4 border-t-gold">
          <p class="text-3xl" aria-hidden="true">${i}</p><h2 class="mt-2 text-xl font-bold text-brand">${t}</h2><p class="text-gray-800 mt-1">${d}</p></a>`).join('')}
    </section>

    <section aria-labelledby="upTitle">
      <div class="flex items-end mb-4"><h2 id="upTitle" class="text-2xl font-bold text-brand flex-1">Upcoming events</h2>
        ${u ? `<a class="text-brand font-semibold underline" href="${P}events.html">See all</a>` : ''}</div>
      <div id="upcoming" class="grid gap-4 sm:grid-cols-3">${u ? skelCards(3, 'h-28') : emptyState('🔐', 'Log in to see upcoming events', 'Event listings are available to registered residents.', `<a class="${BTN.primary}" href="${P}login.html">Log in</a>`)}</div>
    </section>`);

  if (!u) return;
  const load = () => api('GET', EP.events).done(r => {
    const next = asList(r).filter(e => isPublished(e) && new Date(e.ends_at || e.starts_at) > new Date())
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 3);
    $('#upcoming').html(next.length ? next.map(e => `<a class="${CARD} p-4 block lift" href="${P}event-detail.html?id=${e.id}">
        <h3 class="font-bold text-lg">${esc(e.title)}</h3><p class="text-sm text-gray-700">${fmtDateTime(e.starts_at)}</p>
        <p class="text-sm text-gray-700">📍 ${esc(e.location || '')}</p></a>`).join('')
      : emptyState('📅', 'No upcoming events yet', 'Check back soon.'));
  }).fail(msg => errorState($('#upcoming'), msg, load));
  load();
}

/* ===================== Global search (header search bar) ===================== */
function search() {
  const q = (qparam('q') || '').trim(), ql = q.toLowerCase();
  $m.html(`${pageHeader(q ? `Search results for “${q}”` : 'Search', 'Events, announcements and promos.')}<div id="results">${skelRows(5)}</div>`);
  if (!q) return $('#results').html(emptyState('🔍', 'Type something in the search bar above'));

  const safe = path => api('GET', path).then(r => asList(r), () => $.Deferred().resolve([]).promise());
  const match = (...fields) => fields.join(' ').toLowerCase().includes(ql);
  $.when(safe(EP.events), safe(EP.announcements), safe(PROMO_LIST_PATH)).done((evs, anns, prs) => {
    const vis = x => isAdmin() || isPublished(x);
    const groups = [
      ['Events', '📅', evs.filter(e => vis(e) && match(e.title, e.description, e.location)), e => `event-detail.html?id=${e.id}`, e => `${fmtDateTime(e.starts_at)} · ${e.location || ''}`],
      ['Announcements', '📢', anns.filter(a => vis(a) && match(a.title)), a => `announcement-detail.html?id=${a.id}`, a => fmtDate(a.created_at)],
      ['Promos', '🎬', prs.filter(p => vis(p) && match(p.title, p.description, p.caption_text)), p => `promo-detail.html?id=${p.id}`, p => p.description || '']
    ];
    const total = groups.reduce((s, g) => s + g[2].length, 0);
    $('#results').html(`<p class="mb-4 text-gray-700" role="status">${total} result${total === 1 ? '' : 's'}</p>` + (total ? groups.filter(g => g[2].length).map(([t, icon, items, href, sub]) => `
      <section class="mb-6" aria-label="${t}"><h2 class="text-xl font-bold text-brand mb-2">${icon} ${t} <span class="text-sm text-gray-700">(${items.length})</span></h2>
      <ul class="space-y-2">${items.map(x => `<li><a class="${CARD} p-4 block lift" href="${href(x)}"><p class="font-semibold">${esc(x.title)}</p>
        <p class="text-sm text-gray-700 line-clamp-1">${esc(sub(x))}</p></a></li>`).join('')}</ul></section>`).join('')
      : emptyState('🤷', 'Nothing found', 'Try another word, or browse events directly.', `<a class="${BTN.primary}" href="events.html">Browse events</a>`)));
  });
}
const PROMO_LIST_PATH = '/api/promos?page=1&limit=100';
