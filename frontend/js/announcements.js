/* ---------- announcements (audio) ---------- */
function announcements() {
  api('GET', EP.ann).done(r => $m.html(`<div class="flex mb-3"><h1 class="text-2xl font-bold text-brand flex-1">Announcements</h1>${isAdmin() ? `<a class="${B2}" href="${P}announcement-form.html">+ New</a>` : ''}</div>
    <div class="grid gap-4 sm:grid-cols-2">${arr(r).filter(a => a.published !== false || isAdmin()).map(a => `<article class="border rounded p-3"><h2 class="font-bold">${esc(a.title)}</h2><p class="text-sm">${a.duration_seconds ? a.duration_seconds + 's · ' : ''}${fmt(a.created_at)}</p>
    <a class="${B1} inline-block mt-2" href="announcement-detail.html?id=${a.id}">▶ Play</a> ${isAdmin() ? `<button class="${BD} del" data-id="${a.id}">Delete</button>` : ''}</article>`).join('') || '<p>No announcements.</p>'}</div>`))
    .fail(m => err(m, announcements)).always(() => $m.on('click', '.del', function () { if (confirm('Delete?')) api('DELETE', EP.ann + '/' + $(this).data('id')).done(() => { toast('Deleted'); announcements(); }).fail(fail); }));
}
function annDetail(id) {
  api('GET', EP.ann + '/' + id).done(r => { const a = one(r); $m.html(`<h1 class="text-2xl font-bold text-brand">${esc(a.title)}</h1><audio controls preload="metadata" class="w-full my-3" aria-label="Announcement audio: ${esc(a.title)}" src="${abs(a.audio_url)}">Your browser cannot play this audio. <a href="${abs(a.audio_url)}">Download it</a>.</audio>
    <p id="t" aria-live="off" class="text-sm">0:00 / 0:00</p>${a.transcript ? `<h2 class="font-bold mt-3">Transcript</h2><p>${esc(a.transcript)}</p>` : ''}`);
    const au = $('audio')[0], f = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); $(au).on('timeupdate loadedmetadata', () => $('#t').text(f(au.currentTime) + ' / ' + f(au.duration || 0))); }).fail(m => err(m, () => annDetail(id)));
}
const annForm = () => mediaForm('New announcement', 'audio', 'audio/*', 20, EP.ann, '', 'announcements.html');


