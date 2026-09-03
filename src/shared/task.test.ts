import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeProgress,
  resolveTaskColors,
  resolveTaskInteraction,
  type Task,
} from './task';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'a',
  name: 'a',
  startDate: '2025-06-10T00:00:00Z',
  endDate: '2025-06-14T00:00:00Z',
  parentId: null,
  sequence: '1',
  ...overrides,
});

describe('normalizeProgress', () => {
  it('clamps to 0-100 and rejects missing or NaN values', () => {
    expect(normalizeProgress(42)).toBe(42);
    expect(normalizeProgress(-10)).toBe(0);
    expect(normalizeProgress(150)).toBe(100);
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress(Number.NaN)).toBeNull();
  });
});

describe('resolveTaskInteraction - flag precedence (#37)', () => {
  it('allows everything when nothing is configured', () => {
    expect(resolveTaskInteraction(task())).toMatchObject({
      canMove: true,
      canResize: true,
      canChangeProgress: true,
    });
  });

  it('freezes the whole chart from the single readOnly prop', () => {
    expect(resolveTaskInteraction(task(), { readOnly: true })).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('lets a global capability flag gate one gesture on its own', () => {
    expect(
      resolveTaskInteraction(task(), { allowResize: false })
    ).toMatchObject({ canMove: true, canResize: false, canChangeProgress: true });
  });

  it('lets a per-task flag override the global one in both directions', () => {
    expect(
      resolveTaskInteraction(task({ allowMove: false }), { allowMove: true })
    ).toMatchObject({ canMove: false });
    expect(
      resolveTaskInteraction(task({ allowMove: true }), { allowMove: false })
    ).toMatchObject({ canMove: true });
  });

  it('lets a per-task readOnly freeze one task in an otherwise editable chart', () => {
    expect(resolveTaskInteraction(task({ readOnly: true }))).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('lets a per-task readOnly beat a permissive global capability flag', () => {
    expect(
      resolveTaskInteraction(task({ readOnly: true }), { allowMove: true })
    ).toMatchObject({ canMove: false });
  });

  it('lets a per-task capability flag punch through both blanket readOnly settings', () => {
    expect(
      resolveTaskInteraction(task({ readOnly: true, allowProgressChange: true }), {
        readOnly: true,
      })
    ).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: true,
    });
  });

  it('never resizes a summary row or drags its rolled-up progress', () => {
    // Ends and percentage come from the children; moving is still allowed, it carries the subtree.
    expect(
      resolveTaskInteraction({
        ...task({ allowResize: true, allowProgressChange: true }),
        isSummary: true,
      })
    ).toMatchObject({
      canMove: true,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('still lets readOnly freeze a summary row entirely', () => {
    expect(
      resolveTaskInteraction({ ...task(), isSummary: true }, { readOnly: true })
    ).toMatchObject({ canMove: false, canResize: false });
  });

  it('takes bounds from the task first and the chart second', () => {
    expect(
      resolveTaskInteraction(task({ minDate: '2025-06-01' }), {
        minDate: '2025-01-01',
        maxDate: '2025-12-31',
      })
    ).toMatchObject({ minDate: '2025-06-01', maxDate: '2025-12-31' });
  });
});

describe('resolveTaskColors', () => {
  it('emits nothing when there is no usable color, leaving the theme tokens to decide', () => {
    expect(resolveTaskColors(undefined)).toEqual({});
    expect(resolveTaskColors('')).toEqual({});
    expect(resolveTaskColors('   ')).toEqual({});
  });

  it('derives a hover shade, a progress shade and a label color from one value', () => {
    expect(resolveTaskColors('  #fde68a  ')).toEqual({
      '--gantt-bar-color': '#fde68a',
      '--gantt-bar-color-hover': 'color-mix(in srgb, #fde68a 86%, #000)',
      '--gantt-progress-color': 'color-mix(in srgb, #fde68a 62%, #000)',
      '--gantt-bar-text-color':
        'oklch(from #fde68a clamp(0, (l / 0.5637 - 1) * -infinity, 1) 0 h)',
    });
  });

  // A string test would happily accept a wrong threshold, and the wrong one still looks plausible:
  // MUI ships 0.7, which puts a white label on Tailwind #ef4444 at 3.76:1 when black gives 5.58:1.
  it('cuts at the lightness where black and white tie on WCAG contrast', () => {
    expect(Math.cbrt(0.1791).toFixed(4)).toBe('0.5637');
    expect(resolveTaskColors('#000')['--gantt-bar-text-color']).toContain('l / 0.5637');
  });

  // The case JS luminance math cannot serve: the value is only a color once CSS substitutes it.
  it('passes a custom property through untouched', () => {
    const vars = resolveTaskColors('var(--brand)');
    expect(vars['--gantt-bar-color']).toBe('var(--brand)');
    expect(vars['--gantt-bar-text-color']).toBe(
      'oklch(from var(--brand) clamp(0, (l / 0.5637 - 1) * -infinity, 1) 0 h)'
    );
  });
});

describe('the bar label reads the derived color', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  it('falls back to the theme token when the task has no color', () => {
    expect(css).toContain(
      'color: var(--gantt-bar-text-color, var(--gantt-bar-text));'
    );
  });

  // A label pushed outside a narrow bar sits on the chart background, not on the task
  // color, so its own rule must stay declared later to win at equal-or-higher specificity.
  it('keeps .outside declared after the base rule', () => {
    expect(css.indexOf('.gantt-task-name.outside')).toBeGreaterThan(
      css.indexOf('.gantt-task-name {')
    );
  });
});
