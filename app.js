import('/src/events.js')
  .then(({ init }) => init())
  .catch((error) => {
    console.error('Duke init error:', error);
    const root = document.getElementById('gateScreen');
    const title = document.getElementById('gateTitle');
    const text = document.getElementById('gateText');
    const loader = document.getElementById('gateLoader');
    if (root) root.classList.remove('hidden');
    if (title) title.textContent = 'Duke no pudo iniciar';
    if (text) text.textContent = 'Actualiza la página. Si el problema continúa, revisa la configuración de Vercel y Neon.';
    if (loader) loader.classList.add('hidden');
  });
