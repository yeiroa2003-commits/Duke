import {
  $,
  state,
  toast,
  translateError,
  api,
  closeDialog,
  openDialog,
  setSnapshot,
} from './core.js';

const localErrors = {
  SPACE_EXISTS_JOIN_REQUIRED: 'El espacio ya existe. En la segunda cuenta selecciona “Unirme con código”.',
  COUPLE_ALREADY_EXISTS: 'El espacio ya existe. En la segunda cuenta selecciona “Unirme con código”.',
  INVALID_DATE: 'La fecha seleccionada no es válida.',
  ACCESS_CODE_REQUIRED: 'Primero escribe el código 2003 en la pantalla de acceso.',
  ACTION_NOT_FOUND: 'No se encontró la acción solicitada.',
};

function errorText(code) {
  return localErrors[code] || translateError(code);
}

async function spaceApi(action, payload = {}) {
  const response = await fetch(`/api/space?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

function setBusy(form, busy, text) {
  const button = form.querySelector('button[type="submit"], button:not([type])');
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? text : button.dataset.originalText;
}

async function refreshWithoutReopeningModal(fallbackCouple) {
  state.couple = fallbackCouple || state.couple;
  closeDialog('coupleDialog');

  try {
    const snapshot = await api('sync');
    if (snapshot.couple) {
      setSnapshot(snapshot, true);
    } else if (fallbackCouple) {
      state.couple = fallbackCouple;
    }
  } catch (error) {
    // La creación ya fue confirmada por /api/space. No volvemos a mostrar
    // “Primer paso” solo porque una consulta secundaria haya fallado.
    console.warn('Duke: el espacio se creó, pero la sincronización secundaria falló.', error);
  }

  closeDialog('coupleDialog');
}

async function handleCreate(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  setBusy(form, true, 'Creando espacio…');

  try {
    const data = await spaceApi('create', {
      name: $('#coupleNameInput').value,
      relationshipDate: $('#relationshipDateInput').value || null,
      pin: $('#couplePinInput').value,
    });

    await refreshWithoutReopeningModal(data.couple);
    form.reset();
    toast(
      data.recovered
        ? 'El espacio ya estaba creado y fue recuperado correctamente.'
        : `Espacio creado correctamente. Código: ${data.couple.invite_code}`,
      'success'
    );

    // Abre el perfil para que la primera persona vea y copie el código.
    setTimeout(() => openDialog('profileDialog'), 120);
  } catch (error) {
    toast(errorText(error.code), 'error');
  } finally {
    setBusy(form, false);
  }
}

async function handleJoin(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  setBusy(form, true, 'Conectando…');

  try {
    const data = await spaceApi('join', {
      inviteCode: $('#inviteCodeInput').value,
      pin: $('#joinPinInput').value,
    });

    await refreshWithoutReopeningModal(data.couple);
    form.reset();
    toast(
      data.recovered
        ? 'Tu cuenta ya estaba conectada. Se recuperó el espacio.'
        : 'Ya están conectados correctamente en Duke.',
      'success'
    );
  } catch (error) {
    toast(errorText(error.code), 'error');
  } finally {
    setBusy(form, false);
  }
}

async function recoverExistingSpace() {
  if (!state.user) return;

  try {
    const data = await spaceApi('status');
    if (!data.couple) return;
    await refreshWithoutReopeningModal(data.couple);
  } catch (error) {
    if (!['UNAUTHORIZED', 'ACCESS_CODE_REQUIRED'].includes(error.code)) {
      console.warn('Duke: no se pudo comprobar el espacio existente.', error);
    }
  }
}

function initSpaceFix() {
  const createForm = $('#createCoupleForm');
  const joinForm = $('#joinCoupleForm');

  if (createForm) createForm.addEventListener('submit', handleCreate, { capture: true });
  if (joinForm) joinForm.addEventListener('submit', handleJoin, { capture: true });

  // Corrige automáticamente el caso en que el espacio sí se creó en Neon,
  // pero la versión anterior dejó visible la pantalla “Primer paso”.
  recoverExistingSpace();
  setTimeout(recoverExistingSpace, 900);
}

export { initSpaceFix };
