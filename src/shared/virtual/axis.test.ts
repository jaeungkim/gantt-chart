import { describe, expect, it } from 'vitest';
import { axisOf, fixedAxis, variableAxis } from './axis';

describe('fixedAxis', () => {
  const axis = fixedAxis(1000, 38);

  it('measures the whole axis', () => {
    expect(axis.total).toBe(38_000);
    expect(axis.sizeAt(0)).toBe(38);
    expect(axis.offsetAt(10)).toBe(380);
  });

  it('resolves the item covering a pixel, edges included', () => {
    expect(axis.indexAt(0)).toBe(0);
    expect(axis.indexAt(37.9)).toBe(0);
    expect(axis.indexAt(38)).toBe(1);
  });

  it('clamps past either end rather than returning an index nobody can render', () => {
    expect(axis.indexAt(-100)).toBe(0);
    expect(axis.indexAt(1e9)).toBe(999);
    expect(axis.offsetAt(5000)).toBe(38_000);
  });

  it('refuses a zero size - a row of no height would swallow every index', () => {
    expect(fixedAxis(10, 0).sizeAt(0)).toBe(1);
  });
});

describe('variableAxis', () => {
  const sizes = [10, 20, 30, 40];
  const axis = variableAxis(sizes.length, (index) => sizes[index]);

  it('accumulates the sizes it was given', () => {
    expect(axis.total).toBe(100);
    expect(axis.offsetAt(2)).toBe(30);
    expect(axis.sizeAt(3)).toBe(40);
  });

  it('binary-searches to the item covering a pixel', () => {
    expect(axis.indexAt(0)).toBe(0);
    expect(axis.indexAt(9.5)).toBe(0);
    expect(axis.indexAt(10)).toBe(1);
    expect(axis.indexAt(29)).toBe(1);
    expect(axis.indexAt(30)).toBe(2);
    expect(axis.indexAt(99.9)).toBe(3);
  });

  it('reports nothing outside its range', () => {
    expect(axis.sizeAt(-1)).toBe(0);
    expect(axis.sizeAt(4)).toBe(0);
  });

  it('handles an empty axis', () => {
    const empty = variableAxis(0, () => 10);
    expect(empty.total).toBe(0);
    expect(empty.indexAt(50)).toBe(0);
  });

  it('treats a negative size as zero instead of walking the offsets backwards', () => {
    const axis = variableAxis(3, () => -5);
    expect(axis.total).toBe(0);
    expect(axis.offsetAt(2)).toBe(0);
  });
});

describe('axisOf', () => {
  it('takes a number as a uniform axis', () => {
    expect(axisOf(4, 25).total).toBe(100);
  });

  it('takes a list as the sizes themselves', () => {
    expect(axisOf(4, [10, 20, 30, 40]).total).toBe(100);
  });

  it('falls back for entries the list does not carry', () => {
    // a time cell that reported no width still occupies a column
    expect(axisOf(4, [10, 20], 32).total).toBe(94);
  });
});
