import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

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
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tseslint,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      "react/react-in-jsx-scope": "off", // Not needed with React 17+
      "react/prop-types": "off", // Using TypeScript instead
      "react/display-name": "off", // React.memo, React.forwardRef
      "react-hooks/exhaustive-deps": "warn",
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
    // src/core must stay Node-runnable; the list below is every other src/ folder - add new ones.
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
                ...[
                  "shared",
                  "timeline",
                  "bars",
                  "dependencies",
                  "rows",
                  "task-list",
                  "interaction",
                  "detail",
                  // `**` not `*`: domains nest subfolders, so `shared/*` misses `shared/utils/i18n`.
                ].flatMap((domain) => [`${domain}/**`, `**/${domain}/**`]),
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
