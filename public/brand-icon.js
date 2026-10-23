// The Campus Companion app icon: calendar + check + rising sun, with the page-curl corner.
// One markup builder, used for the big icon on the login screen, the flying copy and the small
// icon docked in the sidebar. Motion lives in brand.css (CSS) plus <animate> on the curl (SMIL).
//
// Strict CSP: nothing here uses inline style="" attributes; positions are set through the CSSOM.

let uid = 0;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs><clipPath id="cal-clip-@ID@"><path d="M 123 144 H 280 A 28 28 0 0 1 308 172 V 309 A 28 28 0 0 1 280 337 H 123 A 28 28 0 0 1 95 309 V 172 A 28 28 0 0 1 123 144 Z"/></clipPath></defs>
    <rect x="0" y="0" width="400" height="400" fill="#DCF5F2"/>
    <g class="sun">
    <g class="rays" fill="#FE6C3E">
    <rect class="ray" x="194" y="37" width="12" height="33" rx="6"/>
    <g transform="rotate(45 129 73)"><rect class="ray" x="111.5" y="66.5" width="35" height="13" rx="6.5"/></g>
    <g transform="rotate(-45 271 73)"><rect class="ray" x="253.5" y="66.5" width="35" height="13" rx="6.5"/></g>
    <rect class="ray" x="91" y="116" width="32" height="12" rx="6"/>
    <rect class="ray" x="277" y="116" width="32" height="12" rx="6"/>
    </g>
    <path class="dome" d="M 132 144 A 68 68 0 0 1 268 144 Z" fill="#FE6C3E"/>
    </g>
    <g class="calendar">
    <path class="cal-body" d="M 123 144 H 280 A 28 28 0 0 1 308 172 V 309 A 28 28 0 0 1 280 337 H 123 A 28 28 0 0 1 95 309 V 172 A 28 28 0 0 1 123 144 Z" fill="#FDFAF1"/>
    <g class="curl" clip-path="url(#cal-clip-@ID@)">
    <path class="curl-flap" d="M 332 215 L 309 221 C 308 252 302 266 288 272 C 272 278 252 277 241 284 C 235 289 236 302 233 316 C 230 328 215 337 192 337 L 192 362 L 332 362 Z" fill="#CDEFEB">
    <animate attributeName="d" dur="4000ms" begin="2000ms" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" values="M 332 215 L 309 221 C 308 252 302 266 288 272 C 272 278 252 277 241 284 C 235 289 236 302 233 316 C 230 328 215 337 192 337 L 192 362 L 332 362 Z;M 332 210.5 L 309 216.5 C 305 249.6 299 263.6 285 269.6 C 269 275.6 249 274.6 238 281.6 C 232 286.6 233 299.6 230 313.6 C 227 325.6 212 334.6 187.5 337 L 187.5 362 L 332 362 Z;M 332 215 L 309 221 C 308 252 302 266 288 272 C 272 278 252 277 241 284 C 235 289 236 302 233 316 C 230 328 215 337 192 337 L 192 362 L 332 362 Z;M 332 217.4 L 309 223.4 C 309.6 253.28 303.6 267.28 289.6 273.28 C 273.6 279.28 253.6 278.28 242.6 285.28 C 236.6 290.28 237.6 303.28 234.6 317.28 C 231.6 329.28 216.6 338.28 194.4 337 L 194.4 362 L 332 362 Z;M 332 215 L 309 221 C 308 252 302 266 288 272 C 272 278 252 277 241 284 C 235 289 236 302 233 316 C 230 328 215 337 192 337 L 192 362 L 332 362 Z"/>
    </path>
    <path class="curl-back" d="M 332 222 L 309 228 C 306 262 282 306 234 330 C 222 336 206 337 192 337 L 192 362 L 332 362 Z" fill="#B8E2DE">
    <animate attributeName="d" dur="4000ms" begin="2120ms" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" values="M 332 222 L 309 228 C 306 262 282 306 234 330 C 222 336 206 337 192 337 L 192 362 L 332 362 Z;M 332 217.5 L 309 223.5 C 301.2 258.16 277.2 302.16 229.2 326.16 C 217.2 332.16 201.2 333.16 187.5 337 L 187.5 362 L 332 362 Z;M 332 222 L 309 228 C 306 262 282 306 234 330 C 222 336 206 337 192 337 L 192 362 L 332 362 Z;M 332 224.4 L 309 230.4 C 308.56 264.05 284.56 308.05 236.56 332.05 C 224.56 338.05 208.56 339.05 194.4 337 L 194.4 362 L 332 362 Z;M 332 222 L 309 228 C 306 262 282 306 234 330 C 222 336 206 337 192 337 L 192 362 L 332 362 Z"/>
    </path>
    </g>
    </g>
    <g class="rings" fill="#CAEDEA">
    <rect x="146" y="128" width="16" height="42" rx="8"/>
    <rect x="238" y="128" width="16" height="42" rx="8"/>
    </g>
    <path class="check" d="M 148 242 L 186 278 L 256 196" fill="none" stroke="#049F95" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
    </svg>`;

/** Fresh <svg> markup. `animated:false` strips the SMIL curl motion (the CSS side honours prefers-reduced-motion itself). */
export function iconMarkup() {
  let m = SVG.replaceAll('@ID@', String(++uid));
  if (reduced()) m = m.replace(/<animate [^>]*\/>/g, '');
  return m;
}

/** Put a fresh icon into `slot` (a .bi-tile element). Returns the <svg>. */
export function mountIcon(slot) {
  slot.innerHTML = iconMarkup();
  slot.classList.add('bi');
  return slot.querySelector('svg');
}

/** Make `to` show the same moment of the animation as `from` (SMIL curl + CSS animations). */
export function syncMotion(from, to) {
  try { to.setCurrentTime(from.getCurrentTime()); } catch { /* old browser: harmless */ }
  try {
    const a = from.getAnimations({ subtree: true }), b = to.getAnimations({ subtree: true });
    a.forEach((anim, i) => { if (b[i] && anim.currentTime != null) b[i].currentTime = anim.currentTime; });
  } catch { /* getAnimations unsupported */ }
}

const wait = ms => new Promise(r => setTimeout(r, ms));
let flying = false;

/** Mount the big icon on the login screen once (it animates in, then keeps its resident motion). */
export function ensureHero() {
  const hero = document.getElementById('hero-icon');
  if (hero && !hero.querySelector('svg')) mountIcon(hero);
}

/** Mount the small icon in the sidebar unless a flight is about to land there. */
export function ensureDock() {
  const dock = document.getElementById('dock-icon');
  if (dock && !flying && !dock.querySelector('svg')) mountIcon(dock);
}

/**
 * Sign-in / sign-up succeeded: run `enter()` (which shows the app) and, at the same time, fly the big
 * login icon to the sidebar corner, where it lands, settles and carries on with its resident motion.
 * Resolves as soon as `enter()` is done; the flight carries on in the background.
 */
export async function flyToDock(enter) {
  const hero = document.getElementById('hero-icon'), heroSvg = hero?.querySelector('svg');
  if (!heroSvg || reduced() || flying || hero.offsetWidth === 0) return enter();
  const from = hero.getBoundingClientRect();
  // A synced copy on its own fixed layer, exactly over the original, so the login screen can disappear under it.
  const flyer = document.createElement('div');
  flyer.className = 'bi-tile bi bi-flyer';
  const copy = mountIcon(flyer);
  Object.assign(flyer.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.append(flyer);
  syncMotion(heroSvg, copy);
  flying = true;
  document.getElementById('app')?.classList.add('app-enter');
  try { await enter(); } catch (e) { flyer.remove(); flying = false; throw e; }
  const dock = document.getElementById('dock-icon');
  if (!dock || dock.offsetWidth === 0) { flyer.remove(); flying = false; ensureDock(); return; }
  dock.classList.add('bi-waiting');
  land(flyer, copy, dock, from).finally(() => { flying = false; });
}

async function land(flyer, copy, dock, from) {
  const to = dock.getBoundingClientRect();
  const k = to.width / from.width;
  const dx = to.left - from.left, dy = to.top - from.top;
  // transform-origin is the top-left corner, so a translate + scale lands exactly on the dock
  const at = (t, scale, lift = 0) => `translate(${dx * t}px, ${dy * t - lift}px) scale(${scale})`;
  const s = (t) => 1 + (k - 1) * t;
  // arc height: a gentle hump, but never so high that the icon leaves the screen
  const lift = Math.max(0, Math.min(Math.abs(dy) * 0.25 + 50, from.top + dy * 0.62 - 8));
  const flight = flyer.animate([
    { offset: 0,    transform: at(0, 1),            easing: 'cubic-bezier(.3,0,.2,1)' },
    { offset: 0.16, transform: at(0, 1.1),          easing: 'cubic-bezier(.5,0,.2,1)' },        // little hop before take-off
    { offset: 0.62, transform: at(0.62, s(0.62) * 1.04, lift), easing: 'cubic-bezier(.3,0,.25,1)' }, // arc
    { offset: 0.86, transform: at(1, k * 0.9),      easing: 'cubic-bezier(.3,1.4,.5,1)' },    // touch down, slightly squashed
    { offset: 1,    transform: at(1, k) },
  ], { duration: 1500, fill: 'forwards' });
  await flight.finished.catch(() => {});
  // swap the flying copy for the docked icon at exactly the same moment of the animation
  const svg = mountIcon(dock);
  syncMotion(copy, svg);
  dock.classList.remove('bi-waiting');
  dock.classList.add('bi-landed');
  flyer.remove();
  await wait(900);
  dock.classList.remove('bi-landed');
}
