const DUKE_BUILD = '2026.08.05-r17';
const gateScreen = document.getElementById('gateScreen');
const gateTitle = document.getElementById('gateTitle');
const gateText = document.getElementById('gateText');
const gateLoader = document.getElementById('gateLoader');

let startPromise = null;
let optionalFeaturesStarted = false;

function versioned(path) {
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}build=${encodeURIComponent(DUKE_BUILD)}`;
}

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

function showRecovery(error) {
  console.error('Duke startup failure:', error);
  document.getElementById('authScreen')?.classList.add('hidden');
  document.getElementById('appShell')?.classList.add('hidden');
  gateScreen?.classList.remove('hidden');
  gateLoader?.classList.add('hidden');
  if (gateTitle) gateTitle.textContent = 'Duke necesita reiniciarse';
  if (gateText) gateText.textContent = 'Se detectó un archivo antiguo o incompleto. Presiona reparar para limpiar la instalación y abrir la versión nueva.';

  if (!document.getElementById('dukeRepairButton')) {
    const button = document.createElement('button');
    button.id = 'dukeRepairButton';
    button.type = 'button';
    button.className = 'primary-btn full';
    button.style.marginTop = '18px';
    button.textContent = 'Reparar y abrir Duke';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Reparando…';
      await resetLocalInstallation();
      location.replace(`${location.pathname}?duke-repair=${Date.now()}${location.hash || ''}`);
    });
    document.querySelector('.gate-card')?.append(button);
  }
}

async function resetLocalInstallation() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('Duke cache cleanup failed:', error);
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn('Duke worker cleanup failed:', error);
  }
}

async function prepareFreshBuild() {
  const storedBuild = localStorage.getItem('duke_active_build');
  if (storedBuild === DUKE_BUILD) return;

  localStorage.setItem('duke_active_build', DUKE_BUILD);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('Duke old cache cleanup failed:', error);
  }
}

async function refreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await registration.update().catch(() => {});
  } catch (error) {
    console.warn('Duke service worker unavailable:', error);
  }
}

function openJourneySection() {
  setTimeout(() => {
    document.getElementById('dukeJourneySection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState({}, '', location.pathname);
  }, 350);
}

async function loadOptionalFeature(path, exportName) {
  try {
    const module = await import(versioned(path));
    const initializer = module?.[exportName];
    if (typeof initializer === 'function') await initializer();
    return true;
  } catch (error) {
    console.error(`Duke optional feature failed: ${path}`, error);
    return false;
  }
}

function startOptionalFeatures() {
  if (optionalFeaturesStarted) return;
  optionalFeaturesStarted = true;

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
    void loadOptionalFeature(path, exportName);
  }
}

async function startDukeInternal() {
  const entryHash = location.hash;
  document.getElementById('copyPrivateLinkButton')?.classList.add('hidden');

  const module = await import(versioned('/src/events.js'));
  if (typeof module?.init !== 'function') throw new Error('DUKE_CORE_INIT_MISSING');

  await module.init();
  startOptionalFeatures();
  void refreshServiceWorker();

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
}

function startDuke() {
  if (!startPromise) {
    startPromise = startDukeInternal().catch((error) => {
      startPromise = null;
      showRecovery(error);
      throw error;
    });
  }
  return startPromise;
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
    if (!button || !input) return;

    button.disabled = true;
    showGateError('');

    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'INVALID_ACCESS_CODE');
      await startDuke();
    } catch (error) {
      if (error?.message === 'INVALID_ACCESS_CODE') {
        showGateError('El código no coincide. Escríbelo nuevamente.');
        input.value = '';
        input.focus();
      } else {
        showRecovery(error);
      }
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  await prepareFreshBuild();

  try {
    const response = await fetch(`/api/duke?action=gate&build=${encodeURIComponent(DUKE_BUILD)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.unlocked) {
      await startDuke();
      return;
    }
  } catch (error) {
    console.warn('Duke gate check failed:', error);
  }

  renderCodeGate();
}

window.addEventListener('error', (event) => {
  if (!document.getElementById('appShell')?.classList.contains('hidden')) return;
  showRecovery(event.error || new Error(event.message || 'DUKE_WINDOW_ERROR'));
});

window.addEventListener('unhandledrejection', (event) => {
  if (!document.getElementById('appShell')?.classList.contains('hidden')) return;
  showRecovery(event.reason || new Error('DUKE_PROMISE_ERROR'));
});

void boot();
