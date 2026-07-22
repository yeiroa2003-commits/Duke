const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  couple: null,
  members: [],
  partner: null,
  messages: [],
  memories: [],
  dates: [],
  games: {},
  stats: {},
  replyTo: null,
  poller: null,
  installPrompt: null,
  jitsi: null,
  spinning: false,
  lastNotificationIds: new Set(),
};

const questions = [
  '¿Cuál es tu recuerdo favorito de nosotros?',
  '¿Qué fue lo primero que te gustó de mí?',
  '¿Qué lugar te gustaría visitar conmigo?',
  '¿Qué canción te hace pensar en nosotros?',
  '¿Cuál sería nuestra cita perfecta?',
  '¿Qué pequeño detalle mío te hace feliz?',
  '¿Qué sueño quisieras cumplir juntos?',
  '¿Cuál ha sido nuestro momento más divertido?',
  '¿Qué cosa nueva te gustaría aprender conmigo?',
  '¿Cómo imaginas un día perfecto a mi lado?',
];

const rouletteItems = [
  'Dedícale una canción',
  'Cuenta un recuerdo que nunca olvidarás',
  'Envía una foto graciosa',
  'Da tres razones por las que le amas',
  'Planifiquen una cita virtual',
  'Haz una pregunta profunda',
  'Envíale un audio cariñoso por el chat',
  'Elige una película para ver juntos',
];

const errorMessages = {
  PRIVATE_LINK_REQUIRED: 'Duke solo abre desde el enlace privado.',
  INVALID_PRIVATE_LINK: 'Este enlace privado no es válido.',
  DATABASE_URL_MISSING: 'Falta configurar DATABASE_URL en Vercel.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  INVALID_EMAIL: 'Escribe un correo válido.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 6 caracteres.',
  DISPLAY_NAME_REQUIRED: 'Escribe tu nombre o apodo.',
  EMAIL_ALREADY_EXISTS: 'Ese correo ya está registrado.',
  TWO_USERS_MAXIMUM: 'Duke ya tiene sus dos cuentas autorizadas.',
  COUPLE_ALREADY_EXISTS: 'Ya existe un espacio Duke. La segunda persona debe unirse con el código y el PIN.',
  INVALID_CODE_OR_PIN: 'El código o el PIN no son correctos.',
  DUKE_SPACE_FULL: 'Este espacio ya tiene dos personas.',
  USER_ALREADY_HAS_DUKE: 'Esta cuenta ya pertenece a un espacio Duke.',
  NO_DUKE_SPACE: 'Primero debes crear o unirte al espacio.',
  INVALID_INPUT: 'Revisa los datos e inténtalo nuevamente.',
  SERVER_ERROR: 'Ocurrió un error en el servidor.',
};

function toast(message, type = '') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  $('#toastRoot').append(item);
  setTimeout(() => item.remove(), 4200);
}

function translateError(code) {
  return errorMessages[code] || String(code || 'No se pudo completar la acción.').replaceAll('_', ' ');
}

async function api(action, options = {}) {
  const method = options.method || (options.body ? 'POST' : 'GET');
  const url = new URL('/api/duke', location.origin);
  url.searchParams.set('action', action);
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, error: 'SERVER_ERROR' };
  }
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'SERVER_ERROR');
    error.code = data.error || 'SERVER_ERROR';
    throw error;
  }
  return data;
}

function showOnly(id) {
  ['gateScreen', 'authScreen', 'appShell'].forEach((screen) => $(`#${screen}`).classList.toggle('hidden', screen !== id));
}

function openDialog(id) {
  const dialog = $(`#${id}`);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(id) {
  const dialog = $(`#${id}`);
  if (dialog?.open) dialog.close();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDate(value, options = {}) {
  if (!value) return '';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es', { dateStyle: options.dateStyle || 'medium', ...options }).format(date);
}

function fmtTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function daysSince(value) {
  if (!value) return 0;
  const start = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - start) / 86400000));
}

function isOnline(member) {
  if (!member?.last_seen) return false;
  return Date.now() - new Date(member.last_seen).getTime() < 60000;
}

async function imageToDataUrl(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('INVALID_INPUT');
  if (file.size > 12 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', .76);
}

async function unlockPrivateLink() {
  const params = new URLSearchParams(location.search);
  const key = params.get('duke');
  if (key) {
    try {
      await api('unlock', { method: 'POST', body: { key } });
      localStorage.setItem('duke_private_link', `${location.origin}/?duke=${encodeURIComponent(key)}`);
      history.replaceState({}, '', `${location.pathname}${location.hash || ''}`);
    } catch (error) {
      $('#gateTitle').textContent = 'Este enlace no tiene acceso';
      $('#gateText').textContent = translateError(error.code);
      $('#gateLoader').classList.add('hidden');
      return false;
    }
  }

  try {
    const gate = await api('gate');
    if (!gate.unlocked) {
      $('#gateTitle').textContent = 'Necesitas el enlace privado';
      $('#gateText').textContent = 'Solicita el enlace original de Duke. Sin ese enlace no se puede abrir el registro ni el contenido.';
      $('#gateLoader').classList.add('hidden');
      return false;
    }
    return true;
  } catch {
    $('#gateTitle').textContent = 'No se pudo comprobar el acceso';
    $('#gateText').textContent = 'Revisa la conexión e inténtalo nuevamente.';
    $('#gateLoader').classList.add('hidden');
    return false;
  }
}

function setSnapshot(data, initial = false) {
  const previousNotifications = new Set(state.lastNotificationIds);
  state.user = data.user;
  state.couple = data.couple;
  state.members = data.members || [];
  state.partner = state.members.find((member) => member.user_id !== state.user?.id) || null;
  state.messages = data.messages || [];
  state.memories = data.memories || [];
  state.dates = data.dates || [];
  state.games = data.games || {};
  state.stats = data.stats || {};

  for (const notification of data.notifications || []) {
    if (!initial && !previousNotifications.has(notification.id)) {
      toast(`${notification.title}${notification.body ? `: ${notification.body}` : ''}`, 'success');
    }
    state.lastNotificationIds.add(notification.id);
  }

  renderAll();
}

async function loadSession(initial = false) {
  try {
    const data = await api(initial ? 'me' : 'sync');
    setSnapshot(data, initial);
    showOnly('appShell');
    if (!state.couple) openDialog('coupleDialog');
    startPolling();
    return true;
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      state.user = null;
      stopPolling();
      showOnly('authScreen');
      return false;
    }
    if (error.code === 'DATABASE_URL_MISSING') {
      showOnly('gateScreen');
      $('#gateTitle').textContent = 'Falta conectar Neon';
      $('#gateText').textContent = 'Agrega DATABASE_URL en las variables privadas del proyecto de Vercel.';
      $('#gateLoader').classList.add('hidden');
      return false;
    }
    throw error;
  }
}

function startPolling() {
  stopPolling();
  state.poller = setInterval(async () => {
    if (document.hidden || !state.user) return;
    try {
      const data = await api('sync');
      setSnapshot(data, false);
    } catch (error) {
      if (error.code === 'UNAUTHORIZED') {
        stopPolling();
        showOnly('authScreen');
      }
    }
  }, 3500);
}

function stopPolling() {
  if (state.poller) clearInterval(state.poller);
  state.poller = null;
}

function renderAll() {
  if (!state.user) return;
  const me = state.members.find((member) => member.user_id === state.user.id) || state.user;
  const partner = state.partner;
  const avatar = me.avatar || me.display_name?.slice(0, 1).toUpperCase() || 'D';
  const partnerAvatar = partner?.avatar || partner?.display_name?.slice(0, 1).toUpperCase() || '?';

  $('#userAvatar').textContent = avatar;
  $('#homeAvatarMe').textContent = avatar;
  $('#homeAvatarPartner').textContent = partnerAvatar;
  $('#moodNameMe').textContent = me.display_name || 'Tú';
  $('#moodTextMe').textContent = me.mood_text || 'Feliz';
  $('#moodEmojiMe').textContent = me.mood_emoji || '😊';
  $('#moodNamePartner').textContent = partner?.display_name || 'Tu pareja';
  $('#moodTextPartner').textContent = partner ? (partner.mood_text || 'Feliz') : 'Aún no se ha unido';
  $('#moodEmojiPartner').textContent = partner?.mood_emoji || '💜';
  $('#chatPartnerAvatar').textContent = partnerAvatar;
  $('#chatPartnerName').textContent = partner?.display_name || 'Tu pareja';
  $('#chatPartnerStatus').textContent = partner ? (isOnline(partner) ? 'En línea' : `Última vez ${fmtDate(partner.last_seen, { dateStyle: undefined, hour: '2-digit', minute: '2-digit' })}`) : 'Aún no se ha unido';
  $('#onlineDot').style.background = partner && isOnline(partner) ? '#34d399' : '#737083';

  $('#heroGreeting').textContent = state.couple?.couple_name || 'Nuestro lugar siempre está cerca.';
  $('#heroSubtitle').textContent = partner ? `${me.display_name} y ${partner.display_name}, este espacio es solo de ustedes.` : 'Comparte el código y el PIN con tu pareja para completar Duke.';
  $('#daysTogether').textContent = daysSince(state.couple?.relationship_date);
  $('#messageCount').textContent = state.stats.messages ?? state.messages.length;
  $('#memoryCount').textContent = state.stats.memories ?? state.memories.length;
  $('#streakCount').textContent = state.stats.streak ?? 0;
  $('#profileNameInput').value = me.display_name || '';
  $('#profileAvatarInput').value = avatar;
  $('#profileInviteCode').textContent = state.couple?.invite_code || '—';

  renderMessages();
  renderMemories();
  renderDates();
  renderGames();
}

function renderMessages() {
  const list = $('#messagesList');
  if (!state.messages.length) {
    list.innerHTML = '<div class="empty-chat"><span>💜</span><strong>Su conversación comienza aquí</strong><p>Escribe el primer mensaje de este espacio privado.</p></div>';
    return;
  }
  list.innerHTML = state.messages.map((message) => {
    const mine = message.sender_id === state.user.id;
    const image = message.media_url ? `<img src="${escapeHtml(message.media_url)}" alt="Imagen compartida" />` : '';
    const quote = message.reply_preview ? `<div class="quoted">${escapeHtml(message.reply_preview)}</div>` : '';
    return `<article class="message ${mine ? 'mine' : ''}" data-message-id="${message.id}" data-message-preview="${escapeHtml(message.body || 'Imagen')}">${image}${quote}${message.body ? `<div>${escapeHtml(message.body).replaceAll('\n', '<br>')}</div>` : ''}<small>${fmtTime(message.created_at)}</small></article>`;
  }).join('');
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
}

function renderMemories() {
  const grid = $('#memoriesGrid');
  if (!state.memories.length) {
    grid.innerHTML = '<div class="empty-memories"><span>◇</span><h3>Todavía no hay recuerdos</h3><p>Guarden aquí las fotos y momentos que no quieren olvidar.</p></div>';
    return;
  }
  grid.innerHTML = state.memories.map((memory) => `<article class="memory-card glass">${memory.media_url ? `<img src="${escapeHtml(memory.media_url)}" alt="${escapeHtml(memory.title)}" />` : ''}<div class="memory-body"><h4>${escapeHtml(memory.title)}</h4>${memory.description ? `<p>${escapeHtml(memory.description)}</p>` : ''}<div class="memory-meta"><span>${escapeHtml(memory.author_name || '')}</span><span>${fmtDate(memory.memory_date || memory.created_at)}</span></div></div></article>`).join('');
}

function normalizedUpcomingDate(item) {
  const raw = String(item.event_date).slice(0, 10);
  const date = new Date(`${raw}T12:00:00`);
  if (item.repeats_yearly) {
    const now = new Date();
    date.setFullYear(now.getFullYear());
    if (date < now) date.setFullYear(now.getFullYear() + 1);
  }
  return date;
}

function renderDates() {
  const now = new Date();
  const upcoming = state.dates
    .map((item) => ({ item, date: normalizedUpcomingDate(item) }))
    .filter(({ date }) => date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => a.date - b.date)[0];
  if (!upcoming) {
    $('#nextDateCard').textContent = 'Añadan una fecha importante.';
    return;
  }
  const days = Math.ceil((upcoming.date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  $('#nextDateCard').innerHTML = `<div><strong>${escapeHtml(upcoming.item.title)}</strong><br><small>${fmtDate(upcoming.date)} · ${days === 0 ? 'Hoy' : `faltan ${days} días`}</small></div>`;
}

function defaultTic() {
  return { board: Array(9).fill(''), turn: 'X', winner: '', scores: { X: 0, O: 0, draw: 0 } };
}

function ticWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 'draw' : '';
}

function myTicSymbol() {
  const ordered = [...state.members];
  const index = Math.max(0, ordered.findIndex((member) => member.user_id === state.user.id));
  return index === 0 ? 'X' : 'O';
}

function renderGames() {
  const game = { ...defaultTic(), ...(state.games.tictactoe || {}) };
  game.board = Array.isArray(game.board) && game.board.length === 9 ? game.board : Array(9).fill('');
  game.scores = { X: 0, O: 0, draw: 0, ...(game.scores || {}) };
  const mySymbol = myTicSymbol();
  const partnerSymbol = mySymbol === 'X' ? 'O' : 'X';
  $('#ticBoard').innerHTML = game.board.map((cell, index) => `<button class="tic-cell ${cell ? cell.toLowerCase() : ''}" data-cell="${index}" ${cell || game.winner ? 'disabled' : ''}>${cell}</button>`).join('');
  $('#ticStatus').textContent = game.winner === 'draw' ? 'Empate' : game.winner ? `Ganó ${game.winner === mySymbol ? 'tú' : 'tu pareja'}` : game.turn === mySymbol ? `Tu turno: ${mySymbol}` : `Turno de tu pareja: ${partnerSymbol}`;
  $('#ticScoreMe').textContent = game.scores[mySymbol] || 0;
  $('#ticScorePartner').textContent = game.scores[partnerSymbol] || 0;
  $('#ticScoreDraw').textContent = game.scores.draw || 0;

  const q = state.games.questions || { index: 0, answers: {} };
  const index = Number.isInteger(q.index) ? q.index % questions.length : 0;
  $('#questionText').textContent = questions[index];
  $('#questionAnswerInput').value = q.answers?.[state.user.id] || '';
  const answers = q.answers || {};
  $('#questionAnswers').innerHTML = state.members.map((member) => `<article class="answer-card"><small>${escapeHtml(member.display_name)}</small><div>${answers[member.user_id] ? escapeHtml(answers[member.user_id]) : 'Aún no ha respondido.'}</div></article>`).join('');
  if (state.games.roulette?.result) $('#rouletteResult').textContent = state.games.roulette.result;
}

async function saveGame(gameType, gameState) {
  await api('save_game', { method: 'POST', body: { gameType, state: gameState } });
  state.games[gameType] = gameState;
  renderGames();
}

function switchView(name) {
  const titles = { home: ['NUESTRO ESPACIO', 'Inicio'], chat: ['CONVERSACIÓN', 'Chat'], call: ['CERCA DE TI', 'Llamadas'], games: ['TIEMPO JUNTOS', 'Juegos'], memories: ['NUESTRA HISTORIA', 'Recuerdos'] };
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}View`));
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  $('#viewEyebrow').textContent = titles[name]?.[0] || '';
  $('#viewTitle').textContent = titles[name]?.[1] || name;
  api('presence', { method: 'POST', body: { status: 'online', currentView: name } }).catch(() => {});
}

async function beginCall(type) {
  if (!state.partner) return toast('Tu pareja todavía no se ha unido.', 'error');
  try {
    const data = await api('start_call', { method: 'POST', body: { type } });
    switchView('call');
    $('#callLobby').classList.add('hidden');
    $('#jitsiContainer').classList.remove('hidden');
    $('#endCallButton').classList.remove('hidden');
    if (state.jitsi) state.jitsi.dispose();
    if (!window.JitsiMeetExternalAPI) throw new Error('JITSI_UNAVAILABLE');
    state.jitsi = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: data.roomName,
      parentNode: $('#jitsiContainer'),
      userInfo: { displayName: state.user.display_name },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: type === 'audio',
        prejoinPageEnabled: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false },
    });
    toast(type === 'audio' ? 'Llamada de voz iniciada.' : 'Videollamada iniciada.', 'success');
  } catch (error) {
    toast(translateError(error.code || error.message), 'error');
  }
}

function endCall() {
  state.jitsi?.dispose();
  state.jitsi = null;
  $('#jitsiContainer').innerHTML = '';
  $('#jitsiContainer').classList.add('hidden');
  $('#endCallButton').classList.add('hidden');
  $('#callLobby').classList.remove('hidden');
}

export { $, $$, state, questions, rouletteItems, toast, translateError, api, showOnly, openDialog, closeDialog, imageToDataUrl, unlockPrivateLink, setSnapshot, loadSession, stopPolling, switchView, beginCall, endCall, defaultTic, ticWinner, myTicSymbol, saveGame };
