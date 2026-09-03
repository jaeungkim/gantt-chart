// One scrollable axis. Every size is known before paint, so no measure-on-paint pass is needed.
export interface VirtualAxis {
  count: number;
  /** Size of the whole axis (px) */
  total: number;
  sizeAt: (index: number) => number;
  /** Pixels before `index` starts */
  offsetAt: (index: number) => number;
  /** Index of the item covering `px`, clamped to the axis */
  indexAt: (px: number) => number;
}

export function fixedAxis(count: number, size: number): VirtualAxis {
  const safeSize = Math.max(1, size);

  return {
    count,
    total: count * safeSize,
    sizeAt: () => safeSize,
    offsetAt: (index) => clamp(index, 0, count) * safeSize,
    indexAt: (px) => clamp(Math.floor(px / safeSize), 0, count - 1),
  };
}

// Prefix-sum table, rebuilt per data change; O(log n) lookups.
export function variableAxis(
  count: number,
  sizeAt: (index: number) => number,
): VirtualAxis {
  const prefix = new Float64Array(count + 1);
  for (let i = 0; i < count; i += 1) {
    prefix[i + 1] = prefix[i] + Math.max(0, sizeAt(i));
  }

  return {
    count,
    total: prefix[count],
    sizeAt: (index) =>
      index >= 0 && index < count ? prefix[index + 1] - prefix[index] : 0,
    offsetAt: (index) => prefix[clamp(index, 0, count)],
    indexAt: (px) => {
      if (count === 0) return 0;

      let low = 0;
      let high = count - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (prefix[mid + 1] <= px) low = mid + 1;
        else high = mid;
      }
      return low;
    },
  };
}

export function axisOf(
  count: number,
  size: number | ArrayLike<number>,
  fallback = 0,
): VirtualAxis {
  if (typeof size === 'number') return fixedAxis(count, size);
  return variableAxis(count, (index) => size[index] ?? fallback);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
