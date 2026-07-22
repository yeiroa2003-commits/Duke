import { $, state, toast, switchView } from './core.js';

const emojiRounds = [
  { emoji: '🍿🎬🛋️', answer: 'noche de peliculas', hint: 'Plan tranquilo en casa' },
  { emoji: '✈️🏝️❤️', answer: 'viaje romantico', hint: 'Una aventura para dos' },
  { emoji: '🍕🍝🍷', answer: 'cena italiana', hint: 'Comida y conversación' },
  { emoji: '🌧️💃🕺', answer: 'bailar bajo la lluvia', hint: 'Momento de película' },
  { emoji: '🌅☕🤗', answer: 'ver el amanecer', hint: 'Hay que levantarse temprano' },
  { emoji: '🎤🎶😂', answer: 'noche de karaoke', hint: 'No importa cantar bien' },
  { emoji: '🧺🌳🥪', answer: 'picnic en el parque', hint: 'Comida al aire libre' },
  { emoji: '📸🚶‍♀️🚶‍♂️', answer: 'paseo de fotos', hint: 'Guarden recuerdos del camino' },
  { emoji: '🍰🕯️🎁', answer: 'celebracion sorpresa', hint: 'Algo especial e inesperado' },
  { emoji: '🎮🍕🏆', answer: 'noche de videojuegos', hint: 'Competencia amistosa' },
];

const weeklyTasks = [
  'Enviar un mensaje de buenos días', 'Decir tres cualidades que admiras', 'Compartir una canción',
  'Planear una cita sencilla', 'Recordar juntos un momento divertido', 'Tener 20 minutos sin teléfonos',
  'Cerrar la semana con un agradecimiento',
];

const activityIdeas = [
  ['🎬', 'Noche de películas', 'Elijan una película cada uno y voten cuál ver.'],
  ['🍳', 'Cocinar juntos', 'Preparen una receta nueva por videollamada o en casa.'],
  ['📸', 'Reto de cinco fotos', 'Tomen fotos de cinco cosas que les recuerden al otro.'],
  ['🎵', 'Playlist de ustedes', 'Cada uno agrega cinco canciones y explica una.'],
  ['🗺️', 'Planear un viaje', 'Elijan destino, alojamiento y tres lugares para visitar.'],
  ['✉️', 'Carta para el futuro', 'Escriban algo para leer dentro de un año.'],
  ['☕', 'Cita de café', 'Hablen de un sueño sin tocar temas de trabajo.'],
  ['🌙', 'Mirar el cielo', 'Busquen la luna y hablen diez minutos sin pantallas.'],
  ['🎨', 'Dibujarse mutuamente', 'No importa el resultado: gana el más divertido.'],
  ['📚', 'Historia compartida', 'Uno comienza una historia y el otro la continúa.'],
  ['🚶', 'Paseo con preguntas', 'Caminen y respondan cinco preguntas profundas.'],
  ['🍦', 'Probar algo nuevo', 'Elijan un sabor o comida que nunca hayan probado.'],
  ['🧩', 'Rompecabezas en equipo', 'Completen uno mientras escuchan su playlist.'],
  ['💆', 'Noche de relajación', 'Masaje, música tranquila y conversación suave.'],
  ['😂', 'Concurso de memes', 'Cada uno busca tres memes que describan la relación.'],
  ['🏆', 'Celebrar un logro', 'Celebren algo pequeño que uno de los dos consiguió.'],
  ['🧹', 'Proyecto juntos', 'Ordenen o decoren un espacio mientras hablan.'],
  ['🌮', 'Cena temática', 'Elijan un país y preparen una cena inspirada en él.'],
  ['🎤', 'Karaoke privado', 'Canten canciones que ambos conocen.'],
  ['💭', 'Tablero de sueños', 'Junten imágenes de metas que desean cumplir juntos.'],
];

const datePlaces = ['en casa', 'en un parque', 'en una cafetería', 'junto al mar', 'en un lugar nuevo', 'por videollamada'];
const dateFoods = ['pizza', 'postre y café', 'comida casera', 'hamburguesas', 'helado', 'su comida favorita'];
const dateActivities = ['hacer preguntas para conocerse más', 'ver una película', 'tomar fotos', 'escuchar música', 'jugar juntos', 'planear un viaje'];

const plus = { games: {}, active: null, poller: null, initialized: false, activityIndex: 0 };

function gamesApi(action, payload = {}) {
  return fetch(`/api/games?action=${encodeURIComponent(action)}`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({ ok: false, error: 'SERVER_ERROR' }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'SERVER_ERROR');
    return data;
  });
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function injectStyles() {
  if ($('#activitiesPlusStyles')) return;
  const style = document.createElement('style');
  style.id = 'activitiesPlusStyles';
  style.textContent = `
    .activities-plus{margin-top:25px}.activities-plus-head{margin:0 3px 13px}.activities-plus-head h3{margin:0;font-size:1.5rem}.activities-plus-head p{color:var(--muted);margin:6px 0 0}
    .activities-game-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.activities-game-card{padding:19px;border-radius:19px;border:1px solid var(--line);background:linear-gradient(145deg,rgba(27,18,49,.86),rgba(10,8,20,.82));cursor:pointer;text-align:left}.activities-game-card:hover{transform:translateY(-3px);border-color:rgba(139,92,246,.55)}.activities-game-card span,.activities-game-card strong,.activities-game-card small{display:block}.activities-game-card span{font-size:2rem;margin-bottom:12px}.activities-game-card small{color:var(--muted);line-height:1.45;margin-top:5px}
    .plus-game-dialog{border:0;background:transparent;color:white;width:min(94vw,760px);padding:0}.plus-game-dialog::backdrop{background:rgba(0,0,0,.8);backdrop-filter:blur(10px)}.plus-game-box{padding:24px;border-radius:25px;background:linear-gradient(145deg,rgba(28,18,51,.99),rgba(8,6,17,.99));border:1px solid var(--line);box-shadow:0 28px 90px rgba(0,0,0,.58)}
    .plus-game-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.plus-game-head h3{margin:0}.plus-game-close{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}.plus-game-content{margin-top:20px}
    .emoji-stage{text-align:center;padding:28px;border-radius:20px;background:radial-gradient(circle at top,rgba(139,92,246,.25),rgba(37,99,235,.06));border:1px solid var(--line)}.emoji-stage .emoji{font-size:clamp(3rem,9vw,5.5rem);letter-spacing:.12em}.emoji-stage h4{font-size:1.3rem;margin:15px 0 5px}.emoji-form{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:14px}.emoji-guesses{display:grid;gap:7px;margin-top:13px}.emoji-guess{padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.06)}.emoji-guess.correct{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3)}
    .shared-list{display:grid;gap:9px;margin-top:14px}.shared-item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08)}.shared-item.done .shared-text{text-decoration:line-through;color:var(--muted)}.shared-check,.shared-delete{border:0;background:rgba(255,255,255,.08);border-radius:10px;width:36px;height:36px;cursor:pointer}.shared-add{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:16px}
    .coupon-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.love-coupon{padding:17px;border-radius:17px;background:linear-gradient(135deg,rgba(244,63,94,.2),rgba(139,92,246,.16));border:1px dashed rgba(253,164,175,.4)}.love-coupon.redeemed{opacity:.58}.love-coupon p{font-size:1.05rem;margin:0 0 12px}.love-coupon small{color:var(--muted)}.love-coupon button{margin-top:12px}
    .challenge-list{display:grid;gap:9px}.challenge-day{padding:13px;border-radius:15px;border:1px solid var(--line);background:rgba(255,255,255,.045)}.challenge-day-head{display:flex;justify-content:space-between;gap:10px}.challenge-people{display:flex;gap:7px;margin-top:10px}.challenge-person{padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.07);font-size:.73rem}.challenge-person.done{background:rgba(34,197,94,.16);color:#a7f3d0}
    .date-result{padding:26px;text-align:center;border-radius:20px;background:radial-gradient(circle at top,rgba(249,115,22,.2),rgba(219,39,119,.07));border:1px solid var(--line)}.date-result span{font-size:3rem}.date-result h4{font-size:1.4rem;line-height:1.4;margin:14px auto;max-width:560px}.plus-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:15px}
    .home-activity{margin-top:14px;padding:22px;border-radius:22px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;background:radial-gradient(circle at 90% 10%,rgba(139,92,246,.23),transparent 35%),linear-gradient(145deg,rgba(27,18,49,.9),rgba(10,8,20,.85));border:1px solid var(--line);box-shadow:var(--shadow)}.home-activity-icon{width:68px;height:68px;border-radius:20px;display:grid;place-items:center;font-size:2rem;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(37,99,235,.22))}.home-activity h3{margin:3px 0 5px}.home-activity p{margin:0;color:var(--muted);line-height:1.45}.home-activity-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    @media(max-width:900px){.activities-game-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.activities-game-grid,.coupon-grid{grid-template-columns:1fr}.emoji-form,.shared-add{grid-template-columns:1fr}.home-activity{grid-template-columns:auto 1fr}.home-activity-actions{grid-column:1/-1;justify-content:stretch}.home-activity-actions button{flex:1}}
  `;
  document.head.append(style);
}

function buildGamesSection() {
  if ($('#activitiesPlus')) return;
  const gamesView = $('#gamesView');
  if (!gamesView) return;
  const section = document.createElement('section');
  section.id = 'activitiesPlus';
  section.className = 'activities-plus';
  section.innerHTML = `
    <div class="activities-plus-head"><p class="eyebrow">NUEVOS JUEGOS Y PLANES</p><h3>Más cosas para hacer juntos</h3><p>Sus avances se sincronizan entre ambos teléfonos.</p></div>
    <div class="activities-game-grid">
      <button class="activities-game-card" data-plus-game="emoji_guess"><span>🧩</span><strong>Adivina los emojis</strong><small>Descubran la frase escondida.</small></button>
      <button class="activities-game-card" data-plus-game="bucket_list"><span>🌍</span><strong>Lista de sueños</strong><small>Metas y lugares que quieren cumplir juntos.</small></button>
      <button class="activities-game-card" data-plus-game="love_coupons"><span>🎟️</span><strong>Cupones de amor</strong><small>Regalen detalles que pueden canjear.</small></button>
      <button class="activities-game-card" data-plus-game="weekly_challenge"><span>🔥</span><strong>Reto de 7 días</strong><small>Una pequeña acción de pareja cada día.</small></button>
      <button class="activities-game-card" data-plus-game="date_planner"><span>💡</span><strong>Generador de citas</strong><small>Duke combina un plan sorpresa.</small></button>
    </div>`;
  gamesView.append(section);
  section.querySelectorAll('[data-plus-game]').forEach((button) => button.addEventListener('click', () => openGame(button.dataset.plusGame)));
}

function buildDialog() {
  if ($('#plusGameDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'plusGameDialog';
  dialog.className = 'plus-game-dialog';
  dialog.innerHTML = `<div class="plus-game-box"><div class="plus-game-head"><div><p class="eyebrow">ACTIVIDAD PARA DOS</p><h3 id="plusGameTitle"></h3></div><button id="closePlusGame" class="plus-game-close" type="button">×</button></div><div id="plusGameContent" class="plus-game-content"></div></div>`;
  document.body.append(dialog);
  $('#closePlusGame').addEventListener('click', () => dialog.close());
}

function buildHomeActivity() {
  if ($('#homeActivityIdea')) return true;
  const anchor = $('#dukeNotesSection') || $('#dukeTodaySection') || $('.dashboard-grid');
  if (!anchor) return false;
  const card = document.createElement('section');
  card.id = 'homeActivityIdea';
  card.className = 'home-activity';
  card.innerHTML = `<div id="homeActivityIcon" class="home-activity-icon">🎬</div><div><p class="eyebrow">IDEA PARA HOY</p><h3 id="homeActivityTitle"></h3><p id="homeActivityText"></p></div><div class="home-activity-actions"><button id="anotherActivity" class="secondary-btn" type="button">Otra idea</button><button id="proposeActivity" class="primary-btn" type="button">Proponer en chat</button></div>`;
  anchor.after(card);
  $('#anotherActivity').addEventListener('click', () => { plus.activityIndex = (plus.activityIndex + 1 + Math.floor(Math.random() * 5)) % activityIdeas.length; renderActivity(); });
  $('#proposeActivity').addEventListener('click', proposeActivity);
  renderActivity();
  return true;
}

function renderActivity() {
  const idea = activityIdeas[plus.activityIndex % activityIdeas.length];
  if (!idea || !$('#homeActivityTitle')) return;
  $('#homeActivityIcon').textContent = idea[0];
  $('#homeActivityTitle').textContent = idea[1];
  $('#homeActivityText').textContent = idea[2];
}

function proposeActivity() {
  const idea = activityIdeas[plus.activityIndex % activityIdeas.length];
  switchView('chat');
  const input = $('#messageInput');
  if (input) { input.value = `¿Hacemos esto juntos? ${idea[0]} ${idea[1]}\n${idea[2]}`; input.focus(); }
}

async function loadGames(render = true) {
  if (!state.user || !state.couple) return;
  try {
    const data = await gamesApi('get');
    plus.games = data.games || {};
    if (render && plus.active && $('#plusGameDialog')?.open) renderGame(plus.active);
  } catch {}
}

async function saveGame(type, game) {
  plus.games[type] = game;
  renderGame(type);
  try { await gamesApi('save', { gameType: type, state: game }); }
  catch { toast('No se pudo sincronizar esta actividad.', 'error'); }
}

function openGame(type) {
  plus.active = type;
  renderGame(type);
  const dialog = $('#plusGameDialog');
  if (!dialog.open) dialog.showModal();
}

function renderGame(type) {
  const titles = { emoji_guess: 'Adivina los emojis', bucket_list: 'Lista de sueños', love_coupons: 'Cupones de amor', weekly_challenge: 'Reto de 7 días', date_planner: 'Generador de citas' };
  $('#plusGameTitle').textContent = titles[type] || 'Actividad';
  if (type === 'emoji_guess') renderEmoji();
  if (type === 'bucket_list') renderBucket();
  if (type === 'love_coupons') renderCoupons();
  if (type === 'weekly_challenge') renderChallenge();
  if (type === 'date_planner') renderDatePlanner();
}

function renderEmoji() {
  const game = plus.games.emoji_guess || { index: 0, guesses: [], winnerId: null };
  const round = emojiRounds[Number(game.index || 0) % emojiRounds.length];
  const winner = state.members.find((member) => member.user_id === game.winnerId)?.display_name;
  $('#plusGameContent').innerHTML = `
    <div class="emoji-stage"><div class="emoji">${round.emoji}</div><h4>${winner ? `🏆 ${escapeText(winner)} adivinó` : '¿Qué plan representan?'}</h4><small>Pista: ${round.hint}</small></div>
    ${!winner ? '<form id="emojiGuessForm" class="emoji-form"><input id="emojiGuessInput" maxlength="60" required placeholder="Escribe tu respuesta" /><button class="primary-btn">Adivinar</button></form>' : ''}
    <div class="plus-actions"><button id="nextEmojiRound" class="secondary-btn" type="button">Nueva ronda</button></div>
    <div class="emoji-guesses">${(game.guesses || []).slice(-8).reverse().map((guess) => `<div class="emoji-guess ${guess.correct ? 'correct' : ''}">${guess.correct ? '✅ ' : ''}${escapeText(guess.text)} <small>— ${escapeText(guess.name)}</small></div>`).join('')}</div>`;
  $('#emojiGuessForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = $('#emojiGuessInput').value.trim();
    const correct = normalize(text) === normalize(round.answer);
    await saveGame('emoji_guess', { ...game, guesses: [...(game.guesses || []), { text, correct, name: state.user.display_name, userId: state.user.id }].slice(-15), winnerId: correct ? state.user.id : null });
    toast(correct ? '¡Adivinaste! 🎉' : 'No es esa. Sigue intentando.', correct ? 'success' : 'error');
  });
  $('#nextEmojiRound').addEventListener('click', () => saveGame('emoji_guess', { index: (Number(game.index || 0) + 1) % emojiRounds.length, guesses: [], winnerId: null }));
}

function renderBucket() {
  const game = plus.games.bucket_list || { items: [] };
  $('#plusGameContent').innerHTML = `
    <p style="color:var(--muted)">Agreguen viajes, metas, experiencias y sueños que quieran compartir.</p>
    <div class="shared-list">${(game.items || []).map((item) => `<div class="shared-item ${item.done ? 'done' : ''}"><button class="shared-check" data-bucket-check="${item.id}" type="button">${item.done ? '✓' : '○'}</button><div class="shared-text"><strong>${escapeText(item.text)}</strong><small style="display:block;color:var(--muted);margin-top:3px">${escapeText(item.name || '')}</small></div><button class="shared-delete" data-bucket-delete="${item.id}" type="button">×</button></div>`).join('') || '<div style="color:var(--muted);text-align:center;padding:20px">Su lista comienza aquí.</div>'}</div>
    <form id="bucketAddForm" class="shared-add"><input id="bucketText" maxlength="100" required placeholder="Ej. Conocer una playa nueva" /><button class="primary-btn">Agregar</button></form>`;
  $('#bucketAddForm').addEventListener('submit', (event) => { event.preventDefault(); const text = $('#bucketText').value.trim(); if (text) saveGame('bucket_list', { items: [...(game.items || []), { id: uid(), text, done: false, userId: state.user.id, name: state.user.display_name }].slice(-60) }); });
  document.querySelectorAll('[data-bucket-check]').forEach((button) => button.addEventListener('click', () => saveGame('bucket_list', { items: game.items.map((item) => item.id === button.dataset.bucketCheck ? { ...item, done: !item.done } : item) })));
  document.querySelectorAll('[data-bucket-delete]').forEach((button) => button.addEventListener('click', () => saveGame('bucket_list', { items: game.items.filter((item) => item.id !== button.dataset.bucketDelete) })));
}

function renderCoupons() {
  const game = plus.games.love_coupons || { items: [] };
  const presets = ['Un masaje', 'Elegir la película', 'Desayuno sorpresa', 'Una llamada larga', 'Una cita especial', 'Un abrazo de 2 minutos'];
  $('#plusGameContent').innerHTML = `
    <div class="coupon-grid">${(game.items || []).map((item) => `<article class="love-coupon ${item.redeemed ? 'redeemed' : ''}"><p>🎟️ ${escapeText(item.text)}</p><small>Creado por ${escapeText(item.name || 'Duke')}</small>${item.redeemed ? '<strong style="display:block;margin-top:10px">CANJEADO ✓</strong>' : `<button class="secondary-btn" data-coupon-redeem="${item.id}" type="button">Canjear cupón</button>`}</article>`).join('') || '<div style="grid-column:1/-1;color:var(--muted);text-align:center;padding:20px">Todavía no hay cupones.</div>'}</div>
    <form id="couponForm" class="shared-add"><input id="couponText" maxlength="80" list="couponPresets" required placeholder="Escribe un detalle para regalar" /><datalist id="couponPresets">${presets.map((item) => `<option value="${item}">`).join('')}</datalist><button class="primary-btn">Crear cupón</button></form>`;
  $('#couponForm').addEventListener('submit', (event) => { event.preventDefault(); const text = $('#couponText').value.trim(); if (text) saveGame('love_coupons', { items: [...(game.items || []), { id: uid(), text, name: state.user.display_name, createdBy: state.user.id, redeemed: false }].slice(-30) }); });
  document.querySelectorAll('[data-coupon-redeem]').forEach((button) => button.addEventListener('click', () => saveGame('love_coupons', { items: game.items.map((item) => item.id === button.dataset.couponRedeem ? { ...item, redeemed: true, redeemedBy: state.user.id } : item) })));
}

function weekKey() {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  return `${now.getFullYear()}-${Math.ceil((((now - first) / 86400000) + first.getDay() + 1) / 7)}`;
}

function renderChallenge() {
  let game = plus.games.weekly_challenge || { week: weekKey(), completed: {} };
  if (game.week !== weekKey()) game = { week: weekKey(), completed: {} };
  $('#plusGameContent').innerHTML = `<div class="challenge-list">${weeklyTasks.map((task, index) => {
    const completed = game.completed?.[index] || [];
    return `<article class="challenge-day"><div class="challenge-day-head"><div><small>DÍA ${index + 1}</small><strong style="display:block;margin-top:3px">${task}</strong></div><button class="secondary-btn" data-challenge="${index}" type="button">${completed.includes(state.user.id) ? 'Desmarcar' : 'Completar'}</button></div><div class="challenge-people">${state.members.map((member) => `<span class="challenge-person ${completed.includes(member.user_id) ? 'done' : ''}">${completed.includes(member.user_id) ? '✓ ' : ''}${escapeText(member.display_name)}</span>`).join('')}</div></article>`;
  }).join('')}</div>`;
  document.querySelectorAll('[data-challenge]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.challenge); const current = [...(game.completed?.[index] || [])]; const has = current.includes(state.user.id); const next = has ? current.filter((id) => id !== state.user.id) : [...current, state.user.id];
    saveGame('weekly_challenge', { ...game, completed: { ...(game.completed || {}), [index]: next } });
  }));
}

function randomDatePlan() {
  return { place: datePlaces[Math.floor(Math.random() * datePlaces.length)], food: dateFoods[Math.floor(Math.random() * dateFoods.length)], activity: dateActivities[Math.floor(Math.random() * dateActivities.length)], createdBy: state.user.id, createdAt: new Date().toISOString() };
}

function renderDatePlanner() {
  const game = plus.games.date_planner || { current: randomDatePlan() };
  const current = game.current || randomDatePlan();
  const sentence = `Una cita ${current.place}, comiendo ${current.food} y dedicando un rato a ${current.activity}.`;
  $('#plusGameContent').innerHTML = `<div class="date-result"><span>💞</span><p class="eyebrow">SU PRÓXIMA CITA</p><h4>${escapeText(sentence)}</h4></div><div class="plus-actions"><button id="newDatePlan" class="secondary-btn" type="button">Generar otra</button><button id="shareDatePlan" class="primary-btn" type="button">Proponer en chat</button></div>`;
  $('#newDatePlan').addEventListener('click', () => saveGame('date_planner', { current: randomDatePlan() }));
  $('#shareDatePlan').addEventListener('click', () => { $('#plusGameDialog').close(); switchView('chat'); const input = $('#messageInput'); if (input) { input.value = `Tengo una idea para nuestra próxima cita 💞\n${sentence}`; input.focus(); } });
}

function initActivitiesPlus() {
  if (plus.initialized) return;
  plus.initialized = true;
  injectStyles();
  buildGamesSection();
  buildDialog();
  const injectHome = () => { if (!buildHomeActivity()) setTimeout(injectHome, 350); };
  injectHome();
  plus.activityIndex = new Date().getDate() % activityIdeas.length;
  loadGames(false);
  clearInterval(plus.poller);
  plus.poller = setInterval(() => loadGames(true), 1800);
}

export { initActivitiesPlus };
