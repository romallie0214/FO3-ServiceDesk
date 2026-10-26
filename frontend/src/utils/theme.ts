export type Theme = 'light' | 'dark';
const storageKey = 'fo3-service-desk-theme';
export function getTheme(): Theme { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
export function setTheme(theme: Theme) {
  clearTimeout(transitionTimer);
  document.documentElement.classList.add('theme-changing');
  document.documentElement.dataset.theme = theme;
  transitionTimer = setTimeout(() => document.documentElement.classList.remove('theme-changing'), 220);
  try { localStorage.setItem(storageKey, theme); } catch { /* Session-only preference when storage is unavailable. */ }
  window.dispatchEvent(new Event('fo3-theme-change'));
}
export function subscribeTheme(callback: () => void) {
  window.addEventListener('fo3-theme-change', callback);
  return () => window.removeEventListener('fo3-theme-change', callback);
}
let saved: string | null = null;
try { saved = localStorage.getItem(storageKey); } catch { /* Use the system preference. */ }
const preferred = window.matchMedia('(prefers-color-scheme: dark)');
document.documentElement.dataset.theme = saved === 'dark' || saved === 'light' ? saved : preferred.matches ? 'dark' : 'light';
preferred.addEventListener('change', event => {
  let explicit = null;
  try { explicit = localStorage.getItem(storageKey); } catch { /* Follow system preference. */ }
  if (!explicit) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; window.dispatchEvent(new Event('fo3-theme-change')); }
});
