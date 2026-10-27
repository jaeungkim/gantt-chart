import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/source', () => ({
  source: { pageTree: { en: { name: 'en', children: [] }, ko: { name: 'ko', children: [] } } },
}));

import DocsRouteLayout from './layout';

const layout = (lang: string) =>
  DocsRouteLayout({ params: Promise.resolve({ lang }), children: null });

describe('docs layout', () => {
  it('renders a locale that has a page tree', async () => {
    await expect(layout('ko')).resolves.toBeTruthy();
  });

  it('gives HomeLayout a container that is not a second main', async () => {
    const { props } = await layout('en');
    expect(props.slots.container({ children: null }).type).toBe('div');
  });

  it('is a 404 for a lang with no page tree, instead of handing DocsLayout undefined', async () => {
    await expect(layout('x.y')).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });
});
