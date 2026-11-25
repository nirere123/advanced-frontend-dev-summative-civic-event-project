/* ============================================================================
 * promos.js — Video promos with captions
 *   GET    /api/promos?page=&limit=      list (cached; invalidated on any write)
 *   GET    /api/promos/:id               detail
 *   POST   /api/promos        (admin)    multipart: title, description, caption_text, file key "video"
 *   PUT    /api/promos/:id    (admin)    multipart: same fields (+ optional video, published)
 *   PATCH  /api/promos/:id/publish | /unpublish   (admin)
 *   DELETE /api/promos/:id    (admin)
 *
 * The backend stores captions as plain `caption_text` (no caption file URL), so
 * the player converts it to a WebVTT file in the browser and attaches it as
 * <track kind="captions" srclang="en" label="English" default>.
 * ========================================================================== */

const PROMO_LIST = EP.promos + '?page=1&limit=100';

/* ---------- captions helpers ---------- */
function vttTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(3);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.padStart(6, '0')}`;
}
/** Accepts real WebVTT, or plain text which is split into ~3.5s cues of ~10 words. */
function captionTextToVtt(text) {
  text = (text || '').trim();
  if (/^WEBVTT/.test(text)) return text;
  const words = text.split(/\s+/).filter(Boolean), cues = [];
  for (let i = 0, t = 0, n = 1; i < words.length; i += 10, t += 3.5, n++) {
    cues.push(`${n}\n${vttTime(t)} --> ${vttTime(t + 3.5)}\n${words.slice(i, i + 10).join(' ')}`);
  }
  return 'WEBVTT\n\n' + cues.join('\n\n');
}
/** Human-readable transcript (strips WebVTT timing lines). */
function captionTranscript(text) {
  text = (text || '').trim();
  if (!/^WEBVTT/.test(text)) return text;
  return text.split(/\r?\n/).filter(l => l.trim() && !/^WEBVTT/.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^NOTE/.test(l)).join(' ');
}

/* ---------- lazy thumbnails: only load a video's first frame when its card scrolls into view ---------- */
function lazyThumbs(root) {
  const vids = $(root).find('video[data-src]').toArray();
  const load = v => { v.src = v.dataset.src + '#t=1'; v.removeAttribute('data-src'); };
  if (!('IntersectionObserver' in window)) return vids.forEach(load);
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { load(en.target); io.unobserve(en.target); }
  }), { rootMargin: '200px' });
  vids.forEach(v => io.observe(v));
}

/* ===================== List ===================== */
function promos() {
  const admin = isAdmin();
  let all = [];

  $m.html(`${pageHeader('Promos', 'Short videos about city programmes — all with captions.',
      admin ? `<a class="${BTN.gold}" href="promo-form.html">+ New promo</a>` : '' /* ROLE GUARD */)}
    <div id="promoList" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">${skelCards(6, 'h-72')}</div>`);

  const card = p => `<article class="${CARD} overflow-hidden flex flex-col lift" aria-labelledby="pr-${p.id}">
      <a href="promo-detail.html?id=${p.id}" class="relative block aspect-video bg-ink group" aria-label="Play ${esc(p.title)}">
        <video data-src="${esc(abs(p.video_url))}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"
          class="h-full w-full object-cover opacity-90 group-hover:opacity-100"></video>
        <span class="absolute inset-0 grid place-items-center" aria-hidden="true">
          <span class="grid h-14 w-14 place-items-center rounded-full bg-gold text-ink text-xl shadow-lg group-hover:scale-110 transition">▶</span></span>
        <span class="absolute bottom-2 left-2">${badge('CC', 'ink')}</span>
        ${admin && !isPublished(p) ? `<span class="absolute top-2 right-2">${badge('Draft', 'gold')}</span>` : ''}
      </a>
      <div class="p-4 flex flex-col flex-1">
        <h2 id="pr-${p.id}" class="font-bold text-lg">${esc(p.title)}</h2>
        <p class="text-sm text-gray-800 mt-1 line-clamp-3 flex-1">${esc(p.description || '')}</p>
        <div class="flex flex-wrap gap-2 mt-4">
          <a class="${BTN.primary} ${BTN.sm}" href="promo-detail.html?id=${p.id}" aria-label="Play ${esc(p.title)}">▶ Play</a>
          ${admin ? /* ROLE GUARD: admin controls */ `
            <a class="${BTN.ghost} ${BTN.sm}" href="promo-form.html?id=${p.id}" aria-label="Edit ${esc(p.title)}">Edit</a>
            <button class="${BTN.ghost} ${BTN.sm}" data-toggle-pub="${p.id}">${isPublished(p) ? 'Unpublish' : 'Publish'}</button>
            <button class="${BTN.danger} ${BTN.sm}" data-delete="${p.id}" aria-label="Delete ${esc(p.title)}">Delete</button>` : ''}
        </div>
      </div></article>`;

  const draw = () => {
    const list = all.filter(p => admin || isPublished(p)); // users only see published promos
    $('#promoList').attr('aria-busy', 'false').html(list.length ? list.map(card).join('')
      : emptyState('🎬', 'No promos yet', 'Promotional videos from the city will appear here.'));
    lazyThumbs('#promoList');
  };
  const load = fresh => {
    if (fresh) Cache.bust(EP.promos);
    cachedGet(PROMO_LIST, 2 * 60 * 1000).done(r => { all = asList(r); draw(); })
      .fail(msg => errorState($('#promoList'), msg, () => load(true)));
  };

  // ROLE GUARD (admin): publish / unpublish / delete — optimistic with revert
  $('#promoList').on('click', '[data-toggle-pub]', function () {
    const p = all.find(x => x.id === $(this).data('toggle-pub')), was = isPublished(p);
    p.published = !was; draw();
    api('PATCH', `${EP.promos}/${p.id}/${was ? 'unpublish' : 'publish'}`)
      .done(() => toast(was ? 'Promo unpublished' : 'Promo published — users notified'))
      .fail(msg => { p.published = was; draw(); fail(msg); });
  });
  $('#promoList').on('click', '[data-delete]', async function () {
    const id = $(this).data('delete'), p = all.find(x => x.id === id);
    if (!await confirmDialog(`Delete “${p.title}”? This cannot be undone.`, { title: 'Delete promo', confirmText: 'Delete', danger: true })) return;
    const backup = all.slice(); all = all.filter(x => x.id !== id); draw();
    api('DELETE', EP.promos + '/' + id).done(() => toast('Promo deleted'))
      .fail(msg => { all = backup; draw(); fail(msg); });
  });
  load();
}

/* ===================== Detail ===================== */
function promoDetail(id) {
  if (!id) return errorState($m, 'No promo selected.', null);
  $m.html(`<div class="sk aspect-video rounded-xl mb-4"></div><div class="sk h-8 w-1/2 rounded">${loading()}</div>`);

  api('GET', EP.promos + '/' + id).done(res => {
    const p = asItem(res), url = abs(p.video_url);
    if (!isAdmin() && !isPublished(p)) return errorState($m, 'This promo is not available.', null);
    document.title = p.title + ' · CivicEvents';
    const hasCaptions = !!(p.caption_text && p.caption_text.trim());
    const vttUrl = hasCaptions ? URL.createObjectURL(new Blob([captionTextToVtt(p.caption_text)], { type: 'text/vtt' })) : '';

    $m.html(`
      <nav aria-label="Breadcrumb" class="text-sm mb-4"><a class="text-brand underline" href="promos.html">Promos</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(p.title)}</span></nav>
      <article class="max-w-4xl mx-auto space-y-6">
        <div class="rounded-xl overflow-hidden bg-ink shadow-lg">
          <video id="video" controls preload="metadata" playsinline class="w-full aspect-video bg-ink" aria-label="${esc(p.title)} video">
            <source src="${esc(url)}">
            ${hasCaptions ? `<track kind="captions" src="${vttUrl}" srclang="en" label="English" default>` : ''}
            Your browser cannot play this video. <a href="${esc(url)}" class="underline">Download it</a> instead.
          </video>
        </div>
        <p id="videoErr" class="hidden text-red-800 font-semibold" role="alert"></p>
        <div class="flex flex-wrap items-start gap-4">
          <div class="flex-1 min-w-[240px]">
            <h1 class="text-3xl font-bold text-brand">${esc(p.title)}</h1>
            <p class="text-gray-700 text-sm mt-1">Added ${fmtDate(p.created_at)} ${isAdmin() ? ' · ' + (isPublished(p) ? badge('Published', 'green') : badge('Draft', 'gold')) : ''}</p>
            <p class="mt-3 whitespace-pre-line text-gray-900">${esc(p.description || '')}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${hasCaptions ? `<button id="ccBtn" class="${BTN.gold} ${BTN.sm}" aria-pressed="true">CC Captions: On</button>` : badge('No captions available', 'gray')}
            <button id="fsBtn" class="${BTN.ghost} ${BTN.sm}">⛶ Fullscreen</button>
            ${isAdmin() ? /* ROLE GUARD */ `<a class="${BTN.ghost} ${BTN.sm}" href="promo-form.html?id=${p.id}">Edit</a>
              <button id="delPromo" class="${BTN.danger} ${BTN.sm}">Delete</button>` : ''}
          </div>
        </div>
        ${hasCaptions ? `<details class="${CARD} p-5" open><summary class="cursor-pointer font-bold text-brand text-lg">Transcript</summary>
          <p class="mt-3 whitespace-pre-line text-gray-900">${esc(captionTranscript(p.caption_text))}</p></details>` : ''}
      </article>`);

    const v = $('#video')[0];
    // Make sure captions are showing by default (some browsers ignore `default` on dynamic tracks).
    $(v).on('loadedmetadata', () => { if (v.textTracks[0] && $('#ccBtn').attr('aria-pressed') === 'true') v.textTracks[0].mode = 'showing'; });
    $(v).find('source').on('error', () => $('#videoErr').removeClass('hidden').text('The video could not be loaded. It may have been removed or the server is unreachable.'));
    $('#ccBtn').on('click', function () {
      const t = v.textTracks[0]; if (!t) return;
      const on = t.mode !== 'showing';
      t.mode = on ? 'showing' : 'hidden';
      $(this).attr('aria-pressed', on).text('CC Captions: ' + (on ? 'On' : 'Off'));
    });
    $('#fsBtn').on('click', () => (v.requestFullscreen || v.webkitEnterFullscreen || (() => { })).call(v));
    $('#delPromo').on('click', async () => {
      if (!await confirmDialog(`Delete “${p.title}”?`, { title: 'Delete promo', confirmText: 'Delete', danger: true })) return;
      api('DELETE', EP.promos + '/' + p.id).done(() => { flash('Promo deleted'); location.href = 'promos.html'; }).fail(fail);
    });
  }).fail(msg => errorState($m, msg, () => promoDetail(id)));
}

/* ===================== Create / edit (admin) ===================== */
function promoForm(id) {
  const render = (p = {}) => {
    $m.html(adminLayout('promos', `
      ${pageHeader(id ? 'Edit promo' : 'New promo', id ? '' : 'Upload a short video with captions. Users are notified when it is created.')}
      <form id="promoForm" class="${CARD} p-6 space-y-5 max-w-3xl" novalidate>
        ${field('title', 'Title', { required: true, value: p.title || '', attrs: 'maxlength="200"' })}
        ${field('description', 'Description', { type: 'textarea', required: true, rows: 3, value: p.description || '' })}
        ${field('caption_text', 'Captions', { type: 'textarea', required: true, rows: 6, value: p.caption_text || '',
          help: 'Paste WebVTT (starting with <code>WEBVTT</code>) for exact timing, or plain text — it will be split into timed captions automatically and also shown as a transcript.' })}
        ${field('video', 'Video file', { type: 'file', required: !id, attrs: `accept="${FILE_RULES.video.accept}"`,
          help: `MP4, MOV, AVI or MKV, up to ${FILE_RULES.video.maxMB} MB.${id ? ' Leave empty to keep the current video.' : ''}` })}
        <div id="videoPreviewWrap" class="${id && p.video_url ? '' : 'hidden'}"><p class="font-semibold text-sm">${id ? 'Current / new video' : 'Preview'}</p>
          <video id="videoPreview" controls preload="metadata" class="w-full max-h-72 bg-ink rounded mt-1" src="${esc(abs(p.video_url))}"></video></div>
        ${toggleSwitch('published', 'Published', id ? isPublished(p) : true, 'Unpublished promos are only visible to admins.')}
        ${progressBar('uploadProgress')}
        <div class="flex flex-wrap gap-2"><button type="submit" class="${BTN.primary}">${id ? 'Save changes' : 'Upload promo'}</button>
          <a class="${BTN.ghost}" href="promos.html">Cancel</a></div>
      </form>`));

    $('#video').on('change', function () {
      const f = this.files[0], err = checkFile(f, FILE_RULES.video);
      setFieldError('video', err);
      if (err) { this.value = ''; return; }
      if (f) { $('#videoPreview').attr('src', URL.createObjectURL(f)); $('#videoPreviewWrap').removeClass('hidden'); }
    });

    $('#promoForm').on('submit', function (ev) {
      ev.preventDefault();
      const $f = $(this); clearErrors($f);
      const val = k => $('#' + k).val().trim(), published = $('#published').is(':checked');
      let ok = true;
      if (!val('title')) { setFieldError('title', 'Title is required.'); ok = false; }
      if (!val('description')) { setFieldError('description', 'Description is required.'); ok = false; }
      if (!val('caption_text')) { setFieldError('caption_text', 'Captions are required for accessibility.'); ok = false; }
      const file = $('#video')[0].files[0];
      const fileErr = !id && !file ? 'Please choose a video file.' : checkFile(file, FILE_RULES.video);
      if (fileErr) { setFieldError('video', fileErr); ok = false; }
      if (!ok) return focusFirstError($f);

      const fd = new FormData();
      fd.append('title', val('title'));
      fd.append('description', val('description'));
      fd.append('caption_text', val('caption_text'));
      if (id) fd.append('published', published);
      if (file) fd.append('video', file); // multer: uploadPromoVideo.single('video')

      const $btn = $f.find('[type=submit]'); setBusy($btn, true, file ? 'Uploading…' : 'Saving…');
      api(id ? 'PUT' : 'POST', EP.promos + (id ? '/' + id : ''), fd, { onProgress: pct => file && setProgress('uploadProgress', pct) })
        .then(res => {
          const saved = asItem(res);
          // POST always creates a published promo; unpublish straight away if requested.
          if (!id && !published && saved && saved.id) return api('PATCH', `${EP.promos}/${saved.id}/unpublish`).then(() => saved);
          return saved;
        })
        .done(saved => {
          flash(id ? 'Promo updated.' : 'Promo uploaded' + (published ? ' — users have been notified.' : ' as a draft.'));
          location.href = 'promo-detail.html?id=' + ((saved && saved.id) || id);
        })
        .fail(msg => { setBusy($btn, false); $('#uploadProgress').addClass('hidden'); fail(typeof msg === 'string' ? msg : 'Upload failed.'); });
    });
  };

  if (!id) return render();
  $m.html(adminLayout('promos', skelRows(5)));
  api('GET', EP.promos + '/' + id).done(r => render(asItem(r))).fail(msg => errorState($m, msg, () => promoForm(id)));
}
