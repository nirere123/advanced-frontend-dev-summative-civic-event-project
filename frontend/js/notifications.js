/* ---------- notifications ---------- */
function notifications() {
  const load = () => api('GET', EP.notes).done(r => { const l = arr(r);
    $m.html(`<h1 class="text-2xl font-bold text-brand mb-3">Notifications</h1>${isAdmin() ? `<form id="bc" class="border rounded p-3 mb-4 space-y-2"><h2 class="font-bold">Broadcast</h2>${field('nt', 'Title')}${field('nm', 'Message')}<button class="${B2}">Send broadcast</button></form>` : ''}
      <ul class="space-y-2">${l.map(n => `<li class="border rounded p-3 ${n.is_read ? '' : 'border-l-4 border-l-gold'}"><button class="font-bold text-left text-brand open" data-id="${n.id}">${esc(n.title)}</button><span class="text-xs ml-2">${fmt(n.created_at)} ${esc(n.type)}</span>
      <div class="det hidden mt-2" id="d${n.id}"><p>${esc(n.message)}</p>${n.metadata && n.metadata.event_id ? `<a class="underline text-brand" href="event-detail.html?id=${n.metadata.event_id}">Open event</a>` : ''}</div>${isAdmin() ? ` <button class="${BD} nd" data-id="${n.id}">Delete</button>` : ''}</li>`).join('') || '<li>No notifications.</li>'}</ul>`);
    $('.open').on('click', function () { $('#d' + $(this).data('id')).toggleClass('hidden'); $(this).closest('li').removeClass('border-l-4'); api('PATCH', EP.notes + '/' + $(this).data('id') + '/read').fail(() => { }); }); // optimistic
    $('.nd').on('click', function () { if (confirm('Delete notification?')) api('DELETE', EP.notes + '/' + $(this).data('id')).done(() => { toast('Deleted'); load(); }).fail(fail); });
    $('#bc').on('submit', e => { e.preventDefault(); api('POST', EP.notes, { title: $('#nt').val(), message: $('#nm').val(), type: 'broadcast' }).done(() => { toast('Broadcast sent'); load(); }).fail(fail); });
  }).fail(m => err(m, load)); load();
}

