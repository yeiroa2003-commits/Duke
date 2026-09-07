(() => {
  'use strict';

  const KEY = 'emelwash_data_v1';
  const API_URL = '/api/memel';
  const BRAND = 'MEMEL WASH';
  const LEGACY_BRAND = 'EMEL WASH';
  const nativeSetItem = Storage.prototype.setItem;
  let hydrated = false;
  let syncing = false;
  let queuedState = null;

  function defaultState() {
    return {
      settings: { businessName: BRAND, currency: 'USD', defaultCommission: 30 },
      clients: [], employees: [], washes: []
    };
  }

  function normalize(value) {
    const state = value && typeof value === 'object' ? value : defaultState();
    state.settings = { ...defaultState().settings, ...(state.settings || {}) };
    if (!state.settings.businessName || state.settings.businessName === LEGACY_BRAND) state.settings.businessName = BRAND;
    state.clients = Array.isArray(state.clients) ? state.clients : [];
    state.employees = Array.isArray(state.employees) ? state.employees : [];
    state.washes = Array.isArray(state.washes) ? state.washes : [];
    return state;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch {
      return defaultState();
    }
  }

  function setLocal(state) {
    nativeSetItem.call(localStorage, KEY, JSON.stringify(normalize(state)));
  }

  function statusNodes() {
    return {
      title: document.getElementById('storageStatusTitle') || document.querySelector('.sidebar-footer strong'),
      text: document.getElementById('storageStatusText') || document.querySelector('.sidebar-footer small'),
      dot: document.getElementById('databaseStatusDot') || document.querySelector('.sidebar-footer .status-dot')
    };
  }

  function setStatus(mode, detail) {
    const { title, text, dot } = statusNodes();
    if (title) title.textContent = mode === 'online' ? 'Base sincronizada' : mode === 'syncing' ? 'Sincronizando…' : 'Modo local';
    if (text) text.textContent = detail || (mode === 'online' ? 'Neon conectada' : mode === 'syncing' ? 'Guardando cambios' : 'Sin conexión a Neon');
    if (dot) {
      const color = mode === 'online' ? '#3ddc97' : mode === 'syncing' ? '#f5bd4d' : '#ff6b78';
      dot.style.background = color;
      dot.style.boxShadow = `0 0 0 5px ${mode === 'online' ? 'rgba(61,220,151,.09)' : mode === 'syncing' ? 'rgba(245,189,77,.09)' : 'rgba(255,107,120,.09)'}`;
    }
  }

  async function fetchWithTimeout(url, options = {}, timeout = 3500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function pushState(state) {
    queuedState = normalize(state);
    if (syncing) return;
    syncing = true;
    setStatus('syncing', 'Guardando en Neon');
    try {
      while (queuedState) {
        const next = queuedState;
        queuedState = null;
        const response = await fetchWithTimeout(API_URL, {
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: next })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
      }
      setStatus('online', 'Neon conectada');
    } catch (error) {
      console.warn('MEMEL WASH: sincronización pendiente', error);
      setStatus('offline', 'Cambios guardados localmente');
    } finally {
      syncing = false;
      if (queuedState) void pushState(queuedState);
    }
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (this === localStorage && key === KEY) {
      try {
        const state = normalize(JSON.parse(value));
        nativeSetItem.call(this, key, JSON.stringify(state));
        if (hydrated) void pushState(state);
        return;
      } catch {
        // Mantiene el comportamiento nativo para valores no JSON.
      }
    }
    return nativeSetItem.call(this, key, value);
  };

  async function hydrate() {
    setStatus('syncing', 'Conectando con Neon');
    const localState = readLocal();
    setLocal(localState);

    try {
      const response = await fetchWithTimeout(API_URL, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
      if (data.state) setLocal(data.state);
      else await pushState(localState);
      setStatus('online', 'Neon conectada');
    } catch (error) {
      console.warn('MEMEL WASH: usando copia local', error);
      setStatus('offline', 'Usando copia local');
    } finally {
      hydrated = true;
    }
  }

  function replaceBrandText() {
    document.title = document.title.replaceAll(LEGACY_BRAND, BRAND);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeValue?.includes(LEGACY_BRAND)) node.nodeValue = node.nodeValue.replaceAll(LEGACY_BRAND, BRAND);
    }

    const input = document.getElementById('businessNameInput');
    if (input && (!input.value || input.value === LEGACY_BRAND)) input.value = BRAND;
    const mark = document.querySelector('.brand-mark');
    if (mark && mark.textContent.trim() === 'EW') mark.textContent = 'MW';
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.setAttribute('href', '/assets/memel-wash-icon.svg');

    const info = document.querySelector('#settingsView .panel.full .section-copy');
    if (info) info.textContent = 'MEMEL WASH utiliza la base de datos Neon que ya estaba conectada al repositorio. Los cambios se sincronizan con la base de datos y se conserva una copia local de respaldo.';
  }

  function installBrandGuard() {
    replaceBrandText();
    const observer = new MutationObserver(replaceBrandText);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }

  function installMemelExport() {
    const button = document.getElementById('exportDataButton');
    if (!button) return;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const payload = { app: BRAND, exportedAt: new Date().toISOString(), data: readLocal() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memel-wash-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, true);
  }

  function loadLegacyApp() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `/legacy-app.js?build=memel-neon-1`;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  window.MEMEL_DB_READY = (async () => {
    await hydrate();
    installBrandGuard();
    installMemelExport();
    await loadLegacyApp();
    replaceBrandText();
  })().catch((error) => {
    console.error('MEMEL WASH no pudo iniciar completamente', error);
  });
})();
