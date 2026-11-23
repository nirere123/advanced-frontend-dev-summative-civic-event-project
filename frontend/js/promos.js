/* ---------- promos (video + captions) ---------- */
function promos() {
  api('GET', EP.promos).done(r => $m.html(`<div class="flex mb-3"><h1 class="text-2xl font-bold text-brand flex-1">Promos</h1>${isAdmin() ? `<a class="${B2}" href="${P}promo-form.html">+ New</a>` : ''}</div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${arr(r).filter(p => p.published !== false || isAdmin()).map(p => `<article class="border rounded p-3"><div class="h-28 bg-ink text-gold grid place-items-center rounded" aria-hidden="true">▶</div><h2 class="font-bold mt-2">${esc(p.title)}</h2><p class="text-sm">${esc(p.description)}</p>
    <a class="${B1} inline-block mt-2" href="promo-detail.html?id=${p.id}">Play</a> ${isAdmin() ? `<button class="${BD} del" data-id="${p.id}">Delete</button>` : ''}</article>`).join('') || '<p>No promos.</p>'}</div>`))
    .fail(m => err(m, promos)).always(() => $m.on('click', '.del', function () { if (confirm('Delete?')) api('DELETE', EP.promos + '/' + $(this).data('id')).done(() => { toast('Deleted'); promos(); }).fail(fail); }));
}
function promoDetail(id) {
  api('GET', EP.promos + '/' + id).done(r => { const p = one(r); $m.html(`<h1 class="text-2xl font-bold text-brand">${esc(p.title)}</h1><video controls preload="none" class="w-full my-3 bg-ink rounded" src="${abs(p.video_url)}"><track kind="captions" src="${abs(p.caption_url)}" srclang="en" label="English" default>Your browser cannot play this video.</video>
    <p>${esc(p.description)}</p>${p.caption_text ? `<details class="mt-3"><summary class="cursor-pointer text-brand">Transcript</summary><p class="whitespace-pre-line">${esc(p.caption_text)}</p></details>` : ''}`); }).fail(m => err(m, () => promoDetail(id)));
}


const promoForm = () => mediaForm('New promo', 'video', 'video/*', 100, EP.promos, `<div><label for="description">Description</label><textarea id="description" class="${inp}"></textarea></div><div><label for="caption_text">Captions (WebVTT or text)</label><textarea id="caption_text" class="${inp}"></textarea></div>`, 'promos.html');
