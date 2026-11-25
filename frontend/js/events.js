/* ============================================================================
 * events.js — Events, registrations & feedback
 *   GET    /api/events                         list (all logged-in users)
 *   GET    /api/events/:id                     detail
 *   POST   /api/events            (admin)      multipart, file key "image"
 *   PUT    /api/events/:id        (admin)      multipart, optional "image"
 *   DELETE /api/events/:id        (admin)
 *   POST   /api/event-registrations/register   { event_id }
 *   POST   /api/event-registrations/cancel     { event_id }
 *   GET    /api/event-registrations/my-registrations
 *   GET    /api/event-registrations/event/:id/attendees   (admin)
 *   POST   /api/event-feedback                 { event_id, rating, comment }
 *   PUT    /api/event-feedback/:id             { rating, comment }
 *   GET    /api/event-feedback/my-feedback
 *   GET    /api/event-feedback/event/:id       (admin on the provided backend)
 * ========================================================================== */

const eventImage = e => e && e.metadata && e.metadata.image_url ? abs(e.metadata.image_url) : '';

function eventTiming(e) {
  const now = Date.now(), s = new Date(e.starts_at).getTime(), end = new Date(e.ends_at || e.starts_at).getTime();
  if (end < now) return 'past';
  if (s <= now) return 'live';
  return 'upcoming';
}
const timingBadge = t => ({ past: badge('Ended', 'gray'), live: badge('Happening now', 'green'), upcoming: badge('Upcoming', 'purple') }[t]);

/** Map of event_id -> 'registered' | 'cancelled' for the current user. */
function regMap(list) {
  const m = {};
  list.forEach(r => { m[r.event_id] = r.status || 'registered'; });
  return m;
}
const myRegistrationsSafe = () => isUser()
  ? api('GET', EP.myRegs).then(r => asList(r), () => $.Deferred().resolve([]).promise())
  : $.Deferred().resolve([]).promise();

/** Register / cancel. Returns a promise; shows toasts. */
function setRegistration(eventId, register) {
  return api('POST', register ? EP.regRegister : EP.regCancel, { event_id: eventId })
    .done(() => toast(register ? 'You are registered! See it under “My registrations”.' : 'Your registration was cancelled.'))
    .fail((msg, xhr) => {
      if (register && xhr && xhr.status === 409) {
        fail('You already have a registration record for this event (registrations that were cancelled cannot be re-opened on this server).');
      } else fail(msg);
    });
}

function dateBlock(d) {
  const dt = new Date(d);
  return `<div class="rounded-lg bg-white/95 text-center px-3 py-1 shadow" aria-hidden="true">
    <p class="text-xs font-bold uppercase text-brand">${dt.toLocaleString(undefined, { month: 'short' })}</p>
    <p class="text-xl font-bold leading-none">${dt.getDate()}</p></div>`;
}

/* ===================== Events list ===================== */
function events() {
  const admin = isAdmin();
  const state = { all: [], regs: {}, page: 1, per: 6 };

  $m.html(`
    ${pageHeader('Events', 'Discover what is happening around the city.',
      admin ? `<a class="${BTN.gold}" href="event-form.html">+ New event</a>` : '' /* ROLE GUARD: create is admin-only */)}
    <form id="filters" class="${CARD} p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end" role="search" aria-label="Filter events">
      <div class="lg:col-span-2"><label for="fq" class="block text-sm font-semibold">Keyword</label>
        <input id="fq" type="search" class="${INPUT}" placeholder="Title or description"></div>
      <div><label for="floc" class="block text-sm font-semibold">Location</label><select id="floc" class="${INPUT}"><option value="">All locations</option></select></div>
      <div><label for="ffrom" class="block text-sm font-semibold">From date</label><input id="ffrom" type="date" class="${INPUT}"></div>
      <div><label for="fto" class="block text-sm font-semibold">To date</label><input id="fto" type="date" class="${INPUT}"></div>
      <div><label for="fwhen" class="block text-sm font-semibold">Show</label>
        <select id="fwhen" class="${INPUT}"><option value="upcoming">Upcoming &amp; live</option><option value="past">Past events</option><option value="all">All events</option></select></div>
      ${admin ? `<div><label for="fstatus" class="block text-sm font-semibold">Status (admin)</label>
        <select id="fstatus" class="${INPUT}"><option value="all">All</option><option value="published">Published</option><option value="draft">Drafts</option></select></div>` : ''}
      <div class="flex gap-2"><button type="reset" class="${BTN.ghost} w-full">Reset</button></div>
    </form>
    <p id="resultCount" class="text-sm text-gray-700 mb-3" aria-live="polite"></p>
    <div id="eventList" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">${skelCards(6, 'h-80')}</div>
    <nav id="pager" class="flex flex-wrap gap-2 justify-center mt-8" aria-label="Pagination"></nav>`);

  const filtered = () => {
    const q = $('#fq').val().trim().toLowerCase(), loc = $('#floc').val(), from = $('#ffrom').val(), to = $('#fto').val();
    const when = $('#fwhen').val(), status = $('#fstatus').val() || 'all';
    return state.all.filter(e => {
      const day = toLocalInput(e.starts_at).slice(0, 10), t = eventTiming(e);
      return (!q || `${e.title} ${e.description || ''} ${e.location || ''}`.toLowerCase().includes(q))
        && (!loc || e.location === loc)
        && (!from || day >= from) && (!to || day <= to)
        && (when === 'all' || (when === 'past' ? t === 'past' : t !== 'past'))
        && (status === 'all' || (status === 'published' ? isPublished(e) : !isPublished(e)));
    });
  };

  const card = e => {
    const img = eventImage(e), t = eventTiming(e), reg = state.regs[e.id];
    return `<article class="${CARD} overflow-hidden flex flex-col lift" aria-labelledby="ev-${e.id}">
      <div class="relative h-44 bg-gradient-to-br from-brand to-ink">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy" class="h-full w-full object-cover" onerror="this.remove()">` : `<div class="h-full grid place-items-center text-5xl" aria-hidden="true">📅</div>`}
        <div class="absolute top-3 left-3">${dateBlock(e.starts_at)}</div>
        <div class="absolute top-3 right-3 flex gap-1">${timingBadge(t)}${admin && !isPublished(e) ? badge('Draft', 'gold') : ''}</div>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h2 id="ev-${e.id}" class="text-lg font-bold text-ink">${esc(e.title)}</h2>
        <p class="text-sm text-gray-700 mt-1"><span aria-hidden="true">🕒</span> <time datetime="${esc(e.starts_at)}">${fmtDateTime(e.starts_at)}</time></p>
        <p class="text-sm text-gray-700"><span aria-hidden="true">📍</span> ${esc(e.location || 'Location TBA')}</p>
        <p class="text-sm text-gray-800 mt-2 line-clamp-3 flex-1">${esc(e.description || '')}</p>
        ${reg === 'registered' ? `<p class="mt-2 text-sm font-semibold text-green-800">✓ You're registered</p>` : ''}
        <div class="flex flex-wrap gap-2 pt-4">
          <a class="${BTN.primary} ${BTN.sm}" href="event-detail.html?id=${e.id}" aria-label="View ${esc(e.title)}">View</a>
          ${isUser() && t !== 'past' && reg !== 'registered' && reg !== 'cancelled'
            ? `<button class="${BTN.gold} ${BTN.sm}" data-register="${e.id}" aria-label="Register for ${esc(e.title)}">Register</button>` : ''}
          ${admin ? /* ROLE GUARD: edit/delete only rendered for admins */ `
            <a class="${BTN.ghost} ${BTN.sm}" href="event-form.html?id=${e.id}" aria-label="Edit ${esc(e.title)}">Edit</a>
            <button class="${BTN.danger} ${BTN.sm}" data-delete="${e.id}" aria-label="Delete ${esc(e.title)}">Delete</button>` : ''}
        </div>
      </div></article>`;
  };

  const draw = () => {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / state.per));
    state.page = Math.min(state.page, pages);
    const slice = list.slice((state.page - 1) * state.per, state.page * state.per);
    $('#resultCount').text(`${list.length} event${list.length === 1 ? '' : 's'} found` + (pages > 1 ? ` · page ${state.page} of ${pages}` : ''));
    $('#eventList').attr('aria-busy', 'false').html(slice.length ? slice.map(card).join('')
      : emptyState('🔍', 'No events match your filters', 'Try a different keyword, date range or location.',
        `<button class="${BTN.ghost}" data-clear>Clear filters</button>`));
    if (pages <= 1) return $('#pager').empty();
    const pbtn = (p, label, disabled, aria) => `<button class="${p === state.page && !aria ? BTN.primary : BTN.ghost} ${BTN.sm}" data-page="${p}"
      ${disabled ? 'disabled' : ''} ${p === state.page && !aria ? 'aria-current="page"' : ''} aria-label="${aria || 'Page ' + p}">${label}</button>`;
    $('#pager').html(pbtn(state.page - 1, '← Prev', state.page === 1, 'Previous page')
      + Array.from({ length: pages }, (_, i) => pbtn(i + 1, i + 1)).join('')
      + pbtn(state.page + 1, 'Next →', state.page === pages, 'Next page'));
  };

  const load = () => {
    $('#eventList').attr('aria-busy', 'true').html(skelCards(6, 'h-80'));
    $.when(api('GET', EP.events), myRegistrationsSafe()).done((evRes, regs) => {
      // Normal users only ever see published events; admins can also see drafts.
      state.all = asList(evRes).filter(e => admin || isPublished(e))
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      state.regs = regMap(regs);
      const locs = [...new Set(state.all.map(e => e.location).filter(Boolean))].sort();
      $('#floc').html('<option value="">All locations</option>' + locs.map(l => `<option>${esc(l)}</option>`).join(''));
      draw();
    }).fail(msg => errorState($('#eventList'), msg, load));
  };

  $('#filters').on('input change', 'input,select', () => { state.page = 1; draw(); })
    .on('submit', e => e.preventDefault())
    .on('reset', () => setTimeout(() => { state.page = 1; draw(); }));
  $('#fq').val(qparam('q') || ''); // keyword from the global search bar
  $('#eventList').on('click', '[data-clear]', () => $('#filters')[0].reset());
  $('#pager').on('click', '[data-page]', function () {
    state.page = +$(this).data('page'); draw();
    $('#resultCount')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#eventList').on('click', '[data-register]', function () {
    const id = $(this).data('register'), $b = $(this);
    setBusy($b, true, 'Registering…');
    setRegistration(id, true).done(() => { state.regs[id] = 'registered'; draw(); }).fail(() => setBusy($b, false));
  });
  $('#eventList').on('click', '[data-delete]', async function () {
    const id = $(this).data('delete'), ev = state.all.find(e => e.id === id);
    if (!await confirmDialog(`Delete “${ev.title}”? This cannot be undone.`, { title: 'Delete event', confirmText: 'Delete', danger: true })) return;
    const backup = state.all.slice();
    state.all = state.all.filter(e => e.id !== id); draw(); // optimistic
    api('DELETE', EP.events + '/' + id).done(() => toast('Event deleted'))
      .fail(msg => { state.all = backup; draw(); fail(msg); }); // revert on failure
  });
  load();
}

/* ===================== Event detail ===================== */
function starString(n) {
  const r = Math.round(n);
  return `<span aria-hidden="true" class="text-gold tracking-tight">${'★'.repeat(r)}<span class="text-gray-300">${'★'.repeat(5 - r)}</span></span>`;
}

function eventDetail(id) {
  if (!id) return errorState($m, 'No event selected.', () => location.href = 'events.html');
  $m.html(`<div class="sk h-72 rounded-xl mb-6"></div><div class="sk h-8 w-2/3 rounded mb-3"></div><div class="sk h-24 rounded">${loading()}</div>`);

  api('GET', EP.events + '/' + id).done(res => {
    const e = asItem(res), img = eventImage(e), t = eventTiming(e);
    if (!isAdmin() && !isPublished(e)) return errorState($m, 'This event is not available.', null);
    document.title = e.title + ' · CivicEvents';
    const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location || '');

    $m.html(`
      <nav aria-label="Breadcrumb" class="text-sm mb-4"><a class="text-brand underline" href="events.html">Events</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(e.title)}</span></nav>
      <article class="grid gap-8 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-6">
          <div class="${CARD} overflow-hidden">
            ${img ? `<img src="${esc(img)}" alt="Event image for ${esc(e.title)}" class="w-full max-h-[420px] object-cover" onerror="this.remove()">`
              : `<div class="h-48 bg-gradient-to-br from-brand to-ink grid place-items-center text-6xl" aria-hidden="true">📅</div>`}
            <div class="p-6">
              <div class="flex flex-wrap gap-2 mb-2">${timingBadge(t)}${isAdmin() ? (isPublished(e) ? badge('Published', 'green') : badge('Draft', 'gold')) : ''}</div>
              <h1 class="text-3xl font-bold text-brand">${esc(e.title)}</h1>
              <div class="mt-4 prose max-w-none whitespace-pre-line text-gray-900">${esc(e.description || 'No description provided.')}</div>
            </div>
          </div>
          <section id="feedbackSection" class="${CARD} p-6" aria-labelledby="fbTitle">
            <h2 id="fbTitle" class="text-xl font-bold text-brand">Feedback</h2><div id="fbBody" class="mt-3">${skelRows(2)}</div>
          </section>
          ${isAdmin() ? `<section class="${CARD} p-6" aria-labelledby="attTitle">
            <h2 id="attTitle" class="text-xl font-bold text-brand">Registrants <span class="text-sm font-normal text-gray-700">(admin only)</span></h2>
            <div id="attendees" class="mt-3">${skelRows(3)}</div></section>` : ''}
        </div>
        <aside class="space-y-4">
          <div class="${CARD} p-6 space-y-3 lg:sticky lg:top-24">
            <h2 class="font-bold text-lg">When &amp; where</h2>
            <p><span class="font-semibold">Starts:</span> <time datetime="${esc(e.starts_at)}">${fmtDateTime(e.starts_at)}</time></p>
            <p><span class="font-semibold">Ends:</span> <time datetime="${esc(e.ends_at)}">${fmtDateTime(e.ends_at)}</time></p>
            <p><span class="font-semibold">Location:</span> ${esc(e.location || 'TBA')}</p>
            ${e.location ? `<a class="text-brand font-semibold underline" href="${mapUrl}" target="_blank" rel="noopener">Open in Google Maps<span class="sr-only"> (opens in a new tab)</span> ↗</a>` : ''}
            <div id="regBox" class="pt-3 border-t"></div>
            ${isAdmin() ? /* ROLE GUARD */ `<div class="pt-3 border-t flex flex-wrap gap-2">
              <a class="${BTN.ghost} ${BTN.sm}" href="event-form.html?id=${e.id}">Edit event</a>
              <button id="delEvent" class="${BTN.danger} ${BTN.sm}">Delete</button></div>` : ''}
          </div>
        </aside>
      </article>`);

    renderRegistration(e, t);
    renderFeedback(e);
    if (isAdmin()) renderAttendees(e.id);

    $('#delEvent').on('click', async () => {
      if (!await confirmDialog(`Delete “${e.title}”? This cannot be undone.`, { title: 'Delete event', confirmText: 'Delete', danger: true })) return;
      api('DELETE', EP.events + '/' + e.id).done(() => { flash('Event deleted'); location.href = 'events.html'; }).fail(fail);
    });
  }).fail(msg => errorState($m, msg, () => eventDetail(id)));
}

function renderRegistration(e, timing) {
  const $box = $('#regBox');
  if (isAdmin()) return $box.html('<p class="text-sm text-gray-700">Admins manage events; registration is for residents.</p>');
  if (!isUser()) return $box.html(`<a class="${BTN.primary} w-full" href="login.html">Log in to register</a>`);

  $box.html('<div class="sk h-10 rounded"></div>');
  myRegistrationsSafe().then(regs => {
    const status = regMap(regs)[e.id];
    if (status === 'registered') {
      $box.html(`<p class="font-semibold text-green-800 mb-2">✓ You're registered for this event.</p>
        ${timing !== 'past' ? `<button id="regBtn" class="${BTN.danger} w-full">Cancel registration</button>` : ''}`);
    } else if (status === 'cancelled') {
      $box.html(`<p class="text-gray-800">You cancelled your registration for this event.</p>`);
    } else if (timing === 'past') {
      $box.html(`<p class="text-gray-700">This event has ended.</p>`);
    } else {
      $box.html(`<button id="regBtn" class="${BTN.gold} w-full">Register for this event</button>`);
    }
    $('#regBtn').on('click', async function () {
      const registering = status !== 'registered';
      if (!registering && !await confirmDialog('Cancel your registration for this event?', { title: 'Cancel registration', confirmText: 'Yes, cancel it', danger: true })) return;
      setBusy($(this), true, registering ? 'Registering…' : 'Cancelling…');
      setRegistration(e.id, registering).always(() => renderRegistration(e, timing));
    });
  });
}

function renderAttendees(eventId) {
  const load = () => api('GET', EP.attendees(eventId)).done(r => {
    const list = asList(r);
    $('#attendees').html(list.length ? `<p class="text-sm text-gray-700 mb-2">${list.length} registered</p>
      <div class="overflow-x-auto"><table class="w-full text-left text-sm"><caption class="sr-only">Registered attendees</caption>
      <thead class="bg-gray-100"><tr><th scope="col" class="p-2">Name</th><th scope="col" class="p-2">Email</th><th scope="col" class="p-2">Registered</th></tr></thead>
      <tbody>${list.map(a => `<tr class="border-b"><td class="p-2">${esc(a.full_name)}</td><td class="p-2">${esc(a.email)}</td><td class="p-2">${fmtDateTime(a.created_at)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="text-gray-700">No one has registered yet.</p>');
  }).fail(msg => errorState($('#attendees'), msg, load));
  load();
}

function renderFeedback(e) {
  const $b = $('#fbBody');
  // All feedback (admin on the provided backend). Users fall back to their own entry on 403.
  const allReq = api('GET', EP.eventFeedback(e.id)).then(r => asList(r), () => $.Deferred().resolve(null).promise());
  const mineReq = isUser()
    ? api('GET', EP.myFeedback).then(r => asList(r).find(f => f.event_id === e.id) || null, () => $.Deferred().resolve(null).promise())
    : $.Deferred().resolve(null).promise();

  $.when(allReq, mineReq).done((all, mine) => {
    let html = '';
    if (all) {
      const avg = all.length ? all.reduce((s, f) => s + Number(f.rating || 0), 0) / all.length : 0;
      const dist = [5, 4, 3, 2, 1].map(n => [n, all.filter(f => +f.rating === n).length]);
      html += `<div class="flex flex-wrap items-center gap-6 mb-4">
        <div><p class="text-4xl font-bold">${all.length ? avg.toFixed(1) : '–'}<span class="text-lg text-gray-700">/5</span></p>
          <p class="text-xl">${starString(avg)}<span class="sr-only">Average rating ${avg.toFixed(1)} out of 5</span></p>
          <p class="text-sm text-gray-700">${all.length} review${all.length === 1 ? '' : 's'}</p></div>
        <div class="flex-1 min-w-[180px] space-y-1" aria-hidden="true">${dist.map(([n, c]) => `<div class="flex items-center gap-2 text-sm"><span class="w-6">${n}★</span>
          <div class="flex-1 h-2 bg-gray-200 rounded"><div class="h-2 bg-gold rounded" style="width:${all.length ? c / all.length * 100 : 0}%"></div></div><span class="w-6 text-right">${c}</span></div>`).join('')}</div></div>
        <ul class="space-y-3">${all.map(f => `<li class="border rounded-lg p-3"><div class="flex flex-wrap gap-2 items-center">
          <strong>${esc(f.full_name || 'Attendee')}</strong>${starString(f.rating)}<span class="sr-only">${f.rating} out of 5</span>
          <span class="text-xs text-gray-600 ml-auto">${fmtDate(f.created_at)}</span></div>
          ${f.comment ? `<p class="mt-1 text-gray-900">${esc(f.comment)}</p>` : ''}</li>`).join('') || '<li class="text-gray-700">No feedback yet.</li>'}</ul>`;
    } else {
      html += `<p class="text-sm text-gray-700 mb-3">Overall ratings are shared with event organisers.</p>`;
    }

    if (isUser()) {
      html += mine
        ? `<div class="mt-5 rounded-lg bg-purple-50 border border-purple-200 p-4" id="myFb">
            <h3 class="font-bold">Your feedback</h3><p class="text-xl">${starString(mine.rating)}<span class="sr-only">${mine.rating} out of 5</span></p>
            ${mine.comment ? `<p class="mt-1">${esc(mine.comment)}</p>` : ''}
            <button id="editFb" class="${BTN.ghost} ${BTN.sm} mt-3">Edit my feedback</button>
            <p class="text-xs text-gray-700 mt-2">You can leave one review per event.</p></div>`
        : `<div class="mt-5" id="fbFormWrap">${feedbackForm()}</div>`;
    }
    $b.html(html);
    bindFeedbackForm(e, mine);
    $('#editFb').on('click', () => { $('#myFb').replaceWith(`<div class="mt-5" id="fbFormWrap">${feedbackForm(mine)}</div>`); bindFeedbackForm(e, mine); $('#fbComment').trigger('focus'); });
  });
}

function feedbackForm(existing) {
  const r = existing ? +existing.rating : 0;
  return `<form id="fbForm" class="space-y-3 border-t pt-4" novalidate>
    <h3 class="font-bold">${existing ? 'Edit your feedback' : 'Leave feedback'}</h3>
    <fieldset><legend class="font-semibold">Rating <span class="text-red-700" aria-hidden="true">*</span></legend>
      <div class="stars" role="radiogroup" aria-describedby="rating-err">
        ${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="star${n}" value="${n}" ${r === n ? 'checked' : ''}><label for="star${n}" title="${n} star${n > 1 ? 's' : ''}"><span aria-hidden="true">★</span><span class="sr-only">${n} star${n > 1 ? 's' : ''}</span></label>`).join('')}
      </div><p id="rating-err" class="text-sm text-red-700 font-medium" aria-live="polite"></p></fieldset>
    ${field('fbComment', 'Comment', { type: 'textarea', rows: 3, value: existing ? existing.comment : '', placeholder: 'What did you enjoy? What could be better?', attrs: 'maxlength="1000"' })}
    <button class="${BTN.primary}" type="submit">${existing ? 'Update feedback' : 'Submit feedback'}</button></form>`;
}

function bindFeedbackForm(e, existing) {
  $('#fbForm').on('submit', function (ev) {
    ev.preventDefault();
    const rating = +$('input[name=rating]:checked').val(), comment = $('#fbComment').val().trim();
    $('#rating-err').text(rating ? '' : 'Please choose a rating from 1 to 5 stars.');
    if (!rating) return $('#star5').trigger('focus');
    const $btn = $(this).find('[type=submit]'); setBusy($btn, true, 'Saving…');
    const req = existing
      ? api('PUT', EP.feedback + '/' + existing.id, { rating, comment })
      : api('POST', EP.feedback, { event_id: e.id, rating, comment });
    req.done(() => { toast(existing ? 'Feedback updated' : 'Thanks for your feedback!'); renderFeedback(e); })
      .fail((msg, xhr) => {
        setBusy($btn, false);
        fail(xhr && xhr.status === 409 ? 'You have already left feedback for this event.' : msg);
        if (xhr && xhr.status === 409) renderFeedback(e);
      });
  });
}

/* ===================== Event create / edit (admin) ===================== */
function eventForm(id) {
  const render = (e = {}) => {
    const img = eventImage(e);
    $m.html(adminLayout('events', `
      ${pageHeader(id ? 'Edit event' : 'New event', id ? 'Update the details below and save.' : 'Fill in the details. A notification is broadcast to all users when an event is created.')}
      <form id="eventForm" class="${CARD} p-6 space-y-5 max-w-3xl" novalidate>
        ${field('title', 'Title', { required: true, value: e.title || '', attrs: 'maxlength="200"' })}
        ${field('description', 'Description', { type: 'textarea', rows: 5, value: e.description || '' })}
        ${field('location', 'Location', { required: true, value: e.location || '', placeholder: 'e.g. City Hall, Main Square' })}
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('starts_at', 'Starts', { type: 'datetime-local', required: true, value: toLocalInput(e.starts_at) })}
          ${field('ends_at', 'Ends', { type: 'datetime-local', required: true, value: toLocalInput(e.ends_at) })}
        </div>
        ${toggleSwitch('published', 'Published', id ? isPublished(e) : true, 'Published events are visible to all residents.')}
        <div class="grid gap-4 sm:grid-cols-[1fr_200px] items-start">
          ${field('image', 'Event image', { type: 'file', attrs: `accept="${FILE_RULES.image.accept}"`, help: `JPG, PNG or GIF, up to ${FILE_RULES.image.maxMB} MB.${id ? ' Leave empty to keep the current image.' : ''}` })}
          <figure class="rounded-lg border bg-gray-50 h-36 grid place-items-center overflow-hidden">
            <img id="preview" src="${esc(img)}" alt="Image preview" class="${img ? '' : 'hidden'} h-full w-full object-cover">
            <figcaption id="noPreview" class="text-sm text-gray-600 ${img ? 'hidden' : ''}">No image selected</figcaption>
          </figure>
        </div>
        ${progressBar('uploadProgress')}
        <div class="flex flex-wrap gap-2 pt-2">
          <button type="submit" class="${BTN.primary}">${id ? 'Save changes' : 'Create event'}</button>
          <a href="${id ? 'event-detail.html?id=' + id : 'events.html'}" class="${BTN.ghost}">Cancel</a>
        </div>
      </form>`));

    // Image preview + validation before upload
    $('#image').on('change', function () {
      const f = this.files[0], err = checkFile(f, FILE_RULES.image);
      setFieldError('image', err);
      if (f && !err) {
        $('#preview').attr('src', URL.createObjectURL(f)).removeClass('hidden');
        $('#noPreview').addClass('hidden');
      } else if (err) this.value = '';
    });

    $('#eventForm').on('submit', function (ev) {
      ev.preventDefault();
      const $f = $(this); clearErrors($f);
      const val = k => $('#' + k).val().trim();
      let ok = true;
      if (!val('title')) { setFieldError('title', 'Title is required.'); ok = false; }
      if (!val('location')) { setFieldError('location', 'Location is required.'); ok = false; }
      if (!val('starts_at')) { setFieldError('starts_at', 'Start date and time are required.'); ok = false; }
      if (!val('ends_at')) { setFieldError('ends_at', 'End date and time are required.'); ok = false; }
      if (val('starts_at') && val('ends_at') && new Date(val('ends_at')) <= new Date(val('starts_at'))) { setFieldError('ends_at', 'The event must end after it starts.'); ok = false; }
      const file = $('#image')[0].files[0], fileErr = checkFile(file, FILE_RULES.image);
      if (fileErr) { setFieldError('image', fileErr); ok = false; }
      if (!ok) return focusFirstError($f);

      const fd = new FormData();
      fd.append('title', val('title'));
      fd.append('description', val('description'));
      fd.append('location', val('location'));
      fd.append('starts_at', new Date(val('starts_at')).toISOString()); // send timezone-aware ISO
      fd.append('ends_at', new Date(val('ends_at')).toISOString());
      fd.append('published', $('#published').is(':checked'));
      if (file) fd.append('image', file); // multer: uploadEventImage.single('image')

      const $btn = $f.find('[type=submit]'); setBusy($btn, true, 'Saving…');
      api(id ? 'PUT' : 'POST', EP.events + (id ? '/' + id : ''), fd, { onProgress: p => file && setProgress('uploadProgress', p) })
        .done(res => {
          const saved = asItem(res);
          flash(id ? 'Event updated successfully.' : 'Event created — residents have been notified.');
          location.href = 'event-detail.html?id=' + ((saved && saved.id) || id);
        })
        .fail(msg => { setBusy($btn, false); $('#uploadProgress').addClass('hidden'); fail(msg); });
    });
  };

  if (!id) return render();
  $m.html(adminLayout('events', skelRows(6)));
  api('GET', EP.events + '/' + id).done(r => render(asItem(r))).fail(msg => errorState($m, msg, () => eventForm(id)));
}

/* ===================== My registrations (user) ===================== */
function myRegistrations() {
  let tab = 'upcoming', all = [];
  $m.html(`${pageHeader('My registrations', 'Events you have signed up for.', `<a class="${BTN.gold}" href="events.html">Find more events</a>`)}
    <div role="tablist" aria-label="Registration filter" class="flex flex-wrap gap-2 mb-4">
      ${[['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']].map(([k, l]) =>
        `<button role="tab" data-tab="${k}" aria-selected="${k === tab}" class="tab ${BTN.sm} ${k === tab ? BTN.primary : BTN.ghost}">${l} <span data-count="${k}"></span></button>`).join('')}
    </div>
    <div id="regList" role="tabpanel">${skelRows(4)}</div>`);

  const bucket = r => r.status === 'cancelled' ? 'cancelled' : (eventTiming(r) === 'past' ? 'past' : 'upcoming');
  const draw = () => {
    ['upcoming', 'past', 'cancelled'].forEach(k => $(`[data-count="${k}"]`).text(`(${all.filter(r => bucket(r) === k).length})`));
    $('[data-tab]').each(function () {
      const on = $(this).data('tab') === tab;
      $(this).attr('aria-selected', on).attr('class', `tab ${BTN.sm} ${on ? BTN.primary : BTN.ghost}`);
    });
    const list = all.filter(r => bucket(r) === tab).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    $('#regList').html(list.length ? `<ul class="space-y-3">${list.map(r => `
      <li class="${CARD} p-4 flex flex-wrap items-center gap-4">
        ${dateBlock(r.starts_at)}
        <div class="flex-1 min-w-[200px]"><a class="text-lg font-bold text-brand underline" href="event-detail.html?id=${r.event_id}">${esc(r.title)}</a>
          <p class="text-sm text-gray-700">${fmtDateTime(r.starts_at)} · ${esc(r.location || '')}</p>
          <p class="text-xs text-gray-600">Registered ${fmtDate(r.created_at)}</p></div>
        ${r.status === 'cancelled' ? badge('Cancelled', 'red') : tab === 'upcoming'
          ? `<button class="${BTN.danger} ${BTN.sm}" data-cancel="${r.event_id}">Cancel</button>` : badge('Attended', 'gray')}
      </li>`).join('')}</ul>`
      : emptyState(tab === 'cancelled' ? '🗂️' : '🎟️', tab === 'upcoming' ? 'No upcoming registrations' : `No ${tab} registrations`,
        tab === 'upcoming' ? 'Browse events and register for something you like.' : '',
        tab === 'upcoming' ? `<a class="${BTN.primary}" href="events.html">Browse events</a>` : ''));
  };

  const load = () => api('GET', EP.myRegs).done(r => { all = asList(r); draw(); }).fail(msg => errorState($('#regList'), msg, load));
  $m.on('click', '[data-tab]', function () { tab = $(this).data('tab'); draw(); });
  $('#regList').on('click', '[data-cancel]', async function () {
    const eid = $(this).data('cancel'), reg = all.find(r => r.event_id === eid);
    if (!await confirmDialog(`Cancel your registration for “${reg.title}”?`, { title: 'Cancel registration', confirmText: 'Yes, cancel', danger: true })) return;
    const prev = reg.status;
    reg.status = 'cancelled'; draw(); // optimistic
    setRegistration(eid, false).fail(() => { reg.status = prev; draw(); });
  });
  load();
}
