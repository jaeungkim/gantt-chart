import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function inline(path: string): string {
  return readFileSync(path, "utf8").replace(/^@import "(.+)";$/gm, (_, file: string) =>
    inline(resolve(dirname(path), file)),
  );
}

export const stylesheet = inline(resolve(import.meta.dirname, "../../styles.css"));
