import { $, $$, state, toast, switchView } from './core.js';

const rtcState = {
  call: null,
  pc: null,
  localStream: null,
  remoteStream: null,
  iceServers: [],
  statusPoller: null,
  signalPoller: null,
  lastSignalId: 0,
  pendingCandidates: [],
  audioContext: null,
  ringTimer: null,
  ringMode: null,
  busy: false,
  initialized: false,
  dismissedCalls: new Set(),
};

function callsApi(action, payload = {}) {
  return fetch(`/api/calls?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
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

function callError(code) {
  const messages = {
    PARTNER_NOT_CONNECTED: 'Tu pareja todavía no se ha unido al espacio Duke.',
    NO_DUKE_SPACE: 'Primero crea o únete al espacio Duke.',
    ACCESS_CODE_REQUIRED: 'Primero escribe el código 2003.',
    CALL_NOT_FOUND: 'La llamada ya terminó.',
    INVALID_SIGNAL: 'No se pudo conectar la llamada.',
    UNAUTHORIZED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
    NotAllowedError: 'Debes permitir el uso de cámara y micrófono.',
    NotFoundError: 'No se encontró una cámara o un micrófono disponible.',
  };
  return messages[code] || 'No se pudo completar la llamada.';
}

function injectStyles() {
  if ($('#dukeRtcStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeRtcStyles';
  style.textContent = `
    .duke-incoming-call{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 20%,rgba(109,40,217,.42),rgba(3,3,10,.94) 58%);backdrop-filter:blur(18px)}
    .duke-incoming-call.hidden{display:none}.duke-incoming-card{width:min(92vw,430px);padding:34px 24px;border-radius:30px;text-align:center;background:linear-gradient(145deg,rgba(31,20,58,.97),rgba(8,6,18,.98));border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 100px rgba(0,0,0,.62)}
    .duke-caller-avatar{width:104px;height:104px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;font-size:2.6rem;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 0 0 10px rgba(139,92,246,.09),0 0 55px rgba(37,99,235,.35);animation:dukePulse 1.25s ease-in-out infinite}
    .duke-incoming-card h2{margin:8px 0 6px;font-size:1.8rem}.duke-incoming-card p{margin:0;color:#aaa4bb}.duke-incoming-actions{display:flex;justify-content:center;gap:28px;margin-top:30px}.duke-call-circle{width:68px;height:68px;border:0;border-radius:50%;cursor:pointer;font-size:1.65rem;box-shadow:0 14px 34px rgba(0,0,0,.28)}
    .duke-answer{background:#22c55e}.duke-reject{background:#ef4444}.duke-call-labels{display:flex;justify-content:center;gap:42px;margin-top:9px;color:#aaa4bb;font-size:.78rem}
    .duke-call-stage{position:relative;width:100%;height:calc(100vh - 210px);min-height:480px;border-radius:22px;overflow:hidden;background:#020207;border:1px solid rgba(255,255,255,.1)}
    .duke-remote-video{width:100%;height:100%;object-fit:cover;background:radial-gradient(circle,#171126,#030207)}.duke-local-video{position:absolute;right:18px;top:18px;width:min(27%,220px);aspect-ratio:3/4;object-fit:cover;border-radius:18px;border:2px solid rgba(255,255,255,.28);background:#0d0916;box-shadow:0 18px 50px rgba(0,0,0,.4);transform:scaleX(-1)}
    .duke-call-status{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);font-size:.82rem;font-weight:800}.duke-call-status.live::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:#22c55e;box-shadow:0 0 12px #22c55e}
    .duke-call-controls{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;gap:12px;padding:10px;border-radius:22px;background:rgba(4,3,10,.72);backdrop-filter:blur(16px)}.duke-control{width:55px;height:55px;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(255,255,255,.11);cursor:pointer;font-size:1.15rem}.duke-control.off{background:#78350f}.duke-control.end{background:#ef4444;border-color:#ef4444}
    .duke-audio-avatar{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}.duke-audio-avatar span{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;font-size:4rem;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 0 80px rgba(139,92,246,.4)}
    .duke-sound-enable{margin-top:14px}.duke-call-help{color:#aaa4bb;line-height:1.55;max-width:620px;margin:12px auto}.duke-call-help strong{color:#fff}
    @keyframes dukePulse{50%{transform:scale(1.06);box-shadow:0 0 0 18px rgba(139,92,246,.04),0 0 75px rgba(37,99,235,.45)}}
    @media(max-width:700px){.duke-call-stage{height:calc(100vh - 160px);min-height:520px}.duke-local-video{width:31%;right:10px;top:10px}.duke-call-controls{bottom:15px}.duke-control{width:51px;height:51px}.duke-incoming-card{padding:30px 18px}}
  `;
  document.head.append(style);
}

function ensureIncomingScreen() {
  let screen = $('#dukeIncomingCall');
  if (screen) return screen;
  screen = document.createElement('section');
  screen.id = 'dukeIncomingCall';
  screen.className = 'duke-incoming-call hidden';
  screen.innerHTML = `
    <div class="duke-incoming-card">
      <div id="dukeCallerAvatar" class="duke-caller-avatar">D</div>
      <p class="eyebrow">LLAMADA ENTRANTE</p>
      <h2 id="dukeIncomingTitle">Tu pareja te está llamando</h2>
      <p id="dukeIncomingType">Videollamada de Duke</p>
      <div class="duke-incoming-actions">
        <button id="dukeRejectCall" class="duke-call-circle duke-reject" type="button" aria-label="Rechazar">✕</button>
        <button id="dukeAnswerCall" class="duke-call-circle duke-answer" type="button" aria-label="Contestar">☎</button>
      </div>
      <div class="duke-call-labels"><span>Rechazar</span><span>Contestar</span></div>
    </div>`;
  document.body.append(screen);
  $('#dukeAnswerCall').addEventListener('click', answerCall);
  $('#dukeRejectCall').addEventListener('click', rejectCall);
  return screen;
}

function enhanceLobby() {
  const lobby = $('#callLobby');
  if (!lobby) return;
  lobby.innerHTML = `
    <div class="call-heart">♥</div>
    <p class="eyebrow">LLAMADAS DUKE</p>
    <h3>Hablen y véanse dentro de Duke</h3>
    <p class="duke-call-help">La otra persona escuchará un <strong>tono de llamada</strong> y podrá contestar o rechazar. Permitan cámara y micrófono cuando el teléfono lo solicite.</p>
    <div class="call-actions">
      <button id="startVideoCall" class="primary-btn" type="button">📹 Iniciar videollamada</button>
      <button id="startAudioCall" class="secondary-btn" type="button">☎ Llamada de voz</button>
    </div>
    <button id="enableCallSound" class="outline-btn duke-sound-enable" type="button">🔔 Activar sonido de llamadas</button>`;
  $('#enableCallSound').addEventListener('click', async () => {
    await unlockAudio();
    playTestTone();
    toast('Sonido de llamadas activado.', 'success');
  });
}

function unlockAudio() {
  try {
    if (!rtcState.audioContext) {
      rtcState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return rtcState.audioContext.resume();
  } catch {
    return Promise.resolve();
  }
}

function beep(frequency, startDelay = 0, duration = .28, volume = .12) {
  const context = rtcState.audioContext;
  if (!context || context.state !== 'running') return;
  const start = context.currentTime + startDelay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .04);
}

function playTestTone() {
  beep(660, 0, .18, .08);
  beep(880, .2, .22, .08);
}

function stopRinging() {
  if (rtcState.ringTimer) clearInterval(rtcState.ringTimer);
  rtcState.ringTimer = null;
  rtcState.ringMode = null;
  navigator.vibrate?.(0);
}

async function startRinging(mode) {
  if (rtcState.ringMode === mode) return;
  stopRinging();
  rtcState.ringMode = mode;
  await unlockAudio();

  const pattern = () => {
    if (mode === 'incoming') {
      beep(720, 0, .32, .14);
      beep(880, .38, .32, .14);
      beep(720, .76, .32, .14);
      navigator.vibrate?.([500, 220, 500, 900]);
    } else {
      beep(440, 0, .42, .07);
      beep(480, .48, .42, .07);
    }
  };
  pattern();
  rtcState.ringTimer = setInterval(pattern, mode === 'incoming' ? 2600 : 3300);
}

function showIncoming(call) {
  if (!call || rtcState.dismissedCalls.has(call.id)) return;
  rtcState.call = call;
  const screen = ensureIncomingScreen();
  $('#dukeCallerAvatar').textContent = call.starter_avatar || call.starter_name?.slice(0, 1).toUpperCase() || 'D';
  $('#dukeIncomingTitle').textContent = `${call.starter_name || 'Tu pareja'} te está llamando`;
  $('#dukeIncomingType').textContent = call.call_type === 'audio' ? 'Llamada de voz de Duke' : 'Videollamada de Duke';
  screen.classList.remove('hidden');
  startRinging('incoming');
}

function hideIncoming() {
  $('#dukeIncomingCall')?.classList.add('hidden');
  stopRinging();
}

function setCallStatus(text, live = false) {
  const status = $('#dukeRtcStatus');
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('live', live);
}

function showCallStage(call) {
  switchView('call');
  $('#callLobby')?.classList.add('hidden');
  const container = $('#jitsiContainer');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="duke-call-stage">
      <video id="dukeRemoteVideo" class="duke-remote-video" autoplay playsinline></video>
      <video id="dukeLocalVideo" class="duke-local-video" autoplay playsinline muted></video>
      <div id="dukeAudioAvatar" class="duke-audio-avatar ${call.call_type === 'audio' ? '' : 'hidden'}"><span>${state.partner?.avatar || state.partner?.display_name?.slice(0,1) || '♥'}</span></div>
      <div id="dukeRtcStatus" class="duke-call-status">Conectando…</div>
      <div class="duke-call-controls">
        <button id="dukeMuteButton" class="duke-control" type="button" aria-label="Micrófono">🎙️</button>
        <button id="dukeCameraButton" class="duke-control ${call.call_type === 'audio' ? 'hidden' : ''}" type="button" aria-label="Cámara">📹</button>
        <button id="dukeEndButton" class="duke-control end" type="button" aria-label="Finalizar">☎</button>
      </div>
    </div>`;
  $('#dukeMuteButton').addEventListener('click', toggleMicrophone);
  $('#dukeCameraButton').addEventListener('click', toggleCamera);
  $('#dukeEndButton').addEventListener('click', () => endCall(true));
}

async function getLocalMedia(callType) {
  stopLocalMedia();
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: callType === 'video' ? {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    } : false,
  };

  try {
    rtcState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (callType === 'video') {
      rtcState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      toast('La cámara no pudo abrirse; la llamada continuará solo con audio.', 'error');
    } else {
      throw error;
    }
  }
  const localVideo = $('#dukeLocalVideo');
  if (localVideo) localVideo.srcObject = rtcState.localStream;
  return rtcState.localStream;
}

function stopLocalMedia() {
  rtcState.localStream?.getTracks().forEach((track) => track.stop());
  rtcState.localStream = null;
}

function createPeerConnection() {
  rtcState.pc?.close();
  rtcState.pendingCandidates = [];
  rtcState.remoteStream = new MediaStream();
  const pc = new RTCPeerConnection({
    iceServers: rtcState.iceServers,
    iceCandidatePoolSize: 10,
  });
  rtcState.pc = pc;

  rtcState.localStream?.getTracks().forEach((track) => pc.addTrack(track, rtcState.localStream));

  pc.onicecandidate = (event) => {
    if (!event.candidate || !rtcState.call) return;
    sendSignal('candidate', event.candidate.toJSON()).catch(() => {});
  };

  pc.ontrack = (event) => {
    for (const track of event.streams[0]?.getTracks() || [event.track]) {
      if (!rtcState.remoteStream.getTracks().some((item) => item.id === track.id)) {
        rtcState.remoteStream.addTrack(track);
      }
    }
    const remoteVideo = $('#dukeRemoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = rtcState.remoteStream;
      remoteVideo.play().catch(() => {});
    }
  };

  pc.onconnectionstatechange = () => {
    const connection = pc.connectionState;
    if (connection === 'connected') {
      stopRinging();
      setCallStatus('Conectados', true);
    } else if (connection === 'connecting') {
      setCallStatus('Conectando…');
    } else if (connection === 'disconnected') {
      setCallStatus('Reconectando…');
    } else if (connection === 'failed') {
      setCallStatus('No se pudo conectar');
      toast('La conexión falló. Intenta nuevamente o configura un servidor TURN.', 'error');
    } else if (connection === 'closed') {
      setCallStatus('Llamada finalizada');
    }
  };
  return pc;
}

async function sendSignal(signalType, payload) {
  if (!rtcState.call) return;
  await callsApi('signal', { callId: rtcState.call.id, signalType, payload });
}

async function flushCandidates() {
  if (!rtcState.pc?.remoteDescription) return;
  const queued = [...rtcState.pendingCandidates];
  rtcState.pendingCandidates = [];
  for (const candidate of queued) {
    try { await rtcState.pc.addIceCandidate(candidate); } catch (error) { console.warn('ICE candidate error', error); }
  }
}

async function processSignal(signal) {
  if (!rtcState.pc) return;
  const payload = signal.payload;
  if (signal.signal_type === 'offer') {
    if (rtcState.pc.signalingState !== 'stable') return;
    await rtcState.pc.setRemoteDescription(new RTCSessionDescription(payload));
    await flushCandidates();
    const answer = await rtcState.pc.createAnswer();
    await rtcState.pc.setLocalDescription(answer);
    await sendSignal('answer', rtcState.pc.localDescription.toJSON());
  } else if (signal.signal_type === 'answer') {
    if (!rtcState.pc.remoteDescription) {
      await rtcState.pc.setRemoteDescription(new RTCSessionDescription(payload));
      await flushCandidates();
    }
  } else if (signal.signal_type === 'candidate') {
    const candidate = new RTCIceCandidate(payload);
    if (rtcState.pc.remoteDescription) await rtcState.pc.addIceCandidate(candidate);
    else rtcState.pendingCandidates.push(candidate);
  }
}

async function pollSignals() {
  if (!rtcState.call || !rtcState.pc) return;
  try {
    const data = await callsApi('signals', {
      callId: rtcState.call.id,
      afterId: rtcState.lastSignalId,
    });
    for (const signal of data.signals || []) {
      rtcState.lastSignalId = Math.max(rtcState.lastSignalId, Number(signal.id));
      await processSignal(signal);
    }
  } catch (error) {
    if (error.code === 'CALL_NOT_FOUND') cleanupCall(false);
  }
}

function startSignalPolling() {
  clearInterval(rtcState.signalPoller);
  rtcState.signalPoller = setInterval(pollSignals, 650);
  pollSignals();
}

async function startCall(type) {
  if (rtcState.busy) return;
  if (!state.couple) return toast('Primero crea el espacio Duke.', 'error');
  if (!state.partner) return toast('Tu pareja todavía no se ha unido al espacio.', 'error');
  rtcState.busy = true;
  try {
    await unlockAudio();
    switchView('call');
    const data = await callsApi('start', { type });
    rtcState.call = data.call;
    rtcState.iceServers = data.iceServers || [];
    rtcState.lastSignalId = 0;
    showCallStage(data.call);
    await getLocalMedia(type);
    const pc = createPeerConnection();
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === 'video' });
    await pc.setLocalDescription(offer);
    await sendSignal('offer', pc.localDescription.toJSON());
    startSignalPolling();
    startRinging('outgoing');
    setCallStatus(`Llamando a ${state.partner.display_name || 'tu pareja'}…`);
  } catch (error) {
    console.error('Start call error', error);
    toast(callError(error.code || error.name), 'error');
    await endCall(true, false);
  } finally {
    rtcState.busy = false;
  }
}

async function answerCall() {
  if (!rtcState.call || rtcState.busy) return;
  rtcState.busy = true;
  hideIncoming();
  try {
    await unlockAudio();
    const data = await callsApi('answer', { callId: rtcState.call.id });
    rtcState.call = { ...rtcState.call, ...data.call };
    rtcState.iceServers = data.iceServers || rtcState.iceServers;
    rtcState.lastSignalId = 0;
    showCallStage(rtcState.call);
    await getLocalMedia(rtcState.call.call_type);
    createPeerConnection();
    startSignalPolling();
    await pollSignals();
    setCallStatus('Conectando con tu pareja…');
  } catch (error) {
    console.error('Answer call error', error);
    toast(callError(error.code || error.name), 'error');
    await endCall(true, false);
  } finally {
    rtcState.busy = false;
  }
}

async function rejectCall() {
  const call = rtcState.call;
  hideIncoming();
  if (!call) return;
  rtcState.dismissedCalls.add(call.id);
  await callsApi('decline', { callId: call.id }).catch(() => {});
  cleanupCall(false);
}

function toggleMicrophone() {
  const track = rtcState.localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $('#dukeMuteButton')?.classList.toggle('off', !track.enabled);
  $('#dukeMuteButton').textContent = track.enabled ? '🎙️' : '🔇';
}

function toggleCamera() {
  const track = rtcState.localStream?.getVideoTracks()[0];
  if (!track) return toast('Esta llamada está funcionando solo con audio.', 'error');
  track.enabled = !track.enabled;
  $('#dukeCameraButton')?.classList.toggle('off', !track.enabled);
  $('#dukeCameraButton').textContent = track.enabled ? '📹' : '🚫';
}

async function endCall(notifyServer = true, showMessage = true) {
  const call = rtcState.call;
  if (notifyServer && call) await callsApi('end', { callId: call.id }).catch(() => {});
  cleanupCall(showMessage);
}

function cleanupCall(showMessage = false) {
  stopRinging();
  clearInterval(rtcState.signalPoller);
  rtcState.signalPoller = null;
  rtcState.pc?.close();
  rtcState.pc = null;
  stopLocalMedia();
  rtcState.remoteStream = null;
  rtcState.call = null;
  rtcState.lastSignalId = 0;
  rtcState.pendingCandidates = [];
  hideIncoming();
  const container = $('#jitsiContainer');
  if (container) {
    container.innerHTML = '';
    container.classList.add('hidden');
  }
  $('#callLobby')?.classList.remove('hidden');
  $('#endCallButton')?.classList.add('hidden');
  if (showMessage) toast('Llamada finalizada.', 'success');
}

async function checkCallStatus() {
  if (!state.user || !state.couple || rtcState.busy) return;
  try {
    const data = await callsApi('status');
    rtcState.iceServers = data.iceServers || rtcState.iceServers;
    const call = data.call;

    if (!call) {
      if (rtcState.call) cleanupCall(false);
      return;
    }

    if (rtcState.call?.id === call.id) {
      rtcState.call = { ...rtcState.call, ...call };
      return;
    }

    if (call.started_by !== state.user.id) {
      showIncoming(call);
    }
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) {
      console.warn('Call status error', error);
    }
  }
}

function bindCallButton(button, type) {
  if (!button || button.dataset.rtcBound === 'true') return;
  button.dataset.rtcBound = 'true';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    startCall(type);
  }, true);
}

function initWebRTCCalls() {
  if (rtcState.initialized) return;
  rtcState.initialized = true;
  injectStyles();
  ensureIncomingScreen();
  enhanceLobby();

  bindCallButton($('#startVideoCall'), 'video');
  bindCallButton($('#startAudioCall'), 'audio');
  $$('[data-call-mode="video"]').forEach((button) => bindCallButton(button, 'video'));
  $$('[data-call-mode="audio"]').forEach((button) => bindCallButton(button, 'audio'));

  const unlock = () => unlockAudio();
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });

  clearInterval(rtcState.statusPoller);
  rtcState.statusPoller = setInterval(checkCallStatus, 1000);
  setTimeout(checkCallStatus, 500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkCallStatus();
  });
  window.addEventListener('beforeunload', () => stopLocalMedia());
}

export { initWebRTCCalls, startCall, endCall };
