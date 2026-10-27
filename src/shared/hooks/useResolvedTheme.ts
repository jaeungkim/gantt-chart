import { useSyncExternalStore } from 'react';
import { GanttTheme } from 'shared/types';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const systemScheme = (): 'light' | 'dark' =>
  canMatchMedia() && window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';

const hostScheme = (): 'light' | 'dark' => {
  if (typeof document === 'undefined') return 'light';

  const used = getComputedStyle(document.documentElement).colorScheme;
  const light = used.includes('light');
  const dark = used.includes('dark');

  if (light && dark) return systemScheme();
  return dark ? 'dark' : 'light';
};

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const media = canMatchMedia() ? window.matchMedia(SYSTEM_DARK_QUERY) : null;
  media?.addEventListener('change', onChange);

  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme'],
  });

  return () => {
    media?.removeEventListener('change', onChange);
    observer.disconnect();
  };
};

const getServerSnapshot = (): 'light' | 'dark' => 'light';

export function useResolvedTheme(theme?: GanttTheme): 'light' | 'dark' {
  const ambient = useSyncExternalStore(
    subscribe,
    theme === 'system' ? systemScheme : hostScheme,
    getServerSnapshot
  );

  return theme === 'light' || theme === 'dark' ? theme : ambient;
}
