import { useMemo, useSyncExternalStore } from 'react';
import { GanttTheme } from 'shared/types';

interface UseResolvedThemeResult {
  containerClassName: string;
  dataTheme: 'light' | 'dark' | undefined;
}

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const subscribeSystemTheme = (onChange: () => void) => {
  if (!canMatchMedia()) return () => {};

  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
};

const getSystemTheme = (): 'light' | 'dark' | null => {
  if (!canMatchMedia()) return null;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
};

const getServerSystemTheme = (): 'light' | 'dark' | null => null;

// 'system' stays null until after hydration, then flips to the real setting - no hydration mismatch.
export function useResolvedTheme(
  theme?: GanttTheme,
  baseClassName = 'gantt-container'
): UseResolvedThemeResult {
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme
  );

  // No theme prop means the host manages theming, so nothing is attached
  const resolvedTheme = useMemo((): 'light' | 'dark' | null => {
    if (!theme) return null;
    return theme === 'system' ? systemTheme : theme;
  }, [theme, systemTheme]);

  const containerClassName = useMemo(
    () => (resolvedTheme ? `${baseClassName} ${resolvedTheme}` : baseClassName),
    [baseClassName, resolvedTheme]
  );

  return {
    containerClassName,
    dataTheme: resolvedTheme ?? undefined,
  };
}
