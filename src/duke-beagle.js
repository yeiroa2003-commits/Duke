let beagleSequence = 0;

function beagleSvgMarkup() {
  beagleSequence += 1;
  const uid = `dukeBeagle${beagleSequence}`;
  return `
    <svg viewBox="0 0 250 250" role="img" aria-labelledby="${uid}Title ${uid}Desc">
      <title id="${uid}Title">Duke, el beagle narrador</title>
      <desc id="${uid}Desc">Perrito beagle tricolor animado y delgado, con orejas largas, franja blanca corta, lomo negro, parte inferior manchada y collar azul.</desc>
      <defs>
        <linearGradient id="${uid}Tan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d99a55"/>
          <stop offset=".48" stop-color="#b96932"/>
          <stop offset="1" stop-color="#8f461f"/>
        </linearGradient>
        <linearGradient id="${uid}Ear" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stop-color="#9c522b"/>
          <stop offset="1" stop-color="#62301f"/>
        </linearGradient>
        <linearGradient id="${uid}Black" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#29231f"/>
          <stop offset=".58" stop-color="#111317"/>
          <stop offset="1" stop-color="#050608"/>
        </linearGradient>
        <linearGradient id="${uid}White" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fffdf4"/>
          <stop offset=".7" stop-color="#eee5d4"/>
          <stop offset="1" stop-color="#d9cbb7"/>
        </linearGradient>
        <linearGradient id="${uid}Blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2563eb"/>
          <stop offset=".52" stop-color="#173fb7"/>
          <stop offset="1" stop-color="#0d246b"/>
        </linearGradient>
        <radialGradient id="${uid}Eye" cx="38%" cy="30%" r="72%">
          <stop offset="0" stop-color="#8e5c34"/>
          <stop offset=".48" stop-color="#4a291c"/>
          <stop offset="1" stop-color="#140d0a"/>
        </radialGradient>
        <filter id="${uid}Shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000" flood-opacity=".34"/>
        </filter>
      </defs>

      <g filter="url(#${uid}Shadow)" stroke="#3a2117" stroke-width="2.2" stroke-linejoin="round">
        <g class="dog-tail">
          <path d="M184 158c27-20 41-8 33 8-7 13-21 17-34 13" fill="none" stroke="#171719" stroke-width="16" stroke-linecap="round"/>
          <path d="M210 154c9-2 12 5 6 13-4 6-9 8-16 9" fill="none" stroke="#f4efe4" stroke-width="13" stroke-linecap="round"/>
        </g>

        <g class="dog-body">
          <ellipse cx="126" cy="172" rx="64" ry="50" fill="url(#${uid}White)"/>
          <path d="M77 147c17-29 76-37 108-8 8 7 12 17 12 27-22-8-42-8-60-2-20 7-42 3-60-17z" fill="url(#${uid}Black)"/>
          <path class="dog-chest" d="M108 144c8 8 28 8 36 0 8 18 8 48-2 66-10 7-24 7-34 0-10-18-10-48 0-66z" fill="url(#${uid}White)" stroke="none"/>

          <g class="dog-belly-spots" fill="#a7653d" stroke="none" opacity=".92">
            <ellipse cx="113" cy="171" rx="3.8" ry="3.1" transform="rotate(-18 113 171)"/>
            <ellipse cx="137" cy="166" rx="3.1" ry="4.2" transform="rotate(26 137 166)"/>
            <ellipse cx="120" cy="187" rx="2.5" ry="3.4" transform="rotate(14 120 187)"/>
            <ellipse cx="139" cy="195" rx="3.9" ry="2.5" transform="rotate(-22 139 195)"/>
            <ellipse cx="109" cy="202" rx="2.6" ry="2.1"/>
            <ellipse cx="129" cy="209" rx="3.2" ry="2.6" transform="rotate(18 129 209)"/>
          </g>
          <g class="dog-belly-spots-dark" fill="#7f462d" stroke="none" opacity=".82">
            <circle cx="128" cy="178" r="2.2"/>
            <ellipse cx="116" cy="194" rx="2" ry="2.8"/>
            <circle cx="145" cy="182" r="2"/>
          </g>

          <path d="M88 168c12 8 22 11 39 11 18 0 30-3 45-12" fill="none" stroke="url(#${uid}Blue)" stroke-width="11" stroke-linecap="round"/>
          <path d="M90 171c11 8 21 10 37 10 18 0 31-3 45-12" fill="none" stroke="#5da2ff" stroke-width="2.1" stroke-linecap="round" opacity=".8"/>
          <circle cx="128" cy="179" r="9.5" fill="#e7c34b" stroke="#745414"/>
          <path d="M123 176h10M128 171v10" stroke="#745414" stroke-width="2" stroke-linecap="round"/>
        </g>

        <g class="dog-paw-left">
          <path d="M67 178c-4 12-5 26 1 38 5 8 24 9 31 0 5-11 4-24-2-36z" fill="url(#${uid}White)"/>
          <ellipse cx="82" cy="217" rx="19" ry="12" fill="url(#${uid}White)"/>
          <g fill="#a8663d" stroke="none">
            <ellipse cx="74" cy="188" rx="3.3" ry="2.5" transform="rotate(-20 74 188)"/>
            <ellipse cx="88" cy="194" rx="2.8" ry="3.6" transform="rotate(17 88 194)"/>
            <ellipse cx="77" cy="202" rx="2.5" ry="2"/>
            <ellipse cx="91" cy="209" rx="2.2" ry="2.8"/>
            <circle cx="72" cy="211" r="1.9"/>
          </g>
          <g fill="#7c432b" stroke="none" opacity=".8"><circle cx="83" cy="185" r="1.8"/><circle cx="83" cy="207" r="1.7"/></g>
          <path d="M72 220v-6M81 222v-7M90 220v-6" stroke="#b8aa96" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="dog-paw-right">
          <path d="M154 180c-5 12-6 26-2 36 6 9 25 8 32 0 5-11 4-25 0-37z" fill="url(#${uid}White)"/>
          <ellipse cx="168" cy="217" rx="19" ry="12" fill="url(#${uid}White)"/>
          <g fill="#a8663d" stroke="none">
            <ellipse cx="162" cy="188" rx="2.8" ry="3.4" transform="rotate(12 162 188)"/>
            <ellipse cx="175" cy="195" rx="3.4" ry="2.6" transform="rotate(-18 175 195)"/>
            <ellipse cx="160" cy="202" rx="2.3" ry="2.8"/>
            <ellipse cx="176" cy="208" rx="2.5" ry="2"/>
            <circle cx="167" cy="211" r="1.9"/>
          </g>
          <g fill="#7c432b" stroke="none" opacity=".8"><circle cx="171" cy="185" r="1.7"/><circle cx="168" cy="202" r="1.6"/></g>
          <path d="M159 220v-6M168 222v-7M177 220v-6" stroke="#b8aa96" stroke-width="2" stroke-linecap="round"/>
        </g>

        <g class="dog-head">
          <path class="dog-ear-left" d="M82 70C48 59 37 79 44 111c5 25 17 39 34 42 11 2 17-5 14-18z" fill="url(#${uid}Ear)"/>
          <path class="dog-ear-right" d="M166 69c35-11 47 10 39 42-6 25-18 39-35 42-11 1-17-7-13-19z" fill="url(#${uid}Ear)"/>
          <path d="M63 111c-1-39 25-67 60-67 36 0 63 28 61 68-2 35-25 58-61 58-36 0-59-23-60-59z" fill="url(#${uid}Tan)"/>

          <path class="dog-blaze" d="M116 52c5-3 11-3 16 0-4 12-4 23-1 34 2 9 2 17-2 26-3 7-7 11-13 11s-10-4-13-11c-4-9-4-17-1-26 3-11 5-22 14-34z" fill="url(#${uid}White)" stroke="none"/>
          <path d="M68 100c6-24 23-37 42-37-12 12-17 28-14 47-12-7-20-10-28-10z" fill="#2d211c" opacity=".26" stroke="none"/>
          <path d="M180 99c-7-24-24-37-43-37 13 12 18 28 15 47 11-7 20-10 28-10z" fill="#2d211c" opacity=".27" stroke="none"/>

          <path class="dog-brow-left" d="M84 91c8-7 18-8 27-2" fill="none" stroke="#4d271a" stroke-width="4" stroke-linecap="round"/>
          <path class="dog-brow-right" d="M139 89c9-5 19-4 27 3" fill="none" stroke="#4d271a" stroke-width="4" stroke-linecap="round"/>

          <ellipse cx="99" cy="108" rx="11" ry="14" fill="#17100d" stroke="#22120e"/>
          <ellipse cx="150" cy="108" rx="11" ry="14" fill="#17100d" stroke="#22120e"/>
          <ellipse class="dog-eye" cx="99" cy="108" rx="7.2" ry="10" fill="url(#${uid}Eye)" stroke="none"/>
          <ellipse class="dog-eye" cx="150" cy="108" rx="7.2" ry="10" fill="url(#${uid}Eye)" stroke="none"/>
          <circle cx="96" cy="103" r="2.8" fill="#fff" stroke="none"/><circle cx="147" cy="103" r="2.8" fill="#fff" stroke="none"/>
          <circle cx="102" cy="112" r="1.2" fill="#d9a16e" stroke="none"/><circle cx="153" cy="112" r="1.2" fill="#d9a16e" stroke="none"/>

          <path d="M83 126c4-20 22-31 41-31 20 0 38 11 42 31 4 23-12 43-42 44-29 0-46-20-41-44z" fill="url(#${uid}White)"/>
          <path d="M112 124c4-8 20-9 25 0 3 8-3 16-12 17-9 0-16-8-13-17z" fill="#171417" class="dog-nose"/>
          <ellipse cx="119" cy="125" rx="3.5" ry="2.2" fill="#656066" stroke="none" opacity=".75"/>
          <path d="M124 140v7" stroke="#5d3a2c" stroke-width="3" stroke-linecap="round"/>
          <path d="M108 148c9 9 23 9 32 0" fill="none" stroke="#6c3a32" stroke-width="3" stroke-linecap="round"/>
          <path class="dog-mouth" d="M107 150c10 15 25 15 35 0-2 23-33 26-35 0z" fill="#531f27" stroke="#462027"/>
          <path class="dog-tongue" d="M116 161c5-6 14-6 19 0-2 10-17 12-19 0z" fill="#ef8291" stroke="none"/>
          <ellipse cx="78" cy="135" rx="10" ry="6" fill="#f3a9a0" opacity=".25" stroke="none"/>
          <ellipse cx="171" cy="135" rx="10" ry="6" fill="#f3a9a0" opacity=".25" stroke="none"/>
        </g>
      </g>
    </svg>`;
}

function injectBeagleStyles() {
  if (document.getElementById('dukeBeagleStyles')) return;
  const style = document.createElement('style');
  style.id = 'dukeBeagleStyles';
  style.textContent = `
    .duke-dog.beagle-duke .dog-body{transform-origin:126px 190px;animation:beagleBreathe 3.1s ease-in-out infinite}
    .duke-dog.beagle-duke .dog-chest{animation:beagleChest 3.1s ease-in-out infinite;transform-origin:center bottom;transform-box:fill-box}
    .duke-dog.beagle-duke .dog-belly-spots,.duke-dog.beagle-duke .dog-belly-spots-dark{transform-origin:126px 195px;animation:beagleChest 3.1s ease-in-out infinite}
    .duke-dog.beagle-duke .dog-nose{transform-box:fill-box;transform-origin:center;animation:beagleSniff 2.9s ease-in-out infinite}
    .duke-dog.beagle-duke .dog-brow-left,.duke-dog.beagle-duke .dog-brow-right{transform-box:fill-box;transform-origin:center;animation:beagleBrows 4.2s ease-in-out infinite}
    .duke-dog.beagle-duke .dog-tongue{transform-box:fill-box;transform-origin:center top;transition:opacity .2s ease}
    .duke-dog.beagle-duke.talking .dog-tongue{animation:beagleTongue .2s ease-in-out infinite alternate}
    .duke-dog.beagle-duke.listening .dog-brow-left{transform:translateY(-2px) rotate(-5deg)}
    .duke-dog.beagle-duke.listening .dog-brow-right{transform:translateY(-2px) rotate(5deg)}
    .duke-dog.beagle-duke.excited .dog-tail{animation-duration:.24s!important}
    .duke-dog.beagle-duke.talking .dog-tail{animation-duration:.34s!important}
    @keyframes beagleBreathe{50%{transform:scaleY(1.018) translateY(-1px)}}
    @keyframes beagleChest{50%{transform:scaleY(1.025)}}
    @keyframes beagleSniff{0%,82%,100%{transform:scale(1)}88%{transform:scale(1.045)}94%{transform:scale(.985)}}
    @keyframes beagleBrows{0%,80%,100%{transform:translateY(0)}85%{transform:translateY(-2px)}90%{transform:translateY(0)}}
    @keyframes beagleTongue{to{transform:scaleY(1.18) translateY(1px)}}
  `;
  document.head.append(style);
}

function replaceDog(dog) {
  if (!(dog instanceof HTMLElement) || dog.dataset.beagleReady === 'true') return;
  dog.dataset.beagleReady = 'true';
  dog.classList.add('beagle-duke');
  dog.setAttribute('aria-label', 'Duke, el beagle narrador animado');
  dog.innerHTML = beagleSvgMarkup();
}

function replaceAllDogs(root = document) {
  root.querySelectorAll?.('.duke-dog').forEach(replaceDog);
}

function initDukeBeagle() {
  injectBeagleStyles();
  replaceAllDogs();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.duke-dog')) replaceDog(node);
        replaceAllDogs(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export { initDukeBeagle };
