import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/demo/gantt-demo', () => ({ GanttDemo: () => null }));

import HomePage from './page';

const types = (node: unknown): unknown[] => {
  if (Array.isArray(node)) return node.flatMap(types);
  if (typeof node !== 'object' || node === null || !('props' in node)) return [];
  const element = node as { type: unknown; props: { children?: unknown } };
  return [element.type, ...types(element.props.children)];
};

describe('home page', () => {
  it('leaves the main landmark to HomeLayout, which already renders one around it', async () => {
    const page = await HomePage({ params: Promise.resolve({ lang: 'en' }) });
    expect(types(page)).not.toContain('main');
  });
});
