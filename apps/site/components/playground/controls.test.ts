import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTROLS } from './controls';

const SRC = new URL('../../../../src/', import.meta.url);

const library = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => readFileSync(new URL(file, SRC), 'utf8'))
  .join('\n');

// A key a hint can name, and what the chart's source must check to honor it
const KEYS: [RegExp, RegExp][] = [
  [/\bDelete\b/, /["']Delete["']/],
  [/\bBackspace\b/, /["']Backspace["']/],
  [/\bAlt\b/, /\baltKey\b/],
  [/[↑↓]/, /["']ArrowUp["']/],
  [/[←→]/, /["']ArrowLeft["']/],
  [/\bCtrl\b/, /\bctrlKey\b/],
];

describe('control hints', () => {
  it('name only keys the chart listens for', () => {
    const unheard = CONTROLS.flatMap(({ key, hint }) =>
      KEYS.filter(([word, check]) => word.test(hint) && !check.test(library)).map(
        ([word]) => `${key}: ${word}`
      )
    );
    expect(unheard).toEqual([]);
  });
});
