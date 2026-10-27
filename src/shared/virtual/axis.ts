export interface VirtualAxis {
  count: number;
  total: number;
  sizeAt: (index: number) => number;
  offsetAt: (index: number) => number;
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

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
