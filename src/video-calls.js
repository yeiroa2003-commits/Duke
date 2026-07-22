import { $, $$, state, toast, switchView } from './core.js';

const videoState = {
  currentCall: null,
  jitsi: null,
  poller: null,
  joining: false,
  dismissed: new Set(),
};

function injectStyles() {
  if ($('#dukeVideoStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeVideoStyles';
  style.textContent = `
    .incoming-call-banner{position:fixed;z-index:80;left:50%;top:18px;transform:translateX(-50%);width:min(92vw,520px);padding:16px;border-radius:20px;background:linear-gradient(135deg,rgba(109,40,217,.97),rgba(29,78,216,.96));border:1px solid rgba(255,255,255,.2);box-shadow:0 24px 80px rgba(0,0,0,.5);display:flex;align-items:center;gap:14px;animation:dukeCallIn .28s ease}
    .incoming-call-banner.hidden{display:none}
    .incoming-call-avatar{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:1.45rem;font-weight:900;flex:0 0 auto}
    .incoming-call-copy{min-width:0;flex:1}.incoming-call-copy strong,.incoming-call-copy small{display:block}.incoming-call-copy small{opacity:.78;margin-top:4px}
    .incoming-call-actions{display:flex;gap:8px}.incoming-call-actions button{border:0;border-radius:12px;padding:10px 13px;cursor:pointer;font-weight:800}
    .incoming-call-join{background:#fff;color:#5b21b6}.incoming-call-decline{background:rgba(0,0,0,.28);color:#fff}
    .video-fallback{display:grid;place-items:center;gap:12px;text-align:center;min-height:360px;padding:30px;border:1px dashed rgba(255,255,255,.18);border-radius:18px;color:#aaa4bb}
    .video-fallback a{display:inline-flex;text-decoration:none;color:white;background:linear-gradient(135deg,#8b5cf6,#2563eb);padding:12px 18px;border-radius:14px;font-weight:800}
    .call-live-note{display:inline-flex;align-items:center;gap:8px;margin:15px auto 0;padding:8px 12px;border-radius:999px;background:rgba(52,211,153,.12);color:#a7f3d0;border:1px solid rgba(52,211,153,.25)}
    .call-live-note::before{content:"";width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 14px #34d399}
    @keyframes dukeCallIn{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}
    @media(max-width:620px){.incoming-call-banner{align-items:flex-start;flex-wrap:wrap}.incoming-call-copy{width:calc(100% - 70px)}.incoming-call-actions{width:100%}.incoming-call-actions button{flex:1}}
  `;
  document.head.append(style);
}

function ensureBanner() {
  let banner = $('#incomingCallBanner');
  if (banner) return banner;
  banner = document.createElement('section');
  banner.id = 'incomingCallBanner';
  banner.className = 'incoming-call-banner hidden';
  banner.innerHTML = `
    <div id="incomingCallAvatar" class="incoming-call-avatar">D</div>
    <div class="incoming-call-copy">
      <strong id="incomingCallTitle">Videollamada entrante</strong>
      <small id="incomingCallText">Tu pareja quiere verte.</small>
    </div>
    <div class="incoming-call-actions">
      <button id="joinIncomingCall" class="incoming-call-join" type="button">Unirme</button>
      <button id="declineIncomingCall" class="incoming-call-decline" type="button">Ahora no</button>
    </div>
  `;
  document.body.append(banner);
  $('#joinIncomingCall').addEventListener('click', () => answerIncomingCall());
  $('#declineIncomingCall').addEventListener('click', () => declineIncomingCall());
  return banner;
}

async function callsApi(action, payload = {}) {
  const response = await fetch(`/api/calls?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'SERVER_ERROR' }));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'SERVER_ERROR');
    error.code = data.error || 'SERVER_ERROR';
    throw error;
  }
  return data;
}

function errorMessage(code) {
  const messages = {
    PARTNER_NOT_CONNECTED: 'Tu pareja todavía no se ha unido al espacio Duke.',
    NO_DUKE_SPACE: 'Primero crea o únete al espacio Duke.',
    ACCESS_CODE_REQUIRED: 'Primero escribe el código 2003.',
    CALL_NOT_FOUND: 'La videollamada ya terminó.',
    UNAUTHORIZED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
    JITSI_UNAVAILABLE: 'No se pudo cargar el servicio de videollamada.',
  };
  return messages[code] || 'No se pudo iniciar la videollamada.';
}

function hideIncomingBanner() {
  $('#incomingCallBanner')?.classList.add('hidden');
}

function showIncomingBanner(call) {
  if (!call || videoState.dismissed.has(call.id)) return;
  const banner = ensureBanner();
  $('#incomingCallAvatar').textContent = call.starter_avatar || call.starter_name?.slice(0, 1).toUpperCase() || 'D';
  $('#incomingCallTitle').textContent = call.call_type === 'audio' ? 'Llamada de voz entrante' : 'Videollamada entrante';
  $('#incomingCallText').textContent = `${call.starter_name || 'Tu pareja'} quiere ${call.call_type === 'audio' ? 'hablar contigo' : 'verte ahora'}.`;
  banner.classList.remove('hidden');
}

function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="meet.jit.si/external_api.js"]');
    if (existing) {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.JitsiMeetExternalAPI) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 8000) {
          clearInterval(timer);
          reject(new Error('JITSI_UNAVAILABLE'));
        }
      }, 150);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('JITSI_UNAVAILABLE'));
    document.head.append(script);
  });
}

function directRoomUrl(roomName) {
  return `https://meet.jit.si/${encodeURIComponent(roomName)}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`;
}

function resetCallUi() {
  videoState.jitsi?.dispose?.();
  videoState.jitsi = null;
  videoState.currentCall = null;
  const container = $('#jitsiContainer');
  if (container) {
    container.innerHTML = '';
    container.classList.add('hidden');
  }
  $('#endCallButton')?.classList.add('hidden');
  $('#callLobby')?.classList.remove('hidden');
  hideIncomingBanner();
}

function showFallback(call) {
  const container = $('#jitsiContainer');
  if (!container) return;
  const url = directRoomUrl(call.room_name);
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="video-fallback">
      <span style="font-size:3rem">📹</span>
      <strong>No se pudo abrir el video dentro de Duke</strong>
      <p>Puedes entrar a la misma sala segura desde una pestaña nueva.</p>
      <a href="${url}" target="_blank" rel="noopener noreferrer">Abrir videollamada</a>
    </div>
  `;
}

async function openCall(call, shouldAnswer = false) {
  if (!call || videoState.joining) return;
  videoState.joining = true;
  hideIncomingBanner();

  try {
    let current = call;
    if (shouldAnswer) {
      const answered = await callsApi('answer', { callId: call.id });
      current = { ...call, ...answered.call };
    }

    videoState.currentCall = current;
    switchView('call');
    $('#callLobby')?.classList.add('hidden');
    $('#jitsiContainer')?.classList.remove('hidden');
    $('#endCallButton')?.classList.remove('hidden');

    await loadJitsiScript();

    videoState.jitsi?.dispose?.();
    $('#jitsiContainer').innerHTML = '';
    videoState.jitsi = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: current.room_name,
      parentNode: $('#jitsiContainer'),
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: state.user?.display_name || 'Duke',
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        startWithAudioMuted: false,
        startWithVideoMuted: current.call_type === 'audio',
        enableWelcomePage: false,
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
      },
    });

    videoState.jitsi.addEventListener('videoConferenceJoined', () => {
      toast(current.call_type === 'audio' ? 'Entraste a la llamada.' : 'Entraste a la videollamada.', 'success');
    });
    videoState.jitsi.addEventListener('readyToClose', () => endCurrentCall());
  } catch (error) {
    console.error('Duke video error:', error);
    showFallback(call);
    toast(errorMessage(error.code || error.message), 'error');
  } finally {
    videoState.joining = false;
  }
}

async function startCall(type) {
  if (!state.couple) return toast('Primero crea el espacio Duke.', 'error');
  if (!state.partner) return toast('Tu pareja todavía no se ha unido al espacio.', 'error');
  try {
    const data = await callsApi('start', { type });
    await openCall(data.call, false);
    toast(type === 'audio' ? 'Llamada iniciada.' : 'Videollamada iniciada. Tu pareja verá el aviso para unirse.', 'success');
  } catch (error) {
    toast(errorMessage(error.code), 'error');
  }
}

async function answerIncomingCall() {
  const call = videoState.currentCall;
  if (!call) return;
  await openCall(call, true);
}

async function declineIncomingCall() {
  const call = videoState.currentCall;
  if (!call) return hideIncomingBanner();
  videoState.dismissed.add(call.id);
  hideIncomingBanner();
  try {
    await callsApi('decline', { callId: call.id });
  } catch {
    // El aviso se oculta aunque la llamada haya terminado en el otro dispositivo.
  }
  videoState.currentCall = null;
}

async function endCurrentCall() {
  const call = videoState.currentCall;
  if (call) {
    await callsApi('end', { callId: call.id }).catch(() => {});
  }
  resetCallUi();
  toast('Videollamada finalizada.', 'success');
}

async function checkActiveCall() {
  if (!state.user || !state.couple || videoState.joining) return;
  try {
    const data = await callsApi('status');
    const call = data.call;

    if (!call) {
      if (videoState.currentCall && !videoState.jitsi) resetCallUi();
      return;
    }

    if (videoState.jitsi && videoState.currentCall?.id === call.id) return;

    videoState.currentCall = call;
    if (call.started_by !== state.user.id) {
      showIncomingBanner(call);
    }
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) {
      console.warn('Duke: no se pudo comprobar la videollamada.', error);
    }
  }
}

function interceptCallButton(button, type) {
  if (!button || button.dataset.dukeVideoBound === 'true') return;
  button.dataset.dukeVideoBound = 'true';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    startCall(type);
  }, true);
}

function initVideoCalls() {
  injectStyles();
  ensureBanner();

  interceptCallButton($('#startVideoCall'), 'video');
  interceptCallButton($('#startAudioCall'), 'audio');
  $$('[data-call-mode="video"]').forEach((button) => interceptCallButton(button, 'video'));
  $$('[data-call-mode="audio"]').forEach((button) => interceptCallButton(button, 'audio'));

  const endButton = $('#endCallButton');
  if (endButton && endButton.dataset.dukeVideoBound !== 'true') {
    endButton.dataset.dukeVideoBound = 'true';
    endButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      endCurrentCall();
    }, true);
  }

  $('#startVideoCall').textContent = 'Iniciar videollamada';
  $('#startAudioCall').textContent = 'Solo audio';

  clearInterval(videoState.poller);
  videoState.poller = setInterval(checkActiveCall, 2500);
  setTimeout(checkActiveCall, 600);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkActiveCall();
  });
}

export { initVideoCalls, startCall, endCurrentCall };
