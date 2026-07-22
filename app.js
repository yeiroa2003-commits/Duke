/* Duke — PWA privada para parejas */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const CONFIG_KEY = 'duke_supabase_config';
  const DEMO_KEY = 'duke_demo_state_v1';

  const state = {
    supabase: null,
    user: null,
    profile: null,
    couple: null,
    members: [],
    partner: null,
    messages: [],
    memories: [],
    dates: [],
    games: {},
    subscriptions: [],
    demo: false,
    replyTo: null,
    installPrompt: null,
    jitsiApi: null,
    selectedMood: null,
  };

  const questions = [
    '¿Cuál es tu recuerdo favorito de nosotros?',
    '¿Qué viaje te gustaría hacer conmigo?',
    '¿Qué pequeña cosa hago que te hace sentir amado/a?',
    '¿Qué canción describe mejor nuestra relación?',
    '¿Cuál fue tu primera impresión de mí?',
    '¿Qué meta te emociona cumplir juntos?',
    '¿Qué momento quisieras volver a vivir?',
    '¿Qué aprendiste de nuestra relación?',
    '¿Qué cita perfecta planearías para nosotros?',
    '¿Qué palabra usarías para describir lo nuestro?',
    '¿En qué momento supiste que yo era especial?',
    '¿Qué tradición te gustaría crear conmigo?',
  ];

  const rouletteItems = [
    'Dedíquense una canción',
    'Cuéntense un recuerdo gracioso',
    'Envíense una foto espontánea',
    'Planeen su próxima cita',
    'Dense cinco cumplidos',
    'Hagan una videollamada de 10 minutos',
  ];

  const titleMap = {
    home: ['Nuestro espacio', 'Inicio'],
    chat: ['Siempre conectados', 'Chat privado'],
    call: ['Más cerca', 'Llamadas'],
    games: ['Tiempo de calidad', 'Juegos'],
    memories: ['Nuestra historia', 'Recuerdos'],
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindEvents();
    registerServiceWorker();
    restoreSetupFields();

    const config = readConfig();
    if (!config?.url || !config?.key || !window.supabase) {
      showAuth();
      return;
    }

    try {
      state.supabase = window.supabase.createClient(config.url, config.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data: { session } } = await state.supabase.auth.getSession();
      state.supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user && !state.user) startCloudSession(nextSession.user);
        if (!nextSession && state.user && !state.demo) resetToAuth();
      });
      if (session?.user) await startCloudSession(session.user);
      else showAuth();
    } catch (error) {
      console.error(error);
      toast('No se pudo conectar con Supabase. Revisa la configuración.', 'error');
      showAuth();
    }
  }

  function bindEvents() {
    $$('.auth-tab').forEach((button) => button.addEventListener('click', () => switchAuthTab(button.dataset.authTab)));
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#registerForm').addEventListener('submit', handleRegister);
    $('#demoButton').addEventListener('click', startDemo);
    $('#openSetupFromAuth').addEventListener('click', () => openDialog('setupDialog'));
    $('#settingsButton').addEventListener('click', () => openDialog('setupDialog'));
    $('#logoutButton').addEventListener('click', logout);
    $('#profileButton').addEventListener('click', openProfile);
    $('#profileForm').addEventListener('submit', saveProfile);
    $('#showInviteButton').addEventListener('click', showInvite);

    $$('.nav-btn[data-view], .mobile-nav-btn[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));

    $('#setupForm').addEventListener('submit', saveSetup);
    $('#clearSetupButton').addEventListener('click', clearSetup);
    $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));

    $$('[data-couple-option]').forEach((button) => button.addEventListener('click', () => switchCoupleOption(button.dataset.coupleOption)));
    $('#createCoupleForm').addEventListener('submit', createCouple);
    $('#joinCoupleForm').addEventListener('submit', joinCouple);
    $('#copyInviteButton').addEventListener('click', copyInviteCode);

    $('#missingYouButton').addEventListener('click', sendMissingYou);
    $('#editMoodButton').addEventListener('click', () => openDialog('moodDialog'));
    $$('.mood-picker button').forEach((button) => button.addEventListener('click', () => chooseMood(button.dataset.mood)));
    $('#addDateButton').addEventListener('click', () => openDialog('dateDialog'));
    $('#dateForm').addEventListener('submit', saveDate);

    $('#messageForm').addEventListener('submit', sendMessage);
    $('#messageInput').addEventListener('input', autoResizeTextarea);
    $('#messageInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        $('#messageForm').requestSubmit();
      }
    });
    $('#messageImageInput').addEventListener('change', sendImageMessage);
    $('#cancelReplyButton').addEventListener('click', clearReply);
    $('#messagesList').addEventListener('click', handleMessageClick);

    $$('[data-call-mode]').forEach((button) => button.addEventListener('click', () => {
      navigate('call');
      startCall(button.dataset.callMode);
    }));
    $('#startVideoCall').addEventListener('click', () => startCall('video'));
    $('#startAudioCall').addEventListener('click', () => startCall('audio'));
    $('#endCallButton').addEventListener('click', endCall);

    $$('.game-tab').forEach((button) => button.addEventListener('click', () => switchGame(button.dataset.game)));
    $('#resetTicTacToe').addEventListener('click', resetTicTacToe);
    $('#ticBoard').addEventListener('click', playTicTacToe);
    $('#nextQuestionButton').addEventListener('click', nextQuestion);
    $('#questionAnswerForm').addEventListener('submit', saveQuestionAnswer);
    $('#spinRouletteButton').addEventListener('click', spinRoulette);

    $('#addMemoryButton').addEventListener('click', () => openDialog('memoryDialog'));
    $('#memoryForm').addEventListener('submit', saveMemory);
    $('#memoriesGrid').addEventListener('click', deleteMemory);

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.installPrompt = event;
      $('#installButton').classList.remove('hidden');
    });
    $('#installButton').addEventListener('click', installPwa);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateLastSeen();
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('SW:', error));
    }
  }

  function readConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); }
    catch { return null; }
  }

  function restoreSetupFields() {
    const config = readConfig();
    if (config) {
      $('#supabaseUrlInput').value = config.url || '';
      $('#supabaseKeyInput').value = config.key || '';
    }
  }

  function saveSetup(event) {
    event.preventDefault();
    const url = $('#supabaseUrlInput').value.trim().replace(/\/$/, '');
    const key = $('#supabaseKeyInput').value.trim();
    if (!url || !key) return toast('Completa la URL y la clave pública.', 'error');
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
    toast('Conexión guardada. Duke se reiniciará.', 'success');
    setTimeout(() => location.reload(), 600);
  }

  function clearSetup() {
    localStorage.removeItem(CONFIG_KEY);
    $('#supabaseUrlInput').value = '';
    $('#supabaseKeyInput').value = '';
    toast('Configuración eliminada.', 'success');
  }

  function switchAuthTab(tab) {
    $$('.auth-tab').forEach((button) => button.classList.toggle('active', button.dataset.authTab === tab));
    $('#loginForm').classList.toggle('active', tab === 'login');
    $('#registerForm').classList.toggle('active', tab === 'register');
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!state.supabase) return openDialog('setupDialog');
    setFormBusy(event.currentTarget, true);
    const { error } = await state.supabase.auth.signInWithPassword({
      email: $('#loginEmail').value.trim(),
      password: $('#loginPassword').value,
    });
    setFormBusy(event.currentTarget, false);
    if (error) toast(readableError(error.message), 'error');
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!state.supabase) return openDialog('setupDialog');
    setFormBusy(event.currentTarget, true);
    const name = $('#registerName').value.trim();
    const { data, error } = await state.supabase.auth.signUp({
      email: $('#registerEmail').value.trim(),
      password: $('#registerPassword').value,
      options: { data: { display_name: name, avatar: name.charAt(0).toUpperCase() } },
    });
    setFormBusy(event.currentTarget, false);
    if (error) return toast(readableError(error.message), 'error');
    if (!data.session) toast('Cuenta creada. Revisa tu correo para confirmar el acceso.', 'success');
    else toast('Cuenta creada correctamente.', 'success');
  }

  async function startCloudSession(user) {
    state.demo = false;
    state.user = user;
    const { data: profile, error } = await state.supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) console.error(error);
    state.profile = profile || {
      user_id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Duke',
      avatar: user.user_metadata?.avatar || 'D',
      mood_text: 'Feliz', mood_emoji: '😊',
    };

    const { data: membership, error: membershipError } = await state.supabase
      .from('couple_members')
      .select('couple_id, joined_at, couples(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) console.error(membershipError);
    if (!membership?.couples) {
      showApp();
      renderProfileBasics();
      $('#coupleDialog').showModal();
      return;
    }

    state.couple = membership.couples;
    await loadAllData();
    showApp();
    subscribeRealtime();
    updateLastSeen();
    setInterval(updateLastSeen, 45000);
  }

  function startDemo() {
    state.demo = true;
    state.user = { id: 'demo-me', email: 'demo@duke.local' };
    state.profile = { user_id: 'demo-me', display_name: 'Tú', avatar: 'D', mood_text: 'Feliz', mood_emoji: '😊' };
    state.couple = { id: 'demo-couple', name: 'Nuestro Duke', invite_code: 'DUKE-DEMO', relationship_date: new Date(Date.now() - 86400000 * 365).toISOString().slice(0, 10), created_at: new Date().toISOString() };
    state.members = [
      { user_id: 'demo-me', joined_at: new Date().toISOString(), profiles: state.profile },
      { user_id: 'demo-partner', joined_at: new Date().toISOString(), profiles: { user_id: 'demo-partner', display_name: 'Mi amor', avatar: '💜', mood_text: 'Te extraño', mood_emoji: '🥺', last_seen: new Date().toISOString() } },
    ];
    state.partner = state.members[1].profiles;
    const saved = readDemo();
    state.messages = saved.messages || [
      { id: 'welcome-1', sender_id: 'demo-partner', body: 'Bienvenido/a a nuestro lugar 💜', message_type: 'text', created_at: new Date(Date.now() - 60000).toISOString() },
    ];
    state.memories = saved.memories || [];
    state.dates = saved.dates || [];
    state.games = saved.games || {};
    showApp();
    renderAll();
    toast('Estás viendo el modo demostración.', 'success');
  }

  function readDemo() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveDemo() {
    if (!state.demo) return;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ messages: state.messages, memories: state.memories, dates: state.dates, games: state.games }));
  }

  async function createCouple(event) {
    event.preventDefault();
    const name = $('#coupleNameInput').value.trim();
    const relationshipDate = $('#relationshipDateInput').value || null;
    const pin = $('#couplePinInput').value.trim();
    if (!/^\d{4,8}$/.test(pin)) return toast('El PIN debe tener entre 4 y 8 números.', 'error');
    setFormBusy(event.currentTarget, true);
    const pinHash = await sha256(pin);
    const { data, error } = await state.supabase.rpc('create_duke_couple', {
      p_name: name,
      p_relationship_date: relationshipDate,
      p_pin_hash: pinHash,
    });
    setFormBusy(event.currentTarget, false);
    if (error) return toast(readableError(error.message), 'error');
    state.couple = Array.isArray(data) ? data[0] : data;
    closeDialog('coupleDialog');
    await loadAllData();
    subscribeRealtime();
    renderAll();
    showInvite();
  }

  async function joinCouple(event) {
    event.preventDefault();
    const code = $('#inviteCodeInput').value.trim().toUpperCase();
    const pin = $('#joinPinInput').value.trim();
    if (!code || !/^\d{4,8}$/.test(pin)) return toast('Revisa el código y el PIN.', 'error');
    setFormBusy(event.currentTarget, true);
    const pinHash = await sha256(pin);
    const { data, error } = await state.supabase.rpc('join_duke_couple', {
      p_invite_code: code,
      p_pin_hash: pinHash,
    });
    setFormBusy(event.currentTarget, false);
    if (error) return toast(readableError(error.message), 'error');
    state.couple = Array.isArray(data) ? data[0] : data;
    closeDialog('coupleDialog');
    await loadAllData();
    subscribeRealtime();
    renderAll();
    toast('Ya están conectados en Duke.', 'success');
  }

  function switchCoupleOption(option) {
    $$('[data-couple-option]').forEach((button) => button.classList.toggle('active', button.dataset.coupleOption === option));
    $('#createCoupleForm').classList.toggle('active', option === 'create');
    $('#joinCoupleForm').classList.toggle('active', option === 'join');
  }

  async function loadAllData() {
    await Promise.all([loadMembers(), loadMessages(), loadMemories(), loadDates(), loadGames()]);
    renderAll();
  }

  async function loadMembers() {
    const { data, error } = await state.supabase
      .from('couple_members')
      .select('user_id, joined_at, profiles(*)')
      .eq('couple_id', state.couple.id)
      .order('joined_at');
    if (error) return console.error(error);
    state.members = data || [];
    const partnerMember = state.members.find((member) => member.user_id !== state.user.id);
    state.partner = partnerMember?.profiles || null;
    const selfMember = state.members.find((member) => member.user_id === state.user.id);
    if (selfMember?.profiles) state.profile = selfMember.profiles;
  }

  async function loadMessages() {
    const { data, error } = await state.supabase
      .from('messages')
      .select('*')
      .eq('couple_id', state.couple.id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return console.error(error);
    state.messages = data || [];
  }

  async function loadMemories() {
    const { data, error } = await state.supabase
      .from('memories')
      .select('*')
      .eq('couple_id', state.couple.id)
      .order('memory_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) return console.error(error);
    state.memories = data || [];
  }

  async function loadDates() {
    const { data, error } = await state.supabase
      .from('special_dates')
      .select('*')
      .eq('couple_id', state.couple.id)
      .order('event_date');
    if (error) return console.error(error);
    state.dates = data || [];
  }

  async function loadGames() {
    const { data, error } = await state.supabase.from('game_states').select('*').eq('couple_id', state.couple.id);
    if (error) return console.error(error);
    state.games = Object.fromEntries((data || []).map((game) => [game.game_type, game.state]));
  }

  function subscribeRealtime() {
    unsubscribeRealtime();
    if (!state.supabase || !state.couple?.id) return;
    const filter = `couple_id=eq.${state.couple.id}`;

    state.subscriptions.push(
      state.supabase.channel(`duke-messages-${state.couple.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter }, async () => {
          await loadMessages(); renderMessages(); renderStats();
        }).subscribe(),
      state.supabase.channel(`duke-memories-${state.couple.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter }, async () => {
          await loadMemories(); renderMemories(); renderStats();
        }).subscribe(),
      state.supabase.channel(`duke-dates-${state.couple.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'special_dates', filter }, async () => {
          await loadDates(); renderNextDate();
        }).subscribe(),
      state.supabase.channel(`duke-games-${state.couple.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_states', filter }, async (payload) => {
          if (payload.new?.game_type) state.games[payload.new.game_type] = payload.new.state;
          renderGames();
        }).subscribe(),
      state.supabase.channel(`duke-members-${state.couple.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_members', filter }, async () => {
          await loadMembers(); renderProfileBasics();
        }).subscribe()
    );

    state.subscriptions.push(
      state.supabase.channel(`duke-profiles-${state.couple.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async (payload) => {
          if (state.members.some((member) => member.user_id === payload.new.user_id)) {
            await loadMembers(); renderProfileBasics(); renderMoods();
          }
        }).subscribe()
    );
  }

  function unsubscribeRealtime() {
    state.subscriptions.forEach((channel) => state.supabase?.removeChannel(channel));
    state.subscriptions = [];
  }

  function renderAll() {
    renderProfileBasics();
    renderStats();
    renderMoods();
    renderNextDate();
    renderMessages();
    renderMemories();
    renderGames();
  }

  function renderProfileBasics() {
    const me = state.profile || {};
    const partner = state.partner || {};
    const meAvatar = me.avatar || me.display_name?.charAt(0)?.toUpperCase() || 'D';
    const partnerAvatar = partner.avatar || partner.display_name?.charAt(0)?.toUpperCase() || '?';
    $('#userAvatar').textContent = meAvatar;
    $('#homeAvatarMe').textContent = meAvatar;
    $('#homeAvatarPartner').textContent = partnerAvatar;
    $('#chatPartnerAvatar').textContent = partnerAvatar;
    $('#chatPartnerName').textContent = partner.display_name || 'Tu pareja';
    $('#chatPartnerStatus').textContent = partner.user_id ? onlineLabel(partner.last_seen) : 'Aún no se ha unido';
    $('#heroGreeting').textContent = partner.display_name ? `${me.display_name || 'Tú'} y ${partner.display_name}, este es su lugar.` : 'Nuestro lugar siempre está cerca.';
    $('#heroSubtitle').textContent = state.couple?.name || 'Un espacio creado para compartir aun cuando estén lejos.';
    $('#profileNameInput').value = me.display_name || '';
    $('#profileAvatarInput').value = me.avatar || '';
    const hasInvite = Boolean(state.couple?.invite_code);
    $('#profileInviteArea').classList.toggle('hidden', !hasInvite);
    $('#profileInviteCode').textContent = state.couple?.invite_code || '';
  }

  function renderStats() {
    const relationship = state.couple?.relationship_date ? new Date(`${state.couple.relationship_date}T12:00:00`) : new Date();
    const days = Math.max(0, Math.floor((Date.now() - relationship.getTime()) / 86400000));
    $('#daysTogether').textContent = days.toLocaleString('es');
    $('#messageCount').textContent = state.messages.length.toLocaleString('es');
    $('#memoryCount').textContent = state.memories.length.toLocaleString('es');
    const activeDays = new Set(state.messages.map((message) => new Date(message.created_at).toISOString().slice(0, 10)));
    $('#streakCount').textContent = Math.max(1, calculateStreak(activeDays));
  }

  function calculateStreak(daysSet) {
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 3650; i += 1) {
      const day = cursor.toISOString().slice(0, 10);
      if (daysSet.has(day)) streak += 1;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderMoods() {
    const me = state.profile || {};
    const partner = state.partner || {};
    $('#moodEmojiMe').textContent = me.mood_emoji || '😊';
    $('#moodNameMe').textContent = me.display_name || 'Tú';
    $('#moodTextMe').textContent = me.mood_text || 'Feliz';
    $('#moodEmojiPartner').textContent = partner.mood_emoji || '💜';
    $('#moodNamePartner').textContent = partner.display_name || 'Tu pareja';
    $('#moodTextPartner').textContent = partner.mood_text || 'Esperando conexión';
  }

  function renderNextDate() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const future = state.dates
      .map((date) => ({ ...date, parsed: new Date(`${date.event_date}T12:00:00`) }))
      .filter((date) => date.parsed >= now)
      .sort((a, b) => a.parsed - b.parsed)[0];
    if (!future) {
      $('#nextDateCard').innerHTML = '<span class="date-badge">♡</span><div><strong>Añadan una fecha</strong><p>Aniversario, visita, cumpleaños o cita virtual.</p></div>';
      return;
    }
    const remaining = Math.ceil((future.parsed - now) / 86400000);
    $('#nextDateCard').innerHTML = `<span class="date-badge">${future.parsed.getDate()}</span><div><strong>${escapeHtml(future.title)}</strong><p>${formatDate(future.event_date)} · ${remaining === 0 ? 'Es hoy' : `Faltan ${remaining} días`}</p></div>`;
  }

  async function renderMessages() {
    const list = $('#messagesList');
    if (!state.messages.length) {
      list.innerHTML = '<div class="empty-state"><span>💜</span><h3>Su conversación comienza aquí</h3><p>Escribe el primer mensaje de este espacio privado.</p></div>';
      return;
    }

    const rows = await Promise.all(state.messages.map(async (message) => {
      const mine = message.sender_id === state.user.id;
      const sender = mine ? state.profile : state.partner;
      const avatar = sender?.avatar || sender?.display_name?.charAt(0)?.toUpperCase() || '?';
      const imageUrl = message.message_type === 'image' && message.media_path ? await mediaUrl(message.media_path) : null;
      return `<div class="message-row ${mine ? 'mine' : ''}" data-message-id="${message.id}">
        <span class="message-avatar">${escapeHtml(avatar)}</span>
        <div class="message-bubble" title="Pulsa para responder">
          ${message.reply_preview ? `<div class="message-reply">${escapeHtml(message.reply_preview)}</div>` : ''}
          ${imageUrl ? `<img class="message-image" src="${escapeAttribute(imageUrl)}" alt="Imagen compartida" loading="lazy">` : ''}
          ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ''}
          <small>${formatTime(message.created_at)}</small>
        </div>
      </div>`;
    }));

    list.innerHTML = rows.join('');
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  async function renderMemories() {
    const grid = $('#memoriesGrid');
    if (!state.memories.length) {
      grid.innerHTML = '<div class="panel glass empty-state" style="grid-column:1/-1"><span>📸</span><h3>Todavía no hay recuerdos</h3><p>Guarden su primera foto, carta o momento especial.</p></div>';
      return;
    }
    const cards = await Promise.all(state.memories.map(async (memory) => {
      const image = memory.media_path ? await mediaUrl(memory.media_path) : null;
      return `<article class="memory-card glass">
        <button class="memory-delete" data-delete-memory="${memory.id}" title="Eliminar recuerdo">×</button>
        ${image ? `<img class="memory-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(memory.title)}" loading="lazy">` : '<div class="memory-placeholder">◇</div>'}
        <div class="memory-body">
          <h4>${escapeHtml(memory.title)}</h4>
          <p>${escapeHtml(memory.description || 'Un momento especial de nuestra historia.')}</p>
          <div class="memory-meta"><span>${formatDate(memory.memory_date || memory.created_at)}</span><span>DUKE</span></div>
        </div>
      </article>`;
    }));
    grid.innerHTML = cards.join('');
  }

  function renderGames() {
    renderTicTacToe();
    renderQuestions();
    renderRoulette();
  }

  function getTicState() {
    const first = state.members[0]?.user_id || state.user.id;
    const second = state.members[1]?.user_id || 'waiting';
    return state.games.tictactoe || {
      board: Array(9).fill(''), turn: 'X', winner: null,
      players: { X: first, O: second }, scores: { X: 0, O: 0, draw: 0 },
    };
  }

  function renderTicTacToe() {
    const game = getTicState();
    $('#ticBoard').innerHTML = game.board.map((cell, index) => `<button class="tic-cell ${cell.toLowerCase()}" data-cell="${index}" ${cell || game.winner ? 'disabled' : ''}>${cell}</button>`).join('');
    const mySymbol = game.players.X === state.user.id ? 'X' : game.players.O === state.user.id ? 'O' : null;
    if (game.winner === 'draw') $('#ticStatus').textContent = 'Empate. ¡Estuvieron muy cerca!';
    else if (game.winner) $('#ticStatus').textContent = game.players[game.winner] === state.user.id ? '¡Ganaste esta partida!' : 'Tu pareja ganó esta partida.';
    else if (!mySymbol) $('#ticStatus').textContent = 'La partida espera a la segunda persona.';
    else $('#ticStatus').textContent = game.turn === mySymbol ? `Tu turno: ${mySymbol}` : `Turno de tu pareja: ${game.turn}`;
    $('#ticScoreMe').textContent = mySymbol ? game.scores[mySymbol] || 0 : 0;
    $('#ticScorePartner').textContent = mySymbol ? game.scores[mySymbol === 'X' ? 'O' : 'X'] || 0 : 0;
    $('#ticScoreDraw').textContent = game.scores.draw || 0;
  }

  function renderQuestions() {
    const game = state.games.questions || { index: 0, answers: {} };
    $('#questionText').textContent = questions[game.index % questions.length];
    $('#questionAnswerInput').value = game.answers?.[state.user.id] || '';
    const answerEntries = Object.entries(game.answers || {});
    const bothAnswered = answerEntries.length >= Math.min(2, state.members.length || 2);
    if (!answerEntries.length) {
      $('#questionAnswers').innerHTML = '';
      return;
    }
    $('#questionAnswers').innerHTML = answerEntries.map(([userId, answer]) => {
      const member = state.members.find((item) => item.user_id === userId)?.profiles;
      const name = userId === state.user.id ? (state.profile?.display_name || 'Tú') : (member?.display_name || 'Tu pareja');
      return `<div class="answer-card"><strong>${escapeHtml(name)}</strong><p>${bothAnswered ? escapeHtml(answer) : userId === state.user.id ? escapeHtml(answer) : 'Respuesta guardada 🔒'}</p></div>`;
    }).join('');
  }

  function renderRoulette() {
    const game = state.games.roulette;
    if (!game) return;
    $('#rouletteWheel').style.transform = `rotate(${game.rotation || 0}deg)`;
    $('#rouletteResult').textContent = game.result || 'El resultado aparecerá aquí.';
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = $('#messageInput');
    const body = input.value.trim();
    if (!body || !state.couple) return;
    const message = {
      id: crypto.randomUUID(), couple_id: state.couple.id, sender_id: state.user.id,
      body, message_type: 'text', reply_to: state.replyTo?.id || null,
      reply_preview: state.replyTo?.body?.slice(0, 120) || null,
      created_at: new Date().toISOString(),
    };
    input.value = ''; autoResizeTextarea({ target: input }); clearReply();
    if (state.demo) {
      state.messages.push(message); saveDemo(); renderMessages(); renderStats();
      simulateDemoReply(body);
      return;
    }
    const { error } = await state.supabase.from('messages').insert(message);
    if (error) { toast(readableError(error.message), 'error'); input.value = body; }
  }

  async function sendImageMessage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 7 * 1024 * 1024) return toast('La imagen no puede superar 7 MB.', 'error');
    try {
      const path = await uploadMedia(file, 'messages');
      const message = {
        id: crypto.randomUUID(), couple_id: state.couple.id, sender_id: state.user.id,
        body: '', message_type: 'image', media_path: path,
        reply_to: state.replyTo?.id || null, reply_preview: state.replyTo?.body?.slice(0, 120) || null,
        created_at: new Date().toISOString(),
      };
      clearReply();
      if (state.demo) { state.messages.push(message); saveDemo(); renderMessages(); renderStats(); }
      else {
        const { error } = await state.supabase.from('messages').insert(message);
        if (error) throw error;
      }
    } catch (error) { toast(readableError(error.message), 'error'); }
  }

  function handleMessageClick(event) {
    const row = event.target.closest('[data-message-id]');
    if (!row) return;
    const message = state.messages.find((item) => String(item.id) === row.dataset.messageId);
    if (!message) return;
    state.replyTo = message;
    $('#replyPreviewText').textContent = message.body || 'Imagen';
    $('#replyPreview').classList.remove('hidden');
    $('#messageInput').focus();
  }

  function clearReply() {
    state.replyTo = null;
    $('#replyPreview').classList.add('hidden');
  }

  function simulateDemoReply(body) {
    window.setTimeout(() => {
      const reply = {
        id: crypto.randomUUID(), couple_id: state.couple.id, sender_id: 'demo-partner',
        body: body.toLowerCase().includes('extraño') ? 'Yo también te extraño muchísimo 🥺💜' : 'Me encanta que tengamos este espacio para nosotros 💜',
        message_type: 'text', created_at: new Date().toISOString(),
      };
      state.messages.push(reply); saveDemo(); renderMessages(); renderStats();
    }, 900);
  }

  async function sendMissingYou() {
    if (!state.couple) return;
    $('#messageInput').value = 'Te extraño mucho 💜';
    await sendMessage({ preventDefault() {} });
    toast('Le enviaste un “Te extraño” especial.', 'success');
  }

  async function chooseMood(value) {
    const [moodText, moodEmoji] = value.split('|');
    state.profile = { ...state.profile, mood_text: moodText, mood_emoji: moodEmoji, last_seen: new Date().toISOString() };
    closeDialog('moodDialog'); renderMoods();
    if (state.demo) return;
    const { error } = await state.supabase.from('profiles').update({ mood_text: moodText, mood_emoji: moodEmoji, last_seen: new Date().toISOString() }).eq('user_id', state.user.id);
    if (error) toast(readableError(error.message), 'error');
  }

  async function saveDate(event) {
    event.preventDefault();
    const date = {
      id: crypto.randomUUID(), couple_id: state.couple.id, created_by: state.user.id,
      title: $('#dateTitleInput').value.trim(), event_date: $('#dateValueInput').value,
      created_at: new Date().toISOString(),
    };
    if (state.demo) { state.dates.push(date); saveDemo(); renderNextDate(); }
    else {
      const { error } = await state.supabase.from('special_dates').insert(date);
      if (error) return toast(readableError(error.message), 'error');
    }
    event.currentTarget.reset(); closeDialog('dateDialog'); toast('Fecha especial guardada.', 'success');
  }

  async function saveMemory(event) {
    event.preventDefault();
    setFormBusy(event.currentTarget, true);
    try {
      const file = $('#memoryImageInput').files?.[0];
      if (file && file.size > 7 * 1024 * 1024) throw new Error('La imagen no puede superar 7 MB.');
      const mediaPath = file ? await uploadMedia(file, 'memories') : null;
      const memory = {
        id: crypto.randomUUID(), couple_id: state.couple.id, user_id: state.user.id,
        title: $('#memoryTitleInput').value.trim(), description: $('#memoryDescriptionInput').value.trim(),
        memory_date: $('#memoryDateInput').value || new Date().toISOString().slice(0, 10),
        media_path: mediaPath, created_at: new Date().toISOString(),
      };
      if (state.demo) { state.memories.unshift(memory); saveDemo(); renderMemories(); renderStats(); }
      else {
        const { error } = await state.supabase.from('memories').insert(memory);
        if (error) throw error;
      }
      event.currentTarget.reset(); closeDialog('memoryDialog'); toast('Recuerdo guardado.', 'success');
    } catch (error) { toast(readableError(error.message), 'error'); }
    finally { setFormBusy(event.currentTarget, false); }
  }

  async function deleteMemory(event) {
    const button = event.target.closest('[data-delete-memory]');
    if (!button) return;
    const memory = state.memories.find((item) => String(item.id) === button.dataset.deleteMemory);
    if (!memory || !confirm('¿Eliminar este recuerdo?')) return;
    if (state.demo) {
      state.memories = state.memories.filter((item) => item.id !== memory.id); saveDemo(); renderMemories(); renderStats(); return;
    }
    const { error } = await state.supabase.from('memories').delete().eq('id', memory.id);
    if (error) toast(readableError(error.message), 'error');
    if (memory.media_path) state.supabase.storage.from('duke-media').remove([memory.media_path]);
  }

  async function uploadMedia(file, folder) {
    if (state.demo) return fileToDataUrl(file);
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${state.couple.id}/${state.user.id}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await state.supabase.storage.from('duke-media').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return path;
  }

  async function mediaUrl(path) {
    if (!path) return null;
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    if (!state.supabase) return null;
    const { data, error } = await state.supabase.storage.from('duke-media').createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }

  async function playTicTacToe(event) {
    const cell = event.target.closest('[data-cell]');
    if (!cell) return;
    const game = structuredClone(getTicState());
    const index = Number(cell.dataset.cell);
    const mySymbol = game.players.X === state.user.id ? 'X' : game.players.O === state.user.id ? 'O' : null;
    if (!mySymbol || game.turn !== mySymbol || game.board[index] || game.winner) return toast('Espera tu turno.', 'error');
    game.board[index] = mySymbol;
    const winner = findWinner(game.board);
    if (winner) { game.winner = winner; game.scores[winner] = (game.scores[winner] || 0) + 1; }
    else if (game.board.every(Boolean)) { game.winner = 'draw'; game.scores.draw = (game.scores.draw || 0) + 1; }
    else game.turn = mySymbol === 'X' ? 'O' : 'X';
    await saveGame('tictactoe', game);
  }

  async function resetTicTacToe() {
    const previous = getTicState();
    const game = { ...previous, board: Array(9).fill(''), winner: null, turn: previous.turn === 'X' ? 'O' : 'X' };
    await saveGame('tictactoe', game);
  }

  function findWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return null;
  }

  async function nextQuestion() {
    const current = state.games.questions || { index: 0, answers: {} };
    await saveGame('questions', { index: (current.index + 1) % questions.length, answers: {} });
  }

  async function saveQuestionAnswer(event) {
    event.preventDefault();
    const answer = $('#questionAnswerInput').value.trim();
    if (!answer) return;
    const current = structuredClone(state.games.questions || { index: 0, answers: {} });
    current.answers ||= {};
    current.answers[state.user.id] = answer;
    await saveGame('questions', current);
    toast('Respuesta guardada.', 'success');
  }

  async function spinRoulette() {
    const current = state.games.roulette || { rotation: 0 };
    const index = Math.floor(Math.random() * rouletteItems.length);
    const rotation = (current.rotation || 0) + 1440 + index * 60 + Math.floor(Math.random() * 35);
    await saveGame('roulette', { rotation, result: rouletteItems[index] });
  }

  async function saveGame(type, gameState) {
    state.games[type] = gameState; renderGames();
    if (state.demo) { saveDemo(); return; }
    const { error } = await state.supabase.from('game_states').upsert({
      couple_id: state.couple.id, game_type: type, state: gameState,
      updated_by: state.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'couple_id,game_type' });
    if (error) toast(readableError(error.message), 'error');
  }

  function startCall(mode) {
    if (!window.JitsiMeetExternalAPI) return toast('No se pudo cargar el servicio de llamadas.', 'error');
    if (!state.couple) return toast('Primero conecta el espacio de pareja.', 'error');
    endCall();
    $('#callLobby').classList.add('hidden');
    $('#jitsiContainer').classList.remove('hidden');
    $('#endCallButton').classList.remove('hidden');
    const roomName = `Duke-${String(state.couple.id).replace(/[^a-zA-Z0-9]/g, '')}-private`;
    state.jitsiApi = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName,
      parentNode: $('#jitsiContainer'),
      width: '100%', height: '100%',
      userInfo: { displayName: state.profile?.display_name || 'Duke' },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithVideoMuted: mode === 'audio',
        startAudioOnly: mode === 'audio',
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
        TOOLBAR_BUTTONS: ['microphone','camera','desktop','fullscreen','hangup','chat','tileview','select-background','settings'],
      },
    });
    state.jitsiApi.addListener('readyToClose', endCall);
    sendCallNotification(mode);
  }

  async function sendCallNotification(mode) {
    if (state.demo || !state.supabase) return;
    const body = mode === 'audio' ? '☎ Inició una llamada de voz.' : '📹 Inició una videollamada.';
    await state.supabase.from('messages').insert({ couple_id: state.couple.id, sender_id: state.user.id, body, message_type: 'system' });
  }

  function endCall() {
    if (state.jitsiApi) {
      try { state.jitsiApi.dispose(); } catch (error) { console.warn(error); }
      state.jitsiApi = null;
    }
    $('#jitsiContainer').innerHTML = '';
    $('#jitsiContainer').classList.add('hidden');
    $('#endCallButton').classList.add('hidden');
    $('#callLobby').classList.remove('hidden');
  }

  function navigate(view) {
    const [eyebrow, title] = titleMap[view] || titleMap.home;
    $('#viewEyebrow').textContent = eyebrow;
    $('#viewTitle').textContent = title;
    $$('.view').forEach((section) => section.classList.toggle('active', section.id === `${view}View`));
    $$('.nav-btn[data-view], .mobile-nav-btn[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    if (view !== 'call') endCall();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchGame(game) {
    $$('.game-tab').forEach((button) => button.classList.toggle('active', button.dataset.game === game));
    $$('.game-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${game}Game`));
  }

  function openProfile() {
    renderProfileBasics();
    openDialog('profileDialog');
  }

  async function saveProfile(event) {
    event.preventDefault();
    const displayName = $('#profileNameInput').value.trim();
    const avatar = $('#profileAvatarInput').value.trim() || displayName.charAt(0).toUpperCase();
    state.profile = { ...state.profile, display_name: displayName, avatar };
    renderProfileBasics(); closeDialog('profileDialog');
    if (state.demo) return;
    const { error } = await state.supabase.from('profiles').update({ display_name: displayName, avatar }).eq('user_id', state.user.id);
    if (error) toast(readableError(error.message), 'error'); else toast('Perfil actualizado.', 'success');
  }

  function showInvite() {
    if (!state.couple?.invite_code) return;
    $('#inviteCodeDisplay').textContent = state.couple.invite_code;
    closeDialog('profileDialog');
    openDialog('inviteDialog');
  }

  async function copyInviteCode() {
    const code = state.couple?.invite_code || '';
    try { await navigator.clipboard.writeText(code); toast('Código copiado.', 'success'); }
    catch { toast(`Código: ${code}`, 'success'); }
  }

  async function updateLastSeen() {
    if (state.demo || !state.supabase || !state.user) return;
    await state.supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('user_id', state.user.id);
  }

  async function logout() {
    endCall(); unsubscribeRealtime();
    if (state.demo) return resetToAuth();
    await state.supabase?.auth.signOut();
    resetToAuth();
  }

  function resetToAuth() {
    state.user = null; state.profile = null; state.couple = null; state.members = []; state.partner = null;
    state.messages = []; state.memories = []; state.dates = []; state.games = {}; state.demo = false;
    $('#appShell').classList.add('hidden');
    showAuth();
  }

  function showAuth() {
    $('#authScreen').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
  }

  function showApp() {
    $('#authScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    navigate('home');
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
  }

  function autoResizeTextarea(event) {
    const element = event.target;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 130)}px`;
  }

  async function installPwa() {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('#installButton').classList.add('hidden');
  }

  function setFormBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) { button.dataset.originalText = button.textContent; button.textContent = 'Procesando…'; button.disabled = true; }
    else { button.textContent = button.dataset.originalText || button.textContent; button.disabled = false; }
  }

  function onlineLabel(lastSeen) {
    if (!lastSeen) return 'Sin conexión reciente';
    const seconds = (Date.now() - new Date(lastSeen).getTime()) / 1000;
    if (seconds < 120) return 'En línea ahora';
    if (seconds < 3600) return `Visto hace ${Math.floor(seconds / 60)} min`;
    return `Visto ${new Date(lastSeen).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = String(value).includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
    return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function readableError(message = '') {
    const map = [
      ['Invalid login credentials', 'Correo o contraseña incorrectos.'],
      ['Email not confirmed', 'Debes confirmar tu correo antes de entrar.'],
      ['User already registered', 'Ese correo ya está registrado.'],
      ['Invalid invite code or PIN', 'El código o el PIN no son correctos.'],
      ['This Duke space already has two members', 'Este espacio de Duke ya tiene dos personas.'],
      ['User already belongs to a Duke space', 'Esta cuenta ya pertenece a un espacio de Duke.'],
    ];
    const found = map.find(([key]) => message.includes(key));
    return found ? found[1] : message || 'Ocurrió un error inesperado.';
  }

  function toast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('#toastRoot').appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function escapeAttribute(value = '') { return escapeHtml(value); }
})();
