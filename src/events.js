import { $, $$, state, questions, rouletteItems, toast, translateError, api, showOnly, openDialog, closeDialog, imageToDataUrl, unlockPrivateLink, setSnapshot, loadSession, stopPolling, switchView, beginCall, endCall, defaultTic, ticWinner, myTicSymbol, saveGame } from './core.js';

function bindEvents() {
  $$('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-auth-tab]').forEach((item) => item.classList.toggle('active', item === button));
    $$('.auth-form').forEach((form) => form.classList.toggle('active', form.id.toLowerCase().startsWith(button.dataset.authTab)));
  }));

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await api('login', { method: 'POST', body: { email: $('#loginEmail').value, password: $('#loginPassword').value } });
      await loadSession(true);
    } catch (error) {
      toast(translateError(error.code), 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await api('register', { method: 'POST', body: { displayName: $('#registerName').value, email: $('#registerEmail').value, password: $('#registerPassword').value } });
      await loadSession(true);
      toast('Cuenta creada. Ahora conecta a tu pareja.', 'success');
    } catch (error) {
      toast(translateError(error.code), 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#logoutButton').addEventListener('click', async () => {
    await api('logout', { method: 'POST' }).catch(() => {});
    stopPolling();
    state.user = null;
    showOnly('authScreen');
  });

  $$('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.go)));
  $$('[data-call-mode]').forEach((button) => button.addEventListener('click', () => beginCall(button.dataset.callMode)));
  $('#startVideoCall').addEventListener('click', () => beginCall('video'));
  $('#startAudioCall').addEventListener('click', () => beginCall('audio'));
  $('#endCallButton').addEventListener('click', endCall);

  $$('[data-couple-option]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-couple-option]').forEach((item) => item.classList.toggle('active', item === button));
    $('#createCoupleForm').classList.toggle('active', button.dataset.coupleOption === 'create');
    $('#joinCoupleForm').classList.toggle('active', button.dataset.coupleOption === 'join');
  }));

  $('#createCoupleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('create_couple', { method: 'POST', body: { name: $('#coupleNameInput').value, relationshipDate: $('#relationshipDateInput').value || null, pin: $('#couplePinInput').value } });
      closeDialog('coupleDialog');
      await loadSession(true);
      toast(`Espacio creado. Código: ${data.couple.invite_code}`, 'success');
      openDialog('profileDialog');
    } catch (error) {
      toast(translateError(error.code), 'error');
    }
  });

  $('#joinCoupleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('join_couple', { method: 'POST', body: { inviteCode: $('#inviteCodeInput').value, pin: $('#joinPinInput').value } });
      closeDialog('coupleDialog');
      await loadSession(true);
      toast('Ya están conectados en Duke.', 'success');
    } catch (error) {
      toast(translateError(error.code), 'error');
    }
  });

  $('#messageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = $('#messageInput').value.trim();
    const file = $('#messageImageInput').files[0];
    if (!text && !file) return;
    const button = event.submitter;
    button.disabled = true;
    try {
      const mediaUrl = file ? await imageToDataUrl(file) : null;
      await api('send_message', { method: 'POST', body: { body: text, mediaUrl, replyTo: state.replyTo?.id || null, replyPreview: state.replyTo?.preview || null } });
      $('#messageInput').value = '';
      $('#messageImageInput').value = '';
      state.replyTo = null;
      $('#replyPreview').classList.add('hidden');
      const data = await api('sync');
      setSnapshot(data);
    } catch (error) {
      toast(error.message === 'IMAGE_TOO_LARGE' ? 'La imagen es demasiado grande.' : translateError(error.code), 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#messagesList').addEventListener('click', (event) => {
    const message = event.target.closest('[data-message-id]');
    if (!message) return;
    state.replyTo = { id: message.dataset.messageId, preview: message.dataset.messagePreview };
    $('#replyPreviewText').textContent = state.replyTo.preview;
    $('#replyPreview').classList.remove('hidden');
    $('#messageInput').focus();
  });

  $('#cancelReplyButton').addEventListener('click', () => {
    state.replyTo = null;
    $('#replyPreview').classList.add('hidden');
  });

  let typingTimer;
  $('#messageInput').addEventListener('input', () => {
    clearTimeout(typingTimer);
    api('presence', { method: 'POST', body: { status: 'online', isTyping: true, currentView: 'chat' } }).catch(() => {});
    typingTimer = setTimeout(() => api('presence', { method: 'POST', body: { status: 'online', isTyping: false, currentView: 'chat' } }).catch(() => {}), 1200);
  });

  $('#editMoodButton').addEventListener('click', () => openDialog('moodDialog'));
  $$('.mood-picker [data-mood]').forEach((button) => button.addEventListener('click', async () => {
    const [text, emoji] = button.dataset.mood.split('|');
    try {
      await api('mood', { method: 'POST', body: { text, emoji } });
      closeDialog('moodDialog');
      await loadSession(false);
    } catch (error) { toast(translateError(error.code), 'error'); }
  }));

  $('#addDateButton').addEventListener('click', () => openDialog('dateDialog'));
  $('#dateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('add_date', { method: 'POST', body: { title: $('#dateTitleInput').value, eventDate: $('#dateValueInput').value, repeatsYearly: $('#dateRepeatInput').checked } });
      event.target.reset();
      closeDialog('dateDialog');
      await loadSession(false);
    } catch (error) { toast(translateError(error.code), 'error'); }
  });

  $('#addMemoryButton').addEventListener('click', () => openDialog('memoryDialog'));
  $('#memoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const file = $('#memoryImageInput').files[0];
      const mediaUrl = file ? await imageToDataUrl(file) : null;
      await api('add_memory', { method: 'POST', body: { title: $('#memoryTitleInput').value, description: $('#memoryDescriptionInput').value, memoryDate: $('#memoryDateInput').value || null, mediaUrl } });
      event.target.reset();
      closeDialog('memoryDialog');
      await loadSession(false);
      toast('Recuerdo guardado.', 'success');
    } catch (error) {
      toast(error.message === 'IMAGE_TOO_LARGE' ? 'La imagen es demasiado grande.' : translateError(error.code), 'error');
    } finally { button.disabled = false; }
  });

  $('#profileButton').addEventListener('click', () => openDialog('profileDialog'));
  $('#avatarButton').addEventListener('click', () => openDialog('profileDialog'));
  $('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('profile', { method: 'POST', body: { displayName: $('#profileNameInput').value, avatar: $('#profileAvatarInput').value } });
      closeDialog('profileDialog');
      await loadSession(false);
    } catch (error) { toast(translateError(error.code), 'error'); }
  });

  $('#copyInviteButton').addEventListener('click', async () => {
    const code = state.couple?.invite_code;
    if (!code) return toast('Primero crea el espacio Duke.', 'error');
    await navigator.clipboard.writeText(code);
    toast('Código de pareja copiado.', 'success');
  });

  $('#copyPrivateLinkButton').addEventListener('click', async () => {
    const link = localStorage.getItem('duke_private_link');
    if (!link) return toast('Abre Duke nuevamente desde el enlace privado para guardarlo en este dispositivo.', 'error');
    await navigator.clipboard.writeText(link);
    toast('Enlace privado copiado.', 'success');
  });

  $('#missingYouButton').addEventListener('click', async () => {
    if (!state.partner) return toast('Tu pareja todavía no se ha unido.', 'error');
    try {
      await api('missing_you', { method: 'POST' });
      toast('Le enviaste un “Te extraño” 💜', 'success');
    } catch (error) { toast(translateError(error.code), 'error'); }
  });

  $('#ticBoard').addEventListener('click', async (event) => {
    const cell = event.target.closest('[data-cell]');
    if (!cell) return;
    const game = { ...defaultTic(), ...(state.games.tictactoe || {}) };
    game.board = Array.isArray(game.board) ? [...game.board] : Array(9).fill('');
    game.scores = { X: 0, O: 0, draw: 0, ...(game.scores || {}) };
    const symbol = myTicSymbol();
    const index = Number(cell.dataset.cell);
    if (game.winner || game.board[index] || game.turn !== symbol) return toast('Espera tu turno.', 'error');
    game.board[index] = symbol;
    game.winner = ticWinner(game.board);
    if (game.winner) game.scores[game.winner] = (game.scores[game.winner] || 0) + 1;
    else game.turn = symbol === 'X' ? 'O' : 'X';
    await saveGame('tictactoe', game).catch((error) => toast(translateError(error.code), 'error'));
  });

  $('#resetTicTacToe').addEventListener('click', async () => {
    const old = { ...defaultTic(), ...(state.games.tictactoe || {}) };
    await saveGame('tictactoe', { ...defaultTic(), scores: { X: 0, O: 0, draw: 0, ...(old.scores || {}) } }).catch((error) => toast(translateError(error.code), 'error'));
  });

  $('#nextQuestionButton').addEventListener('click', async () => {
    const current = state.games.questions || { index: 0 };
    const next = { index: (Number(current.index || 0) + 1) % questions.length, answers: {} };
    await saveGame('questions', next).catch((error) => toast(translateError(error.code), 'error'));
  });

  $('#questionAnswerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const answer = $('#questionAnswerInput').value.trim();
    if (!answer) return;
    const current = state.games.questions || { index: 0, answers: {} };
    const next = { ...current, answers: { ...(current.answers || {}), [state.user.id]: answer } };
    await saveGame('questions', next).catch((error) => toast(translateError(error.code), 'error'));
  });

  $('#spinRouletteButton').addEventListener('click', async () => {
    if (state.spinning) return;
    state.spinning = true;
    const selected = rouletteItems[Math.floor(Math.random() * rouletteItems.length)];
    const wheel = $('#rouletteWheel');
    const degrees = 1440 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${degrees}deg)`;
    setTimeout(async () => {
      $('#rouletteResult').textContent = selected;
      state.spinning = false;
      await saveGame('roulette', { result: selected, spunBy: state.user.id, spunAt: new Date().toISOString() }).catch(() => {});
    }, 2850);
  });

  $$('.game-tab').forEach((button) => button.addEventListener('click', () => {
    $$('.game-tab').forEach((item) => item.classList.toggle('active', item === button));
    $$('.game-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${button.dataset.game}Game`));
  }));

  $$('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.close)));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $('#installButton').classList.remove('hidden');
  });

  $('#installButton').addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('#installButton').classList.add('hidden');
  });

  document.addEventListener('visibilitychange', () => {
    if (!state.user || !state.couple) return;
    api('presence', { method: 'POST', body: { status: document.hidden ? 'away' : 'online' } }).catch(() => {});
  });
}

async function init() {
  bindEvents();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const unlocked = await unlockPrivateLink();
  if (!unlocked) return;
  try {
    await loadSession(true);
  } catch (error) {
    toast(translateError(error.code), 'error');
    showOnly('authScreen');
  }
}

export { bindEvents, init };
