import { $, state, toast } from './core.js';

const extra = {
  games: {},
  active: null,
  poller: null,
  memoryLock: false,
};

const truths = [
  '¿Cuál fue el momento en que supiste que te estabas enamorando?',
  '¿Qué detalle de tu pareja te hace sentir más amado/a?',
  '¿Cuál es un miedo que todavía no le habías contado?',
  '¿Qué recuerdo de ustedes repetirías exactamente igual?',
  '¿Qué cosa te gustaría mejorar juntos como pareja?',
  '¿Qué fue lo primero que pensaste al conocerle?',
  '¿Cuál es tu sueño más grande para los dos?',
  '¿Qué canción describe mejor su relación?',
  '¿Cuál ha sido el gesto más romántico que recibiste?',
  '¿Qué cosa pequeña extrañas cuando están separados?',
];

const dares = [
  'Dile cinco cosas que amas de su personalidad.',
  'Envíale un audio cantando una parte de su canción favorita.',
  'Imita durante 30 segundos la forma en que habla tu pareja.',
  'Planea una cita virtual para esta semana.',
  'Cuenta un recuerdo divertido sin decir dónde ocurrió.',
  'Dale un cumplido que nunca le hayas dicho.',
  'Hazle una promesa bonita para el próximo mes.',
  'Envía una foto haciendo una cara graciosa.',
  'Describe su beso perfecto en tres palabras.',
  'Elige una película para verla juntos y explica por qué.',
];

const ratherQuestions = [
  ['¿Viaje romántico a la playa?', '¿Escapada romántica a la montaña?'],
  ['¿Una cena elegante?', '¿Una noche de películas en casa?'],
  ['¿Recibir una carta de amor?', '¿Recibir una sorpresa inesperada?'],
  ['¿Bailar juntos bajo la lluvia?', '¿Ver juntos un amanecer?'],
  ['¿Hablar toda la noche?', '¿Dormir abrazados todo el día?'],
  ['¿Repetir la primera cita?', '¿Vivir una cita totalmente nueva?'],
  ['¿Un regalo hecho a mano?', '¿Una experiencia para recordar?'],
  ['¿Cocinar juntos?', '¿Pedir su comida favorita?'],
];

const diceActions = ['Beso', 'Abrazo', 'Cumplido', 'Confesión', 'Masaje', 'Baile'];
const diceTargets = ['en la frente', 'durante 20 segundos', 'con los ojos cerrados', 'muy lentamente', 'con una canción', 'como sorpresa'];

const compatibilityQuestions = [
  ['Para una cita ideal prefieres…', 'Salir a explorar', 'Quedarse en casa'],
  ['Cuando estás triste necesitas…', 'Hablar inmediatamente', 'Un poco de espacio'],
  ['El mejor regalo sería…', 'Algo sentimental', 'Una experiencia juntos'],
  ['En vacaciones prefieres…', 'Planificar todo', 'Improvisar'],
  ['Demuestras amor principalmente con…', 'Palabras y mensajes', 'Acciones y detalles'],
  ['Un domingo perfecto es…', 'Descansar sin planes', 'Hacer algo nuevo'],
  ['Para resolver una discusión prefieres…', 'Hablar hasta resolverla', 'Calmarse y hablar después'],
  ['El futuro ideal incluye…', 'Mucha estabilidad', 'Muchas aventuras'],
];

const bingoTasks = [
  'Decirse te amo', 'Ver una película', 'Enviar un audio bonito', 'Recordar la primera cita',
  'Planear un viaje', 'Cocinar juntos', 'Hacerse reír', 'Compartir una canción',
  'Dar un cumplido', 'Hablar de un sueño', 'Tener una cita virtual', 'Enviar una foto juntos',
  'Resolver algo en equipo', 'Contar un secreto', 'Celebrar un logro', 'Prometer un nuevo plan',
];

function gamesApi(action, payload = {}) {
  return fetch(`/api/games?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({ ok: false, error: 'SERVER_ERROR' }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'SERVER_ERROR');
    return data;
  });
}

function injectStyles() {
  if ($('#dukeExtraGamesStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeExtraGamesStyles';
  style.textContent = `
    .extra-games-title{margin:26px 0 13px}.extra-games-title h3{margin:0;font-size:1.55rem}.extra-games-title p{color:#aaa4bb;margin:.4rem 0 0}
    .extra-games-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.extra-game-card{border:1px solid rgba(255,255,255,.11);border-radius:20px;padding:20px;text-align:left;background:linear-gradient(145deg,rgba(27,18,49,.84),rgba(10,8,20,.8));cursor:pointer;transition:.2s}.extra-game-card:hover{transform:translateY(-3px);border-color:rgba(139,92,246,.55)}.extra-game-card span{display:block;font-size:2rem;margin-bottom:14px}.extra-game-card strong,.extra-game-card small{display:block}.extra-game-card small{color:#aaa4bb;margin-top:6px;line-height:1.45}
    .extra-game-dialog{border:0;background:transparent;color:white;width:min(94vw,720px);padding:0}.extra-game-dialog::backdrop{background:rgba(0,0,0,.78);backdrop-filter:blur(10px)}.extra-game-box{padding:25px;border-radius:25px;background:linear-gradient(145deg,rgba(28,18,51,.98),rgba(8,6,17,.98));border:1px solid rgba(255,255,255,.13);box-shadow:0 28px 90px rgba(0,0,0,.55)}.extra-game-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.extra-game-head h3{margin:0;font-size:1.55rem}.extra-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.07);cursor:pointer}
    .game-big-card{margin:22px 0;padding:28px 20px;min-height:170px;border-radius:21px;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at top,rgba(139,92,246,.22),rgba(37,99,235,.06));border:1px solid rgba(255,255,255,.1)}.game-big-card h4{font-size:clamp(1.3rem,4vw,2rem);margin:0;line-height:1.35}.game-choice-row{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.game-choice{padding:18px;border-radius:17px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);cursor:pointer;font-weight:800;min-height:82px}.game-choice.selected{border-color:#8b5cf6;background:rgba(139,92,246,.22)}.game-actions-center{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.game-result{margin-top:16px;padding:14px;border-radius:15px;background:rgba(37,99,235,.1);color:#cbd5ff;text-align:center}
    .love-dice{display:flex;justify-content:center;gap:18px;margin:26px 0}.love-die{width:110px;height:110px;border-radius:24px;display:grid;place-items:center;text-align:center;padding:10px;font-size:1rem;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 16px 45px rgba(37,99,235,.25)}
    .memory-board{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:20px auto;max-width:480px}.memory-card-btn{aspect-ratio:1;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:linear-gradient(145deg,#201634,#0d0a17);font-size:clamp(1.5rem,5vw,2.4rem);cursor:pointer}.memory-card-btn.covered{color:transparent}.memory-card-btn.covered::after{content:'♥';color:#8b5cf6}.memory-card-btn.matched{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.45)}
    .compat-progress{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:18px 0}.compat-progress i{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#2563eb)}.compat-status{text-align:center;color:#aaa4bb;margin-top:14px}
    .bingo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:20px}.bingo-cell{min-height:90px;padding:9px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);cursor:pointer;font-size:.78rem;font-weight:750}.bingo-cell.done{background:linear-gradient(135deg,rgba(139,92,246,.65),rgba(37,99,235,.65));text-decoration:line-through}.bingo-win{text-align:center;margin-top:14px;color:#a7f3d0;font-weight:900}
    @media(max-width:760px){.extra-games-grid{grid-template-columns:repeat(2,1fr)}.extra-game-card{padding:16px}.game-choice-row{grid-template-columns:1fr}.bingo-grid{grid-template-columns:repeat(3,1fr)}.love-die{width:94px;height:94px}.extra-game-box{padding:20px 15px}}
  `;
  document.head.append(style);
}

function injectGames() {
  if ($('#extraGamesSection')) return;
  const gamesView = $('#gamesView');
  const section = document.createElement('section');
  section.id = 'extraGamesSection';
  section.innerHTML = `
    <div class="extra-games-title"><p class="eyebrow">MÁS PARA DISFRUTAR</p><h3>Más juegos de pareja</h3><p>Juegos nuevos sincronizados entre los dos teléfonos.</p></div>
    <div class="extra-games-grid">
      <button class="extra-game-card" data-extra-game="truth_dare"><span>🎭</span><strong>Verdad o reto</strong><small>Preguntas sinceras y retos románticos.</small></button>
      <button class="extra-game-card" data-extra-game="would_you_rather"><span>💭</span><strong>¿Qué prefieres?</strong><small>Elijan y descubran si piensan igual.</small></button>
      <button class="extra-game-card" data-extra-game="love_dice"><span>🎲</span><strong>Dados del amor</strong><small>Una acción y una forma de cumplirla.</small></button>
      <button class="extra-game-card" data-extra-game="memory_match"><span>🧠</span><strong>Memoria de corazones</strong><small>Encuentren todas las parejas juntos.</small></button>
      <button class="extra-game-card" data-extra-game="compatibility"><span>💞</span><strong>Compatibilidad</strong><small>Respondan y comparen sus elecciones.</small></button>
      <button class="extra-game-card" data-extra-game="couple_bingo"><span>🏆</span><strong>Bingo de pareja</strong><small>Completen experiencias y formen líneas.</small></button>
    </div>`;
  gamesView.append(section);
  section.querySelectorAll('[data-extra-game]').forEach((button) => {
    button.addEventListener('click', () => openGame(button.dataset.extraGame));
  });

  const dialog = document.createElement('dialog');
  dialog.id = 'extraGameDialog';
  dialog.className = 'extra-game-dialog';
  dialog.innerHTML = `<div class="extra-game-box"><div class="extra-game-head"><div><p class="eyebrow">JUEGO PARA DOS</p><h3 id="extraGameTitle"></h3></div><button id="closeExtraGame" class="extra-close" type="button">×</button></div><div id="extraGameContent"></div></div>`;
  document.body.append(dialog);
  $('#closeExtraGame').addEventListener('click', () => dialog.close());
}

async function loadGames(render = true) {
  if (!state.user || !state.couple) return;
  try {
    const data = await gamesApi('get');
    extra.games = data.games || {};
    if (render && extra.active && $('#extraGameDialog')?.open) renderGame(extra.active);
  } catch {
    // Se reintentará automáticamente.
  }
}

async function saveGame(gameType, gameState) {
  extra.games[gameType] = gameState;
  renderGame(gameType);
  try {
    await gamesApi('save', { gameType, state: gameState });
  } catch {
    toast('No se pudo guardar la partida. Intenta nuevamente.', 'error');
  }
}

function openGame(gameType) {
  extra.active = gameType;
  renderGame(gameType);
  const dialog = $('#extraGameDialog');
  if (!dialog.open) dialog.showModal();
}

function renderGame(gameType) {
  const titles = {
    truth_dare: 'Verdad o reto', would_you_rather: '¿Qué prefieres?', love_dice: 'Dados del amor',
    memory_match: 'Memoria de corazones', compatibility: 'Compatibilidad', couple_bingo: 'Bingo de pareja',
  };
  $('#extraGameTitle').textContent = titles[gameType] || 'Juego';
  if (gameType === 'truth_dare') renderTruthDare();
  if (gameType === 'would_you_rather') renderRather();
  if (gameType === 'love_dice') renderDice();
  if (gameType === 'memory_match') renderMemory();
  if (gameType === 'compatibility') renderCompatibility();
  if (gameType === 'couple_bingo') renderBingo();
}

function renderTruthDare() {
  const current = extra.games.truth_dare || {};
  $('#extraGameContent').innerHTML = `
    <div class="game-big-card"><h4>${current.prompt || 'Elijan verdad o reto para comenzar.'}</h4></div>
    <div class="game-actions-center"><button id="truthButton" class="primary-btn">Verdad</button><button id="dareButton" class="secondary-btn">Reto</button></div>
    ${current.kind ? `<div class="game-result">Última elección: ${current.kind === 'truth' ? 'Verdad' : 'Reto'} · ${current.byName || 'Duke'}</div>` : ''}`;
  $('#truthButton').onclick = () => chooseTruthDare('truth');
  $('#dareButton').onclick = () => chooseTruthDare('dare');
}

function chooseTruthDare(kind) {
  const list = kind === 'truth' ? truths : dares;
  saveGame('truth_dare', {
    kind,
    prompt: list[Math.floor(Math.random() * list.length)],
    by: state.user.id,
    byName: state.user.display_name,
    at: new Date().toISOString(),
  });
}

function renderRather() {
  const game = extra.games.would_you_rather || { index: 0, votes: {} };
  const index = Number(game.index || 0) % ratherQuestions.length;
  const [a, b] = ratherQuestions[index];
  const mine = game.votes?.[state.user.id];
  const partnerVote = state.partner ? game.votes?.[state.partner.user_id] : null;
  const both = mine && partnerVote;
  $('#extraGameContent').innerHTML = `
    <div class="game-big-card"><h4>¿Qué prefieres?</h4></div>
    <div class="game-choice-row"><button id="ratherA" class="game-choice ${mine === 'a' ? 'selected' : ''}">${a}</button><button id="ratherB" class="game-choice ${mine === 'b' ? 'selected' : ''}">${b}</button></div>
    <div class="game-result">${both ? (mine === partnerVote ? '¡Coincidieron! 💜' : 'Eligieron diferente. Conversen sobre sus razones.') : mine ? 'Tu respuesta está guardada. Falta tu pareja.' : 'Cada uno debe elegir una opción.'}</div>
    ${both ? '<div class="game-actions-center" style="margin-top:12px"><button id="nextRather" class="primary-btn">Siguiente pregunta</button></div>' : ''}`;
  $('#ratherA').onclick = () => voteRather('a');
  $('#ratherB').onclick = () => voteRather('b');
  if ($('#nextRather')) $('#nextRather').onclick = () => saveGame('would_you_rather', { index: (index + 1) % ratherQuestions.length, votes: {} });
}

function voteRather(choice) {
  const game = extra.games.would_you_rather || { index: 0, votes: {} };
  saveGame('would_you_rather', { ...game, votes: { ...(game.votes || {}), [state.user.id]: choice } });
}

function renderDice() {
  const game = extra.games.love_dice || {};
  $('#extraGameContent').innerHTML = `
    <div class="love-dice"><div class="love-die">${game.action || 'ACCIÓN'}</div><div class="love-die">${game.target || 'FORMA'}</div></div>
    <div class="game-actions-center"><button id="rollLoveDice" class="primary-btn">🎲 Lanzar los dados</button></div>
    ${game.byName ? `<div class="game-result">Lanzado por ${game.byName}</div>` : ''}`;
  $('#rollLoveDice').onclick = () => saveGame('love_dice', {
    action: diceActions[Math.floor(Math.random() * diceActions.length)],
    target: diceTargets[Math.floor(Math.random() * diceTargets.length)],
    by: state.user.id,
    byName: state.user.display_name,
    at: new Date().toISOString(),
  });
}

function shuffledCards() {
  return [...['💜','💙','💋','🌹','✨','🥰'], ...['💜','💙','💋','🌹','✨','🥰']]
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function memoryGame() {
  const stored = extra.games.memory_match;
  if (stored?.cards?.length === 12) return stored;
  return { cards: shuffledCards(), revealed: [], matched: [], moves: 0 };
}

function renderMemory() {
  const game = memoryGame();
  const complete = game.matched.length === 12;
  $('#extraGameContent').innerHTML = `
    <div class="memory-board">${game.cards.map((card, index) => {
      const visible = game.revealed.includes(index) || game.matched.includes(index);
      return `<button class="memory-card-btn ${visible ? '' : 'covered'} ${game.matched.includes(index) ? 'matched' : ''}" data-memory-index="${index}">${visible ? card : '♥'}</button>`;
    }).join('')}</div>
    <div class="game-result">Movimientos: ${game.moves}${complete ? ' · ¡Completaron el juego! 🎉' : ''}</div>
    <div class="game-actions-center" style="margin-top:12px"><button id="resetMemory" class="outline-btn">Reiniciar</button></div>`;
  $('#extraGameContent').querySelectorAll('[data-memory-index]').forEach((button) => button.onclick = () => flipMemory(Number(button.dataset.memoryIndex)));
  $('#resetMemory').onclick = () => saveGame('memory_match', { cards: shuffledCards(), revealed: [], matched: [], moves: 0 });
}

async function flipMemory(index) {
  if (extra.memoryLock) return;
  const game = memoryGame();
  if (game.revealed.includes(index) || game.matched.includes(index) || game.revealed.length >= 2) return;
  const next = { ...game, revealed: [...game.revealed, index] };
  await saveGame('memory_match', next);
  if (next.revealed.length === 2) {
    extra.memoryLock = true;
    const [a, b] = next.revealed;
    setTimeout(async () => {
      const latest = memoryGame();
      const match = latest.cards[a] === latest.cards[b];
      await saveGame('memory_match', {
        ...latest,
        revealed: [],
        matched: match ? [...new Set([...latest.matched, a, b])] : latest.matched,
        moves: Number(latest.moves || 0) + 1,
      });
      extra.memoryLock = false;
    }, 850);
  }
}

function renderCompatibility() {
  const game = extra.games.compatibility || { index: 0, answers: {}, matches: 0, completed: 0 };
  const index = Math.min(Number(game.index || 0), compatibilityQuestions.length - 1);
  const [question, a, b] = compatibilityQuestions[index];
  const answers = game.answers?.[index] || {};
  const mine = answers[state.user.id];
  const theirs = state.partner ? answers[state.partner.user_id] : null;
  const both = mine && theirs;
  const finished = Number(game.index || 0) >= compatibilityQuestions.length;

  if (finished) {
    const percentage = Math.round((Number(game.matches || 0) / compatibilityQuestions.length) * 100);
    $('#extraGameContent').innerHTML = `<div class="game-big-card"><div><h4>${percentage}% de compatibilidad</h4><p>Coincidieron en ${game.matches} de ${compatibilityQuestions.length} respuestas.</p></div></div><div class="game-actions-center"><button id="restartCompatibility" class="primary-btn">Jugar de nuevo</button></div>`;
    $('#restartCompatibility').onclick = () => saveGame('compatibility', { index: 0, answers: {}, matches: 0, completed: 0 });
    return;
  }

  $('#extraGameContent').innerHTML = `
    <div class="compat-progress"><i style="width:${((index + 1) / compatibilityQuestions.length) * 100}%"></i></div>
    <div class="game-big-card"><h4>${question}</h4></div>
    <div class="game-choice-row"><button id="compatA" class="game-choice ${mine === 'a' ? 'selected' : ''}">${a}</button><button id="compatB" class="game-choice ${mine === 'b' ? 'selected' : ''}">${b}</button></div>
    <div class="compat-status">${both ? (mine === theirs ? 'Coincidieron en esta respuesta 💜' : 'Esta vez eligieron diferente.') : mine ? 'Esperando la respuesta de tu pareja…' : `Pregunta ${index + 1} de ${compatibilityQuestions.length}`}</div>
    ${both ? '<div class="game-actions-center" style="margin-top:12px"><button id="nextCompatibility" class="primary-btn">Continuar</button></div>' : ''}`;
  $('#compatA').onclick = () => answerCompatibility('a');
  $('#compatB').onclick = () => answerCompatibility('b');
  if ($('#nextCompatibility')) $('#nextCompatibility').onclick = () => {
    const alreadyCounted = game.completed > index;
    saveGame('compatibility', {
      ...game,
      index: index + 1,
      completed: index + 1,
      matches: Number(game.matches || 0) + (!alreadyCounted && mine === theirs ? 1 : 0),
    });
  };
}

function answerCompatibility(choice) {
  const game = extra.games.compatibility || { index: 0, answers: {}, matches: 0, completed: 0 };
  const index = Number(game.index || 0);
  saveGame('compatibility', {
    ...game,
    answers: { ...(game.answers || {}), [index]: { ...(game.answers?.[index] || {}), [state.user.id]: choice } },
  });
}

function hasBingo(completed) {
  const set = new Set(completed);
  const lines = [
    [0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
    [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],
    [0,5,10,15],[3,6,9,12],
  ];
  return lines.some((line) => line.every((item) => set.has(item)));
}

function renderBingo() {
  const game = extra.games.couple_bingo || { completed: [] };
  const win = hasBingo(game.completed || []);
  $('#extraGameContent').innerHTML = `
    <div class="bingo-grid">${bingoTasks.map((task, index) => `<button class="bingo-cell ${(game.completed || []).includes(index) ? 'done' : ''}" data-bingo="${index}">${task}</button>`).join('')}</div>
    ${win ? '<div class="bingo-win">¡BINGO! Completaron una línea juntos 💜</div>' : '<div class="game-result">Marquen cada experiencia que hayan completado juntos.</div>'}
    <div class="game-actions-center" style="margin-top:12px"><button id="resetBingo" class="outline-btn">Limpiar bingo</button></div>`;
  $('#extraGameContent').querySelectorAll('[data-bingo]').forEach((button) => button.onclick = () => {
    const index = Number(button.dataset.bingo);
    const completed = new Set(game.completed || []);
    if (completed.has(index)) completed.delete(index); else completed.add(index);
    saveGame('couple_bingo', { completed: [...completed], updatedBy: state.user.id });
  });
  $('#resetBingo').onclick = () => saveGame('couple_bingo', { completed: [] });
}

function initMoreGames() {
  injectStyles();
  injectGames();
  clearInterval(extra.poller);
  extra.poller = setInterval(() => loadGames(true), 3500);
  setTimeout(() => loadGames(false), 900);
}

export { initMoreGames };
