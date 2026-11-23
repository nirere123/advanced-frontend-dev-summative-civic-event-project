/* ---------- events ---------- */
function events(_, p) {
  api('GET', EP.events).done(r => {
    let all = arr(r).filter(e => e.published !== false || isAdmin()); let page = 1; const per = 6;
    $m.html(`<div class="flex flex-wrap gap-2 items-end mb-4"><h1 class="text-2xl font-bold text-brand flex-1">Events</h1>
      <div><label class="block text-sm" for="fq">Search</label><input id="fq" class="${inp}" value="${esc(p.get('q') || '')}"></div>
      <div><label class="block text-sm" for="fl">Location</label><input id="fl" class="${inp}"></div>
      <div><label class="block text-sm" for="fd">Date</label><input id="fd" type="date" class="${inp}"></div>
      ${isAdmin() ? `<a class="${B2}" href="${P}event-form.html">+ New event</a>` : ''}</div><div id="list" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"></div><div id="pg" class="flex gap-2 justify-center mt-4"></div>`);
    const draw = () => {
      const q = $('#fq').val().toLowerCase(), l = $('#fl').val().toLowerCase(), d = $('#fd').val();
      const f = all.filter(e => (e.title + ' ' + (e.description || '')).toLowerCase().includes(q) && (e.location || '').toLowerCase().includes(l) && (!d || (e.starts_at || '').slice(0, 10) === d));
      const pages = Math.max(1, Math.ceil(f.length / per)); page = Math.min(page, pages);
      $('#list').html(f.slice((page - 1) * per, page * per).map(card).join('') || '<p>No events found.</p>');
      $('#pg').html(Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? B1 : B2}" data-p="${i + 1}" aria-label="Page ${i + 1}">${i + 1}</button>`).join(''));
      $('#pg button').on('click', function () { page = +$(this).data('p'); draw(); });
      $('.del').on('click', function () { if (confirm('Delete this event?')) api('DELETE', EP.events + '/' + $(this).data('id')).done(() => { toast('Event deleted'); all = all.filter(e => e.id != $(this).data('id')); draw(); }).fail(fail); });
    };
    const card = e => `<article class="border rounded shadow-sm overflow-hidden"><img loading="lazy" alt="${esc(e.title)}" class="h-40 w-full object-cover bg-purple-100" src="${abs(e.metadata && e.metadata.image_url)}" onerror="this.style.visibility='hidden'">
      <div class="p-3 space-y-1"><h2 class="font-bold text-brand">${esc(e.title)}</h2><p class="text-sm">${fmt(e.starts_at)} · ${esc(e.location)}</p><p class="text-sm line-clamp-2">${esc(e.description)}</p>
      <div class="flex gap-2 pt-2"><a class="${B1}" href="event-detail.html?id=${e.id}">View</a>${isAdmin() ? `<a class="${B2}" href="event-form.html?id=${e.id}">Edit</a><button class="${BD} del" data-id="${e.id}">Delete</button>` : ''}</div></div></article>`;
    $('#fq,#fl,#fd').on('input', () => { page = 1; draw(); }); draw();
  }).fail(m => err(m, () => events(_, p)));
}
function eventDetail(id) {
  api('GET', EP.events + '/' + id).done(r => {
    const e = one(r), u = Auth.user;
    $m.html(`<article><img alt="${esc(e.title)}" class="w-full max-h-80 object-cover rounded" src="${abs(e.metadata && e.metadata.image_url)}" onerror="this.remove()"><h1 class="text-3xl font-bold text-brand mt-3">${esc(e.title)}</h1>
      <p>${fmt(e.starts_at)} – ${fmt(e.ends_at)}</p><p>📍 ${esc(e.location)} · <a class="text-brand underline" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(e.location || '')}">Map</a></p>
      <p class="my-3 whitespace-pre-line">${esc(e.description)}</p><div id="reg"></div><section id="rl" class="mt-6"></section><section id="fb" class="mt-6"></section></article>`);
    if (u && !isAdmin()) api('GET', EP.myRegs).done(rr => {
      const mine = arr(rr).find(x => (x.event_id || (x.event && x.event.id)) == id); const reg = $('#reg');
      reg.html(mine ? `<button class="${BD}" id="rg">Cancel registration</button>` : `<button class="${B1}" id="rg">Register</button>`);
      $('#rg').on('click', function () { $(this).prop('disabled', true);
        (mine ? api('DELETE', EP.regs + '/' + (mine.id || mine.registration_id)) : api('POST', EP.regs, { user_id: u.id, event_id: +id })).done(() => { toast(mine ? 'Registration cancelled' : 'Registered!'); eventDetail(id); }).fail(m => { fail(m); $(this).prop('disabled', false); }); });
    }); else if (!u) $('#reg').html(`<a class="${B1}" href="${P}login.html">Log in to register</a>`);
    if (isAdmin()) api('GET', EP.regs + '/event/' + id).done(rr => $('#rl').html(`<h2 class="font-bold text-xl">Registrants</h2><ul class="list-disc ml-5">${arr(rr).map(x => `<li>${esc((x.user && x.user.full_name) || x.full_name || x.user_id)}</li>`).join('') || '<li>None yet</li>'}</ul>`));
    api('GET', EP.fb + '/event/' + id).done(fr => {
      const l = arr(fr), avg = l.length ? (l.reduce((s, x) => s + +x.rating, 0) / l.length).toFixed(1) : '–';
      $('#fb').html(`<h2 class="font-bold text-xl">Feedback · average ${avg}/5</h2><ul class="space-y-2 my-2">${l.map(x => `<li class="border rounded p-2">${'★'.repeat(x.rating)} ${esc(x.comment)}</li>`).join('') || '<li>No feedback yet.</li>'}</ul>
        ${u && !isAdmin() ? `<form id="ff" class="space-y-2 max-w-md"><label for="rt">Rating</label><select id="rt" class="${inp}">${[5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join('')}</select><label for="cm">Comment</label><textarea id="cm" class="${inp}" required></textarea><button class="${B1}">Submit feedback</button></form>` : ''}`);
      $('#ff').on('submit', ev => { ev.preventDefault(); api('POST', EP.fb, { event_id: +id, rating: +$('#rt').val(), comment: $('#cm').val() }).done(() => { toast('Thanks for your feedback!'); eventDetail(id); }).fail(fail); });
    }).fail(() => $('#fb').html('<p>Feedback unavailable.</p>'));
  }).fail(m => err(m, () => eventDetail(id)));
}

function eventForm(id) {
  const go = e => {
    e = e || {}; $m.html(`<form id="f" class="max-w-xl mx-auto space-y-3"><h1 class="text-2xl font-bold text-brand">${id ? 'Edit' : 'New'} event</h1>${field('title', 'Title', 'text', 'required')}
      <div><label for="description">Description</label><textarea id="description" name="description" class="${inp}" required></textarea></div>${field('location', 'Location', 'text', 'required')}${field('starts_at', 'Starts', 'datetime-local', 'required')}${field('ends_at', 'Ends', 'datetime-local', 'required')}
      <label><input type="checkbox" id="published" name="published" value="true"> Published</label>${field('image', 'Image (JPG/PNG, max 5MB)', 'file', 'accept="image/*"')}<img id="pv" alt="Image preview" class="max-h-40 hidden"><button class="${B1}">Save</button></form>`);
    ['title', 'description', 'location'].forEach(k => $('#' + k).val(e[k])); ['starts_at', 'ends_at'].forEach(k => e[k] && $('#' + k).val(e[k].slice(0, 16))); $('#published').prop('checked', e.published);
    $('#image').on('change', function () { const f = this.files[0]; if (f && checkFile(f, ['image/'], 5)) $('#pv').attr('src', URL.createObjectURL(f)).removeClass('hidden'); });
    $('#f').on('submit', ev => { ev.preventDefault(); if (!checkFile($('#image')[0].files[0], ['image/'], 5)) return;
      const fd = new FormData(); ['title', 'description', 'location', 'starts_at', 'ends_at'].forEach(k => fd.append(k, $('#' + k).val())); fd.append('published', $('#published').is(':checked'));
      if ($('#image')[0].files[0]) fd.append('image', $('#image')[0].files[0]);
      $('#f button').prop('disabled', true).text('Saving...');
      api(id ? 'PUT' : 'POST', EP.events + (id ? '/' + id : ''), fd, true).done(() => { toast('Event saved'); location.href = P + 'events.html'; }).fail(m => { fail(m); $('#f button').prop('disabled', false).text('Save'); }); });
  };
  id ? api('GET', EP.events + '/' + id).done(r => go(one(r))).fail(fail) : go();
}
function myRegs() {
  api('GET', EP.myRegs).done(r => $m.html(`<h1 class="text-2xl font-bold text-brand mb-3">My registrations</h1><ul class="space-y-2">${arr(r).map(x => { const e = x.event || x; const eid = x.event_id || e.id;
    return `<li class="border rounded p-3"><a class="text-brand underline" href="event-detail.html?id=${eid}">${esc(e.title || 'Event #' + eid)}</a> ${fmt(e.starts_at)}</li>`; }).join('') || '<li>No registrations yet.</li>'}</ul>`)).fail(m => err(m, myRegs));
}

