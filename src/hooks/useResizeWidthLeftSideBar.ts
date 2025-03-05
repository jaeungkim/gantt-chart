import { useState } from 'react';

import { registerMouseDownDrag } from 'utils/events';

export function useResizableLeftSideBar(
  initialWidth: number,
  onResize?: (width: number) => void,
  minWidth = 6.25,
  maxWidth = 62.5,
) {
  const [width, setWidth] = useState(initialWidth);

  const handleResize = (deltaX: number) => {
    let newWidth = width + deltaX / 16;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    setWidth(newWidth);
    if (onResize) onResize(newWidth);
  };

  return {
    width,
    resizeProps: registerMouseDownDrag(handleResize, true),
  };
}
