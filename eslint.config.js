import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["dist"] },
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
      // Base JavaScript rules
      ...js.configs.recommended.rules,

      // TypeScript rules
      ...tseslint.configs.recommended.rules,

      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Essential React rules
      "react/react-in-jsx-scope": "off", // Not needed with React 17+
      "react/prop-types": "off", // Using TypeScript instead
      "react/display-name": "off", // React.memo, React.forwardRef
      "react-hooks/exhaustive-deps": "warn", // Warn instead of error for better DX
      // v7 compiler rule flags pre-existing latest-ref patterns in drag hooks;
      // keep as warning until those are refactored
      "react-hooks/refs": "warn",

      // General rules
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-unused-vars": "off", // Let TypeScript handle this
      "no-undef": "off", // Let TypeScript handle this
    },
  },
  {
    // The package barrel deliberately re-exports the headless core's functions alongside
    // the component, so the fast-refresh "components only" rule does not apply to it.
    files: ["src/index.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // ===== Headless core boundary =====
    // src/core/ has to stay runnable in Node and publishable on its own, so nothing in it
    // may reach for React, the store, a component, or anything that thinks in pixels.
    // Catching that here is cheaper than discovering it the day the core ships separately.
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
                "components/*",
                "hooks/*",
                "pages/*",
                "stores/*",
                "constants/*",
                "types/*",
                "utils/*",
                "assets/*",
                "**/components/*",
                "**/hooks/*",
                "**/pages/*",
                "**/stores/*",
                "**/constants/*",
                "**/utils/*",
              ],
              message:
                "src/core must stay free of React, the DOM and pixel math - keep render-side code in src/utils or src/components.",
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
