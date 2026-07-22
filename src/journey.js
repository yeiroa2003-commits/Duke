import { $, state, toast, imageToDataUrl } from './core.js';

const missions = [
  ['sin-pantallas', '📵', 'Diez minutos sin pantallas', 'Hablen durante diez minutos sin mirar el teléfono.'],
  ['audio-bonito', '🎙️', 'Un audio que alegre el día', 'Envíale un audio corto diciendo algo que admiras.'],
  ['foto-recuerdo', '📸', 'Una foto que me recordó a ti', 'Comparte una foto de algo que te hizo pensar en tu pareja.'],
  ['tres-gracias', '🙏', 'Tres cosas que agradezco', 'Díganse tres cosas pequeñas que agradecen del otro.'],
  ['mini-cita', '☕', 'Planear una mini cita', 'Elijan juntos un plan sencillo para esta semana.'],
  ['pregunta-apoyo', '🫶', '¿Cómo puedo apoyarte hoy?', 'Haz la pregunta y escucha la respuesta sin interrumpir.'],
  ['cancion', '🎵', 'La canción de hoy', 'Compartan una canción y expliquen por qué la eligieron.'],
  ['recuerdo', '💭', 'Volver a un recuerdo', 'Hablen de un momento bonito y agreguen un detalle que el otro no sabía.'],
  ['cumplido', '✨', 'Un cumplido diferente', 'Dile algo bonito que no suelas decirle.'],
  ['nota-sorpresa', '📝', 'Nota sorpresa', 'Déjale una nota en Duke para que la encuentre durante el día.'],
  ['llamada-quince', '☎️', 'Quince minutos para nosotros', 'Hagan una llamada sin realizar otra actividad al mismo tiempo.'],
  ['sueno', '🌟', 'Un sueño compartido', 'Elijan una meta que les gustaría cumplir juntos.'],
  ['paseo', '🚶', 'Caminar y conversar', 'Den un paseo corto o caminen cada uno mientras hablan por llamada.'],
  ['comida', '🍳', 'Preparar algo juntos', 'Cocinen, pidan o elijan una comida especial para compartir.'],
  ['atardecer', '🌅', 'Mirar el mismo cielo', 'Busquen el atardecer, la luna o las estrellas y compartan una foto.'],
  ['secreto-dulce', '🤫', 'Algo que nunca te dije', 'Cuéntale un pensamiento bonito que habías guardado.'],
  ['orgullo', '🏆', 'Estoy orgulloso/a de ti', 'Dile tres razones por las que te sientes orgulloso/a de tu pareja.'],
  ['capsula', '💌', 'Crear una cápsula', 'Guarden un mensaje para abrirlo juntos en una fecha futura.'],
  ['cupon', '🎟️', 'Regalar un cupón', 'Crea un cupón de amor que tu pareja pueda canjear.'],
  ['dibujar', '🎨', 'Dibujarnos', 'Jueguen Adivina el dibujo o hagan un retrato divertido del otro.'],
  ['pregunta-profunda', '💬', 'Una pregunta profunda', 'Pregunten qué ha cambiado en sus sueños durante el último año.'],
  ['celebrar', '🥂', 'Celebrar algo pequeño', 'Reconozcan un logro pequeño que ocurrió esta semana.'],
  ['playlist', '🎧', 'Dos canciones nuevas', 'Cada uno agrega una canción a la historia de ustedes.'],
  ['risa', '😂', 'Hacernos reír', 'Compartan un meme, recuerdo o imitación que haga reír al otro.'],
];

const gardenStages = [
  ['🌰', 'La semilla', 'Cada pequeño gesto está comenzando algo bonito.'],
  ['🌱', 'Primer brote', 'Su constancia ya está tomando forma.'],
  ['🌿', 'Creciendo juntos', 'Las conversaciones y recuerdos fortalecen sus raíces.'],
  ['🌷', 'Primera flor', 'Su historia ya tiene momentos que florecen.'],
  ['🌸', 'Jardín compartido', 'Los detalles cotidianos están llenando Duke de vida.'],
  ['🌳', 'Árbol de ustedes', 'Su conexión tiene raíces, historia y nuevas ramas.'],
  ['🌳✨', 'Jardín mágico', 'Han construido un espacio vivo que sigue creciendo.'],
];

const journey = {
  data: null,
  poller: null,
  initialized: false,
  notifiedCapsules: new Set(JSON.parse(localStorage.getItem('duke_notified_capsules') || '[]')),
};

function journeyApi(action, payload = {}) {
  return fetch(`/api/journey?action=${encodeURIComponent(action)}`, {
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

function missionForDate(dateText) {
  const text = String(dateText || new Date().toISOString().slice(0, 10));
  const seed = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return missions[seed % missions.length];
}

function injectStyles() {
  if ($('#dukeJourneyStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeJourneyStyles';
  style.textContent = `
    .journey-section{margin-top:18px}.journey-head{display:flex;justify-content:space-between;align-items:end;gap:14px;margin:26px 3px 13px}.journey-head h2{margin:0;font-size:clamp(1.65rem,3vw,2.25rem)}.journey-head p{margin:6px 0 0;color:var(--muted)}
    .journey-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(37,99,235,.13));border:1px solid rgba(139,92,246,.26);font-size:.76rem;font-weight:900;color:#ddd6fe}
    .journey-grid{display:grid;grid-template-columns:1.1fr .9fr .9fr;gap:14px}.journey-card{position:relative;overflow:hidden;padding:22px;border-radius:23px;background:linear-gradient(145deg,rgba(27,18,49,.91),rgba(9,7,18,.88));border:1px solid var(--line);box-shadow:var(--shadow)}.journey-card::after{content:'';position:absolute;width:190px;height:190px;border-radius:50%;right:-90px;bottom:-105px;background:radial-gradient(circle,rgba(139,92,246,.23),transparent 68%);pointer-events:none}.journey-card>*{position:relative;z-index:1}.journey-card h3{margin:4px 0 7px}.journey-card p{color:var(--muted);line-height:1.5}
    .journey-garden{grid-row:span 2;min-height:420px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(circle at 50% 28%,rgba(52,211,153,.13),transparent 34%),radial-gradient(circle at 90% 8%,rgba(139,92,246,.27),transparent 36%),linear-gradient(160deg,rgba(22,38,38,.92),rgba(14,10,27,.94))}.garden-scene{position:relative;min-height:225px;display:grid;place-items:center}.garden-glow{position:absolute;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(52,211,153,.22),transparent 68%);animation:gardenGlow 3s ease-in-out infinite}.garden-plant{position:relative;font-size:clamp(5rem,12vw,8rem);filter:drop-shadow(0 20px 32px rgba(0,0,0,.4));animation:gardenFloat 3.5s ease-in-out infinite}.garden-leaf{position:absolute;font-size:1.15rem;opacity:.7;animation:leafDrift 4s linear infinite}.garden-leaf:nth-child(2){left:20%;top:30%;animation-delay:-1s}.garden-leaf:nth-child(3){right:18%;top:43%;animation-delay:-2.2s}.garden-leaf:nth-child(4){left:30%;bottom:12%;animation-delay:-3s}
    .garden-level{display:flex;justify-content:space-between;gap:10px;align-items:end}.garden-level strong{font-size:1.45rem}.garden-level small{color:var(--muted)}.garden-bar{height:10px;margin-top:13px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}.garden-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#34d399,var(--purple),var(--blue));box-shadow:0 0 18px rgba(52,211,153,.4);transition:width .5s ease}
    .mission-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:1.8rem;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(37,99,235,.18));margin-bottom:15px}.mission-people{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.mission-person{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.065);font-size:.75rem}.mission-person.done{background:rgba(52,211,153,.14);color:#a7f3d0;border:1px solid rgba(52,211,153,.22)}
    .checkin-preview{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:14px 0}.checkin-mini{padding:11px;border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}.checkin-mini strong,.checkin-mini small{display:block}.checkin-mini small{color:var(--muted);margin-top:4px}.checkin-empty{padding:15px;border-radius:14px;border:1px dashed rgba(255,255,255,.14);color:var(--muted);text-align:center}
    .weekly-numbers{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}.weekly-number{padding:10px 6px;border-radius:13px;background:rgba(255,255,255,.055);text-align:center}.weekly-number strong,.weekly-number small{display:block}.weekly-number strong{font-size:1.25rem}.weekly-number small{font-size:.65rem;color:var(--muted);margin-top:3px}
    .capsule-card{grid-column:2/-1}.capsule-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:15px}.capsule-item{min-height:135px;padding:15px;border-radius:17px;border:1px solid rgba(255,255,255,.1);background:radial-gradient(circle at top right,rgba(139,92,246,.2),transparent 42%),rgba(255,255,255,.045);cursor:pointer;text-align:left}.capsule-item span,.capsule-item strong,.capsule-item small{display:block}.capsule-item span{font-size:1.65rem;margin-bottom:12px}.capsule-item small{color:var(--muted);margin-top:5px}.capsule-item.unlocked{border-color:rgba(52,211,153,.35);background:radial-gradient(circle at top right,rgba(52,211,153,.2),transparent 42%),rgba(255,255,255,.045)}
    .journey-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.journey-dialog{border:0;background:transparent;color:white;width:min(94vw,640px);padding:0}.journey-dialog::backdrop{background:rgba(0,0,0,.8);backdrop-filter:blur(11px)}.journey-dialog-card{padding:25px;border-radius:25px;background:linear-gradient(145deg,rgba(28,18,51,.99),rgba(8,6,17,.99));border:1px solid var(--line);box-shadow:0 28px 90px rgba(0,0,0,.6)}.journey-dialog-head{display:flex;justify-content:space-between;gap:13px;align-items:flex-start}.journey-dialog-head h3{margin:0}.journey-close{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.07);cursor:pointer}.journey-form{display:grid;gap:14px;margin-top:20px}
    .scale-row{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.scale-button{padding:11px 5px;border-radius:13px;border:1px solid var(--line);background:rgba(255,255,255,.05);cursor:pointer;font-size:1.25rem}.scale-button.active{background:linear-gradient(135deg,rgba(139,92,246,.45),rgba(37,99,235,.35));border-color:#a78bfa}.capsule-emojis{display:flex;gap:8px;flex-wrap:wrap}.capsule-emoji{width:42px;height:42px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.055);cursor:pointer;font-size:1.2rem}.capsule-emoji.active{border-color:#a78bfa;background:rgba(139,92,246,.2)}
    .capsule-detail{text-align:center}.capsule-detail>span{font-size:4rem}.capsule-detail h3{font-size:1.6rem;margin:12px 0}.capsule-message{margin:18px 0;padding:20px;border-radius:18px;background:rgba(255,255,255,.055);white-space:pre-wrap;text-align:left;line-height:1.6}.capsule-detail img{max-width:100%;max-height:420px;border-radius:17px;margin-top:14px}.capsule-lock{font-size:3.4rem;text-align:center;margin:20px 0}.capsule-empty{grid-column:1/-1;padding:20px;border:1px dashed rgba(255,255,255,.13);border-radius:15px;text-align:center;color:var(--muted)}
    @keyframes gardenFloat{50%{transform:translateY(-8px) rotate(1deg)}}@keyframes gardenGlow{50%{transform:scale(1.13);opacity:.65}}@keyframes leafDrift{0%{transform:translateY(-8px) rotate(0);opacity:0}25%{opacity:.75}100%{transform:translateY(90px) rotate(180deg);opacity:0}}
    @media(max-width:1050px){.journey-grid{grid-template-columns:repeat(2,1fr)}.journey-garden{grid-row:auto;grid-column:1/-1;min-height:330px}.capsule-card{grid-column:1/-1}}
    @media(max-width:680px){.journey-grid{grid-template-columns:1fr}.journey-garden,.capsule-card{grid-column:auto}.capsule-list{grid-template-columns:1fr}.weekly-numbers{grid-template-columns:repeat(2,1fr)}.journey-head{align-items:flex-start;flex-direction:column}.scale-row{gap:5px}.scale-button{padding:10px 3px}.garden-scene{min-height:180px}}
    @media(prefers-reduced-motion:reduce){.garden-plant,.garden-glow,.garden-leaf{animation:none!important}}
  `;
  document.head.append(style);
}

function buildSection() {
  if ($('#dukeJourneySection')) return true;
  const anchor = $('#homeActivityIdea') || $('#dukeNotesSection') || $('#dukeTodaySection') || $('.dashboard-grid');
  if (!anchor) return false;
  const section = document.createElement('section');
  section.id = 'dukeJourneySection';
  section.className = 'journey-section';
  section.innerHTML = `
    <div class="journey-head">
      <div><span class="journey-badge">✦ NUEVA IDEA DUKE</span><h2>Nuestro Camino</h2><p>Un espacio que crece con sus gestos, conversaciones y recuerdos.</p></div>
      <button id="openJourneyCapsule" class="primary-btn" type="button">💌 Crear cápsula</button>
    </div>
    <div class="journey-grid">
      <article class="journey-card journey-garden">
        <div><p class="eyebrow">JARDÍN DE LA RELACIÓN</p><div class="garden-scene"><div class="garden-glow"></div><span id="journeyPlant" class="garden-plant">🌱</span><span class="garden-leaf">✨</span><span class="garden-leaf">🍃</span><span class="garden-leaf">💜</span></div></div>
        <div><div class="garden-level"><div><strong id="journeyGardenName">Primer brote</strong><small id="journeyGardenText">Su constancia ya está tomando forma.</small></div><small id="journeyPoints">0 puntos</small></div><div class="garden-bar"><i id="journeyGardenProgress" style="width:0%"></i></div><small id="journeyNextLevel" style="display:block;margin-top:9px;color:var(--muted)"></small></div>
      </article>
      <article class="journey-card">
        <div id="journeyMissionIcon" class="mission-icon">🫶</div><p class="eyebrow">MISIÓN DE HOY</p><h3 id="journeyMissionTitle">Un momento para ustedes</h3><p id="journeyMissionText"></p><div id="journeyMissionPeople" class="mission-people"></div><button id="journeyMissionButton" class="primary-btn full" type="button">Marcar como hecha</button>
      </article>
      <article class="journey-card">
        <p class="eyebrow">PULSO DE LA SEMANA</p><h3>¿Cómo están los dos?</h3><p>Una revisión breve para saber qué necesita cada uno.</p><div id="journeyCheckinPreview" class="checkin-preview"></div><button id="openJourneyCheckin" class="secondary-btn full" type="button">Responder mi pulso</button>
      </article>
      <article class="journey-card">
        <p class="eyebrow">ESTA SEMANA</p><h3>Su historia en números</h3><p id="journeyWeeklyCopy">Cada interacción ayuda a que el jardín crezca.</p><div class="weekly-numbers"><div class="weekly-number"><strong id="journeyWeekMessages">0</strong><small>MENSAJES</small></div><div class="weekly-number"><strong id="journeyWeekMemories">0</strong><small>RECUERDOS</small></div><div class="weekly-number"><strong id="journeyWeekGames">0</strong><small>JUEGOS</small></div><div class="weekly-number"><strong id="journeyWeekCalls">0</strong><small>LLAMADAS</small></div></div>
      </article>
      <article class="journey-card capsule-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><p class="eyebrow">CÁPSULAS DEL TIEMPO</p><h3>Mensajes para el futuro</h3><p>Guarden palabras y fotos que solo se revelarán cuando llegue la fecha.</p></div><button id="openJourneyCapsuleMini" class="secondary-btn" type="button">＋ Nueva</button></div><div id="journeyCapsuleList" class="capsule-list"></div>
      </article>
    </div>`;
  anchor.after(section);
  $('#openJourneyCapsule').addEventListener('click', openCapsuleDialog);
  $('#openJourneyCapsuleMini').addEventListener('click', openCapsuleDialog);
  $('#openJourneyCheckin').addEventListener('click', openCheckinDialog);
  $('#journeyMissionButton').addEventListener('click', toggleMission);
  return true;
}

function buildDialogs() {
  if (!$('#journeyCheckinDialog')) {
    const dialog = document.createElement('dialog');
    dialog.id = 'journeyCheckinDialog';
    dialog.className = 'journey-dialog';
    dialog.innerHTML = `
      <form id="journeyCheckinForm" class="journey-dialog-card journey-form">
        <div class="journey-dialog-head"><div><p class="eyebrow">PULSO DE LA SEMANA</p><h3>¿Cómo te sientes con ustedes?</h3></div><button class="journey-close" type="button" data-close-journey="journeyCheckinDialog">×</button></div>
        <div><label>Cercanía emocional</label><div class="scale-row" data-scale="closeness">${['😔','😕','🙂','😊','🥰'].map((item, index) => `<button class="scale-button ${index === 2 ? 'active' : ''}" type="button" data-value="${index + 1}">${item}</button>`).join('')}</div></div>
        <div><label>Nivel de energía</label><div class="scale-row" data-scale="energy">${['🪫','😴','🙂','⚡','🔥'].map((item, index) => `<button class="scale-button ${index === 2 ? 'active' : ''}" type="button" data-value="${index + 1}">${item}</button>`).join('')}</div></div>
        <label>Lo que más necesito<select id="journeyNeed"><option value="cariño">Más cariño</option><option value="hablar">Hablar con calma</option><option value="espacio">Un poco de espacio</option><option value="apoyo">Apoyo</option><option value="divertirnos">Divertirnos juntos</option><option value="descansar">Descansar</option><option value="planear">Planear algo juntos</option></select></label>
        <label>Algo que quieras decir<textarea id="journeyCheckinNote" maxlength="180" placeholder="Opcional: explica cómo te sientes…"></textarea></label>
        <button class="primary-btn full" type="submit">Guardar mi pulso</button>
      </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-scale]').forEach((row) => row.querySelectorAll('[data-value]').forEach((button) => button.addEventListener('click', () => {
      row.querySelectorAll('[data-value]').forEach((item) => item.classList.toggle('active', item === button));
    })));
    dialog.querySelector('[data-close-journey]').addEventListener('click', () => dialog.close());
    $('#journeyCheckinForm').addEventListener('submit', submitCheckin);
  }

  if (!$('#journeyCapsuleDialog')) {
    const dialog = document.createElement('dialog');
    dialog.id = 'journeyCapsuleDialog';
    dialog.className = 'journey-dialog';
    dialog.innerHTML = `
      <form id="journeyCapsuleForm" class="journey-dialog-card journey-form">
        <div class="journey-dialog-head"><div><p class="eyebrow">CÁPSULA DEL TIEMPO</p><h3>Guarda algo para el futuro</h3></div><button class="journey-close" type="button" data-close-journey="journeyCapsuleDialog">×</button></div>
        <label>Título<input id="journeyCapsuleTitle" maxlength="80" required placeholder="Ej. Para nuestro aniversario" /></label>
        <label>Mensaje<textarea id="journeyCapsuleMessage" maxlength="1200" required placeholder="Esto permanecerá oculto hasta la fecha elegida…"></textarea></label>
        <label>Fecha para abrir<input id="journeyCapsuleDate" type="datetime-local" required /></label>
        <label>Foto opcional<input id="journeyCapsuleImage" type="file" accept="image/*" /><small style="color:var(--muted)">La imagen también permanecerá sellada.</small></label>
        <div><label>Identifica la cápsula</label><div class="capsule-emojis">${['💌','💜','🌹','✨','🌙','🌻','🎁','🫶'].map((item, index) => `<button class="capsule-emoji ${index === 0 ? 'active' : ''}" type="button" data-capsule-emoji="${item}">${item}</button>`).join('')}</div></div>
        <button class="primary-btn full" type="submit">Sellar cápsula</button>
      </form>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close-journey]').addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('[data-capsule-emoji]').forEach((button) => button.addEventListener('click', () => dialog.querySelectorAll('[data-capsule-emoji]').forEach((item) => item.classList.toggle('active', item === button))));
    $('#journeyCapsuleForm').addEventListener('submit', submitCapsule);
  }

  if (!$('#journeyCapsuleDetail')) {
    const dialog = document.createElement('dialog');
    dialog.id = 'journeyCapsuleDetail';
    dialog.className = 'journey-dialog';
    dialog.innerHTML = '<div class="journey-dialog-card"><div class="journey-dialog-head"><div><p class="eyebrow">CÁPSULA DEL TIEMPO</p><h3>Un mensaje de su historia</h3></div><button class="journey-close" type="button">×</button></div><div id="journeyCapsuleContent"></div></div>';
    document.body.append(dialog);
    dialog.querySelector('.journey-close').addEventListener('click', () => dialog.close());
  }
}

function openCheckinDialog() {
  const mine = journey.data?.checkins?.find((item) => item.user_id === state.user?.id);
  const dialog = $('#journeyCheckinDialog');
  if (mine) {
    dialog.querySelectorAll('[data-scale="closeness"] [data-value]').forEach((button) => button.classList.toggle('active', Number(button.dataset.value) === Number(mine.closeness)));
    dialog.querySelectorAll('[data-scale="energy"] [data-value]').forEach((button) => button.classList.toggle('active', Number(button.dataset.value) === Number(mine.energy)));
    $('#journeyNeed').value = mine.need || 'cariño';
    $('#journeyCheckinNote').value = mine.note || '';
  }
  if (!dialog.open) dialog.showModal();
}

function openCapsuleDialog() {
  if (!state.partner) return toast('Tu pareja todavía no se ha unido.', 'error');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  $('#journeyCapsuleDate').value = tomorrow.toISOString().slice(0, 16);
  const dialog = $('#journeyCapsuleDialog');
  if (!dialog.open) dialog.showModal();
}

async function submitCheckin(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const closeness = Number($('#journeyCheckinForm [data-scale="closeness"] .active')?.dataset.value || 3);
    const energy = Number($('#journeyCheckinForm [data-scale="energy"] .active')?.dataset.value || 3);
    journey.data = await journeyApi('checkin', { closeness, energy, need: $('#journeyNeed').value, note: $('#journeyCheckinNote').value });
    $('#journeyCheckinDialog').close();
    render();
    toast('Tu pulso semanal quedó guardado.', 'success');
  } catch {
    toast('No se pudo guardar el pulso.', 'error');
  } finally { button.disabled = false; }
}

async function submitCapsule(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const file = $('#journeyCapsuleImage').files?.[0];
    const mediaUrl = file ? await imageToDataUrl(file) : null;
    const emoji = $('#journeyCapsuleForm [data-capsule-emoji].active')?.dataset.capsuleEmoji || '💌';
    await journeyApi('capsule_create', {
      title: $('#journeyCapsuleTitle').value,
      message: $('#journeyCapsuleMessage').value,
      unlockAt: new Date($('#journeyCapsuleDate').value).toISOString(),
      emoji,
      mediaUrl,
    });
    event.target.reset();
    $('#journeyCapsuleDialog').close();
    await loadJourney(true);
    toast('La cápsula quedó sellada para el futuro. 💌', 'success');
  } catch (error) {
    const message = error.code === 'DATE_TOO_FAR' ? 'La fecha debe estar dentro de los próximos cinco años.' : error.message === 'IMAGE_TOO_LARGE' ? 'La foto es demasiado grande.' : 'No se pudo crear la cápsula. Revisa la fecha y los datos.';
    toast(message, 'error');
  } finally { button.disabled = false; }
}

async function toggleMission() {
  if (!journey.data) return;
  const mission = missionForDate(journey.data.serverDate);
  const mine = journey.data.missionCompletions?.some((item) => item.user_id === state.user?.id && item.mission_key === mission[0]);
  const button = $('#journeyMissionButton');
  button.disabled = true;
  try {
    journey.data = await journeyApi('mission', { missionKey: mission[0], completed: !mine });
    render();
    toast(!mine ? '¡Misión completada! Su jardín ganó energía. ✨' : 'Misión desmarcada.', 'success');
  } catch {
    toast('No se pudo actualizar la misión.', 'error');
  } finally { button.disabled = false; }
}

function renderGarden() {
  const garden = journey.data?.garden || { level: 0, points: 0, progress: 0, nextAt: 80 };
  const stage = gardenStages[Math.min(garden.level, gardenStages.length - 1)];
  $('#journeyPlant').textContent = stage[0];
  $('#journeyGardenName').textContent = stage[1];
  $('#journeyGardenText').textContent = stage[2];
  $('#journeyPoints').textContent = `${garden.points} puntos`;
  $('#journeyGardenProgress').style.width = `${garden.progress}%`;
  $('#journeyNextLevel').textContent = garden.level >= gardenStages.length - 1 ? 'Su jardín alcanzó su forma más especial.' : `Faltan ${Math.max(0, garden.nextAt - garden.points)} puntos para la siguiente etapa.`;
}

function renderMission() {
  const mission = missionForDate(journey.data?.serverDate);
  const completions = (journey.data?.missionCompletions || []).filter((item) => item.mission_key === mission[0]);
  const mine = completions.some((item) => item.user_id === state.user?.id);
  $('#journeyMissionIcon').textContent = mission[1];
  $('#journeyMissionTitle').textContent = mission[2];
  $('#journeyMissionText').textContent = mission[3];
  const members = state.members || [];
  $('#journeyMissionPeople').innerHTML = members.map((member) => {
    const done = completions.some((item) => item.user_id === member.user_id);
    return `<span class="mission-person ${done ? 'done' : ''}">${done ? '✓ ' : ''}${escapeText(member.display_name)}</span>`;
  }).join('') || '<span class="mission-person">Esperando a la pareja</span>';
  $('#journeyMissionButton').textContent = mine ? '✓ Misión hecha' : 'Marcar como hecha';
  $('#journeyMissionButton').classList.toggle('secondary-btn', mine);
  $('#journeyMissionButton').classList.toggle('primary-btn', !mine);
}

function renderCheckins() {
  const root = $('#journeyCheckinPreview');
  const checkins = journey.data?.checkins || [];
  if (!checkins.length) {
    root.innerHTML = '<div class="checkin-empty" style="grid-column:1/-1">Todavía nadie ha respondido esta semana.</div>';
    return;
  }
  root.innerHTML = state.members.map((member) => {
    const item = checkins.find((entry) => entry.user_id === member.user_id);
    if (!item) return `<div class="checkin-mini"><strong>${escapeText(member.display_name)}</strong><small>Aún no respondió</small></div>`;
    const hearts = '💜'.repeat(Number(item.closeness || 1));
    const energy = ['🪫','😴','🙂','⚡','🔥'][Number(item.energy || 3) - 1];
    return `<div class="checkin-mini"><strong>${escapeText(member.display_name)}</strong><small>${hearts} · ${energy}</small><small>Necesita: ${escapeText(item.need)}</small>${item.note ? `<small>“${escapeText(item.note)}”</small>` : ''}</div>`;
  }).join('');
}

function renderWeekly() {
  const weekly = journey.data?.weekly || {};
  $('#journeyWeekMessages').textContent = weekly.messages || 0;
  $('#journeyWeekMemories').textContent = weekly.memories || 0;
  $('#journeyWeekGames').textContent = weekly.games || 0;
  $('#journeyWeekCalls').textContent = weekly.calls || 0;
  const total = Number(weekly.messages || 0) + Number(weekly.memories || 0) + Number(weekly.games || 0) + Number(weekly.calls || 0);
  $('#journeyWeeklyCopy').textContent = total ? `Esta semana compartieron ${total} momentos dentro de Duke.` : 'Su nueva semana comienza con un pequeño gesto.';
}

function formatUnlock(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderCapsules() {
  const root = $('#journeyCapsuleList');
  const capsules = journey.data?.capsules || [];
  if (!capsules.length) {
    root.innerHTML = '<div class="capsule-empty">Todavía no hay cápsulas. Guarden hoy algo que quieran descubrir en el futuro.</div>';
    return;
  }
  root.innerHTML = capsules.slice(0, 9).map((capsule) => `
    <button class="capsule-item ${capsule.is_unlocked ? 'unlocked' : ''}" type="button" data-capsule-id="${capsule.id}">
      <span>${capsule.is_unlocked ? capsule.emoji : '🔒'}</span><strong>${escapeText(capsule.title)}</strong><small>${capsule.is_unlocked ? 'Lista para abrir' : `Se abre ${formatUnlock(capsule.unlock_at)}`}</small><small>${capsule.sender_id === state.user?.id ? `Para ${escapeText(capsule.recipient_name)}` : `De ${escapeText(capsule.sender_name)}`}</small>
    </button>`).join('');
  root.querySelectorAll('[data-capsule-id]').forEach((button) => button.addEventListener('click', () => showCapsule(button.dataset.capsuleId)));
}

async function showCapsule(id) {
  const capsule = journey.data?.capsules?.find((item) => item.id === id);
  if (!capsule) return;
  const root = $('#journeyCapsuleContent');
  if (!capsule.is_unlocked) {
    root.innerHTML = `<div class="capsule-detail"><div class="capsule-lock">🔒</div><h3>${escapeText(capsule.title)}</h3><p>Esta cápsula permanece sellada.</p><p><strong>Se abrirá ${formatUnlock(capsule.unlock_at)}</strong></p></div>`;
  } else {
    root.innerHTML = `<div class="capsule-detail"><span>${capsule.emoji}</span><h3>${escapeText(capsule.title)}</h3><small>${escapeText(capsule.sender_name)} · ${formatUnlock(capsule.unlock_at)}</small><div class="capsule-message">${escapeText(capsule.capsule_message)}</div>${capsule.media_url ? `<img src="${capsule.media_url}" alt="Foto de la cápsula" />` : ''}</div>`;
    if (capsule.recipient_id === state.user?.id && !capsule.opened_at) {
      journey.data = await journeyApi('capsule_open', { capsuleId: id }).catch(() => journey.data);
      renderCapsules();
    }
  }
  const dialog = $('#journeyCapsuleDetail');
  if (!dialog.open) dialog.showModal();
}

async function notifyUnlockedCapsules() {
  const unlocked = (journey.data?.capsules || []).filter((capsule) => capsule.is_unlocked && capsule.recipient_id === state.user?.id && !capsule.opened_at && !journey.notifiedCapsules.has(capsule.id));
  for (const capsule of unlocked) {
    journey.notifiedCapsules.add(capsule.id);
    toast(`💌 Se abrió una cápsula: ${capsule.title}`, 'success');
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Una cápsula de Duke está lista 💌', { body: capsule.title, icon: '/assets/duke-icon.svg', badge: '/assets/duke-icon.svg', tag: `duke-capsule-${capsule.id}`, data: { type: 'journey_capsule', capsuleId: capsule.id } });
      } catch {}
    }
  }
  localStorage.setItem('duke_notified_capsules', JSON.stringify([...journey.notifiedCapsules].slice(-50)));
}

function render() {
  if (!journey.data || !$('#dukeJourneySection')) return;
  renderGarden();
  renderMission();
  renderCheckins();
  renderWeekly();
  renderCapsules();
  notifyUnlockedCapsules();
}

async function loadJourney(renderAfter = true) {
  if (!state.user || !state.couple) return;
  try {
    journey.data = await journeyApi('snapshot');
    if (renderAfter) render();
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) console.warn('Journey load error', error);
  }
}

function initJourney() {
  if (journey.initialized) return;
  journey.initialized = true;
  injectStyles();
  buildDialogs();
  const mount = () => {
    if (!buildSection()) return setTimeout(mount, 350);
    loadJourney(true);
  };
  mount();
  clearInterval(journey.poller);
  journey.poller = setInterval(() => loadJourney(true), 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadJourney(true); });
}

export { initJourney };
