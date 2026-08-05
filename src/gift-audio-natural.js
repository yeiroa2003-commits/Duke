import { toast } from './core.js';

const musicLevels = [0.36, 0.5, 0.65];
let selectedMusicLevel = Number.parseFloat(localStorage.getItem('duke_gift_music_level') || '0.5');
if (!musicLevels.includes(selectedMusicLevel)) selectedMusicLevel = 0.5;

let activeGiftMusic = null;
let nativeMediaPlay = null;
let monitorTimer = null;
let initialized = false;
let cachedNaturalVoice = null;

function theaterIsOpen() {
  const theater = document.getElementById('giftTheater');
  return Boolean(theater && !theater.classList.contains('hidden'));
}

function chooseNaturalSpanishVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return cachedNaturalVoice;

  const spanish = voices.filter((voice) => /^es(?:-|$)/i.test(voice.lang || ''));
  const candidates = spanish.length ? spanish : voices;
  const preferredNames = /natural|neural|premium|enhanced|google|microsoft|monica|mónica|paulina|luciana|lucia|lucía|helena|soledad|dalia|elvira|alvaro|álvaro|jorge|diego/i;
  const roboticNames = /espeak|compact|classic|basic/i;

  cachedNaturalVoice = [...candidates].sort((left, right) => {
    const score = (voice) => {
      let value = 0;
      if (/^es-(VE|MX|US|ES|CO|AR)/i.test(voice.lang || '')) value += 5;
      if (preferredNames.test(voice.name || '')) value += 8;
      if (voice.localService) value += 2;
      if (voice.default) value += 1;
      if (roboticNames.test(voice.name || '')) value -= 8;
      return value;
    };
    return score(right) - score(left);
  })[0] || null;

  return cachedNaturalVoice;
}

function patchDukeVoice() {
  if (!('speechSynthesis' in window) || speechSynthesis.__dukeNaturalVoice) return;
  const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);

  try {
    speechSynthesis.speak = (utterance) => {
      if (theaterIsOpen() && utterance instanceof SpeechSynthesisUtterance) {
        const voice = chooseNaturalSpanishVoice();
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || 'es-ES';
        } else {
          utterance.lang = 'es-ES';
        }
        utterance.pitch = 1.02;
        utterance.rate = 0.95;
        utterance.volume = 1;
      }
      return nativeSpeak(utterance);
    };
    speechSynthesis.__dukeNaturalVoice = true;
  } catch (error) {
    console.warn('No se pudo ajustar la voz de Duke:', error);
  }

  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedNaturalVoice = null;
    chooseNaturalSpanishVoice();
  });
  chooseNaturalSpanishVoice();
}

function controlGroup() {
  return document.querySelector('#giftTheater .gift-top-controls > div:last-child');
}

function updateVolumeButton() {
  const button = document.getElementById('giftMusicLevelButton');
  if (button) button.textContent = `🔊 ${Math.round(selectedMusicLevel * 100)}%`;
}

function showAudioRescue(message = 'Activar canción') {
  const button = document.getElementById('giftAudioRescueButton');
  if (!button) return;
  button.textContent = `▶ ${message}`;
  button.classList.remove('hidden');
}

function hideAudioRescue() {
  document.getElementById('giftAudioRescueButton')?.classList.add('hidden');
}

async function rescueMusic() {
  if (!activeGiftMusic) {
    toast('No hay una canción cargada en este regalo.', 'error');
    return;
  }

  try {
    activeGiftMusic.muted = false;
    activeGiftMusic.defaultMuted = false;
    activeGiftMusic.volume = selectedMusicLevel;
    await nativeMediaPlay.call(activeGiftMusic);
    hideAudioRescue();
    toast('Canción activada.', 'success');
  } catch {
    showAudioRescue('Toca otra vez');
    toast('El teléfono sigue bloqueando el audio. Sube el volumen multimedia y toca nuevamente.', 'error');
  }
}

function cycleMusicLevel() {
  const currentIndex = musicLevels.indexOf(selectedMusicLevel);
  selectedMusicLevel = musicLevels[(currentIndex + 1) % musicLevels.length];
  localStorage.setItem('duke_gift_music_level', String(selectedMusicLevel));
  updateVolumeButton();

  const musicMuted = document.getElementById('giftMusicToggle')?.textContent.includes('🔇');
  if (activeGiftMusic && !musicMuted) {
    activeGiftMusic.muted = false;
    activeGiftMusic.volume = selectedMusicLevel;
  }
}

function mountAudioControls() {
  const group = controlGroup();
  if (!group) return false;

  if (!document.getElementById('giftMusicLevelButton')) {
    const levelButton = document.createElement('button');
    levelButton.id = 'giftMusicLevelButton';
    levelButton.type = 'button';
    levelButton.className = 'gift-theater-btn';
    levelButton.addEventListener('click', cycleMusicLevel);
    group.append(levelButton);
  }

  if (!document.getElementById('giftAudioRescueButton')) {
    const rescueButton = document.createElement('button');
    rescueButton.id = 'giftAudioRescueButton';
    rescueButton.type = 'button';
    rescueButton.className = 'gift-theater-btn gift-audio-rescue hidden';
    rescueButton.textContent = '▶ Activar canción';
    rescueButton.addEventListener('click', rescueMusic);
    group.append(rescueButton);
  }

  updateVolumeButton();
  return true;
}

function patchGiftMusicPlayback() {
  if (HTMLMediaElement.prototype.__dukeGiftAudioPatched) return;
  nativeMediaPlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function patchedPlay(...args) {
    const isGiftBackgroundMusic = theaterIsOpen()
      && this instanceof HTMLAudioElement
      && this.loop === true;

    if (isGiftBackgroundMusic) {
      activeGiftMusic = this;
      this.preload = 'auto';
      this.muted = false;
      this.defaultMuted = false;
      if (this.volume <= 0.02) this.volume = 0.03;
    }

    let result;
    try {
      result = nativeMediaPlay.apply(this, args);
    } catch (error) {
      if (isGiftBackgroundMusic) showAudioRescue();
      throw error;
    }

    if (!isGiftBackgroundMusic || !result?.then) return result;

    return result.then(() => {
      hideAudioRescue();
      window.setTimeout(() => {
        const musicMuted = document.getElementById('giftMusicToggle')?.textContent.includes('🔇');
        if (activeGiftMusic === this && theaterIsOpen() && !musicMuted && !this.paused) {
          this.volume = Math.max(this.volume, selectedMusicLevel);
        }
      }, 1350);
    }).catch(() => {
      showAudioRescue();
      return undefined;
    });
  };

  HTMLMediaElement.prototype.__dukeGiftAudioPatched = true;
}

function startVolumeMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = window.setInterval(() => {
    if (!theaterIsOpen()) {
      hideAudioRescue();
      return;
    }

    mountAudioControls();
    if (!activeGiftMusic) return;

    const musicMuted = document.getElementById('giftMusicToggle')?.textContent.includes('🔇');
    const pausedByPresentation = document.getElementById('giftPause')?.textContent === '▶';
    if (!musicMuted && !pausedByPresentation && !activeGiftMusic.paused) {
      activeGiftMusic.muted = false;
      if (activeGiftMusic.volume < selectedMusicLevel) activeGiftMusic.volume = selectedMusicLevel;
    }
  }, 260);
}

function watchTheater() {
  const observer = new MutationObserver(() => {
    mountAudioControls();
    if (!theaterIsOpen()) {
      activeGiftMusic = null;
      return;
    }

    window.setTimeout(() => {
      if (theaterIsOpen() && activeGiftMusic?.paused) showAudioRescue();
    }, 900);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function initGiftAudioNatural() {
  if (initialized) return;
  initialized = true;
  patchDukeVoice();
  patchGiftMusicPlayback();
  mountAudioControls();
  startVolumeMonitor();
  watchTheater();
}

export { initGiftAudioNatural };
