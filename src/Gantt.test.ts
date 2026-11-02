// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import Gantt from "./Gantt";
import type { GanttProps } from "./props";
import type { Task } from "core/types";
import { click, pointer, render } from "shared/testing/dom";

const ROW_HEIGHT = 40;

const TWO_TASKS: Task[] = [
  { id: "a", name: "A", startDate: "2025-01-01", endDate: "2025-01-05", parentId: null, sequence: "1" },
  { id: "b", name: "B", startDate: "2025-01-03", endDate: "2025-01-09", parentId: null, sequence: "2" },
];

const styleOf = (props: GanttProps, className: string) => {
  const html = renderToStaticMarkup(createElement(Gantt, props));
  return new RegExp(`class="${className}[^"]*"[^>]*style="([^"]*)"`).exec(html)?.[1];
};

describe("draw slot", () => {
  const onTaskCreate = () => {};

  it("reserves one blank row under the rows while task creation is on", () => {
    expect(styleOf({ onTaskCreate, rowHeight: 50 }, "gantt-content")).toMatch(
      /(^|;)height:50px(;|$)/
    );
  });

  it("reserves nothing when tasks cannot be created", () => {
    expect(styleOf({ rowHeight: 50 }, "gantt-content")).toMatch(/(^|;)height:0px(;|$)/);
    expect(styleOf({ onTaskCreate, readOnly: true, rowHeight: 50 }, "gantt-content")).toMatch(
      /(^|;)height:0px(;|$)/
    );
  });
});

describe("empty timeline click", () => {
  const selectedThenEmptyClick = async (gesture: (content: Element) => Promise<void>) => {
    const onTaskSelect = vi.fn();
    const onTaskCreate = vi.fn();
    const { host } = await render(
      createElement(Gantt, { tasks: TWO_TASKS, rowHeight: ROW_HEIGHT, onTaskSelect, onTaskCreate })
    );
    await click(host.querySelector('.gantt-task-bar[data-task-id="a"]')!);
    const content = host.querySelector(".gantt-content")!;
    await gesture(content);
    await click(content);
    return { onTaskSelect, onTaskCreate };
  };

  it("clears the selection", async () => {
    const { onTaskSelect } = await selectedThenEmptyClick(async () => {});
    expect(onTaskSelect.mock.calls.map(([task]) => task?.id ?? null)).toEqual(["a", null]);
  });

  it("keeps the selection when the click only ends a drawn task", async () => {
    const drawSlotY = TWO_TASKS.length * ROW_HEIGHT + ROW_HEIGHT / 2;
    const { onTaskSelect, onTaskCreate } = await selectedThenEmptyClick(async (content) => {
      await pointer("pointerdown", content, 10, drawSlotY);
      await pointer("pointermove", document, 200, drawSlotY);
      await pointer("pointerup", document, 200, drawSlotY);
    });
    expect(onTaskCreate).toHaveBeenCalledOnce();
    expect(onTaskSelect.mock.calls.map(([task]) => task?.id ?? null)).toEqual(["a"]);
  });
});

describe("tasks prop sync", () => {
  it("renders and re-renders a task carrying a cycle and a BigInt", async () => {
    const cyclic: Record<string, unknown> = { budget: 10n };
    cyclic.self = cyclic;
    const tasks: Task[] = [Object.assign({ ...TWO_TASKS[0] }, { meta: cyclic })];
    const { host, rerender } = await render(createElement(Gantt, { tasks }));
    await rerender(createElement(Gantt, { tasks: [...tasks] }));
    expect(host.querySelector('.gantt-task-bar[data-task-id="a"]')).not.toBeNull();
  });
});

describe("container size", () => {
  it("keeps the height and width props when style carries them as undefined", () => {
    const style = styleOf(
      { height: 400, width: 500, style: { height: undefined, width: undefined } },
      "gantt-container"
    );
    expect(style).toMatch(/(^|;)height:400px(;|$)/);
    expect(style).toMatch(/(^|;)width:500px(;|$)/);
  });

  it("lets a defined style.height or style.width win over the props", () => {
    const style = styleOf(
      { height: 400, width: 500, style: { height: "100vh", width: 300 } },
      "gantt-container"
    );
    expect(style).toMatch(/(^|;)height:100vh(;|$)/);
    expect(style).toMatch(/(^|;)width:300px(;|$)/);
  });
});

describe("theme tokens", () => {
  it("writes a token string with its unit, and refuses a unitless number", () => {
    const style: GanttProps["style"] = {
      "--gantt-detail-width": "400px",
    };
    expectTypeOf<number>().not.toExtend<
      NonNullable<GanttProps["style"]>["--gantt-accent"]
    >();
    expect(styleOf({ style }, "gantt-container")).toContain("--gantt-detail-width:400px");
  });
});
