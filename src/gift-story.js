import { $, state, toast } from './core.js';

const gift = {
  data: null,
  initialized: false,
  poller: null,
  playing: false,
  current: -1,
  sceneToken: 0,
  nextTimer: null,
  bgAudio: null,
  narrationAudio: null,
  baseVolume: .16,
  voiceEnabled: true,
  musicEnabled: true,
  cuePlayed: false,
  editingId: null,
};

const annoyingOpeners = [
  'Oye, oye... no te distraigas.',
  'Mira, mira... presta atención.',
  'Ajá... todavía no termino.',
  'Ey, tú... esto es importante.',
  'No te vayas, que falta lo bonito.',
];

function giftApi(action, payload = {}) {
  return fetch(`/api/gift?action=${encodeURIComponent(action)}`, {
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

function safeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image/') || url.startsWith('data:audio/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function addStylesheet() {
  if ($('#dukeGiftStylesheet')) return;
  const link = document.createElement('link');
  link.id = 'dukeGiftStylesheet';
  link.rel = 'stylesheet';
  link.href = '/src/gift-story.css';
  document.head.append(link);
}

function dogMarkup(extraClass = '') {
  return `<div class="duke-dog ${extraClass}" aria-label="Duke, el perrito narrador">
    <svg viewBox="0 0 250 250" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="dogBody" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7d7a6"/><stop offset="1" stop-color="#c98952"/></linearGradient>
        <linearGradient id="dogMuzzle" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff2d8"/><stop offset="1" stop-color="#e8bf86"/></linearGradient>
        <filter id="dogShadow"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-opacity=".28"/></filter>
      </defs>
      <g filter="url(#dogShadow)">
        <g class="dog-tail"><path d="M191 151c28-17 39-4 30 12-7 12-19 15-29 11" fill="none" stroke="#bc7744" stroke-width="16" stroke-linecap="round"/></g>
        <ellipse cx="126" cy="168" rx="71" ry="59" fill="url(#dogBody)"/>
        <ellipse cx="83" cy="213" rx="25" ry="18" fill="#d59a61" class="dog-paw-left"/>
        <ellipse cx="166" cy="213" rx="25" ry="18" fill="#d59a61" class="dog-paw-right"/>
        <g class="dog-head">
          <path class="dog-ear-left" d="M79 77C48 64 39 89 54 121c7 15 18 22 31 17" fill="#a9653d"/>
          <path class="dog-ear-right" d="M165 76c32-13 42 12 27 44-7 15-18 22-32 17" fill="#a9653d"/>
          <ellipse cx="123" cy="111" rx="65" ry="61" fill="url(#dogBody)"/>
          <path d="M92 78c9-14 20-20 31-20 13 0 24 6 34 20-21-8-43-8-65 0" fill="#fff0d2" opacity=".58"/>
          <ellipse cx="100" cy="106" rx="8" ry="11" fill="#24160f" class="dog-eye"/>
          <ellipse cx="147" cy="106" rx="8" ry="11" fill="#24160f" class="dog-eye"/>
          <circle cx="97" cy="102" r="2.5" fill="white"/><circle cx="144" cy="102" r="2.5" fill="white"/>
          <ellipse cx="123" cy="136" rx="36" ry="29" fill="url(#dogMuzzle)"/>
          <path d="M112 128c4-7 18-7 22 0-1 9-20 10-22 0" fill="#2f1b17"/>
          <path d="M123 136v7" stroke="#5f3527" stroke-width="3" stroke-linecap="round"/>
          <path class="dog-mouth" d="M108 146c9 13 22 13 31 0-2 20-28 24-31 0" fill="#5b2027"/>
          <path d="M116 157c5-5 12-5 17 0" fill="none" stroke="#f18b9a" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="78" cy="132" rx="11" ry="7" fill="#f1a8a8" opacity=".45"/>
          <ellipse cx="169" cy="132" rx="11" ry="7" fill="#f1a8a8" opacity=".45"/>
        </g>
        <path d="M86 169c14 13 65 13 79 0" fill="none" stroke="#8b5cf6" stroke-width="10" stroke-linecap="round"/>
        <circle cx="126" cy="177" r="10" fill="#f5d565"/><path d="M121 174h10M126 169v10" stroke="#7c5b12" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>
  </div>`;
}

function buildEntry() {
  if ($('#dukeGiftSection')) return true;
  const hero = $('.hero');
  if (!hero) return false;
  const section = document.createElement('section');
  section.id = 'dukeGiftSection';
  section.className = 'duke-gift-entry';
  section.innerHTML = `
    <div class="gift-entry-layout">
      <div class="gift-entry-copy">
        <span class="gift-entry-tag"><i></i> REGALO ESPECIAL</span>
        <p class="eyebrow" style="margin-top:17px">UNA HISTORIA HECHA POR TI</p>
        <h2 id="giftEntryTitle">Regalo para ti</h2>
        <p id="giftEntrySubtitle">Fotos, palabras, voces y una canción para contar la historia de ustedes.</p>
        <div class="gift-entry-actions">
          <button id="giftPlayButton" class="primary-btn" type="button">▶ Ver nuestra historia</button>
          <button id="giftEditButton" class="secondary-btn" type="button">✦ Crear y editar</button>
        </div>
        <div class="gift-entry-count"><span>🎞️</span><span><strong id="giftSceneCount">0</strong> recuerdos preparados</span></div>
      </div>
      <div class="gift-entry-dog">${dogMarkup('excited')}</div>
    </div>`;
  hero.after(section);
  $('#giftPlayButton').addEventListener('click', startTheater);
  $('#giftEditButton').addEventListener('click', openEditor);
  return true;
}

function buildEditor() {
  if ($('#giftEditorDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'giftEditorDialog';
  dialog.className = 'gift-editor-dialog';
  dialog.innerHTML = `
    <div class="gift-editor-shell">
      <div class="gift-editor-head">
        <div><p class="eyebrow">CONSTRUYE EL REGALO</p><h2>La historia de ustedes</h2><p style="color:var(--muted);margin:7px 0 0">Agrega cada recuerdo y Duke lo convertirá en una película.</p></div>
        <button id="giftEditorClose" class="gift-editor-close" type="button">×</button>
      </div>
      <div class="gift-editor-grid">
        <section class="gift-editor-panel">
          <h3>Presentación y música</h3>
          <form id="giftSettingsForm" class="gift-form">
            <label>Título<input id="giftTitleInput" maxlength="90" required placeholder="Regalo para ti" /></label>
            <label>Subtítulo<input id="giftSubtitleInput" maxlength="180" placeholder="Nuestra historia, contada con el corazón" /></label>
            <label>Dedicatoria inicial<textarea id="giftDedicationInput" maxlength="900" rows="5" placeholder="Escribe las primeras palabras que ella verá..."></textarea></label>
            <div class="gift-form-row">
              <label>Estilo<select id="giftThemeInput"><option value="cinema">Cine elegante</option><option value="romantic">Romántico</option><option value="midnight">Noche</option><option value="sunset">Atardecer</option></select></label>
              <label>Segundos por escena<input id="giftSecondsInput" type="number" min="4" max="20" value="8" /></label>
            </div>
            <label>Canción suave de fondo<input id="giftMusicFile" type="file" accept="audio/*" /><small>Archivo corto de máximo 1.6 MB.</small></label>
            <label>O enlace HTTPS de la canción<input id="giftMusicUrl" type="url" placeholder="https://..." /></label>
            <div id="giftCurrentMusic" class="gift-current-file hidden"></div>
            <button id="giftClearMusic" class="gift-danger-link hidden" type="button">Quitar canción actual</button>
            <label class="gift-check"><input id="giftEnabledInput" type="checkbox" checked /> Mostrar el regalo en el inicio</label>
            <button class="primary-btn full" type="submit">Guardar presentación</button>
          </form>
        </section>
        <section class="gift-editor-panel">
          <div class="gift-scenes-head"><div><p class="eyebrow">ESCENAS</p><h3>Recuerdos de la película</h3></div><button id="giftNewScene" class="secondary-btn" type="button">＋ Nuevo</button></div>
          <div id="giftSceneList" class="gift-scene-list"></div>
          <form id="giftSceneForm" class="gift-form gift-scene-editor">
            <h4 id="giftSceneFormTitle">Agregar recuerdo</h4>
            <div class="gift-form-row">
              <label>Título<input id="giftSceneTitle" maxlength="100" placeholder="Nuestro primer viaje" /></label>
              <label>Fecha o momento<input id="giftSceneDate" maxlength="60" placeholder="Cuba · 2025" /></label>
            </div>
            <label>Historia<textarea id="giftSceneText" maxlength="1200" rows="5" placeholder="Cuenta qué pasó, qué sentiste y por qué este recuerdo es especial..."></textarea></label>
            <div class="gift-form-row">
              <label>Tipo de contenido<select id="giftSceneMediaType"><option value="image">Fotografía</option><option value="video">Video por enlace</option><option value="none">Solo texto</option></select></label>
              <label>Foto<input id="giftSceneImage" type="file" accept="image/*" /></label>
            </div>
            <label>Enlace HTTPS de foto o video<input id="giftSceneMediaUrl" type="url" placeholder="https://..." /></label>
            <div id="giftMediaPreview" class="gift-media-preview"></div>
            <div class="gift-form-row">
              <label>Audio o narración propia<input id="giftSceneNarration" type="file" accept="audio/*" /><small>Máximo 1.2 MB.</small></label>
              <label>O enlace HTTPS del audio<input id="giftSceneNarrationUrl" type="url" placeholder="https://..." /></label>
            </div>
            <label class="gift-check"><input id="giftClearNarration" type="checkbox" /> Quitar narración actual y usar la voz de Duke</label>
            <div class="gift-form-row"><button id="giftCancelScene" class="secondary-btn" type="button">Limpiar</button><button class="primary-btn" type="submit">Guardar recuerdo</button></div>
          </form>
        </section>
      </div>
    </div>`;
  document.body.append(dialog);
  $('#giftEditorClose').addEventListener('click', () => dialog.close());
  $('#giftSettingsForm').addEventListener('submit', saveSettings);
  $('#giftSceneForm').addEventListener('submit', saveScene);
  $('#giftNewScene').addEventListener('click', resetSceneForm);
  $('#giftCancelScene').addEventListener('click', resetSceneForm);
  $('#giftClearMusic').addEventListener('click', clearMusic);
  $('#giftSceneImage').addEventListener('change', previewSelectedImage);
  $('#giftSceneMediaUrl').addEventListener('input', previewMediaUrl);
  $('#giftSceneMediaType').addEventListener('change', updateMediaFields);
}

function buildTheater() {
  if ($('#giftTheater')) return;
  const theater = document.createElement('section');
  theater.id = 'giftTheater';
  theater.className = 'gift-theater hidden';
  theater.dataset.theme = 'cinema';
  theater.innerHTML = `
    <div class="gift-theater-bg"></div><div id="giftStars" class="gift-stars"></div><div class="gift-film-grain"></div>
    <div class="gift-top-controls">
      <div><button id="giftCloseTheater" class="gift-theater-btn end" type="button">✕ Salir</button></div>
      <div><button id="giftVoiceToggle" class="gift-theater-btn" type="button">🗣️ Voz</button><button id="giftMusicToggle" class="gift-theater-btn" type="button">🎵 Música</button></div>
    </div>
    <div id="giftMusicPulse" class="gift-music-pulse"><i></i><i></i><i></i><i></i></div>
    <div class="gift-stage">
      <div id="giftScene" class="gift-scene"></div>
      <aside class="gift-dog-zone">
        <div id="giftDogBubble" class="gift-dog-bubble">Oye, oye... tengo algo que enseñarte.</div>
        <div id="giftDogCharacter">${dogMarkup()}</div>
        <div class="gift-dog-name">DUKE · NARRADOR OFICIAL</div>
      </aside>
    </div>
    <div class="gift-bottom-controls"><button id="giftPrevious" class="gift-theater-btn" type="button">←</button><button id="giftPause" class="gift-theater-btn" type="button">⏸</button><button id="giftNext" class="gift-theater-btn" type="button">→</button></div>
    <div class="gift-progress-track"><i id="giftProgress"></i></div>`;
  document.body.append(theater);
  $('#giftCloseTheater').addEventListener('click', stopTheater);
  $('#giftPrevious').addEventListener('click', previousScene);
  $('#giftNext').addEventListener('click', nextScene);
  $('#giftPause').addEventListener('click', togglePause);
  $('#giftVoiceToggle').addEventListener('click', toggleVoice);
  $('#giftMusicToggle').addEventListener('click', toggleMusic);
  theater.addEventListener('keydown', handleTheaterKeys);
  buildStars();
}

function buildStars() {
  const root = $('#giftStars');
  if (!root || root.children.length) return;
  for (let index = 0; index < 34; index += 1) {
    const star = document.createElement('i');
    star.className = 'gift-star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.setProperty('--delay', `${(Math.random() * 4).toFixed(2)}s`);
    star.style.opacity = String(.18 + Math.random() * .55);
    root.append(star);
  }
}

async function loadGift(render = true) {
  if (!state.user || !state.couple) return;
  try {
    gift.data = await giftApi('snapshot');
    if (render) renderAll();
  } catch (error) {
    if (!['UNAUTHORIZED', 'NO_DUKE_SPACE'].includes(error.code)) console.warn('Gift load error', error);
  }
}

function renderAll() {
  renderEntry();
  renderEditorValues();
  renderSceneList();
}

function renderEntry() {
  if (!gift.data || !$('#dukeGiftSection')) return;
  const settings = gift.data.settings || {};
  $('#giftEntryTitle').textContent = settings.title || 'Regalo para ti';
  $('#giftEntrySubtitle').textContent = settings.subtitle || 'Nuestra historia, contada con el corazón';
  $('#giftSceneCount').textContent = gift.data.slides?.length || 0;
  $('#dukeGiftSection').classList.toggle('hidden', settings.enabled === false);
  const button = $('#giftPlayButton');
  button.disabled = !(gift.data.slides?.length || settings.dedication);
  button.textContent = button.disabled ? 'Agrega el primer recuerdo' : '▶ Ver nuestra historia';
}

function renderEditorValues() {
  if (!gift.data || !$('#giftSettingsForm')) return;
  const settings = gift.data.settings || {};
  $('#giftTitleInput').value = settings.title || 'Regalo para ti';
  $('#giftSubtitleInput').value = settings.subtitle || '';
  $('#giftDedicationInput').value = settings.dedication || '';
  $('#giftThemeInput').value = settings.theme || 'cinema';
  $('#giftSecondsInput').value = settings.slide_seconds || 8;
  $('#giftEnabledInput').checked = settings.enabled !== false;
  const current = $('#giftCurrentMusic');
  const clear = $('#giftClearMusic');
  if (settings.background_audio) {
    current.textContent = `🎵 Canción actual: ${settings.background_audio_name || 'audio guardado'}`;
    current.classList.remove('hidden');
    clear.classList.remove('hidden');
  } else {
    current.classList.add('hidden');
    clear.classList.add('hidden');
  }
}

function thumbMarkup(slide) {
  const url = safeUrl(slide.media_url);
  if (slide.media_type === 'image' && url) return `<img src="${escapeText(url)}" alt="" />`;
  if (slide.media_type === 'video') return '🎬';
  return '💜';
}

function renderSceneList() {
  const root = $('#giftSceneList');
  if (!root || !gift.data) return;
  const slides = gift.data.slides || [];
  if (!slides.length) {
    root.innerHTML = '<div class="gift-scenes-empty">Todavía no hay escenas. Agrega una foto y cuenta su recuerdo.</div>';
    return;
  }
  root.innerHTML = slides.map((slide, index) => `
    <article class="gift-scene-item">
      <div class="gift-scene-thumb">${thumbMarkup(slide)}</div>
      <div class="gift-scene-copy"><strong>${index + 1}. ${escapeText(slide.title || 'Recuerdo sin título')}</strong><small>${escapeText(slide.date_label || slide.story_text || 'Escena de la historia')}</small></div>
      <div class="gift-scene-controls">
        <button data-gift-move="up" data-gift-id="${slide.id}" title="Subir">↑</button><button data-gift-move="down" data-gift-id="${slide.id}" title="Bajar">↓</button><button data-gift-edit="${slide.id}" title="Editar">✎</button><button data-gift-delete="${slide.id}" title="Eliminar">×</button>
      </div>
    </article>`).join('');
  root.querySelectorAll('[data-gift-edit]').forEach((button) => button.addEventListener('click', () => editScene(button.dataset.giftEdit)));
  root.querySelectorAll('[data-gift-delete]').forEach((button) => button.addEventListener('click', () => deleteScene(button.dataset.giftDelete)));
  root.querySelectorAll('[data-gift-move]').forEach((button) => button.addEventListener('click', () => moveScene(button.dataset.giftId, button.dataset.giftMove)));
}

function openEditor() {
  if (!gift.data) return toast('Duke todavía está cargando el regalo.', 'error');
  renderAll();
  const dialog = $('#giftEditorDialog');
  if (!dialog.open) dialog.showModal();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('INVALID_MEDIA');
  if (file.size > 15 * 1024 * 1024) throw new Error('MEDIA_TOO_LARGE');
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const output = canvas.toDataURL('image/jpeg', .68);
  if (output.length > 1_450_000) throw new Error('MEDIA_TOO_LARGE');
  return output;
}

async function audioValue(file, url, maxBytes) {
  if (file && url) throw new Error('CHOOSE_ONE_AUDIO');
  if (file) {
    if (!file.type.startsWith('audio/')) throw new Error('INVALID_AUDIO');
    if (file.size > maxBytes) throw new Error('MEDIA_TOO_LARGE');
    return fileToDataUrl(file);
  }
  const clean = String(url || '').trim();
  if (!clean) return undefined;
  if (!safeUrl(clean)) throw new Error('INVALID_AUDIO');
  return clean;
}

async function saveSettings(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const file = $('#giftMusicFile').files?.[0] || null;
    const url = $('#giftMusicUrl').value.trim();
    const audio = await audioValue(file, url, 1.6 * 1024 * 1024);
    const payload = {
      title: $('#giftTitleInput').value,
      subtitle: $('#giftSubtitleInput').value,
      dedication: $('#giftDedicationInput').value,
      theme: $('#giftThemeInput').value,
      slideSeconds: $('#giftSecondsInput').value,
      enabled: $('#giftEnabledInput').checked,
    };
    if (audio !== undefined) {
      payload.backgroundAudio = audio;
      payload.backgroundAudioName = file?.name || url.split('/').pop() || 'Canción del regalo';
    }
    gift.data = await giftApi('save_settings', payload);
    $('#giftMusicFile').value = '';
    $('#giftMusicUrl').value = '';
    renderAll();
    toast('Presentación guardada.', 'success');
  } catch (error) {
    const messages = { MEDIA_TOO_LARGE: 'La canción es muy grande. Usa un archivo menor de 1.6 MB o un enlace HTTPS.', CHOOSE_ONE_AUDIO: 'Elige un archivo o un enlace, no ambos.', INVALID_AUDIO: 'El audio no es válido.' };
    toast(messages[error.message] || messages[error.code] || 'No se pudo guardar la presentación.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function clearMusic() {
  try {
    gift.data = await giftApi('save_settings', {
      title: $('#giftTitleInput').value,
      subtitle: $('#giftSubtitleInput').value,
      dedication: $('#giftDedicationInput').value,
      theme: $('#giftThemeInput').value,
      slideSeconds: $('#giftSecondsInput').value,
      enabled: $('#giftEnabledInput').checked,
      clearAudio: true,
      backgroundAudio: '',
    });
    renderAll();
    toast('Canción eliminada.', 'success');
  } catch { toast('No se pudo quitar la canción.', 'error'); }
}

function updateMediaFields() {
  const type = $('#giftSceneMediaType').value;
  $('#giftSceneImage').disabled = type !== 'image';
  $('#giftSceneMediaUrl').placeholder = type === 'video' ? 'Enlace HTTPS del video o YouTube' : type === 'image' ? 'Enlace HTTPS alternativo de la foto' : 'No se necesita contenido';
  $('#giftSceneMediaUrl').disabled = type === 'none';
}

async function previewSelectedImage() {
  const file = $('#giftSceneImage').files?.[0];
  if (!file) return;
  const root = $('#giftMediaPreview');
  try {
    const url = URL.createObjectURL(file);
    root.innerHTML = `<img src="${url}" alt="Vista previa" />`;
    root.classList.add('visible');
  } catch {}
}

function previewMediaUrl() {
  const root = $('#giftMediaPreview');
  const url = safeUrl($('#giftSceneMediaUrl').value);
  if (!url) return;
  const type = $('#giftSceneMediaType').value;
  root.innerHTML = type === 'image' ? `<img src="${escapeText(url)}" alt="Vista previa" />` : '<span style="font-size:3rem">🎬</span>';
  root.classList.add('visible');
}

function resetSceneForm() {
  gift.editingId = null;
  const form = $('#giftSceneForm');
  form.reset();
  form.dataset.mediaUrl = '';
  form.dataset.narrationUrl = '';
  $('#giftSceneFormTitle').textContent = 'Agregar recuerdo';
  $('#giftSceneMediaType').value = 'image';
  $('#giftMediaPreview').innerHTML = '';
  $('#giftMediaPreview').classList.remove('visible');
  updateMediaFields();
  $('#giftSceneTitle').focus();
}

function editScene(id) {
  const slide = gift.data?.slides?.find((item) => item.id === id);
  if (!slide) return;
  gift.editingId = id;
  const form = $('#giftSceneForm');
  form.dataset.mediaUrl = slide.media_url || '';
  form.dataset.narrationUrl = slide.narration_url || '';
  $('#giftSceneFormTitle').textContent = 'Editar recuerdo';
  $('#giftSceneTitle').value = slide.title || '';
  $('#giftSceneDate').value = slide.date_label || '';
  $('#giftSceneText').value = slide.story_text || '';
  $('#giftSceneMediaType').value = slide.media_type || 'none';
  $('#giftSceneMediaUrl').value = slide.media_url?.startsWith('https://') ? slide.media_url : '';
  $('#giftSceneNarrationUrl').value = slide.narration_url?.startsWith('https://') ? slide.narration_url : '';
  $('#giftClearNarration').checked = false;
  const preview = $('#giftMediaPreview');
  const media = safeUrl(slide.media_url);
  if (slide.media_type === 'image' && media) {
    preview.innerHTML = `<img src="${escapeText(media)}" alt="Vista previa" />`;
    preview.classList.add('visible');
  } else if (slide.media_type === 'video' && media) {
    preview.innerHTML = '<span style="font-size:3rem">🎬</span>';
    preview.classList.add('visible');
  } else {
    preview.innerHTML = '';
    preview.classList.remove('visible');
  }
  updateMediaFields();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveScene(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const form = event.currentTarget;
    const mediaType = $('#giftSceneMediaType').value;
    const imageFile = $('#giftSceneImage').files?.[0] || null;
    const mediaUrlInput = $('#giftSceneMediaUrl').value.trim();
    let mediaUrl = form.dataset.mediaUrl || null;
    if (mediaType === 'none') mediaUrl = null;
    else if (imageFile) mediaUrl = await compressImage(imageFile);
    else if (mediaUrlInput) {
      mediaUrl = safeUrl(mediaUrlInput);
      if (!mediaUrl) throw new Error('INVALID_MEDIA');
    }
    if (mediaType === 'video' && !mediaUrl) throw new Error('VIDEO_URL_REQUIRED');

    const narrationFile = $('#giftSceneNarration').files?.[0] || null;
    const narrationInput = $('#giftSceneNarrationUrl').value.trim();
    let narrationUrl = $('#giftClearNarration').checked ? null : (form.dataset.narrationUrl || null);
    const newNarration = await audioValue(narrationFile, narrationInput, 1.2 * 1024 * 1024);
    if (newNarration !== undefined) narrationUrl = newNarration;

    const payload = {
      slideId: gift.editingId,
      title: $('#giftSceneTitle').value,
      dateLabel: $('#giftSceneDate').value,
      storyText: $('#giftSceneText').value,
      mediaType,
      mediaUrl,
      narrationUrl,
      narrationName: narrationFile?.name || (narrationUrl ? 'Narración del recuerdo' : ''),
    };
    gift.data = await giftApi(gift.editingId ? 'slide_update' : 'slide_add', payload);
    renderAll();
    resetSceneForm();
    toast(gift.editingId ? 'Recuerdo actualizado.' : 'Recuerdo agregado.', 'success');
  } catch (error) {
    const messages = { MEDIA_TOO_LARGE: 'El archivo es demasiado grande.', INVALID_MEDIA: 'La foto o el enlace no es válido.', INVALID_AUDIO: 'La narración no es válida.', CHOOSE_ONE_AUDIO: 'Elige un archivo o un enlace para la narración.', VIDEO_URL_REQUIRED: 'Para el video debes pegar un enlace HTTPS.' };
    toast(messages[error.message] || messages[error.code] || 'No se pudo guardar el recuerdo.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function deleteScene(id) {
  if (!confirm('¿Eliminar este recuerdo de la película?')) return;
  try {
    gift.data = await giftApi('slide_delete', { slideId: id });
    if (gift.editingId === id) resetSceneForm();
    renderAll();
    toast('Recuerdo eliminado.', 'success');
  } catch { toast('No se pudo eliminar el recuerdo.', 'error'); }
}

async function moveScene(id, direction) {
  try {
    gift.data = await giftApi('slide_move', { slideId: id, direction });
    renderSceneList();
  } catch { toast('No se pudo cambiar el orden.', 'error'); }
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    let id = '';
    if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1).split('/')[0];
    if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1` : '';
  } catch { return ''; }
}

function directVideo(url) {
  return /\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(url);
}

function sceneMediaMarkup(slide) {
  const url = safeUrl(slide.media_url);
  if (slide.media_type === 'image' && url) return `<img src="${escapeText(url)}" alt="${escapeText(slide.title || 'Recuerdo')}" />`;
  if (slide.media_type === 'video' && url) {
    const embed = youtubeEmbed(url);
    if (embed) return `<iframe src="${escapeText(embed)}" title="${escapeText(slide.title || 'Video del recuerdo')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    if (directVideo(url)) return `<video src="${escapeText(url)}" autoplay muted loop playsinline></video>`;
    return `<div class="gift-media-placeholder"><span>🎬</span></div>`;
  }
  return '<div class="gift-media-placeholder"><span>💜</span></div>';
}

function totalScenes() {
  return (gift.data?.slides?.length || 0) + 2;
}

function currentProgress() {
  return Math.max(0, Math.min(100, ((gift.current + 2) / totalScenes()) * 100));
}

function renderTheaterScene() {
  const root = $('#giftScene');
  if (!root || !gift.data) return;
  const settings = gift.data.settings || {};
  const slides = gift.data.slides || [];
  $('#giftTheater').dataset.theme = settings.theme || 'cinema';
  $('#giftProgress').style.width = `${currentProgress()}%`;

  if (gift.current === -1) {
    root.innerHTML = `<div class="gift-intro"><div class="gift-intro-inner"><div class="gift-intro-heart">💜</div><p class="eyebrow">UNA HISTORIA DE DOS</p><h1>${escapeText(settings.title || 'Regalo para ti')}</h1><h2>${escapeText(settings.subtitle || '')}</h2>${settings.dedication ? `<p>${escapeText(settings.dedication)}</p>` : ''}</div></div>`;
    return;
  }
  if (gift.current >= slides.length) {
    root.innerHTML = `<div class="gift-final"><div><span>💞</span><p class="eyebrow">Y ESTO APENAS COMIENZA</p><h1>Continuará...</h1><p>Porque todavía les quedan muchos recuerdos por crear juntos.</p></div></div>`;
    return;
  }
  const slide = slides[gift.current];
  root.innerHTML = `<div class="gift-media">${sceneMediaMarkup(slide)}<div class="gift-story-copy">${slide.date_label ? `<span class="gift-date">${escapeText(slide.date_label)}</span>` : ''}<h1>${escapeText(slide.title || 'Un recuerdo de nosotros')}</h1>${slide.story_text ? `<p>${escapeText(slide.story_text)}</p>` : ''}</div></div>`;
}

function dogElement() {
  return $('#giftDogCharacter .duke-dog');
}

function setDogSpeech(text, mode = 'talking') {
  const bubble = $('#giftDogBubble');
  if (bubble) {
    bubble.textContent = text;
    bubble.classList.toggle('visible', Boolean(text));
  }
  const dog = dogElement();
  if (!dog) return;
  dog.classList.remove('talking', 'listening', 'excited');
  if (mode) dog.classList.add(mode);
}

function stopDogSpeech() {
  const dog = dogElement();
  dog?.classList.remove('talking', 'listening');
  setTimeout(() => $('#giftDogBubble')?.classList.remove('visible'), 500);
}

function selectedVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find((voice) => /^es/i.test(voice.lang) && /female|mujer|paulina|monica|luciana|helena|sabina|soledad/i.test(voice.name))
    || voices.find((voice) => /^es/i.test(voice.lang))
    || voices[0];
}

function speakDog(text, options = {}) {
  if (!gift.voiceEnabled || !('speechSynthesis' in window) || !text) return Promise.resolve();
  return new Promise((resolve) => {
    if (options.cancel !== false) speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.voice = selectedVoice();
    utterance.pitch = options.pitch || 1.62;
    utterance.rate = options.rate || 1.08;
    utterance.volume = .88;
    utterance.onstart = () => setDogSpeech(text, options.mode || 'talking');
    utterance.onend = () => { stopDogSpeech(); resolve(); };
    utterance.onerror = () => { stopDogSpeech(); resolve(); };
    speechSynthesis.speak(utterance);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fadeAudio(audio, target, duration = 900) {
  if (!audio) return Promise.resolve();
  const start = audio.volume;
  const started = performance.now();
  return new Promise((resolve) => {
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * progress));
      if (progress < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

async function runMusicCue(token) {
  if (gift.cuePlayed || !gift.bgAudio || !gift.musicEnabled || token !== gift.sceneToken) return;
  gift.cuePlayed = true;
  setDogSpeech('¿Escuchas eso?', 'listening');
  await speakDog('¿Escuchas eso?', { mode: 'listening' });
  if (token !== gift.sceneToken) return;
  $('#giftMusicPulse').classList.add('visible');
  await fadeAudio(gift.bgAudio, .46, 900);
  await wait(2600);
  if (token !== gift.sceneToken) return;
  await fadeAudio(gift.bgAudio, gift.baseVolume, 1500);
  $('#giftMusicPulse').classList.remove('visible');
  await speakDog('¿Escuchas la canción que te dedicaron?', { pitch: 1.68, rate: 1.04 });
}

function narrationText(slide, index) {
  const opener = annoyingOpeners[index % annoyingOpeners.length];
  const main = [slide.title, slide.story_text].filter(Boolean).join('. ');
  return `${opener} ${main || 'Mira este recuerdo tan bonito.'}`;
}

function playNarration(url) {
  return new Promise((resolve) => {
    const safe = safeUrl(url);
    if (!safe) return resolve();
    const audio = new Audio(safe);
    gift.narrationAudio = audio;
    audio.volume = .94;
    setDogSpeech('Escucha este recuerdo...', 'listening');
    audio.onended = () => { gift.narrationAudio = null; stopDogSpeech(); resolve(); };
    audio.onerror = () => { gift.narrationAudio = null; stopDogSpeech(); resolve(); };
    audio.play().catch(() => { gift.narrationAudio = null; stopDogSpeech(); resolve(); });
  });
}

async function narrateCurrent(token) {
  const slides = gift.data?.slides || [];
  const settings = gift.data?.settings || {};
  if (gift.current === -1) {
    const intro = `Oye, oye... sí, tú. ${settings.title || 'Tengo un regalo para ti'}. ${settings.dedication || 'No te distraigas, porque esta historia es de ustedes.'}`;
    await speakDog(intro, { pitch: 1.66 });
    return;
  }
  if (gift.current >= slides.length) {
    await speakDog('Ajá... ¿pensaste que ya terminamos? No. Esto apenas comienza. Todavía faltan muchísimos recuerdos.', { pitch: 1.7 });
    return;
  }
  const slide = slides[gift.current];
  const cueIndex = slides.length > 1 ? 1 : 0;
  if (gift.current === cueIndex && gift.bgAudio && !gift.cuePlayed) await runMusicCue(token);
  if (token !== gift.sceneToken) return;
  if (slide.narration_url) await playNarration(slide.narration_url);
  else await speakDog(narrationText(slide, gift.current));
}

function clearScenePlayback() {
  clearTimeout(gift.nextTimer);
  gift.nextTimer = null;
  gift.sceneToken += 1;
  speechSynthesis?.cancel?.();
  if (gift.narrationAudio) {
    gift.narrationAudio.pause();
    gift.narrationAudio = null;
  }
  stopDogSpeech();
}

async function playCurrentScene() {
  clearScenePlayback();
  const token = gift.sceneToken;
  renderTheaterScene();
  const started = Date.now();
  await narrateCurrent(token);
  if (!gift.playing || token !== gift.sceneToken) return;
  const seconds = Math.max(4, Number(gift.data?.settings?.slide_seconds || 8));
  const remaining = Math.max(1600, seconds * 1000 - (Date.now() - started));
  gift.nextTimer = setTimeout(nextScene, remaining);
}

async function startTheater() {
  if (!gift.data) await loadGift(false);
  if (!gift.data) return toast('No se pudo cargar el regalo.', 'error');
  const settings = gift.data.settings || {};
  if (!(gift.data.slides?.length || settings.dedication)) return openEditor();
  gift.playing = true;
  gift.current = -1;
  gift.cuePlayed = false;
  gift.voiceEnabled = true;
  gift.musicEnabled = true;
  $('#giftPause').textContent = '⏸';
  $('#giftVoiceToggle').textContent = '🗣️ Voz';
  $('#giftMusicToggle').textContent = '🎵 Música';
  $('#giftTheater').classList.remove('hidden');
  $('#giftTheater').tabIndex = -1;
  $('#giftTheater').focus();
  document.body.style.overflow = 'hidden';
  if (settings.background_audio) {
    gift.bgAudio = new Audio(safeUrl(settings.background_audio));
    gift.bgAudio.loop = true;
    gift.bgAudio.volume = 0;
    await gift.bgAudio.play().catch(() => {});
    fadeAudio(gift.bgAudio, gift.baseVolume, 1200);
  }
  playCurrentScene();
}

function stopTheater() {
  gift.playing = false;
  clearScenePlayback();
  if (gift.bgAudio) {
    gift.bgAudio.pause();
    gift.bgAudio = null;
  }
  $('#giftMusicPulse')?.classList.remove('visible');
  $('#giftTheater')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function nextScene() {
  if (!gift.playing) return;
  const slides = gift.data?.slides || [];
  if (gift.current >= slides.length) return stopTheater();
  gift.current += 1;
  playCurrentScene();
}

function previousScene() {
  if (!gift.playing) return;
  gift.current = Math.max(-1, gift.current - 1);
  playCurrentScene();
}

function togglePause() {
  gift.playing = !gift.playing;
  $('#giftPause').textContent = gift.playing ? '⏸' : '▶';
  if (!gift.playing) {
    clearTimeout(gift.nextTimer);
    speechSynthesis?.pause?.();
    gift.narrationAudio?.pause();
    gift.bgAudio?.pause();
  } else {
    speechSynthesis?.resume?.();
    gift.narrationAudio?.play().catch(() => {});
    if (gift.musicEnabled) gift.bgAudio?.play().catch(() => {});
    playCurrentScene();
  }
}

function toggleVoice() {
  gift.voiceEnabled = !gift.voiceEnabled;
  $('#giftVoiceToggle').textContent = gift.voiceEnabled ? '🗣️ Voz' : '🔇 Voz';
  if (!gift.voiceEnabled) {
    speechSynthesis?.cancel?.();
    gift.narrationAudio?.pause();
    gift.narrationAudio = null;
    stopDogSpeech();
  }
}

function toggleMusic() {
  gift.musicEnabled = !gift.musicEnabled;
  $('#giftMusicToggle').textContent = gift.musicEnabled ? '🎵 Música' : '🔇 Música';
  if (!gift.bgAudio) return;
  if (gift.musicEnabled) {
    gift.bgAudio.play().catch(() => {});
    fadeAudio(gift.bgAudio, gift.baseVolume, 500);
  } else {
    fadeAudio(gift.bgAudio, 0, 400).then(() => gift.bgAudio?.pause());
  }
}

function handleTheaterKeys(event) {
  if (event.key === 'Escape') stopTheater();
  if (event.key === 'ArrowRight') nextScene();
  if (event.key === 'ArrowLeft') previousScene();
  if (event.key === ' ') { event.preventDefault(); togglePause(); }
}

function initGiftStory() {
  if (gift.initialized) return;
  gift.initialized = true;
  addStylesheet();
  buildEditor();
  buildTheater();
  const mount = () => {
    if (!buildEntry()) return setTimeout(mount, 350);
    loadGift(true);
  };
  mount();
  clearInterval(gift.poller);
  gift.poller = setInterval(() => { if (!gift.playing && !$('#giftEditorDialog')?.open) loadGift(true); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !gift.playing) loadGift(true); });
}

export { initGiftStory };
