import { describe, expect, it, vi } from 'vitest';

vi.mock('fumadocs-ui/provider/next', () => ({ RootProvider: () => null }));
vi.mock('@vercel/analytics/next', () => ({ Analytics: () => null }));

import LangLayout from './layout';

const layout = (lang: string) => LangLayout({ params: Promise.resolve({ lang }), children: null });

describe('[lang] layout', () => {
  it('renders each locale', async () => {
    expect((await layout('en')).props.lang).toBe('en');
    expect((await layout('ko')).props.lang).toBe('ko');
  });

  it('is a 404 for a first segment that names no locale, like /favicon.ico', async () => {
    await expect(layout('favicon.ico')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });
});
