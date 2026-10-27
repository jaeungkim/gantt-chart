import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function inline(path: string): string {
  return readFileSync(path, "utf8").replace(/^@import "(.+)";$/gm, (_, file: string) =>
    inline(resolve(dirname(path), file)),
  );
}

export const stylesheet = inline(fileURLToPath(new URL("../../styles.css", import.meta.url)));
