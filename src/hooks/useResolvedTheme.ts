import { useEffect, useMemo, useState } from 'react';
import { GanttTheme } from 'types/gantt';

interface UseResolvedThemeResult {
  resolvedTheme: 'light' | 'dark';
  containerClassName: string;
  dataTheme: 'light' | 'dark' | undefined;
}

/**
 * 테마를 해결하고 관련 클래스명과 data 속성을 생성하는 훅
 * 'system' 테마의 경우 시스템 설정을 감지하여 자동 전환
 */
export function useResolvedTheme(
  theme?: GanttTheme,
  baseClassName = 'gantt-container'
): UseResolvedThemeResult {
  // 시스템 테마 상태 (prefers-color-scheme 감지)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 최종 테마 결정
  const resolvedTheme = useMemo((): 'light' | 'dark' => {
    if (!theme || theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // 컨테이너 클래스명 생성
  const containerClassName = useMemo(() => {
    const classes = [baseClassName];
    if (theme) {
      classes.push(resolvedTheme);
    }
    return classes.join(' ');
  }, [baseClassName, theme, resolvedTheme]);

  // data-theme 속성 값
  const dataTheme = theme ? resolvedTheme : undefined;

  return {
    resolvedTheme,
    containerClassName,
    dataTheme,
  };
}

