import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

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
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["apps/site/app/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
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
