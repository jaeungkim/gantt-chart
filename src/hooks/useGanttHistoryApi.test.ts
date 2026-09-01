import { describe, expect, it } from 'vitest';
import { isTextEntryTarget } from './useGanttHistoryApi';

describe('isTextEntryTarget', () => {
  it('recognizes the fields that own their own undo', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTextEntryTarget({ tagName })).toBe(true);
    }
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true
    );
  });

  it('lets the chart keep the shortcut everywhere else', () => {
    expect(isTextEntryTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'SECTION' })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(undefined)).toBe(false);
    // A key event on the document itself carries no tag name
    expect(isTextEntryTarget({})).toBe(false);
  });
});
