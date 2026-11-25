/* ============================================================================
 * announcements.js — Audio announcements
 *   GET    /api/announcements                list (cached briefly)
 *   GET    /api/announcements/:id            detail
 *   POST   /api/announcements      (admin)   multipart: title, published, file key "audio"
 *   PUT    /api/announcements/:id  (admin)   { title, published }
 *   PATCH  /api/announcements/:id/publish | /unpublish   (admin)
 *   DELETE /api/announcements/:id  (admin)
 * ========================================================================== */

/** Load an audio file's duration in the background (backend has no duration field). */
function loadDuration(url, cb) {
  const a = new Audio();
  a.preload = 'metadata';
  a.addEventListener('loadedmetadata', () => cb(a.duration));
  a.addEventListener('error', () => cb(null));
  a.src = url;
}

/* ===================== List ===================== */
function announcements() {
  const admin = isAdmin();
  let all = [], player = null, playingId = null;

  $m.html(`${pageHeader('Announcements', 'Audio updates from the city. Press play to listen.',
      admin ? `<a class="${BTN.gold}" href="announcement-form.html">+ New announcement</a>` : '' /* ROLE GUARD */)}
    <div id="annList" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">${skelCards(6, 'h-44')}</div>`);

  const card = a => `<article class="${CARD} p-5 flex flex-col lift" aria-labelledby="an-${a.id}">
      <div class="flex items-start gap-3">
        <button class="play shrink-0 grid h-12 w-12 place-items-center rounded-full bg-brand text-white text-lg hover:bg-purple-800"
          data-play="${a.id}" aria-label="Play ${esc(a.title)}" aria-pressed="false">▶</button>
        <div class="min-w-0 flex-1">
          <h2 id="an-${a.id}" class="font-bold text-lg leading-snug">${esc(a.title)}</h2>
          <p class="text-sm text-gray-700"><span data-dur="${a.id}">–:––</span> · <time datetime="${esc(a.created_at)}">${fmtDate(a.created_at)}</time></p>
          ${admin && !isPublished(a) ? `<p class="mt-1">${badge('Draft', 'gold')}</p>` : ''}
        </div>
      </div>
      <div class="h-1 bg-gray-200 rounded mt-4 overflow-hidden" aria-hidden="true"><div class="h-1 bg-gold" data-prog="${a.id}" style="width:0"></div></div>
      <div class="flex flex-wrap gap-2 mt-4">
        <a class="${BTN.ghost} ${BTN.sm}" href="announcement-detail.html?id=${a.id}" aria-label="Open details for ${esc(a.title)}">Details</a>
        ${admin ? /* ROLE GUARD: admin controls */ `
          <a class="${BTN.ghost} ${BTN.sm}" href="announcement-form.html?id=${a.id}" aria-label="Edit ${esc(a.title)}">Edit</a>
          <button class="${BTN.ghost} ${BTN.sm}" data-toggle-pub="${a.id}">${isPublished(a) ? 'Unpublish' : 'Publish'}</button>
          <button class="${BTN.danger} ${BTN.sm}" data-delete="${a.id}" aria-label="Delete ${esc(a.title)}">Delete</button>` : ''}
      </div></article>`;

  const draw = () => {
    // Users only see published announcements.
    const list = all.filter(a => admin || isPublished(a));
    $('#annList').attr('aria-busy', 'false').html(list.length ? list.map(card).join('')
      : emptyState('📢', 'No announcements yet', 'When the city publishes audio announcements they will appear here.'));
    list.forEach(a => loadDuration(abs(a.audio_url), d => $(`[data-dur="${a.id}"]`).text(d ? fmtDuration(d) : 'Unavailable')));
  };

  const load = (fresh) => {
    if (fresh) Cache.bust(EP.announcements);
    cachedGet(EP.announcements).done(r => { all = asList(r); draw(); })
      .fail(msg => errorState($('#annList'), msg, () => load(true)));
  };

  // Inline player: one shared <audio> element so only one announcement plays at a time.
  $('#annList').on('click', '[data-play]', function () {
    const id = $(this).data('play'), a = all.find(x => x.id === id);
    if (!player) {
      player = new Audio();
      player.addEventListener('timeupdate', () => $(`[data-prog="${playingId}"]`).css('width', (player.currentTime / player.duration * 100 || 0) + '%'));
      player.addEventListener('ended', () => setBtn(playingId, false));
      player.addEventListener('error', () => { fail('This audio file could not be played.'); setBtn(playingId, false); });
    }
    const setBtn = (pid, on) => $(`[data-play="${pid}"]`).text(on ? '❚❚' : '▶').attr('aria-pressed', on)
      .attr('aria-label', (on ? 'Pause ' : 'Play ') + ((all.find(x => x.id === pid) || {}).title || ''));
    if (playingId === id && !player.paused) { player.pause(); return setBtn(id, false); }
    if (playingId !== id) { if (playingId) setBtn(playingId, false); player.src = abs(a.audio_url); playingId = id; }
    player.play().then(() => setBtn(id, true)).catch(() => fail('Playback was blocked or the file is unavailable.'));
  });

  // ROLE GUARD (admin): publish / unpublish / delete — optimistic with revert
  $('#annList').on('click', '[data-toggle-pub]', function () {
    const a = all.find(x => x.id === $(this).data('toggle-pub')), was = isPublished(a);
    a.published = !was; draw();
    api('PATCH', `${EP.announcements}/${a.id}/${was ? 'unpublish' : 'publish'}`)
      .done(() => toast(was ? 'Announcement unpublished' : 'Announcement published — users notified'))
      .fail(msg => { a.published = was; draw(); fail(msg); });
  });
  $('#annList').on('click', '[data-delete]', async function () {
    const id = $(this).data('delete'), a = all.find(x => x.id === id);
    if (!await confirmDialog(`Delete “${a.title}”? This cannot be undone.`, { title: 'Delete announcement', confirmText: 'Delete', danger: true })) return;
    const backup = all.slice(); all = all.filter(x => x.id !== id); draw();
    if (playingId === id && player) player.pause();
    api('DELETE', EP.announcements + '/' + id).done(() => toast('Announcement deleted'))
      .fail(msg => { all = backup; draw(); fail(msg); });
  });
  load();
}

/* ===================== Detail with accessible player ===================== */
function annDetail(id) {
  if (!id) return errorState($m, 'No announcement selected.', null);
  $m.html(`<div class="sk h-10 w-1/2 rounded mb-4"></div><div class="sk h-40 rounded-xl">${loading()}</div>`);

  api('GET', EP.announcements + '/' + id).done(res => {
    const a = asItem(res), url = abs(a.audio_url);
    if (!isAdmin() && !isPublished(a)) return errorState($m, 'This announcement is not available.', null);
    document.title = a.title + ' · CivicEvents';

    $m.html(`
      <nav aria-label="Breadcrumb" class="text-sm mb-4"><a class="text-brand underline" href="announcements.html">Announcements</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(a.title)}</span></nav>
      <article class="max-w-3xl mx-auto space-y-6">
        <header><h1 class="text-3xl font-bold text-brand">${esc(a.title)}</h1>
          <p class="text-gray-700 mt-1">Published <time datetime="${esc(a.created_at)}">${fmtDateTime(a.created_at)}</time>
          ${isAdmin() ? ' · ' + (isPublished(a) ? badge('Published', 'green') : badge('Draft', 'gold')) : ''}</p></header>

        <section class="${CARD} p-6 bg-ink text-white" aria-label="Audio player">
          <audio id="audio" preload="metadata" aria-describedby="audioHelp">
            <source src="${esc(url)}">
            Your browser cannot play this audio format. <a href="${esc(url)}" class="underline">Download the audio file</a> instead.
          </audio>
          <div class="flex items-center gap-4">
            <button id="ppBtn" class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold text-ink text-xl font-bold hover:brightness-110" aria-label="Play">▶</button>
            <div class="flex-1">
              <label for="seek" class="sr-only">Seek</label>
              <input id="seek" type="range" min="0" max="100" step="0.1" value="0" class="w-full accent-[#c8962e]" aria-valuetext="0:00 of 0:00">
              <p class="flex justify-between text-sm text-gray-200 mt-1" aria-live="off"><span id="cur">0:00</span><span id="dur">0:00</span></p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <button id="back10" class="rounded px-3 py-1 bg-white/10 hover:bg-white/20" aria-label="Rewind 10 seconds">⟲ 10s</button>
            <button id="fwd10" class="rounded px-3 py-1 bg-white/10 hover:bg-white/20" aria-label="Forward 10 seconds">10s ⟳</button>
            <button id="muteBtn" class="rounded px-3 py-1 bg-white/10 hover:bg-white/20" aria-pressed="false">🔊 Mute</button>
            <label for="vol" class="sr-only">Volume</label><input id="vol" type="range" min="0" max="1" step="0.05" value="1" class="w-28 accent-[#c8962e]">
            <label for="rate" class="ml-auto">Speed</label>
            <select id="rate" class="rounded bg-white text-ink px-2 py-1">${[0.75, 1, 1.25, 1.5, 2].map(r => `<option value="${r}" ${r === 1 ? 'selected' : ''}>${r}×</option>`).join('')}</select>
          </div>
          <p id="audioHelp" class="sr-only">Keyboard: Space or K to play and pause, left and right arrows to skip 5 seconds.</p>
          <p id="audioErr" class="hidden mt-3 text-amber-200" role="alert"></p>
        </section>

        <section class="${CARD} p-6" aria-labelledby="trTitle"><h2 id="trTitle" class="text-xl font-bold text-brand">Transcript</h2>
          <p class="mt-2 whitespace-pre-line text-gray-900">${a.transcript ? esc(a.transcript) : 'No transcript was provided for this announcement. Please contact support@civicevents.example if you need it in another format.'}</p></section>

        <div class="flex flex-wrap gap-2">
          <a class="${BTN.ghost}" href="${esc(url)}" download>Download audio</a>
          ${isAdmin() ? /* ROLE GUARD */ `<a class="${BTN.ghost}" href="announcement-form.html?id=${a.id}">Edit</a>
            <button id="delAnn" class="${BTN.danger}">Delete</button>` : ''}
        </div>
      </article>`);

    bindAudioPlayer();
    $('#delAnn').on('click', async () => {
      if (!await confirmDialog(`Delete “${a.title}”?`, { title: 'Delete announcement', confirmText: 'Delete', danger: true })) return;
      api('DELETE', EP.announcements + '/' + a.id).done(() => { flash('Announcement deleted'); location.href = 'announcements.html'; }).fail(fail);
    });
  }).fail(msg => errorState($m, msg, () => annDetail(id)));
}

function bindAudioPlayer() {
  const au = $('#audio')[0];
  const sync = () => {
    const d = au.duration || 0;
    $('#cur').text(fmtDuration(au.currentTime));
    $('#dur').text(fmtDuration(d));
    $('#seek').attr('max', d || 100).val(au.currentTime)
      .attr('aria-valuetext', `${fmtDuration(au.currentTime)} of ${fmtDuration(d)}`);
  };
  const setPP = () => $('#ppBtn').text(au.paused ? '▶' : '❚❚').attr('aria-label', au.paused ? 'Play' : 'Pause');
  $(au).on('loadedmetadata timeupdate', sync).on('play pause ended', setPP)
    .on('error', () => $('#audioErr').removeClass('hidden').text('This audio could not be loaded. Try downloading it instead.'));
  $(au).find('source').on('error', () => $('#audioErr').removeClass('hidden').text('This audio could not be loaded. Try downloading it instead.'));
  const toggle = () => au.paused ? au.play().catch(() => { }) : au.pause();
  $('#ppBtn').on('click', toggle);
  $('#seek').on('input', function () { au.currentTime = +this.value; });
  $('#back10').on('click', () => { au.currentTime = Math.max(0, au.currentTime - 10); });
  $('#fwd10').on('click', () => { au.currentTime = Math.min(au.duration || 0, au.currentTime + 10); });
  $('#vol').on('input', function () { au.volume = +this.value; au.muted = false; $('#muteBtn').attr('aria-pressed', false).text('🔊 Mute'); });
  $('#muteBtn').on('click', function () { au.muted = !au.muted; $(this).attr('aria-pressed', au.muted).text(au.muted ? '🔇 Unmute' : '🔊 Mute'); });
  $('#rate').on('change', function () { au.playbackRate = +this.value; });
  $(document).on('keydown', e => {
    if ($(e.target).is('input,select,textarea,button')) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft') au.currentTime = Math.max(0, au.currentTime - 5);
    if (e.key === 'ArrowRight') au.currentTime += 5;
  });
}

/* ===================== Create / edit (admin) ===================== */
function annForm(id) {
  const render = (a = {}) => {
    $m.html(adminLayout('announcements', `
      ${pageHeader(id ? 'Edit announcement' : 'New announcement', id ? '' : 'Upload an audio file. All users receive a notification when it is created.')}
      <form id="annForm" class="${CARD} p-6 space-y-5 max-w-2xl" novalidate>
        ${field('title', 'Title', { required: true, value: a.title || '', attrs: 'maxlength="200"' })}
        ${id ? `<div><p class="font-semibold">Current audio</p><audio controls preload="metadata" class="w-full mt-1" src="${esc(abs(a.audio_url))}">Your browser cannot play this audio.</audio>
            <p class="text-sm text-gray-700 mt-1">The server does not support replacing audio on an existing announcement — create a new one to change the recording.</p></div>`
          : `${field('audio', 'Audio file', { type: 'file', required: true, attrs: `accept="${FILE_RULES.audio.accept}"`, help: `MP3, WAV, M4A or OGG, up to ${FILE_RULES.audio.maxMB} MB.` })}
             <div id="audioPreviewWrap" class="hidden"><p class="font-semibold text-sm">Preview</p><audio id="audioPreview" controls class="w-full mt-1"></audio></div>`}
        ${toggleSwitch('published', 'Published', id ? isPublished(a) : true, 'Published announcements are visible to everyone.')}
        ${progressBar('uploadProgress')}
        <div class="flex flex-wrap gap-2"><button type="submit" class="${BTN.primary}">${id ? 'Save changes' : 'Upload announcement'}</button>
          <a class="${BTN.ghost}" href="announcements.html">Cancel</a></div>
      </form>`));

    $('#audio').on('change', function () {
      const f = this.files[0], err = checkFile(f, FILE_RULES.audio);
      setFieldError('audio', err);
      if (err) { this.value = ''; return $('#audioPreviewWrap').addClass('hidden'); }
      if (f) { $('#audioPreview').attr('src', URL.createObjectURL(f)); $('#audioPreviewWrap').removeClass('hidden'); }
    });

    $('#annForm').on('submit', function (ev) {
      ev.preventDefault();
      const $f = $(this); clearErrors($f);
      const title = $('#title').val().trim(), published = $('#published').is(':checked');
      let ok = true;
      if (!title) { setFieldError('title', 'Title is required.'); ok = false; }
      let file;
      if (!id) {
        file = $('#audio')[0].files[0];
        const err = file ? checkFile(file, FILE_RULES.audio) : 'Please choose an audio file.';
        if (err) { setFieldError('audio', err); ok = false; }
      }
      if (!ok) return focusFirstError($f);

      const $btn = $f.find('[type=submit]'); setBusy($btn, true, id ? 'Saving…' : 'Uploading…');
      let req;
      if (id) {
        req = api('PUT', EP.announcements + '/' + id, { title, published });
      } else {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('published', published);
        fd.append('audio', file); // multer: uploadAudio.single('audio')
        req = api('POST', EP.announcements, fd, { onProgress: p => setProgress('uploadProgress', p) });
      }
      req.done(res => {
        const saved = asItem(res);
        flash(id ? 'Announcement updated.' : 'Announcement uploaded — a notification was sent to all users.');
        location.href = 'announcement-detail.html?id=' + ((saved && saved.id) || id);
      }).fail(msg => { setBusy($btn, false); $('#uploadProgress').addClass('hidden'); fail(msg); });
    });
  };

  if (!id) return render();
  $m.html(adminLayout('announcements', skelRows(4)));
  api('GET', EP.announcements + '/' + id).done(r => render(asItem(r))).fail(msg => errorState($m, msg, () => annForm(id)));
}
