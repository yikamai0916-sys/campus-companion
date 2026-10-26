// Small, optional animations. Every function checks prefers-reduced-motion first:
// people who turned animations off in their system settings get the plain result.

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * "完成反馈按钮": the button shrinks into a circle, a tick is drawn,
 * a ring of particles bursts out. Resolves when the animation is over.
 * Call resetSuccessButton(button) afterwards to restore it.
 */
export async function playButtonSuccess(button) {
  if (reducedMotion()) return;
  button.style.width = button.offsetWidth + 'px'; // fixed start width so the shrink can animate
  void button.offsetWidth;                         // force the browser to apply it before the next step
  button.classList.add('is-success');
  button.insertAdjacentHTML('beforeend', '<svg class="success-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>');
  // Particles. The angle is set through el.style (not a style="" attribute),
  // because the site's Content-Security-Policy blocks inline style attributes.
  const burst = document.createElement('span');
  burst.className = 'success-burst';
  burst.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('i');
    dot.style.setProperty('--angle', i * 36 + 'deg');
    burst.append(dot);
  }
  button.append(burst);
  await wait(800);
}

export function resetSuccessButton(button) {
  button.classList.remove('is-success');
  button.style.width = '';
  button.querySelectorAll('.success-tick,.success-burst').forEach(el => el.remove());
}

/**
 * "圆形扩散转场": the new page grows as a circle from where the user tapped.
 * Uses the View Transitions API; browsers without it (or reduced motion) just switch instantly.
 */
/** Switch workspace pages with a short spatial handoff; theme changes keep their circular reveal. */
let pageTransitionId=0;
export function pageTransition(update) {
  if (reducedMotion()) { update(); return; }
  if (document.startViewTransition) { document.startViewTransition(update); return; }
  const id=++pageTransitionId,current=document.querySelector('main > section:not(.hidden)');
  if (!current) { update(); return; }
  current.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:120,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{}).then(()=>{
    if(id!==pageTransitionId)return;
    update();
    const next=document.querySelector('main > section:not(.hidden)');
    next?.animate([{opacity:0,transform:'translateY(9px)',filter:'blur(3px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:320,easing:'cubic-bezier(.16,1,.3,1)'});
  });
}

export function circularTransition(event, update) {
  if (!document.startViewTransition || reducedMotion()) { update(); return; }
  // Keyboard "clicks" have no pointer position, so use the centre of the button instead.
  let x = event?.clientX, y = event?.clientY;
  if (!event || (!x && !y)) {
    const box = event?.currentTarget?.getBoundingClientRect?.();
    x = box ? box.left + box.width / 2 : innerWidth / 2;
    y = box ? box.top + box.height / 2 : innerHeight / 2;
  }
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(update);
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

/**
 * Background of the progress card: soft aqua deepens slightly as progress increases,
 * blended smoothly in between. Returns an 'rgb(r, g, b)' string.
 */
export function progressColor(percent) {
  const stops = [[0, [239, 245, 243]], [50, [231, 242, 238]], [100, [220, 239, 235]]]; // #EFF5F3 → #E7F2EE → #DCEFEB
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  const [from, to] = p <= 50 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const t = (p - from[0]) / (to[0] - from[0]);
  const rgb = from[1].map((c, i) => Math.round(c + (to[1][i] - c) * t));
  return `rgb(${rgb.join(', ')})`;
}

/**
 * "叠卡展开": cards in `stack` start tucked behind the first one.
 * Tapping the stack (or the button) fans them out with a small stagger; the button folds them back.
 */
export function setupCardStack(stack, button, labels) {
  [...stack.children].forEach((card, i) => card.style.setProperty('--i', String(i))); // CSSOM, allowed by the CSP
  const set = open => {
    stack.classList.toggle('is-collapsed', !open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? labels.close : labels.open;
    stack.querySelectorAll('.digest-card:not(:first-child)').forEach(card => { card.inert = !open; });
  };
  stack.addEventListener('click', () => { if (stack.classList.contains('is-collapsed')) set(true); });
  button.addEventListener('click', () => set(stack.classList.contains('is-collapsed')));
  set(false);
}
