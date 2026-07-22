import { $, state, toast, switchView } from './core.js';

const notesState = {
  received: [],
  sent: [],
  seenIds: new Set(),
  poller: null,
  initialized: false,
};

const palette = {
  violet: ['#8b5cf6', '#4c1d95'],
  rose: ['#fb7185', '#9f1239'],
  blue: ['#38bdf8', '#1d4ed8'],
  gold: ['#fbbf24', '#b45309'],
  green: ['#34d399', '#047857'],
};

function notesApi(action, payload = {}) {
  return fetch(`/api/notes?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({ ok: false, error: 'SERVER_ERROR' }));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || 'SERVER_ERROR');
      error.code = data.error || 'SERVER_ERROR';
      throw error;
    }
    return data;
  });
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function injectStyles() {
  if ($('#dukeNotesStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeNotesStyles';
  style.textContent = `
    .duke-note-trigger{width:43px;height:43px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.06);cursor:pointer;font-size:1.05rem}
    .duke-notes-section{margin-top:14px}.duke-notes-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:24px 3px 12px}.duke-notes-head h3{margin:0}.duke-notes-head p{margin:5px 0 0;color:var(--muted);font-size:.85rem}
    .duke-notes-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.duke-note-card{position:relative;min-height:155px;padding:19px;border-radius:18px;color:white;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.28);transform:rotate(var(--tilt,0deg));border:1px solid rgba(255,255,255,.18)}
    .duke-note-card::after{content:'';position:absolute;right:-35px;bottom:-45px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.09)}.duke-note-card>*{position:relative;z-index:1}.duke-note-card p{font-size:1rem;line-height:1.5;margin:0 0 18px}.duke-note-meta{display:flex;justify-content:space-between;gap:8px;color:rgba(255,255,255,.74);font-size:.72rem}.duke-note-actions{display:flex;gap:7px;margin-top:13px}.duke-note-actions button{border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.17);padding:7px 9px;border-radius:10px;cursor:pointer;font-size:.74rem;font-weight:800}
    .duke-notes-empty{grid-column:1/-1;padding:24px;border:1px dashed rgba(255,255,255,.16);border-radius:18px;color:var(--muted);text-align:center}.duke-notes-empty span{display:block;font-size:2rem;margin-bottom:8px}
    .duke-note-overlay{position:fixed;z-index:210;right:22px;top:92px;width:min(88vw,340px);padding:22px;border-radius:22px;color:white;box-shadow:0 30px 90px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);animation:noteArrive .35s ease}.duke-note-overlay.hidden{display:none}.duke-note-overlay h3{margin:0 0 10px}.duke-note-overlay p{font-size:1.08rem;line-height:1.5}.duke-note-overlay small{opacity:.75}.duke-note-overlay .duke-note-actions{margin-top:17px}
    .duke-note-dialog{border:0;background:transparent;color:white;width:min(94vw,540px);padding:0}.duke-note-dialog::backdrop{background:rgba(0,0,0,.76);backdrop-filter:blur(10px)}.duke-note-dialog-card{padding:24px;border-radius:24px;background:linear-gradient(145deg,rgba(28,18,51,.99),rgba(8,6,17,.99));border:1px solid var(--line);box-shadow:0 28px 90px rgba(0,0,0,.58)}
    .duke-note-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.duke-note-dialog-head h3{margin:0}.duke-note-close{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}.duke-note-colors{display:flex;gap:9px;margin:6px 0}.duke-note-color{width:38px;height:38px;border-radius:50%;border:3px solid transparent;cursor:pointer;background:linear-gradient(135deg,var(--a),var(--b))}.duke-note-color.active{border-color:white;box-shadow:0 0 0 2px var(--purple)}
    .duke-note-form{display:grid;gap:14px;margin-top:20px}.duke-note-form textarea{min-height:115px}.duke-note-help{font-size:.76rem;color:var(--muted);line-height:1.45}
    @keyframes noteArrive{from{opacity:0;transform:translateY(-18px) rotate(2deg)}to{opacity:1;transform:none}}
    @media(max-width:850px){.duke-notes-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.duke-notes-grid{grid-template-columns:1fr}.duke-note-overlay{right:12px;top:82px}.duke-note-trigger{width:40px;height:40px}}
  `;
  document.head.append(style);
}

function colorStyle(color) {
  const [a, b] = palette[color] || palette.violet;
  return `background:linear-gradient(145deg,${a},${b})`;
}

function formatDate(value) {
  if (!value) return 'Ahora';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Ahora' : date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
}

function buildTrigger() {
  if ($('#dukeNoteTrigger')) return;
  const actions = $('.top-actions');
  if (!actions) return;
  const button = document.createElement('button');
  button.id = 'dukeNoteTrigger';
  button.className = 'duke-note-trigger';
  button.type = 'button';
  button.title = 'Dejar una nota';
  button.setAttribute('aria-label', 'Dejar una nota a tu pareja');
  button.textContent = '📝';
  button.addEventListener('click', openComposer);
  actions.prepend(button);
}

function buildSection() {
  if ($('#dukeNotesSection')) return;
  const anchor = $('#dukeTodaySection') || $('.stats-grid');
  if (!anchor) return;
  const section = document.createElement('section');
  section.id = 'dukeNotesSection';
  section.className = 'duke-notes-section';
  section.innerHTML = `
    <div class="duke-notes-head">
      <div><p class="eyebrow">PEQUEÑOS MENSAJES</p><h3>Notas para nosotros</h3><p>Recordatorios y detalles que aparecen en el teléfono de tu pareja.</p></div>
      <button id="newPartnerNote" class="primary-btn" type="button">＋ Nueva nota</button>
    </div>
    <div id="dukeNotesGrid" class="duke-notes-grid"></div>`;
  anchor.after(section);
  $('#newPartnerNote').addEventListener('click', openComposer);
}

function buildDialog() {
  if ($('#dukeNoteDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'dukeNoteDialog';
  dialog.className = 'duke-note-dialog';
  dialog.innerHTML = `
    <form id="dukeNoteForm" class="duke-note-dialog-card duke-note-form">
      <div class="duke-note-dialog-head"><div><p class="eyebrow">NOTA PARA TU PAREJA</p><h3>Déjale algo bonito o importante</h3></div><button id="closeDukeNote" class="duke-note-close" type="button">×</button></div>
      <label>Mensaje<textarea id="dukeNoteText" maxlength="280" required placeholder="Ej. Recuérdame llamarte a las 8 💜"></textarea></label>
      <label>Cuándo debe aparecer<input id="dukeNoteTime" type="datetime-local" /></label>
      <div><small class="duke-note-help">Déjalo vacío para que aparezca inmediatamente.</small></div>
      <div><span style="display:block;margin-bottom:8px;font-size:.86rem;font-weight:800">Color</span><div id="dukeNoteColors" class="duke-note-colors"></div></div>
      <button class="primary-btn full" type="submit">Enviar nota</button>
    </form>`;
  document.body.append(dialog);
  $('#closeDukeNote').addEventListener('click', () => dialog.close());
  $('#dukeNoteForm').addEventListener('submit', submitNote);

  const colors = $('#dukeNoteColors');
  Object.entries(palette).forEach(([name, values], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `duke-note-color ${index === 0 ? 'active' : ''}`;
    button.dataset.noteColor = name;
    button.style.setProperty('--a', values[0]);
    button.style.setProperty('--b', values[1]);
    button.addEventListener('click', () => {
      colors.querySelectorAll('.duke-note-color').forEach((item) => item.classList.toggle('active', item === button));
    });
    colors.append(button);
  });
}

function buildOverlay() {
  if ($('#dukeNoteOverlay')) return;
  const overlay = document.createElement('aside');
  overlay.id = 'dukeNoteOverlay';
  overlay.className = 'duke-note-overlay hidden';
  document.body.append(overlay);
}

function openComposer() {
  if (!state.partner) return toast('Tu pareja todavía no se ha unido.', 'error');
  const dialog = $('#dukeNoteDialog');
  if (dialog && !dialog.open) dialog.showModal();
  setTimeout(() => $('#dukeNoteText')?.focus(), 100);
}

async function submitNote(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const activeColor = $('#dukeNoteColors .active')?.dataset.noteColor || 'violet';
    const localTime = $('#dukeNoteTime').value;
    const remindAt = localTime ? new Date(localTime).toISOString() : null;
    await notesApi('create', { text: $('#dukeNoteText').value, color: activeColor, remindAt });
    event.target.reset();
    $('#dukeNoteColors .duke-note-color')?.classList.add('active');
    $('#dukeNoteDialog').close();
    await loadNotes(false);
    toast(remindAt ? 'Nota programada para tu pareja.' : 'Nota enviada a tu pareja.', 'success');
  } catch (error) {
    toast(error.code === 'PARTNER_NOT_CONNECTED' ? 'Tu pareja todavía no se ha unido.' : 'No se pudo enviar la nota.', 'error');
  } finally {
    button.disabled = false;
  }
}

function renderNotes() {
  const grid = $('#dukeNotesGrid');
  if (!grid) return;
  const received = notesState.received.slice(0, 6);
  if (!received.length) {
    grid.innerHTML = '<div class="duke-notes-empty"><span>📝</span><strong>No hay notas pendientes</strong><p>Dejen pequeños recordatorios y mensajes cariñosos.</p></div>';
    return;
  }
  grid.innerHTML = received.map((note, index) => `
    <article class="duke-note-card" style="${colorStyle(note.color)};--tilt:${index % 2 ? '1deg' : '-1deg'}">
      <p>${escapeText(note.note_text)}</p>
      <div class="duke-note-meta"><span>${escapeText(note.sender_name || 'Tu pareja')}</span><span>${formatDate(note.remind_at || note.created_at)}</span></div>
      <div class="duke-note-actions"><button data-note-reply="${note.id}" type="button">Responder</button><button data-note-dismiss="${note.id}" type="button">Listo ✓</button></div>
    </article>`).join('');
  grid.querySelectorAll('[data-note-dismiss]').forEach((button) => button.addEventListener('click', () => dismissNote(button.dataset.noteDismiss)));
  grid.querySelectorAll('[data-note-reply]').forEach((button) => button.addEventListener('click', () => replyToNote(button.dataset.noteReply)));
}

function replyToNote(noteId) {
  const note = notesState.received.find((item) => item.id === noteId);
  switchView('chat');
  const input = $('#messageInput');
  if (input) {
    input.value = `Sobre tu nota “${note?.note_text || ''}”:\n`;
    input.focus();
  }
}

async function dismissNote(noteId) {
  await notesApi('dismiss', { noteId }).catch(() => {});
  notesState.received = notesState.received.filter((item) => item.id !== noteId);
  $('#dukeNoteOverlay')?.classList.add('hidden');
  renderNotes();
}

async function showSystemNotification(note) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(`${note.sender_name || 'Tu pareja'} te dejó una nota`, {
      body: note.note_text,
      icon: '/assets/duke-icon.svg',
      badge: '/assets/duke-icon.svg',
      tag: `duke-note-${note.id}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 120, 250],
      data: { type: 'partner_note', noteId: note.id, url: '/#duke-notes' },
      actions: [{ action: 'open-note', title: 'Ver nota' }],
    });
  } catch {}
}

function showOverlay(note) {
  const overlay = $('#dukeNoteOverlay');
  if (!overlay) return;
  overlay.style.cssText = colorStyle(note.color);
  overlay.innerHTML = `
    <small>📝 NOTA DE ${escapeText((note.sender_name || 'TU PAREJA').toUpperCase())}</small>
    <h3>Te dejaron un recordatorio</h3>
    <p>${escapeText(note.note_text)}</p>
    <div class="duke-note-actions"><button id="overlayReplyNote" type="button">Responder</button><button id="overlayDismissNote" type="button">Entendido ✓</button></div>`;
  overlay.classList.remove('hidden');
  $('#overlayReplyNote').addEventListener('click', () => { replyToNote(note.id); dismissNote(note.id); });
  $('#overlayDismissNote').addEventListener('click', () => dismissNote(note.id));
  notesApi('seen', { noteId: note.id }).catch(() => {});
}

async function loadNotes(initial = false) {
  if (!state.user || !state.couple) return;
  try {
    const data = await notesApi('list');
    notesState.received = data.received || [];
    notesState.sent = data.sent || [];
    renderNotes();

    for (const note of notesState.received) {
      if (notesState.seenIds.has(note.id)) continue;
      notesState.seenIds.add(note.id);
      if (!initial && !note.seen_at) {
        showOverlay(note);
        if (document.hidden || document.visibilityState !== 'visible') showSystemNotification(note);
        break;
      }
    }
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) console.warn('Notes load error', error);
  }
}

function initPartnerNotes() {
  if (notesState.initialized) return;
  notesState.initialized = true;
  injectStyles();
  buildTrigger();
  buildSection();
  buildDialog();
  buildOverlay();
  loadNotes(true);
  clearInterval(notesState.poller);
  notesState.poller = setInterval(() => loadNotes(false), 1800);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadNotes(false); });
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'DUKE_OPEN_NOTES') {
      window.scrollTo({ top: $('#dukeNotesSection')?.offsetTop || 0, behavior: 'smooth' });
      loadNotes(false);
    }
  });
}

export { initPartnerNotes };
