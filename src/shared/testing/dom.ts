import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()));
  document.body.innerHTML = "";
});

export async function render(element: ReactElement) {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(element));
  return {
    host,
    rerender: (next: ReactElement) => act(async () => root.render(next)),
  };
}

export const dispatch = (target: EventTarget, event: Event) =>
  act(async () => {
    target.dispatchEvent(event);
  });

export const pointer = (
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: EventTarget,
  clientX: number,
  clientY: number,
  init: PointerEventInit = {}
) =>
  dispatch(
    target,
    new PointerEvent(type, {
      bubbles: true,
      composed: true,
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX,
      clientY,
      ...init,
    })
  );

export const click = (target: EventTarget, init: MouseEventInit = {}) =>
  dispatch(target, new MouseEvent("click", { bubbles: true, composed: true, ...init }));

export const keydown = (key: string, target: EventTarget = document, init: KeyboardEventInit = {}) =>
  dispatch(target, new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
