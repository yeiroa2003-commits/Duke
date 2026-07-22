import { $, api, toast, closeDialog, loadSession, imageToDataUrl } from './core.js';

const extraMoods = [
  ['Tranquilo/a', '😌'], ['Emocionado/a', '🤩'], ['Agradecido/a', '🙏'], ['Ansioso/a', '😰'],
  ['Estresado/a', '😵‍💫'], ['Orgulloso/a', '🥹'], ['Romántico/a', '🌹'], ['Juguetón/a', '😜'],
  ['Con energía', '⚡'], ['Enfermo/a', '🤒'], ['Reflexivo/a', '🤔'], ['Necesito cariño', '🤗'],
  ['Molesto/a', '😤'], ['Confundido/a', '😕'], ['Esperanzado/a', '🌟'], ['En paz', '🕊️'],
];

function injectStyles() {
  if ($('#relationshipPlusStyles')) return;
  const style = document.createElement('style');
  style.id = 'relationshipPlusStyles';
  style.textContent = `
    .mood-picker{grid-template-columns:repeat(auto-fit,minmax(105px,1fr))!important;max-height:52vh;overflow:auto;padding-right:4px}
    .mood-custom{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:14px}.mood-custom button{white-space:nowrap}
    .memory-video-note{font-size:.76rem;color:var(--muted);line-height:1.45;margin:-4px 0 2px}
    .memory-card video,.memory-card iframe{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border:0;background:#05040a}
    .memory-card video{max-height:430px}.memory-card iframe{min-height:250px}
    .memory-video-link{display:grid;place-items:center;min-height:210px;padding:24px;text-decoration:none;color:white;background:radial-gradient(circle at top,rgba(139,92,246,.3),rgba(5,4,10,.96));text-align:center}
    .memory-video-link span{display:block;font-size:2.8rem;margin-bottom:10px}.memory-video-link small{color:var(--muted);margin-top:7px}
    @media(max-width:600px){.mood-picker{grid-template-columns:repeat(2,1fr)!important}.mood-custom{grid-template-columns:1fr}.memory-card iframe{min-height:210px}}
  `;
  document.head.append(style);
}

async function setMood(text, emoji) {
  try {
    await api('mood', { method: 'POST', body: { text, emoji } });
    closeDialog('moodDialog');
    await loadSession(false);
    toast(`Estado actualizado: ${emoji} ${text}`, 'success');
  } catch (error) {
    toast(error.code || 'No se pudo actualizar el estado.', 'error');
  }
}

function enhanceMoods() {
  const picker = $('.mood-picker');
  if (!picker || $('#customMoodText')) return;

  for (const [text, emoji] of extraMoods) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `${emoji}<small>${text}</small>`;
    button.addEventListener('click', () => setMood(text, emoji));
    picker.append(button);
  }

  const custom = document.createElement('div');
  custom.className = 'mood-custom';
  custom.innerHTML = `
    <input id="customMoodText" maxlength="50" placeholder="Escribe tu propio estado…" />
    <button id="saveCustomMood" class="secondary-btn" type="button">Guardar ✨</button>`;
  picker.after(custom);
  $('#saveCustomMood').addEventListener('click', () => {
    const text = $('#customMoodText').value.trim();
    if (!text) return toast('Escribe cómo te sientes.', 'error');
    setMood(text, '✨');
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('VIDEO_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

function normalizeVideoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) throw new Error('INVALID_VIDEO_URL');
  return `duke-video:${url}`;
}

async function memoryMediaValue(file, externalUrl) {
  if (file) {
    if (file.type.startsWith('image/')) return imageToDataUrl(file);
    if (file.type.startsWith('video/')) {
      if (file.size > 1.8 * 1024 * 1024) throw new Error('VIDEO_TOO_LARGE');
      return fileToDataUrl(file);
    }
    throw new Error('INVALID_MEDIA');
  }
  return normalizeVideoUrl(externalUrl);
}

function enhanceMemoryForm() {
  const form = $('#memoryForm');
  const input = $('#memoryImageInput');
  if (!form || !input || $('#memoryVideoUrlInput')) return;

  input.accept = 'image/*,video/mp4,video/webm,video/quicktime';
  const label = input.closest('label');
  if (label?.firstChild) label.firstChild.textContent = 'Foto o video corto ';

  const urlLabel = document.createElement('label');
  urlLabel.innerHTML = `Video por enlace
    <input id="memoryVideoUrlInput" type="url" placeholder="YouTube o enlace directo al video" />
    <small class="memory-video-note">Los videos subidos directamente deben pesar menos de 1.8 MB. Para videos largos usa un enlace.</small>`;
  label?.after(urlLabel);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = event.submitter || form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const file = input.files?.[0] || null;
      const externalUrl = $('#memoryVideoUrlInput').value;
      if (file && externalUrl) return toast('Elige un archivo o un enlace, no ambos.', 'error');
      const mediaUrl = await memoryMediaValue(file, externalUrl);
      await api('add_memory', {
        method: 'POST',
        body: {
          title: $('#memoryTitleInput').value,
          description: $('#memoryDescriptionInput').value,
          memoryDate: $('#memoryDateInput').value || null,
          mediaUrl: mediaUrl || null,
        },
      });
      form.reset();
      closeDialog('memoryDialog');
      await loadSession(false);
      toast(mediaUrl?.startsWith('data:video/') || mediaUrl?.startsWith('duke-video:') ? 'Video guardado en sus recuerdos.' : 'Recuerdo guardado.', 'success');
    } catch (error) {
      const messages = {
        VIDEO_TOO_LARGE: 'El video es muy grande. Usa uno menor de 1.8 MB o pega un enlace.',
        INVALID_VIDEO_URL: 'El enlace del video no es válido.',
        INVALID_MEDIA: 'Solo puedes seleccionar una foto o un video.',
        IMAGE_TOO_LARGE: 'La imagen es demasiado grande.',
      };
      toast(messages[error.message] || messages[error.code] || 'No se pudo guardar el recuerdo.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }, true);
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    let id = '';
    if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1).split('/')[0];
    if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
  } catch {
    return '';
  }
}

function transformMemoryMedia() {
  document.querySelectorAll('#memoriesGrid .memory-card img').forEach((image) => {
    const raw = image.getAttribute('src') || '';
    const isDataVideo = raw.startsWith('data:video/');
    const markedVideo = raw.startsWith('duke-video:');
    const directUrl = markedVideo ? raw.slice('duke-video:'.length) : raw;
    const isVideoFile = /\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(directUrl);
    const embed = markedVideo ? youtubeEmbed(directUrl) : '';
    if (!isDataVideo && !markedVideo && !isVideoFile) return;

    if (embed) {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.title = image.alt || 'Video del recuerdo';
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      image.replaceWith(iframe);
      return;
    }

    if (isDataVideo || isVideoFile) {
      const video = document.createElement('video');
      video.src = isDataVideo ? raw : directUrl;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', image.alt || 'Video del recuerdo');
      image.replaceWith(video);
      return;
    }

    const link = document.createElement('a');
    link.className = 'memory-video-link';
    link.href = directUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = '<div><span>🎬</span><strong>Abrir video del recuerdo</strong><small>El video se abrirá en una pestaña nueva.</small></div>';
    image.replaceWith(link);
  });
}

function watchMemories() {
  const grid = $('#memoriesGrid');
  if (!grid) return;
  transformMemoryMedia();
  const observer = new MutationObserver(transformMemoryMedia);
  observer.observe(grid, { childList: true, subtree: true });
}

function initRelationshipPlus() {
  injectStyles();
  enhanceMoods();
  enhanceMemoryForm();
  watchMemories();
}

export { initRelationshipPlus };
