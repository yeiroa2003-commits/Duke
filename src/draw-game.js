import { $, state, toast } from './core.js';

const words = [
  'corazón', 'casa', 'perro', 'gato', 'playa', 'montaña', 'flor', 'anillo',
  'helado', 'pizza', 'avión', 'luna', 'estrella', 'paraguas', 'teléfono', 'regalo',
  'beso', 'abrazo', 'película', 'café', 'carro', 'barco', 'árbol', 'mariposa',
  'zapato', 'reloj', 'pastel', 'guitarra', 'sol', 'nube', 'cámara', 'maleta',
];

const draw = {
  game: null,
  version: 0,
  poller: null,
  canvas: null,
  ctx: null,
  drawing: false,
  stroke: null,
  color: '#8b5cf6',
  size: 7,
  saving: false,
};

function gamesApi(action, payload = {}) {
  return fetch(`/api/games?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({ ok: false, error: 'SERVER_ERROR' }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'SERVER_ERROR');
    return data;
  });
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function injectStyles() {
  if ($('#dukeDrawStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeDrawStyles';
  style.textContent = `
    .draw-dialog{border:0;background:transparent;color:white;width:min(96vw,980px);padding:0}.draw-dialog::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(10px)}
    .draw-box{padding:22px;border-radius:25px;background:linear-gradient(145deg,rgba(28,18,51,.99),rgba(8,6,17,.99));border:1px solid rgba(255,255,255,.13);box-shadow:0 28px 90px rgba(0,0,0,.58)}
    .draw-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.draw-head h3{margin:0;font-size:1.55rem}.draw-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.07);cursor:pointer}
    .draw-meta{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0}.draw-word{padding:10px 14px;border-radius:14px;background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.28);font-weight:900;letter-spacing:.08em}.draw-role{color:#aaa4bb}.draw-role strong{color:#fff}
    .draw-layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px}.draw-canvas-wrap{position:relative;background:#fff;border-radius:19px;overflow:hidden;border:2px solid rgba(255,255,255,.18);min-height:420px}.draw-canvas{display:block;width:100%;height:auto;aspect-ratio:16/10;touch-action:none;cursor:crosshair;background:white}
    .draw-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:11px}.draw-color{width:36px;height:36px;border-radius:50%;border:3px solid transparent;cursor:pointer}.draw-color.active{border-color:white;box-shadow:0 0 0 2px #8b5cf6}.draw-size{padding:9px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:white}.draw-tool-btn{padding:10px 13px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);cursor:pointer;font-weight:800}
    .draw-side{display:flex;flex-direction:column;gap:11px}.draw-guesses{min-height:270px;max-height:360px;overflow:auto;padding:12px;border-radius:17px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}.draw-guess{padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.055);margin-bottom:8px}.draw-guess.correct{background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.34)}.draw-guess strong,.draw-guess small{display:block}.draw-guess small{color:#aaa4bb;margin-top:3px}
    .draw-form{display:grid;gap:8px}.draw-form input{width:100%}.draw-winner{padding:14px;border-radius:15px;text-align:center;background:linear-gradient(135deg,rgba(34,197,94,.22),rgba(37,99,235,.16));font-weight:900}.draw-empty{display:grid;place-items:center;min-height:350px;text-align:center;color:#aaa4bb;padding:30px}.draw-empty span{font-size:3.4rem}.draw-empty h4{color:white;font-size:1.5rem;margin:12px 0 5px}
    @media(max-width:780px){.draw-layout{grid-template-columns:1fr}.draw-canvas-wrap{min-height:auto}.draw-guesses{min-height:150px;max-height:220px}.draw-box{padding:17px 12px}}
  `;
  document.head.append(style);
}

function injectCard() {
  const grid = $('#extraGamesSection .extra-games-grid');
  if (!grid || $('#drawGuessCard')) return;
  const card = document.createElement('button');
  card.id = 'drawGuessCard';
  card.className = 'extra-game-card';
  card.type = 'button';
  card.innerHTML = '<span>🎨</span><strong>Adivina el dibujo</strong><small>Uno dibuja y el otro intenta descubrir la palabra.</small>';
  card.addEventListener('click', openDrawGame);
  grid.append(card);
}

function ensureDialog() {
  let dialog = $('#drawGameDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'drawGameDialog';
  dialog.className = 'draw-dialog';
  dialog.innerHTML = `
    <div class="draw-box">
      <div class="draw-head">
        <div><p class="eyebrow">JUEGO PARA DOS</p><h3>Adivina el dibujo</h3></div>
        <button id="closeDrawGame" class="draw-close" type="button">×</button>
      </div>
      <div id="drawGameContent"></div>
    </div>`;
  document.body.append(dialog);
  $('#closeDrawGame').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => clearInterval(draw.poller));
  return dialog;
}

async function loadGame(render = true) {
  if (!state.user || !state.couple || draw.saving) return;
  try {
    const data = await gamesApi('get');
    const next = data.games?.draw_guess || null;
    const version = Number(next?.version || 0);
    if (version !== draw.version || !draw.game) {
      draw.game = next;
      draw.version = version;
      if (render && $('#drawGameDialog')?.open) renderGame();
    }
  } catch {}
}

async function saveGame(game) {
  draw.game = game;
  draw.saving = true;
  try {
    const result = await gamesApi('save', { gameType: 'draw_guess', state: game });
    draw.version = Number(result.game?.version || draw.version + 1);
  } catch {
    toast('No se pudo sincronizar el dibujo.', 'error');
  } finally {
    draw.saving = false;
  }
}

function memberName(id) {
  return state.members.find((item) => item.user_id === id)?.display_name || 'Jugador';
}

function maskedWord(word) {
  return [...String(word || '')].map((char) => char === ' ' ? '   ' : '_').join(' ');
}

function randomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

async function newRound() {
  if (!state.members.length) return;
  const currentArtist = draw.game?.artistId;
  const nextArtist = currentArtist
    ? (state.members.find((item) => item.user_id !== currentArtist)?.user_id || state.user.id)
    : state.user.id;
  const game = {
    roundId: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    artistId: nextArtist,
    word: randomWord(),
    strokes: [],
    guesses: [],
    winnerId: null,
    startedAt: new Date().toISOString(),
  };
  await saveGame(game);
  renderGame();
}

function openDrawGame() {
  const dialog = ensureDialog();
  renderGame();
  if (!dialog.open) dialog.showModal();
  clearInterval(draw.poller);
  draw.poller = setInterval(() => loadGame(true), 600);
  loadGame(true);
}

function renderGame() {
  const root = $('#drawGameContent');
  if (!root) return;
  const game = draw.game;
  if (!game?.roundId) {
    root.innerHTML = `
      <div class="draw-empty"><div><span>🎨</span><h4>Comiencen una ronda</h4><p>Uno recibirá una palabra secreta y deberá dibujarla.</p><button id="startDrawRound" class="primary-btn" type="button">Nueva ronda</button></div></div>`;
    $('#startDrawRound').addEventListener('click', newRound);
    return;
  }

  const isArtist = game.artistId === state.user.id;
  const winner = game.winnerId ? memberName(game.winnerId) : '';
  root.innerHTML = `
    <div class="draw-meta">
      <div class="draw-role">Dibuja: <strong>${memberName(game.artistId)}</strong></div>
      <div class="draw-word">${isArtist ? `PALABRA: ${game.word}` : maskedWord(game.word)}</div>
      <button id="newDrawRound" class="outline-btn" type="button">Nueva ronda</button>
    </div>
    ${winner ? `<div class="draw-winner">🏆 ${winner} adivinó la palabra: ${game.word}</div>` : ''}
    <div class="draw-layout">
      <div>
        <div class="draw-canvas-wrap"><canvas id="drawCanvas" class="draw-canvas" width="960" height="600"></canvas></div>
        <div class="draw-tools ${isArtist && !winner ? '' : 'hidden'}">
          ${['#111827','#8b5cf6','#2563eb','#ef4444','#22c55e','#f59e0b'].map((color) => `<button class="draw-color ${draw.color === color ? 'active' : ''}" data-draw-color="${color}" style="background:${color}" type="button"></button>`).join('')}
          <select id="drawSize" class="draw-size"><option value="4">Fino</option><option value="7" selected>Medio</option><option value="13">Grueso</option></select>
          <button id="clearDrawing" class="draw-tool-btn" type="button">Limpiar</button>
        </div>
      </div>
      <aside class="draw-side">
        <div id="drawGuesses" class="draw-guesses">${renderGuesses(game.guesses || [])}</div>
        ${!isArtist && !winner ? `<form id="drawGuessForm" class="draw-form"><input id="drawGuessInput" maxlength="40" placeholder="Escribe tu respuesta" required /><button class="primary-btn" type="submit">Adivinar</button></form>` : ''}
        ${isArtist && !winner ? '<small style="color:#aaa4bb">Dibuja sin escribir letras ni números. Cada trazo se sincroniza al levantar el dedo.</small>' : ''}
      </aside>
    </div>`;

  $('#newDrawRound').addEventListener('click', newRound);
  setupCanvas(isArtist && !winner);
  $('#drawGuessForm')?.addEventListener('submit', submitGuess);
  $$Colors();
  $('#drawSize')?.addEventListener('change', (event) => { draw.size = Number(event.target.value) || 7; });
  $('#clearDrawing')?.addEventListener('click', clearDrawing);
}

function renderGuesses(guesses) {
  if (!guesses.length) return '<p style="color:#aaa4bb;text-align:center">Todavía no hay respuestas.</p>';
  return guesses.slice(-20).reverse().map((guess) => `
    <div class="draw-guess ${guess.correct ? 'correct' : ''}">
      <strong>${guess.correct ? '✅ ' : ''}${escapeText(guess.text)}</strong>
      <small>${escapeText(guess.name || memberName(guess.userId))}</small>
    </div>`).join('');
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[char]));
}

function $$Colors() {
  document.querySelectorAll('[data-draw-color]').forEach((button) => {
    button.addEventListener('click', () => {
      draw.color = button.dataset.drawColor;
      document.querySelectorAll('[data-draw-color]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
}

function setupCanvas(editable) {
  draw.canvas = $('#drawCanvas');
  draw.ctx = draw.canvas?.getContext('2d');
  if (!draw.canvas || !draw.ctx) return;
  draw.ctx.lineCap = 'round';
  draw.ctx.lineJoin = 'round';
  redraw();
  if (!editable) {
    draw.canvas.style.cursor = 'default';
    return;
  }
  draw.canvas.addEventListener('pointerdown', beginStroke);
  draw.canvas.addEventListener('pointermove', continueStroke);
  draw.canvas.addEventListener('pointerup', finishStroke);
  draw.canvas.addEventListener('pointercancel', finishStroke);
  draw.canvas.addEventListener('pointerleave', (event) => { if (draw.drawing && event.buttons === 0) finishStroke(event); });
}

function pointFromEvent(event) {
  const rect = draw.canvas.getBoundingClientRect();
  return [
    Math.max(0, Math.min(1000, Math.round(((event.clientX - rect.left) / rect.width) * 1000))),
    Math.max(0, Math.min(1000, Math.round(((event.clientY - rect.top) / rect.height) * 1000))),
  ];
}

function beginStroke(event) {
  if (!draw.game || draw.game.artistId !== state.user.id || draw.game.winnerId) return;
  event.preventDefault();
  draw.canvas.setPointerCapture?.(event.pointerId);
  draw.drawing = true;
  draw.stroke = { color: draw.color, size: draw.size, points: [pointFromEvent(event)] };
}

function continueStroke(event) {
  if (!draw.drawing || !draw.stroke) return;
  event.preventDefault();
  const point = pointFromEvent(event);
  const previous = draw.stroke.points.at(-1);
  if (Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1]) < 7) return;
  if (draw.stroke.points.length < 180) draw.stroke.points.push(point);
  redraw(draw.stroke);
}

async function finishStroke(event) {
  if (!draw.drawing || !draw.stroke) return;
  event?.preventDefault?.();
  draw.drawing = false;
  const stroke = draw.stroke;
  draw.stroke = null;
  if (stroke.points.length < 2) stroke.points.push(stroke.points[0]);
  const strokes = [...(draw.game.strokes || []), stroke].slice(-160);
  const game = { ...draw.game, strokes };
  draw.game = game;
  redraw();
  await saveGame(game);
}

function redraw(previewStroke = null) {
  if (!draw.ctx || !draw.canvas) return;
  draw.ctx.fillStyle = '#ffffff';
  draw.ctx.fillRect(0, 0, draw.canvas.width, draw.canvas.height);
  const strokes = [...(draw.game?.strokes || [])];
  if (previewStroke) strokes.push(previewStroke);
  for (const stroke of strokes) drawStroke(stroke);
}

function drawStroke(stroke) {
  if (!stroke?.points?.length) return;
  const ctx = draw.ctx;
  ctx.strokeStyle = stroke.color || '#111827';
  ctx.lineWidth = Number(stroke.size || 7) * (draw.canvas.width / 960);
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const x = (point[0] / 1000) * draw.canvas.width;
    const y = (point[1] / 1000) * draw.canvas.height;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

async function clearDrawing() {
  if (!draw.game || draw.game.artistId !== state.user.id) return;
  const game = { ...draw.game, strokes: [] };
  draw.game = game;
  redraw();
  await saveGame(game);
}

async function submitGuess(event) {
  event.preventDefault();
  const input = $('#drawGuessInput');
  const text = input.value.trim();
  if (!text || !draw.game) return;
  const correct = normalize(text) === normalize(draw.game.word);
  const guess = {
    userId: state.user.id,
    name: state.user.display_name,
    text,
    correct,
    at: new Date().toISOString(),
  };
  const game = {
    ...draw.game,
    guesses: [...(draw.game.guesses || []), guess].slice(-30),
    winnerId: correct ? state.user.id : draw.game.winnerId,
  };
  input.value = '';
  await saveGame(game);
  renderGame();
  toast(correct ? '¡Adivinaste el dibujo! 🎉' : 'No es esa. Sigue intentando.', correct ? 'success' : 'error');
}

function initDrawGame() {
  injectStyles();
  ensureDialog();
  const tryInject = () => {
    injectCard();
    if (!$('#drawGuessCard')) setTimeout(tryInject, 300);
  };
  tryInject();
  loadGame(false);
}

export { initDrawGame };
