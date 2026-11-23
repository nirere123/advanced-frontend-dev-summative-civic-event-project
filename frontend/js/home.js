/* Landing page: shows the next few published events. */
function home() {
  $m.html(`<section class="rounded-lg bg-brand text-white p-8 sm:p-12 text-center"><h1 class="text-3xl sm:text-5xl font-bold">Your city. <span class="text-gold">Your events.</span></h1>
    <p class="mt-3 max-w-xl mx-auto">Find accessible city events, listen to announcements and watch captioned promos – all in one place.</p>
    <div class="mt-6 flex gap-3 justify-center flex-wrap"><a class="${B2}" href="${P}events.html">Browse events</a><a class="${btn} bg-white text-ink" href="${P}signup.html">Create account</a></div></section>
    <section class="grid gap-4 sm:grid-cols-3 my-8">${[['Events', 'events', 'Register, give feedback and stay informed.'], ['Announcements', 'announcements', 'Listen to audio updates from the city.'], ['Promos', 'promos', 'Watch videos with captions and transcripts.']]
      .map(c => `<a href="${P}${c[1]}.html" class="block border-t-4 border-gold rounded shadow p-4 hover:shadow-md"><h2 class="font-bold text-brand text-xl">${c[0]}</h2><p>${c[2]}</p></a>`).join('')}</section>
    <h2 class="text-2xl font-bold text-brand mb-3">Upcoming events</h2><div id="up" class="grid gap-3 sm:grid-cols-3">${skel(3)}</div>`);
  api('GET', EP.events).done(r => $('#up').html(arr(r).filter(e => e.published !== false).slice(0, 3).map(e =>
    `<a class="block border rounded p-3 hover:shadow" href="${P}event-detail.html?id=${e.id}"><h3 class="font-bold">${esc(e.title)}</h3><p class="text-sm">${fmt(e.starts_at)} · ${esc(e.location)}</p></a>`).join('') || '<p>No events yet.</p>'))
    .fail(() => $('#up').html('<p>Could not load events. Is the backend running?</p>'));
}
