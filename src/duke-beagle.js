let beagleSequence = 0;

function beagleSvgMarkup() {
  beagleSequence += 1;
  const uid = `dukeBeagle${beagleSequence}`;
  return `
    <svg viewBox="0 0 250 250" role="img" aria-labelledby="${uid}Title ${uid}Desc">
      <title id="${uid}Title">Duke, el beagle narrador</title>
      <desc id="${uid}Desc">Perrito beagle tricolor animado, con orejas largas, franja blanca, lomo negro y collar azul.</desc>
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
          <path d="M188 158c28-21 43-8 34 9-7 13-22 18-35 13" fill="none" stroke="#171719" stroke-width="18" stroke-linecap="round"/>
          <path d="M215 153c10-2 13 5 7 14-4 6-10 9-17 10" fill="none" stroke="#f4efe4" stroke-width="15" stroke-linecap="round"/>
        </g>

        <g class="dog-body">
          <ellipse cx="126" cy="170" rx="72" ry="58" fill="url(#${uid}White)"/>
          <path d="M71 143c18-34 84-43 119-7 8 9 11 19 12 31-23-11-49-12-70-4-21 8-45 3-61-20z" fill="url(#${uid}Black)"/>
          <path class="dog-chest" d="M104 142c9 11 34 11 45 0 10 21 9 55-3 76-12 8-30 8-42 0-12-21-12-55 0-76z" fill="url(#${uid}White)" stroke="none"/>
          <path d="M81 163c13 10 24 13 44 13 19 0 32-4 47-14" fill="none" stroke="url(#${uid}Blue)" stroke-width="12" stroke-linecap="round"/>
          <path d="M84 168c13 10 24 13 41 13 20 0 34-4 49-15" fill="none" stroke="#5da2ff" stroke-width="2.3" stroke-linecap="round" opacity=".8"/>
          <circle cx="128" cy="180" r="10" fill="#e7c34b" stroke="#745414"/>
          <path d="M123 177h10M128 172v10" stroke="#745414" stroke-width="2" stroke-linecap="round"/>
        </g>

        <g class="dog-paw-left">
          <path d="M61 176c-5 14-6 30 1 43 6 9 31 10 40 0 6-12 4-27-3-40z" fill="url(#${uid}White)"/>
          <ellipse cx="80" cy="219" rx="24" ry="15" fill="url(#${uid}White)"/>
          <circle cx="72" cy="190" r="3.3" fill="#a8663d" stroke="none"/><circle cx="88" cy="199" r="2.7" fill="#9b5935" stroke="none"/><circle cx="77" cy="208" r="2.3" fill="#b1754d" stroke="none"/>
          <path d="M68 222v-7M79 224v-8M90 222v-7" stroke="#b8aa96" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="dog-paw-right">
          <path d="M151 179c-7 13-8 28-3 40 8 10 33 9 40-1 7-13 5-29-1-43z" fill="url(#${uid}White)"/>
          <ellipse cx="169" cy="219" rx="24" ry="15" fill="url(#${uid}White)"/>
          <circle cx="164" cy="190" r="3" fill="#a8663d" stroke="none"/><circle cx="177" cy="201" r="2.5" fill="#9b5935" stroke="none"/><circle cx="158" cy="208" r="2.2" fill="#b1754d" stroke="none"/>
          <path d="M157 222v-7M168 224v-8M179 222v-7" stroke="#b8aa96" stroke-width="2" stroke-linecap="round"/>
        </g>

        <g class="dog-head">
          <path class="dog-ear-left" d="M82 70C48 59 37 79 44 111c5 25 17 39 34 42 11 2 17-5 14-18z" fill="url(#${uid}Ear)"/>
          <path class="dog-ear-right" d="M166 69c35-11 47 10 39 42-6 25-18 39-35 42-11 1-17-7-13-19z" fill="url(#${uid}Ear)"/>
          <path d="M59 111c-1-41 27-70 64-70 39 0 68 29 66 71-2 38-27 63-65 63-38 0-64-25-65-64z" fill="url(#${uid}Tan)"/>

          <path class="dog-blaze" d="M111 43c8-5 17-5 25 0-6 18-6 34-2 49 4 14 4 25-2 39-5 10-11 16-17 16-7 0-13-6-18-17-5-13-4-25 1-38 6-16 9-31 13-49z" fill="url(#${uid}White)" stroke="none"/>
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
