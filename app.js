const gateScreen = document.getElementById('gateScreen');
const gateTitle = document.getElementById('gateTitle');
const gateText = document.getElementById('gateText');
const gateLoader = document.getElementById('gateLoader');

function showGateError(message) {
  let error = document.getElementById('gateCodeError');
  if (!error) {
    error = document.createElement('p');
    error.id = 'gateCodeError';
    error.style.color = '#fda4af';
    error.style.margin = '12px 0 0';
    error.style.fontSize = '.88rem';
    document.getElementById('gateCodeForm')?.append(error);
  }
  error.textContent = message;
}

function openJourneySection() {
  setTimeout(() => {
    document.getElementById('dukeJourneySection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState({}, '', location.pathname);
  }, 350);
}

async function loadOptionalFeature(path, exportName) {
  try {
    const module = await import(path);
    const initializer = module?.[exportName];
    if (typeof initializer === 'function') {
      await initializer();
    } else {
      console.warn(`Duke optional feature missing initializer: ${exportName}`);
    }
    return true;
  } catch (error) {
    console.error(`Duke optional feature failed: ${path}`, error);
    return false;
  }
}

async function startOptionalFeatures() {
  const features = [
    ['/src/space-fix.js', 'initSpaceFix'],
    ['/src/video-calls.js', 'initWebRTCCalls'],
    ['/src/more-games.js', 'initMoreGames'],
    ['/src/draw-game.js', 'initDrawGame'],
    ['/src/ui-enhancements.js', 'initUiEnhancements'],
    ['/src/relationship-plus.js', 'initRelationshipPlus'],
    ['/src/notes.js', 'initPartnerNotes'],
    ['/src/activities-plus.js', 'initActivitiesPlus'],
    ['/src/journey.js', 'initJourney'],
    ['/src/gift-story.js', 'initGiftStory'],
    ['/src/duke-beagle.js', 'initDukeBeagle'],
  ];

  for (const [path, exportName] of features) {
    await loadOptionalFeature(path, exportName);
  }

  // Audio is intentionally loaded last and isolated because browser media APIs
  // vary between iPhone, Android and desktop. It must never block Duke startup.
  setTimeout(() => {
    loadOptionalFeature('/src/gift-audio-natural.js', 'initGiftAudioNatural');
  }, 700);
}

async function startDuke() {
  const entryHash = location.hash;
  document.getElementById('copyPrivateLinkButton')?.classList.add('hidden');

  try {
    const { init } = await import('/src/events.js');
    if (typeof init !== 'function') throw new Error('DUKE_CORE_INIT_MISSING');

    await init();

    // Duke is already usable at this point. Extra features load separately so
    // one broken module cannot leave the whole application blank.
    startOptionalFeatures();

    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'DUKE_OPEN_JOURNEY') openJourneySection();
    });

    if (entryHash === '#duke-notes') {
      setTimeout(() => {
        document.getElementById('dukeNotesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState({}, '', location.pathname);
      }, 900);
    } else if (entryHash === '#duke-journey') {
      setTimeout(openJourneySection, 700);
    } else if (location.hash && !location.hash.startsWith('#duke-call=')) {
      history.replaceState({}, '', location.pathname);
    }
  } catch (error) {
    console.error('Duke core init error:', error);
    gateScreen?.classList.remove('hidden');
    if (gateTitle) gateTitle.textContent = 'Duke no pudo iniciar';
    if (gateText) gateText.textContent = 'Actualiza la página. Si el problema continúa, cierra Duke por completo y vuelve a abrirlo.';
    gateLoader?.classList.add('hidden');
  }
}

function renderCodeGate() {
  gateLoader?.classList.add('hidden');
  if (gateTitle) gateTitle.textContent = 'Escribe el código de ustedes';
  if (gateText) gateText.textContent = 'Tú y tu pareja deben escribir el mismo código para abrir Duke.';

  if (document.getElementById('gateCodeForm')) return;

  const form = document.createElement('form');
  form.id = 'gateCodeForm';
  form.style.display = 'grid';
  form.style.gap = '12px';
  form.style.marginTop = '22px';
  form.innerHTML = `
    <label style="text-align:left">
      Código de acceso
      <input id="gateCodeInput" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" autocomplete="one-time-code" placeholder="••••" required />
    </label>
    <button class="primary-btn full" type="submit">Entrar a Duke</button>
  `;

  document.querySelector('.gate-card')?.append(form);
  document.getElementById('gateCodeInput')?.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const input = document.getElementById('gateCodeInput');
    const code = input?.value.trim() || '';
    button.disabled = true;
    showGateError('');

    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'INVALID_ACCESS_CODE');
      await startDuke();
    } catch {
      showGateError('El código no coincide. Escríbelo nuevamente.');
      if (input) {
        input.value = '';
        input.focus();
      }
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  try {
    const response = await fetch('/api/duke?action=gate', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.unlocked) {
      await startDuke();
      return;
    }
  } catch {
    // The code screen remains available when the initial check fails.
  }
  renderCodeGate();
}

boot();
