import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// The layers, as in TanStack Table's table-core: core <- shared <- features <- the root modules.
// The src/ blocks below each fence one layer off from the ones above it. The folders and root
// modules src/core may not reach for are read off disk, so a new one is covered the day it appears.
const SRC = readdirSync(fileURLToPath(new URL("src", import.meta.url)), {
  withFileTypes: true,
});

const FOLDERS = SRC.filter(
  (entry) => entry.isDirectory() && entry.name !== "core"
).map((entry) => entry.name);

const ROOT_MODULES = SRC.filter(
  (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
).map((entry) => entry.name.replace(/\.tsx?$/, ""));

export default tseslint.config(
  // `eslint .` walks the whole workspace, so anything generated has to be listed here.
  { ignores: ["dist", "**/.next/**", "**/.source/**"] },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
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

      "react-hooks/refs": "warn",

      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      // Let TypeScript handle these two
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Route files export generateStaticParams/generateMetadata alongside the page component.
    files: ["apps/site/app/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // src/core must stay Node-runnable.
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
                ...FOLDERS.flatMap((folder) => [`${folder}/**`, `**/${folder}/**`]),
                // The root modules are React and prop-surface code; core may not reach up into
                // them either. Both spellings: imports are bare through `baseUrl: "src"`, so
                // `from "props"` is the form a core file would actually write, and `../*` alone
                // would sail straight past it. `../*` stays as the catch-all for everything else
                // one level up (`../shared`, `../styles.css`).
                ...ROOT_MODULES.flatMap((m) => [m, `../${m}`]),
                "../*",
              ],
              message:
                "src/core must stay free of React, the DOM and pixel math - keep render-side code in the feature folder it belongs to.",
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
  },
  {
    // shared/ sits below every feature, so it may not import one or reach up into the root.
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "features/**",
                "**/features/**",
                ...ROOT_MODULES.flatMap((m) => [m, `**/${m}`]),
              ],
              message:
                "src/shared may import only src/core - move feature code into its feature, or the vocabulary it needs into shared/.",
            },
          ],
        },
      ],
    },
  },
  {
    // Features import core/, shared/ and each other, never the root modules that compose them.
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ROOT_MODULES.flatMap((m) => [m, `**/${m}`]),
              message:
                "src/features may not import the root modules - Gantt.tsx composes the features, not the other way round.",
            },
          ],
        },
      ],
    },
  }
);
