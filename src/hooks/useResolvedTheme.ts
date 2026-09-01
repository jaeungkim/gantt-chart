import { useMemo, useSyncExternalStore } from 'react';
import { GanttTheme } from 'types/gantt';

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

// The system setting is unknowable during server rendering and the first hydration render
const getServerSystemTheme = (): 'light' | 'dark' | null => null;

/**
 * Hook that resolves the theme and builds the matching class name and data attribute
 *
 * The 'system' theme is subscribed to with useSyncExternalStore - server rendering and
 * the first hydration render use null (no theme class) and switch to the real system
 * setting after hydration, so there is no hydration mismatch and no getting stuck on
 * the wrong theme.
 */
export function useResolvedTheme(
  theme?: GanttTheme,
  baseClassName = 'gantt-container'
): UseResolvedThemeResult {
  // System theme (subscribes to prefers-color-scheme)
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme
  );

  // Resolve the final theme - with no theme prop the host manages theming, so nothing is
  // attached; 'system' stays null until it resolves
  const resolvedTheme = useMemo((): 'light' | 'dark' | null => {
    if (!theme) return null;
    return theme === 'system' ? systemTheme : theme;
  }, [theme, systemTheme]);

  // Build the container class name
  const containerClassName = useMemo(
    () => (resolvedTheme ? `${baseClassName} ${resolvedTheme}` : baseClassName),
    [baseClassName, resolvedTheme]
  );

  return {
    containerClassName,
    dataTheme: resolvedTheme ?? undefined,
  };
}
