import { $, state, toast, switchView } from './core.js';

const prompts = [
  '¿Qué pequeño detalle de tu pareja agradeces hoy?',
  '¿Qué lugar les gustaría conocer juntos?',
  '¿Qué canción representa este momento de su relación?',
  '¿Cuál ha sido su recuerdo más divertido?',
  '¿Qué plan sencillo podrían hacer esta semana?',
  '¿Qué cualidad de tu pareja admiras más?',
  '¿Qué sueño quieren cumplir juntos?',
  '¿Qué mensaje bonito todavía no le has dicho hoy?',
  '¿Qué comida elegirían para una cita perfecta?',
  '¿Qué momento de su historia repetirían?',
  '¿Qué aprendieron el uno del otro recientemente?',
  '¿Cómo pueden cuidarse mejor esta semana?',
];

const themes = {
  violet: {
    name: 'Duke',
    emoji: '💜',
    vars: { '--purple': '#8b5cf6', '--purple-2': '#6d28d9', '--blue': '#2563eb', '--blue-2': '#60a5fa' },
  },
  rose: {
    name: 'Romántico',
    emoji: '🌹',
    vars: { '--purple': '#f43f5e', '--purple-2': '#be123c', '--blue': '#a855f7', '--blue-2': '#fda4af' },
  },
  ocean: {
    name: 'Océano',
    emoji: '🌊',
    vars: { '--purple': '#06b6d4', '--purple-2': '#0e7490', '--blue': '#2563eb', '--blue-2': '#67e8f9' },
  },
  sunset: {
    name: 'Atardecer',
    emoji: '🌅',
    vars: { '--purple': '#f97316', '--purple-2': '#c2410c', '--blue': '#db2777', '--blue-2': '#fdba74' },
  },
};

const ui = {
  initialized: false,
  theme: localStorage.getItem('duke_theme') || 'violet',
  timer: null,
};

function injectStyles() {
  if ($('#dukeUiEnhancements')) return;
  const style = document.createElement('style');
  style.id = 'dukeUiEnhancements';
  style.textContent = `
    :root{--duke-success:#34d399;--duke-warning:#fbbf24}
    body{background-attachment:fixed}
    button{position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent}
    button:active{transform:scale(.98)}
    .glass{transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease}
    .panel:hover,.stat:hover,.quick-grid button:hover,.extra-game-card:hover{border-color:rgba(167,139,250,.34);box-shadow:0 22px 65px rgba(0,0,0,.36)}
    .duke-top-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px;color:var(--muted);font-size:.74rem}
    .duke-network{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.18);color:#a7f3d0}
    .duke-network.offline{background:rgba(251,113,133,.1);border-color:rgba(251,113,133,.24);color:#fecdd3}
    .duke-network i{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor}
    .duke-theme-wrap{position:relative}.duke-theme-button{width:43px;height:43px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.06);cursor:pointer;font-size:1.08rem}
    .duke-theme-panel{position:absolute;right:0;top:52px;z-index:80;width:220px;padding:10px;border-radius:17px;background:rgba(12,8,24,.97);border:1px solid var(--line);box-shadow:0 25px 70px rgba(0,0,0,.55);backdrop-filter:blur(20px)}
    .duke-theme-panel.hidden{display:none}.duke-theme-option{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:0;border-radius:12px;background:transparent;text-align:left;cursor:pointer}.duke-theme-option:hover,.duke-theme-option.active{background:rgba(255,255,255,.08)}
    .duke-theme-swatch{width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,var(--swatch-a),var(--swatch-b));box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
    .duke-hero-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;margin-bottom:12px;border-radius:999px;background:rgba(139,92,246,.11);border:1px solid rgba(139,92,246,.2);color:#ddd6fe;font-size:.78rem;font-weight:800}
    .duke-hero-chip i{width:7px;height:7px;border-radius:50%;background:var(--duke-success);box-shadow:0 0 12px var(--duke-success)}
    .duke-today-section{margin-top:14px}.duke-section-title{display:flex;align-items:end;justify-content:space-between;gap:15px;margin:24px 3px 12px}.duke-section-title h3{margin:0;font-size:1.35rem}.duke-section-title p{margin:5px 0 0;color:var(--muted);font-size:.85rem}
    .duke-today-grid{display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:14px}
    .duke-today-card{min-height:168px;padding:21px;border-radius:21px;position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(27,18,49,.88),rgba(10,8,20,.84));border:1px solid var(--line);box-shadow:var(--shadow)}
    .duke-today-card::after{content:"";position:absolute;width:170px;height:170px;border-radius:50%;right:-80px;bottom:-95px;background:radial-gradient(circle,rgba(139,92,246,.22),transparent 68%);pointer-events:none}
    .duke-today-card>*{position:relative;z-index:1}.duke-today-card .eyebrow{margin-bottom:8px}.duke-today-card h4{font-size:1.15rem;line-height:1.4;margin:0}.duke-today-card p{color:var(--muted);font-size:.86rem;line-height:1.5;margin:8px 0 0}
    .duke-daily-prompt{grid-row:span 2;display:flex;flex-direction:column;justify-content:space-between;min-height:350px;background:radial-gradient(circle at 90% 5%,rgba(139,92,246,.3),transparent 38%),linear-gradient(145deg,rgba(31,20,58,.94),rgba(8,7,18,.9))}
    .duke-daily-prompt .duke-quote{font-size:clamp(1.35rem,2.5vw,2.05rem);line-height:1.24;margin:18px 0 25px;letter-spacing:-.025em}
    .duke-card-icon{width:45px;height:45px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(37,99,235,.2));font-size:1.35rem;margin-bottom:15px}
    .duke-progress{height:8px;margin-top:17px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.duke-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--purple),var(--blue));box-shadow:0 0 15px rgba(139,92,246,.45)}
    .duke-mini-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:14px}.duke-mini-action{border:1px solid var(--line);border-radius:13px;padding:11px;background:rgba(255,255,255,.05);cursor:pointer;text-align:left;font-weight:800;font-size:.8rem}.duke-mini-action span{display:block;font-size:1.2rem;margin-bottom:6px}
    .duke-partner-line{display:flex;align-items:center;gap:11px;margin-top:14px}.duke-partner-avatar{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--purple),var(--blue));font-weight:900}.duke-partner-copy strong,.duke-partner-copy small{display:block}.duke-partner-copy small{margin-top:3px;color:var(--muted)}
    .duke-status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#737083;margin-right:6px}.duke-status-dot.online{background:var(--duke-success);box-shadow:0 0 12px var(--duke-success)}
    .duke-floating-heart{position:fixed;z-index:200;pointer-events:none;font-size:1.25rem;animation:dukeHeartFly 1.2s ease-out forwards}
    @keyframes dukeHeartFly{0%{opacity:0;transform:translate(-50%,-20%) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--drift)), -150px) scale(1.4) rotate(var(--rotate))}}
    .duke-scroll-top{position:fixed;right:24px;bottom:24px;z-index:35;width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(17,12,31,.9);box-shadow:0 16px 40px rgba(0,0,0,.38);cursor:pointer;opacity:0;transform:translateY(12px);pointer-events:none;transition:.2s}.duke-scroll-top.visible{opacity:1;transform:none;pointer-events:auto}
    .duke-ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.2);transform:scale(0);animation:dukeRipple .55s ease-out;pointer-events:none}@keyframes dukeRipple{to{transform:scale(4);opacity:0}}
    @media(max-width:980px){.duke-today-grid{grid-template-columns:repeat(2,1fr)}.duke-daily-prompt{grid-row:auto;grid-column:1/-1;min-height:240px}}
    @media(max-width:700px){.app-shell{padding:0;display:block}.main-area{padding:0 10px}.topbar{top:8px;border-radius:18px;min-height:70px}.content-wrap{padding-top:10px}.hero{min-height:360px;align-items:flex-start}.couple-orb{position:absolute;right:15px;bottom:20px;min-width:auto;opacity:.55;transform:scale(.72);transform-origin:right bottom}.stats-grid{grid-template-columns:repeat(2,1fr)}.dashboard-grid{grid-template-columns:1fr}.panel.wide{grid-column:auto}.quick-grid{grid-template-columns:repeat(2,1fr)}.duke-today-grid{grid-template-columns:1fr}.duke-daily-prompt{grid-column:auto}.duke-scroll-top{right:15px;bottom:92px}.love-btn span{display:none}.duke-theme-button{width:40px;height:40px}.topbar{padding:13px 14px}.duke-section-title{margin-top:20px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
  `;
  document.head.append(style);
}

function applyTheme(name) {
  const theme = themes[name] || themes.violet;
  ui.theme = themes[name] ? name : 'violet';
  localStorage.setItem('duke_theme', ui.theme);
  document.body.dataset.dukeTheme = ui.theme;
  Object.entries(theme.vars).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  document.querySelectorAll('[data-duke-theme]').forEach((button) => button.classList.toggle('active', button.dataset.dukeTheme === ui.theme));
  const trigger = $('#dukeThemeButton');
  if (trigger) trigger.textContent = theme.emoji;
}

function buildThemeControl() {
  if ($('#dukeThemeWrap')) return;
  const actions = $('.top-actions');
  if (!actions) return;
  const wrap = document.createElement('div');
  wrap.id = 'dukeThemeWrap';
  wrap.className = 'duke-theme-wrap';
  wrap.innerHTML = `
    <button id="dukeThemeButton" class="duke-theme-button" type="button" aria-label="Cambiar tema">🎨</button>
    <div id="dukeThemePanel" class="duke-theme-panel hidden">
      ${Object.entries(themes).map(([key, theme]) => `
        <button class="duke-theme-option" type="button" data-duke-theme="${key}">
          <span class="duke-theme-swatch" style="--swatch-a:${theme.vars['--purple']};--swatch-b:${theme.vars['--blue']}"></span>
          <span>${theme.emoji} ${theme.name}</span>
        </button>`).join('')}
    </div>`;
  actions.prepend(wrap);
  $('#dukeThemeButton').addEventListener('click', (event) => {
    event.stopPropagation();
    $('#dukeThemePanel').classList.toggle('hidden');
  });
  wrap.querySelectorAll('[data-duke-theme]').forEach((button) => button.addEventListener('click', () => {
    applyTheme(button.dataset.dukeTheme);
    $('#dukeThemePanel').classList.add('hidden');
    toast(`Tema ${themes[button.dataset.dukeTheme].name} activado.`, 'success');
  }));
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) $('#dukeThemePanel')?.classList.add('hidden');
  });
  applyTheme(ui.theme);
}

function buildTopMeta() {
  if ($('#dukeTopMeta')) return;
  const holder = $('.topbar > div:first-child');
  if (!holder) return;
  const meta = document.createElement('div');
  meta.id = 'dukeTopMeta';
  meta.className = 'duke-top-meta';
  meta.innerHTML = '<span id="dukeClock"></span><span>•</span><span id="dukeLongDate"></span><span id="dukeNetwork" class="duke-network"><i></i><span>Con conexión</span></span>';
  holder.append(meta);
  updateTopMeta();
  window.addEventListener('online', updateTopMeta);
  window.addEventListener('offline', updateTopMeta);
}

function updateTopMeta() {
  const now = new Date();
  if ($('#dukeClock')) $('#dukeClock').textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  if ($('#dukeLongDate')) $('#dukeLongDate').textContent = now.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  const network = $('#dukeNetwork');
  if (network) {
    network.classList.toggle('offline', !navigator.onLine);
    network.querySelector('span').textContent = navigator.onLine ? 'Con conexión' : 'Sin conexión';
  }
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function isOnline(member) {
  if (!member?.last_seen) return false;
  return Date.now() - new Date(member.last_seen).getTime() < 70000;
}

function daysTogether() {
  const value = state.couple?.relationship_date;
  if (!value) return 0;
  const start = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - start) / 86400000));
}

function nextMilestone(days) {
  const milestones = [7, 30, 50, 100, 180, 365, 500, 730, 1000, 1460, 1825];
  const next = milestones.find((value) => value > days) || Math.ceil((days + 1) / 500) * 500;
  return { next, remaining: Math.max(0, next - days), progress: Math.min(100, Math.round((days / next) * 100)) };
}

function dailyPrompt() {
  const today = new Date();
  const seed = Number(`${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`);
  return prompts[seed % prompts.length];
}

function buildHeroChip() {
  if ($('#dukeHeroChip')) return;
  const heroCopy = $('.hero > div:first-child');
  if (!heroCopy) return;
  const chip = document.createElement('div');
  chip.id = 'dukeHeroChip';
  chip.className = 'duke-hero-chip';
  chip.innerHTML = '<i></i><span>Su espacio está listo</span>';
  heroCopy.prepend(chip);
}

function buildTodaySection() {
  if ($('#dukeTodaySection')) return;
  const stats = $('.stats-grid');
  if (!stats) return;
  const section = document.createElement('section');
  section.id = 'dukeTodaySection';
  section.className = 'duke-today-section';
  section.innerHTML = `
    <div class="duke-section-title">
      <div><p class="eyebrow">UN MOMENTO PARA USTEDES</p><h3>Hoy en Duke</h3><p>Detalles sencillos para sentirse más cerca.</p></div>
    </div>
    <div class="duke-today-grid">
      <article class="duke-today-card duke-daily-prompt">
        <div>
          <div class="duke-card-icon">💬</div>
          <p class="eyebrow">PREGUNTA DEL DÍA</p>
          <h4 id="dukeDailyPrompt" class="duke-quote"></h4>
        </div>
        <div class="duke-mini-actions">
          <button id="dukeAnswerPrompt" class="duke-mini-action" type="button"><span>✦</span>Responder en el chat</button>
          <button id="dukeSurpriseGame" class="duke-mini-action" type="button"><span>🎲</span>Juego sorpresa</button>
        </div>
      </article>
      <article class="duke-today-card">
        <div class="duke-card-icon">💞</div>
        <p class="eyebrow">USTEDES HOY</p>
        <h4 id="dukeGreeting">Bienvenidos a su lugar</h4>
        <div id="dukePartnerLine" class="duke-partner-line"></div>
      </article>
      <article class="duke-today-card">
        <div class="duke-card-icon">🏆</div>
        <p class="eyebrow">PRÓXIMO HITO</p>
        <h4 id="dukeMilestoneTitle">Sigan construyendo su historia</h4>
        <p id="dukeMilestoneText"></p>
        <div class="duke-progress"><i id="dukeMilestoneProgress" style="width:0%"></i></div>
      </article>
      <article class="duke-today-card">
        <div class="duke-card-icon">✨</div>
        <p class="eyebrow">PLAN RÁPIDO</p>
        <h4>Hagan algo bonito ahora</h4>
        <div class="duke-mini-actions">
          <button id="dukeSendLove" class="duke-mini-action" type="button"><span>💜</span>Enviar cariño</button>
          <button id="dukeSaveMemory" class="duke-mini-action" type="button"><span>📸</span>Guardar recuerdo</button>
        </div>
      </article>
    </div>`;
  stats.after(section);

  $('#dukeAnswerPrompt').addEventListener('click', () => {
    switchView('chat');
    const input = $('#messageInput');
    if (input) {
      input.value = `${dailyPrompt()}\n\n`;
      input.focus();
    }
  });
  $('#dukeSurpriseGame').addEventListener('click', () => {
    switchView('games');
    setTimeout(() => {
      const cards = [...document.querySelectorAll('.extra-game-card')];
      if (cards.length) cards[Math.floor(Math.random() * cards.length)].click();
      else toast('Abre uno de los juegos para comenzar.', 'success');
    }, 280);
  });
  $('#dukeSendLove').addEventListener('click', () => $('#missingYouButton')?.click());
  $('#dukeSaveMemory').addEventListener('click', () => $('#addMemoryButton')?.click());
  updateTodaySection();
}

function updateTodaySection() {
  if (!$('#dukeTodaySection')) return;
  const me = state.members?.find((member) => member.user_id === state.user?.id) || state.user;
  const partner = state.partner;
  const days = daysTogether();
  const milestone = nextMilestone(days);
  const partnerOnline = isOnline(partner);

  $('#dukeDailyPrompt').textContent = dailyPrompt();
  $('#dukeGreeting').textContent = `${greeting()}${me?.display_name ? `, ${me.display_name}` : ''}`;
  $('#dukeMilestoneTitle').textContent = `${milestone.next} días juntos`;
  $('#dukeMilestoneText').textContent = milestone.remaining === 1 ? 'Falta 1 día para este momento especial.' : `Faltan ${milestone.remaining} días para celebrarlo.`;
  $('#dukeMilestoneProgress').style.width = `${milestone.progress}%`;

  const line = $('#dukePartnerLine');
  if (line) {
    const avatar = partner?.avatar || partner?.display_name?.slice(0, 1)?.toUpperCase() || '?';
    line.innerHTML = `
      <div class="duke-partner-avatar">${avatar}</div>
      <div class="duke-partner-copy">
        <strong>${partner?.display_name || 'Tu pareja'}</strong>
        <small><i class="duke-status-dot ${partnerOnline ? 'online' : ''}"></i>${partner ? (partnerOnline ? 'Está en Duke ahora' : 'Puede ver tus mensajes al entrar') : 'Todavía no se ha unido'}</small>
      </div>`;
  }

  const chip = $('#dukeHeroChip span');
  if (chip) chip.textContent = partnerOnline ? 'Los dos están conectados' : partner ? 'Su espacio está listo' : 'Comparte el código con tu pareja';
  const dot = $('#dukeHeroChip i');
  if (dot) dot.style.background = partnerOnline ? '#34d399' : partner ? '#60a5fa' : '#fbbf24';
}

function heartBurst(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  for (let index = 0; index < 9; index += 1) {
    const heart = document.createElement('span');
    heart.className = 'duke-floating-heart';
    heart.textContent = ['💜', '💙', '✨'][index % 3];
    heart.style.left = `${rect.left + rect.width / 2 + (Math.random() - .5) * 24}px`;
    heart.style.top = `${rect.top + rect.height / 2}px`;
    heart.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 110)}px`);
    heart.style.setProperty('--rotate', `${Math.round((Math.random() - .5) * 80)}deg`);
    heart.style.animationDelay = `${index * 35}ms`;
    document.body.append(heart);
    setTimeout(() => heart.remove(), 1500);
  }
}

function addRipple(event) {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'duke-ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
  button.append(ripple);
  setTimeout(() => ripple.remove(), 650);
}

function buildScrollTop() {
  if ($('#dukeScrollTop')) return;
  const button = document.createElement('button');
  button.id = 'dukeScrollTop';
  button.className = 'duke-scroll-top';
  button.type = 'button';
  button.textContent = '↑';
  button.setAttribute('aria-label', 'Volver arriba');
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(button);
  window.addEventListener('scroll', () => button.classList.toggle('visible', window.scrollY > 480), { passive: true });
}

function improveAccessibility() {
  document.querySelectorAll('button:not([type])').forEach((button) => button.type = 'button');
  document.querySelectorAll('.icon-btn').forEach((button, index) => {
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', `Acción ${index + 1}`);
  });
}

function initUiEnhancements() {
  if (ui.initialized) return;
  ui.initialized = true;
  injectStyles();
  buildTopMeta();
  buildThemeControl();
  buildHeroChip();
  buildTodaySection();
  buildScrollTop();
  improveAccessibility();

  $('#missingYouButton')?.addEventListener('click', heartBurst);
  document.addEventListener('pointerdown', addRipple, { passive: true });

  clearInterval(ui.timer);
  ui.timer = setInterval(() => {
    updateTopMeta();
    updateTodaySection();
  }, 1500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateTopMeta();
      updateTodaySection();
    }
  });
}

export { initUiEnhancements };
