const root = document.documentElement;
const buttons = () => document.querySelectorAll('.theme-toggle');
const labels = {
  'zh-CN': ['切换深色主题', '切换浅色主题'],
  'zh-TW': ['切換深色主題', '切換淺色主題'],
  en: ['Switch to dark theme', 'Switch to light theme'],
};
let switching = false;

export function updateThemeLabels() {
  const [dark, light] = labels[root.lang] || labels.en;
  const label = root.dataset.theme === 'dark' ? light : dark;
  buttons().forEach(button => {
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    button.innerHTML = root.dataset.theme === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/></svg>';
  });
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.content = root.dataset.theme === 'dark' ? '#141817' : '#f3f7f6';
  });
  const icon = root.dataset.theme === 'dark' ? 'icon-192-dark.png' : 'icon-192.png';
  document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => {
    link.href = `./${icon}?v=20261024-dual-theme`;
  });
}

function saveTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem('campus-theme', theme); } catch { /* browsing without storage */ }
  updateThemeLabels();
  document.dispatchEvent(new Event('campus-theme-change'));
}

async function toggleTheme(event) {
  if (switching) return;
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.detail ? event.clientX : rect.left + rect.width / 2;
  const y = event.detail ? event.clientY : rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    saveTheme(theme);
    return;
  }
  switching = true;
  root.classList.add('theme-switching');
  try {
    const transition = document.startViewTransition(() => saveTheme(theme));
    await transition.ready;
    await root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
    ).finished;
    await transition.finished;
  } catch { saveTheme(theme); }
  finally { root.classList.remove('theme-switching'); switching = false; }
}

export function initTheme() {
  buttons().forEach(button => button.addEventListener('click', toggleTheme));
  updateThemeLabels();
}
