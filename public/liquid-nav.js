// Liquid glass nav pill: glides behind the active nav button with a liquid
// stretch/squash (horizontal stretch on mobile, vertical on the desktop
// sidebar). No app.js changes: it watches the .active class that view()
// already toggles, so nav taps, digest deep-links and boot all move it.
// Strict CSP: positions via CSSOM / WAAPI only, no inline style attributes.
const nav = document.querySelector('aside nav');
if (nav) {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buttons = [...nav.querySelectorAll('button[data-view]')];
  const pill = document.createElement('span');
  pill.className = 'ln-pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.append(pill);

  let placed = false;

  const rectOf = (el) => {
    const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
    return { left: r.left - n.left, top: r.top - n.top, width: r.width, height: r.height };
  };
  const place = (rc, btn) => {
    pill.style.left = rc.left + 'px';
    pill.style.top = rc.top + 'px';
    pill.style.width = rc.width + 'px';
    pill.style.height = rc.height + 'px';
    pill.style.transform = '';
    if (btn) pill.style.borderRadius = getComputedStyle(btn).borderRadius;
    placed = true;
  };
  const same = (a, b) => Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1
    && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

  let anim = null;
  const moveTo = (btn, animate) => {
    if (!btn || nav.offsetWidth === 0) return;
    const rc = rectOf(btn);
    if (rc.width === 0) return;
    // First placement, reduced motion, or no movement: settle instantly.
    if (!placed || !animate || reduced()) { anim?.cancel(); anim = null; place(rc, btn); return; }
    // Start from the live visual position so rapid taps don't jump.
    const from = rectOf(pill);
    if (same(from, rc)) { place(rc, btn); return; }
    const c0 = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const c1 = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
    const cm = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    let mid, squash;
    if (Math.abs(c1.x - c0.x) >= Math.abs(c1.y - c0.y)) {
      const w = Math.max(from.width, rc.width) * 1.12;
      mid = { left: cm.x - w / 2, top: rc.top, width: w, height: rc.height };
      squash = 'scaleY(.9)';
    } else {
      const h = Math.max(from.height, rc.height) * 1.12;
      mid = { left: rc.left, top: cm.y - h / 2, width: rc.width, height: h };
      squash = 'scaleX(.94)';
    }
    const radius = getComputedStyle(btn).borderRadius;
    anim?.cancel();
    anim = pill.animate([
      { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: getComputedStyle(pill).borderRadius, transform: 'scale(1)' },
      { left: mid.left + 'px', top: mid.top + 'px', width: mid.width + 'px', height: mid.height + 'px', borderRadius: radius, transform: squash, offset: 0.55 },
      { left: rc.left + 'px', top: rc.top + 'px', width: rc.width + 'px', height: rc.height + 'px', borderRadius: radius, transform: 'scale(1)' },
    ], { duration: 480, easing: 'cubic-bezier(.32,1.1,.36,1)' });
    anim.onfinish = () => { anim = null; place(rc, btn); };
  };

  const sync = (animate) => {
    const b = nav.querySelector('button.active');
    if (b) moveTo(b, animate);
  };

  buttons.forEach((b) => new MutationObserver(() => sync(true))
    .observe(b, { attributes: true, attributeFilter: ['class'] }));
  sync(false);
  addEventListener('resize', () => sync(false));
  addEventListener('load', () => sync(false));
}
