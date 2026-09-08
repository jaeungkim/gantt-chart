import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Everything under src/ that src/core may not reach for, read off disk so a new folder or root
// module is covered the day it appears. DOMAINS uses `<domain>/**` rather than `<domain>/*`
// because domains nest components/, hooks/ and utils/ inside them.
const SRC = readdirSync(fileURLToPath(new URL("src", import.meta.url)), {
  withFileTypes: true,
});

const DOMAINS = SRC.filter(
  (entry) => entry.isDirectory() && entry.name !== "core"
).map((entry) => entry.name);

// Gantt, props, index, useGanttSelectors. Both spellings: imports here are bare through
// `baseUrl: "src"`, so `from "props"` is the form a core file would actually write, and `../*`
// alone would sail straight past it.
const ROOT_MODULES = SRC.filter(
  (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
).map((entry) => entry.name.replace(/\.tsx?$/, ""));

export default tseslint.config(
  // `eslint .` walks the whole workspace, so anything generated has to be listed here.
  { ignores: ["dist", "**/dist/**", "**/.next/**", "**/.source/**"] },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.plugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // v7 flags pre-existing latest-ref patterns in the drag hooks; warn until refactored.
      "react-hooks/refs": "warn",

      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-unused-vars": "off", // Let TypeScript handle this
      "no-undef": "off", // Let TypeScript handle this
    },
  },
  {
    // The barrel re-exports the core's functions alongside the component.
    files: ["src/index.ts"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Route files export generateStaticParams/generateMetadata alongside the page component.
    files: ["apps/site/app/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // src/core must stay Node-runnable; the folders and root modules below are read off src/.
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react/*",
                "react-dom/*",
                "zustand",
                "zustand/*",
                "@tanstack/*",
                // Read off disk rather than typed out: a new domain folder is covered the day
                // it appears, instead of the day someone remembers to add it here.
                ...DOMAINS.flatMap((domain) => [`${domain}/**`, `**/${domain}/**`]),
                // The root modules are React and prop-surface code; core may not reach up into
                // them either. `../*` stays as the catch-all for everything else one level up
                // (`../shared`, `../styles.css`).
                ...ROOT_MODULES.flatMap((m) => [m, `../${m}`]),
                "../*",
              ],
              message:
                "src/core must stay free of React, the DOM and pixel math - keep render-side code in the domain folder it belongs to.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "sessionStorage",
        "requestAnimationFrame",
      ],
    },
  }
);
