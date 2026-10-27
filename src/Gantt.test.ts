import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it } from "vitest";
import Gantt from "./Gantt";
import type { GanttProps } from "./props";

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
  it("lets a finished draw claim its trailing click before clearing the selection", () => {
    const source = readFileSync("src/Gantt.tsx", "utf8");
    const start = source.indexOf("const handleContentClick");
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, source.indexOf("select(null)", start))).toContain(
      "consumeDrawClick()"
    );
  });
});

describe("tasks prop sync", () => {
  it("never serializes the tasks prop itself, so a task with a cycle or a BigInt cannot throw", () => {
    expect(readFileSync("src/Gantt.tsx", "utf8")).not.toContain("JSON.stringify");
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
