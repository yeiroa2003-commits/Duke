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

async function startDuke() {
  history.replaceState({}, '', `${location.pathname}${location.hash || ''}`);
  document.getElementById('copyPrivateLinkButton')?.classList.add('hidden');
  try {
    const [{ init }, { initSpaceFix }] = await Promise.all([
      import('/src/events.js'),
      import('/src/space-fix.js'),
    ]);
    await init();
    initSpaceFix();
  } catch (error) {
    console.error('Duke init error:', error);
    gateScreen?.classList.remove('hidden');
    if (gateTitle) gateTitle.textContent = 'Duke no pudo iniciar';
    if (gateText) gateText.textContent = 'Actualiza la página. Si el problema continúa, revisa la configuración de Vercel y Neon.';
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
  history.replaceState({}, '', `${location.pathname}${location.hash || ''}`);
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
    // La pantalla del código también funciona cuando la comprobación inicial falla.
  }
  renderCodeGate();
}

boot();
