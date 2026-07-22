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
  remoteSource: null,
  remoteGain: null,
  remoteCompressor: null,
  speakerBoost: 2,
  nightMode: true,
  busy: false,
  initialized: false,
  dismissedCalls: new Set(),
  notifiedCalls: new Set(),
  pendingAnswerId: null,
};

function callsApi(action, payload = {}) {
  return fetch(`/api/calls?action=${encodeURIComponent(action)}`, {
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
    NotReadableError: 'La cámara o el micrófono están siendo usados por otra aplicación.',
  };
  return messages[code] || 'No se pudo completar la llamada.';
}

function injectStyles() {
  if ($('#dukeRtcStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeRtcStyles';
  style.textContent = `
    .duke-incoming-call{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 20%,rgba(109,40,217,.46),rgba(3,3,10,.96) 58%);backdrop-filter:blur(18px)}
    .duke-incoming-call.hidden{display:none}.duke-incoming-card{width:min(92vw,430px);padding:34px 24px;border-radius:30px;text-align:center;background:linear-gradient(145deg,rgba(31,20,58,.98),rgba(8,6,18,.99));border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 100px rgba(0,0,0,.62)}
    .duke-caller-avatar{width:104px;height:104px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;font-size:2.6rem;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 0 0 10px rgba(139,92,246,.09),0 0 55px rgba(37,99,235,.35);animation:dukePulse 1.05s ease-in-out infinite}
    .duke-incoming-card h2{margin:8px 0 6px;font-size:1.8rem}.duke-incoming-card p{margin:0;color:#aaa4bb}.duke-incoming-actions{display:flex;justify-content:center;gap:28px;margin-top:30px}.duke-call-circle{width:70px;height:70px;border:0;border-radius:50%;cursor:pointer;font-size:1.7rem;box-shadow:0 14px 34px rgba(0,0,0,.28)}
    .duke-answer{background:#22c55e}.duke-reject{background:#ef4444}.duke-call-labels{display:flex;justify-content:center;gap:42px;margin-top:9px;color:#aaa4bb;font-size:.78rem}
    .duke-call-stage{position:relative;width:100%;height:calc(100vh - 210px);min-height:480px;border-radius:22px;overflow:hidden;background:#020207;border:1px solid rgba(255,255,255,.1)}
    .duke-remote-video{width:100%;height:100%;object-fit:cover;background:radial-gradient(circle,#171126,#030207);transition:filter .2s ease}.duke-local-video{position:absolute;right:18px;top:18px;width:min(27%,220px);aspect-ratio:3/4;object-fit:cover;border-radius:18px;border:2px solid rgba(255,255,255,.28);background:#0d0916;box-shadow:0 18px 50px rgba(0,0,0,.4);transform:scaleX(-1);transition:filter .2s ease}
    .duke-call-stage.night .duke-remote-video{filter:brightness(1.38) contrast(1.07) saturate(1.08)}.duke-call-stage.night .duke-local-video{filter:brightness(1.30) contrast(1.06) saturate(1.06)}
    .duke-call-status{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:rgba(0,0,0,.6);backdrop-filter:blur(12px);font-size:.82rem;font-weight:800;z-index:3}.duke-call-status.live::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:#22c55e;box-shadow:0 0 12px #22c55e}
    .duke-call-controls{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;gap:10px;padding:10px;border-radius:22px;background:rgba(4,3,10,.76);backdrop-filter:blur(16px);z-index:3}.duke-control{width:55px;height:55px;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(255,255,255,.11);cursor:pointer;font-size:1.1rem}.duke-control.off{background:#78350f}.duke-control.active{background:#4c1d95;border-color:#a78bfa}.duke-control.end{background:#ef4444;border-color:#ef4444}
    .duke-audio-avatar{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}.duke-audio-avatar span{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;font-size:4rem;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#2563eb);box-shadow:0 0 80px rgba(139,92,246,.4)}
    .duke-sound-enable{margin-top:12px}.duke-call-help{color:#aaa4bb;line-height:1.55;max-width:650px;margin:12px auto}.duke-call-help strong{color:#fff}.duke-permission-row{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:12px}
    @keyframes dukePulse{50%{transform:scale(1.07);box-shadow:0 0 0 20px rgba(139,92,246,.04),0 0 80px rgba(37,99,235,.48)}}
    @media(max-width:700px){.duke-call-stage{height:calc(100vh - 160px);min-height:520px}.duke-local-video{width:31%;right:10px;top:10px}.duke-call-controls{bottom:15px;gap:7px}.duke-control{width:49px;height:49px}.duke-incoming-card{padding:30px 18px}}
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
    <p class="duke-call-help">La llamada ahora conecta más rápido, aumenta la voz recibida y activa un <strong>modo nocturno</strong> para aclarar la imagen en lugares oscuros.</p>
    <div class="call-actions">
      <button id="startVideoCall" class="primary-btn" type="button">📹 Iniciar videollamada</button>
      <button id="startAudioCall" class="secondary-btn" type="button">☎ Llamada de voz</button>
    </div>
    <div class="duke-permission-row">
      <button id="enableCallSound" class="outline-btn duke-sound-enable" type="button">🔔 Activar tono alto</button>
      <button id="enableCallNotifications" class="outline-btn duke-sound-enable" type="button">📲 Activar notificaciones</button>
    </div>`;

  $('#enableCallSound').addEventListener('click', async () => {
    await unlockAudio();
    playIncomingPattern();
    toast('Tono alto de llamadas activado.', 'success');
  });

  $('#enableCallNotifications').addEventListener('click', requestNotifications);
}

async function requestNotifications() {
  await unlockAudio();
  if (!('Notification' in window)) return toast('Este navegador no admite notificaciones.', 'error');
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    localStorage.setItem('duke_call_notifications', 'enabled');
    toast('Notificaciones de llamadas activadas.', 'success');
  } else {
    toast('Debes permitir las notificaciones del navegador.', 'error');
  }
}

async function showSystemNotification(call) {
  if (!call || rtcState.notifiedCalls.has(call.id) || Notification.permission !== 'granted') return;
  rtcState.notifiedCalls.add(call.id);
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(`${call.starter_name || 'Tu pareja'} te está llamando`, {
      body: call.call_type === 'audio' ? 'Llamada de voz de Duke. Toca para contestar.' : 'Videollamada de Duke. Toca para contestar.',
      icon: '/assets/duke-icon.svg',
      badge: '/assets/duke-icon.svg',
      tag: `duke-call-${call.id}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [700, 250, 700, 250, 900],
      data: { callId: call.id, url: `/#duke-call=${call.id}` },
      actions: [
        { action: 'answer', title: 'Contestar' },
        { action: 'reject', title: 'Rechazar' },
      ],
    });
  } catch (error) {
    console.warn('Duke notification error', error);
  }
}

async function closeCallNotification(callId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: `duke-call-${callId}` });
    notifications.forEach((item) => item.close());
  } catch {}
}

async function unlockAudio() {
  try {
    if (!rtcState.audioContext) rtcState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (rtcState.audioContext.state !== 'running') await rtcState.audioContext.resume();
  } catch {}
}

function ringNote(frequency, startDelay = 0, duration = .3, volume = .22) {
  const context = rtcState.audioContext;
  if (!context || context.state !== 'running') return;
  const start = context.currentTime + startDelay;
  const gain = context.createGain();
  const main = context.createOscillator();
  const harmonic = context.createOscillator();
  main.type = 'triangle';
  harmonic.type = 'sine';
  main.frequency.setValueAtTime(frequency, start);
  harmonic.frequency.setValueAtTime(frequency * 2, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .025);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  main.connect(gain);
  harmonic.connect(gain);
  gain.connect(context.destination);
  main.start(start);
  harmonic.start(start);
  main.stop(start + duration + .05);
  harmonic.stop(start + duration + .05);
}

function playIncomingPattern() {
  ringNote(784, 0, .28, .28);
  ringNote(988, .31, .28, .28);
  ringNote(1175, .62, .34, .30);
  ringNote(988, 1.01, .28, .26);
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
      playIncomingPattern();
      navigator.vibrate?.([700, 250, 700, 250, 900]);
    } else {
      ringNote(440, 0, .4, .09);
      ringNote(523, .48, .4, .09);
    }
  };
  pattern();
  rtcState.ringTimer = setInterval(pattern, mode === 'incoming' ? 3200 : 3000);
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
  if (document.hidden || document.visibilityState !== 'visible') showSystemNotification(call);
  if (rtcState.pendingAnswerId === call.id) {
    rtcState.pendingAnswerId = null;
    answerCall();
  }
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
    <div id="dukeCallStage" class="duke-call-stage ${rtcState.nightMode ? 'night' : ''}">
      <video id="dukeRemoteVideo" class="duke-remote-video" autoplay playsinline></video>
      <video id="dukeLocalVideo" class="duke-local-video" autoplay playsinline muted></video>
      <div id="dukeAudioAvatar" class="duke-audio-avatar ${call.call_type === 'audio' ? '' : 'hidden'}"><span>${state.partner?.avatar || state.partner?.display_name?.slice(0, 1) || '♥'}</span></div>
      <div id="dukeRtcStatus" class="duke-call-status">Conectando…</div>
      <div class="duke-call-controls">
        <button id="dukeMuteButton" class="duke-control" type="button" aria-label="Micrófono">🎙️</button>
        <button id="dukeCameraButton" class="duke-control ${call.call_type === 'audio' ? 'hidden' : ''}" type="button" aria-label="Cámara">📹</button>
        <button id="dukeNightButton" class="duke-control ${rtcState.nightMode ? 'active' : ''} ${call.call_type === 'audio' ? 'hidden' : ''}" type="button" aria-label="Modo nocturno">🌙</button>
        <button id="dukeVolumeButton" class="duke-control active" type="button" aria-label="Volumen alto">🔊</button>
        <button id="dukeEndButton" class="duke-control end" type="button" aria-label="Finalizar">☎</button>
      </div>
    </div>`;
  $('#dukeMuteButton').addEventListener('click', toggleMicrophone);
  $('#dukeCameraButton').addEventListener('click', toggleCamera);
  $('#dukeNightButton').addEventListener('click', toggleNightMode);
  $('#dukeVolumeButton').addEventListener('click', cycleSpeakerBoost);
  $('#dukeEndButton').addEventListener('click', () => endCall(true));
  attachLocalPreview();
}

function attachLocalPreview() {
  const video = $('#dukeLocalVideo');
  if (video && rtcState.localStream) {
    video.srcObject = rtcState.localStream;
    video.play().catch(() => {});
  }
}

async function improveCameraTrack(track) {
  if (!track) return;
  track.contentHint = 'detail';
  try {
    const capabilities = track.getCapabilities?.() || {};
    const advanced = {};
    if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) advanced.exposureMode = 'continuous';
    if (Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
    if (capabilities.exposureCompensation) advanced.exposureCompensation = Math.min(capabilities.exposureCompensation.max, Math.max(0.5, capabilities.exposureCompensation.max * .45));
    if (capabilities.brightness) advanced.brightness = Math.min(capabilities.brightness.max, capabilities.brightness.min + (capabilities.brightness.max - capabilities.brightness.min) * .68);
    if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] });
  } catch (error) {
    console.warn('Camera enhancement unavailable', error);
  }
}

async function getLocalMedia(callType) {
  stopLocalMedia();
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    video: callType === 'video' ? {
      facingMode: 'user',
      width: { ideal: 1920, min: 960 },
      height: { ideal: 1080, min: 540 },
      frameRate: { ideal: 30, min: 20 },
    } : false,
  };

  try {
    rtcState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (callType === 'video') {
      rtcState.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
      }).catch(async () => {
        toast('La cámara no pudo abrirse; la llamada continuará solo con audio.', 'error');
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      });
    } else {
      throw error;
    }
  }

  await improveCameraTrack(rtcState.localStream.getVideoTracks()[0]);
  attachLocalPreview();
  return rtcState.localStream;
}

function stopLocalMedia() {
  rtcState.localStream?.getTracks().forEach((track) => track.stop());
  rtcState.localStream = null;
}

function configureVideoSender(pc) {
  const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
  if (!sender) return;
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) parameters.encodings = [{}];
    parameters.encodings[0].maxBitrate = 3000000;
    parameters.encodings[0].maxFramerate = 30;
    parameters.encodings[0].scaleResolutionDownBy = 1;
    parameters.degradationPreference = 'maintain-resolution';
    sender.setParameters(parameters).catch(() => {});
  } catch {}
}

function disconnectRemoteAudio() {
  try { rtcState.remoteSource?.disconnect(); } catch {}
  try { rtcState.remoteGain?.disconnect(); } catch {}
  try { rtcState.remoteCompressor?.disconnect(); } catch {}
  rtcState.remoteSource = null;
  rtcState.remoteGain = null;
  rtcState.remoteCompressor = null;
}

async function attachBoostedRemoteAudio() {
  if (!rtcState.remoteStream || rtcState.remoteSource) return;
  await unlockAudio();
  const video = $('#dukeRemoteVideo');
  if (!rtcState.audioContext || rtcState.audioContext.state !== 'running') {
    if (video) { video.muted = false; video.volume = 1; }
    return;
  }
  try {
    disconnectRemoteAudio();
    rtcState.remoteSource = rtcState.audioContext.createMediaStreamSource(rtcState.remoteStream);
    rtcState.remoteGain = rtcState.audioContext.createGain();
    rtcState.remoteGain.gain.value = rtcState.speakerBoost;
    rtcState.remoteCompressor = rtcState.audioContext.createDynamicsCompressor();
    rtcState.remoteCompressor.threshold.value = -18;
    rtcState.remoteCompressor.knee.value = 18;
    rtcState.remoteCompressor.ratio.value = 5;
    rtcState.remoteCompressor.attack.value = .006;
    rtcState.remoteCompressor.release.value = .18;
    rtcState.remoteSource.connect(rtcState.remoteGain).connect(rtcState.remoteCompressor).connect(rtcState.audioContext.destination);
    if (video) video.muted = true;
  } catch {
    if (video) { video.muted = false; video.volume = 1; }
  }
}

function createPeerConnection() {
  rtcState.pc?.close();
  rtcState.pendingCandidates = [];
  rtcState.remoteStream = new MediaStream();
  const pc = new RTCPeerConnection({
    iceServers: rtcState.iceServers,
    iceCandidatePoolSize: 6,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });
  rtcState.pc = pc;
  rtcState.localStream?.getTracks().forEach((track) => pc.addTrack(track, rtcState.localStream));
  configureVideoSender(pc);

  pc.onicecandidate = (event) => {
    if (!event.candidate || !rtcState.call) return;
    sendSignal('candidate', event.candidate.toJSON()).catch(() => {});
  };

  pc.ontrack = (event) => {
    for (const track of event.streams[0]?.getTracks() || [event.track]) {
      if (!rtcState.remoteStream.getTracks().some((item) => item.id === track.id)) rtcState.remoteStream.addTrack(track);
    }
    const remoteVideo = $('#dukeRemoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = rtcState.remoteStream;
      remoteVideo.play().catch(() => {});
    }
    attachBoostedRemoteAudio();
  };

  pc.onconnectionstatechange = () => {
    const connection = pc.connectionState;
    if (connection === 'connected') {
      stopRinging();
      setCallStatus(`Conectados · volumen ${rtcState.speakerBoost}×`, true);
    } else if (connection === 'connecting') {
      setCallStatus('Conectando…');
    } else if (connection === 'disconnected') {
      setCallStatus('Reconectando…');
    } else if (connection === 'failed') {
      setCallStatus('No se pudo conectar');
      toast('La red bloqueó la conexión. Configura TURN para máxima compatibilidad.', 'error');
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
    try { await rtcState.pc.addIceCandidate(candidate); } catch {}
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
    if (rtcState.pc.remoteDescription) await rtcState.pc.addIceCandidate(candidate).catch(() => {});
    else rtcState.pendingCandidates.push(candidate);
  }
}

async function pollSignals() {
  if (!rtcState.call || !rtcState.pc) return;
  try {
    const data = await callsApi('signals', { callId: rtcState.call.id, afterId: rtcState.lastSignalId });
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
  rtcState.signalPoller = setInterval(pollSignals, 220);
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
    setCallStatus('Preparando cámara y micrófono…');
    await getLocalMedia(type);
    const data = await callsApi('start', { type });
    rtcState.call = data.call;
    rtcState.iceServers = data.iceServers || [];
    rtcState.lastSignalId = 0;
    showCallStage(data.call);
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
  const callId = rtcState.call.id;
  hideIncoming();
  closeCallNotification(callId);
  try {
    await unlockAudio();
    await getLocalMedia(rtcState.call.call_type);
    const data = await callsApi('answer', { callId });
    rtcState.call = { ...rtcState.call, ...data.call };
    rtcState.iceServers = data.iceServers || rtcState.iceServers;
    rtcState.lastSignalId = 0;
    showCallStage(rtcState.call);
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
  closeCallNotification(call.id);
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

function toggleNightMode() {
  rtcState.nightMode = !rtcState.nightMode;
  $('#dukeCallStage')?.classList.toggle('night', rtcState.nightMode);
  $('#dukeNightButton')?.classList.toggle('active', rtcState.nightMode);
  toast(rtcState.nightMode ? 'Modo nocturno activado.' : 'Modo nocturno desactivado.', 'success');
}

function cycleSpeakerBoost() {
  const levels = [1, 1.5, 2, 2.5];
  const current = levels.indexOf(rtcState.speakerBoost);
  rtcState.speakerBoost = levels[(current + 1) % levels.length];
  if (rtcState.remoteGain) rtcState.remoteGain.gain.value = rtcState.speakerBoost;
  $('#dukeVolumeButton').textContent = rtcState.speakerBoost === 1 ? '🔉' : '🔊';
  setCallStatus(`Volumen de voz ${rtcState.speakerBoost}×`, rtcState.pc?.connectionState === 'connected');
}

async function endCall(notifyServer = true, showMessage = true) {
  const call = rtcState.call;
  if (notifyServer && call) await callsApi('end', { callId: call.id }).catch(() => {});
  if (call) closeCallNotification(call.id);
  cleanupCall(showMessage);
}

function cleanupCall(showMessage = false) {
  stopRinging();
  clearInterval(rtcState.signalPoller);
  rtcState.signalPoller = null;
  rtcState.pc?.close();
  rtcState.pc = null;
  disconnectRemoteAudio();
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
      if (call.status === 'active' && call.started_by === state.user.id) {
        stopRinging();
        setCallStatus('Tu pareja contestó · conectando…');
      }
      return;
    }
    if (call.started_by !== state.user.id) showIncoming(call);
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) console.warn('Call status error', error);
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

function readPendingNotificationAction() {
  const match = location.hash.match(/^#duke-call=([0-9a-f-]{36})$/i);
  if (match) {
    rtcState.pendingAnswerId = match[1];
    history.replaceState({}, '', location.pathname);
  }
}

function initWebRTCCalls() {
  if (rtcState.initialized) return;
  rtcState.initialized = true;
  injectStyles();
  ensureIncomingScreen();
  enhanceLobby();
  readPendingNotificationAction();

  bindCallButton($('#startVideoCall'), 'video');
  bindCallButton($('#startAudioCall'), 'audio');
  $$('[data-call-mode="video"]').forEach((button) => bindCallButton(button, 'video'));
  $$('[data-call-mode="audio"]').forEach((button) => bindCallButton(button, 'audio'));

  const unlock = () => unlockAudio();
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'DUKE_ANSWER_CALL') {
      rtcState.pendingAnswerId = event.data.callId;
      checkCallStatus();
    }
  });

  clearInterval(rtcState.statusPoller);
  rtcState.statusPoller = setInterval(checkCallStatus, 450);
  setTimeout(checkCallStatus, 250);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkCallStatus();
  });
  window.addEventListener('beforeunload', () => stopLocalMedia());
}

export { initWebRTCCalls, startCall, endCall };
