import { useSyncExternalStore } from 'react';
import { GanttTheme } from 'shared/types';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const prefersDark = () =>
  canMatchMedia() && window.matchMedia(SYSTEM_DARK_QUERY).matches;

// `color-scheme` is the platform's own light/dark signal and it inherits, so reading it off the
// root is how the chart follows a host that flips themes with a class - next-themes, Tailwind and
// fumadocs all write it there. A media query cannot see that choice, only the OS behind it.
const hostScheme = (): 'light' | 'dark' => {
  if (typeof document === 'undefined') return 'light';

  const used = getComputedStyle(document.documentElement).colorScheme;
  const light = used.includes('light');
  const dark = used.includes('dark');

  // Both means "either is fine, ask the user" - the same thing `theme="system"` asks.
  if (light && dark) return prefersDark() ? 'dark' : 'light';
  return dark ? 'dark' : 'light';
};

// Two sources to watch: the OS setting, and the root's own class/style, which is what a host
// theme switch actually mutates.
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

// Server renders light: the host's color-scheme is only readable once there is a document. A host
// that themes before paint (next-themes' blocking script) is already correct on the first client
// render, so only static HTML shows the light frame.
const getServerSnapshot = (): 'light' | 'dark' => 'light';

/**
 * Resolves the `theme` prop to the value written to `data-theme`.
 *
 * 'light' / 'dark' are taken as given, 'system' asks the OS, and no prop at all follows the
 * host page's `color-scheme`.
 */
export function useResolvedTheme(theme?: GanttTheme): 'light' | 'dark' {
  const ambient = useSyncExternalStore(
    subscribe,
    theme === 'system' ? () => (prefersDark() ? 'dark' : 'light') : hostScheme,
    getServerSnapshot
  );

  return theme === 'light' || theme === 'dark' ? theme : ambient;
}
