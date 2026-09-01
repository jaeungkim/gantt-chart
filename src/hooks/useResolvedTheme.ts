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

// 서버 렌더와 하이드레이션 첫 렌더에서는 시스템 설정을 알 수 없다
const getServerSystemTheme = (): 'light' | 'dark' | null => null;

/**
 * 테마를 해결하고 관련 클래스명과 data 속성을 생성하는 훅
 *
 * 'system' 테마는 useSyncExternalStore로 구독한다 - 서버 렌더와 하이드레이션
 * 첫 렌더에서는 null(테마 클래스 없음)을 쓰고 하이드레이션 이후에 실제 시스템
 * 설정으로 전환하므로, 하이드레이션 불일치나 잘못된 테마로 고착되는 일이 없다.
 */
export function useResolvedTheme(
  theme?: GanttTheme,
  baseClassName = 'gantt-container'
): UseResolvedThemeResult {
  // 시스템 테마 (prefers-color-scheme 구독)
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme
  );

  // 최종 테마 결정 - theme이 없으면 호스트가 테마를 관리하므로 아무것도 붙이지 않고,
  // 'system'은 해석되기 전까지 null
  const resolvedTheme = useMemo((): 'light' | 'dark' | null => {
    if (!theme) return null;
    return theme === 'system' ? systemTheme : theme;
  }, [theme, systemTheme]);

  // 컨테이너 클래스명 생성
  const containerClassName = useMemo(
    () => (resolvedTheme ? `${baseClassName} ${resolvedTheme}` : baseClassName),
    [baseClassName, resolvedTheme]
  );

  return {
    containerClassName,
    dataTheme: resolvedTheme ?? undefined,
  };
}
