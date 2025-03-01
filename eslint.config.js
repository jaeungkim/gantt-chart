import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      'airbnb',
      'plugin:react/recommended',
      'plugin:jsx-a11y/recommended',
      'plugin:import/recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:@typescript-eslint/recommended',
      'prettier',
      'plugin:tailwindcss/recommended',
    ],
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint,
      prettier: eslintConfigPrettier,
      tailwindcss: tailwindcss,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'linebreak-style': 0,
      'import/prefer-default-export': 0,
      'import/extensions': 0,
      'import/order': [
        'error',
        {
          groups: [
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling'],
            'index',
            'type',
            'unknown',
          ],
          pathGroups: [
            {
              pattern: '{react*, react*/**}',
              group: 'external',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
        },
      ],
      'import/newline-after-import': 'off',
      'no-restricted-syntax': 'off',
      'guard-for-in': 'off',
      'global-require': 'off',
      'no-use-before-define': 0,
      'import/no-unresolved': 0,
      'react/react-in-jsx-scope': 0,
      'import/no-extraneous-dependencies': 0,
      'no-shadow': 0,
      'react/prop-types': 0,
      'react/jsx-filename-extension': [
        2,
        { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      ],
      'jsx-a11y/no-noninteractive-element-interactions': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/no-var-requires': 'off',
      'react/require-default-props': 'off',
      '@typescript-eslint/no-explicit-any': 0,
      'jsx-a11y/label-has-associated-control': 0,
      'react/jsx-props-no-spreading': 0,
      'react/button-has-type': 0,
      'no-underscore-dangle': 'off',
      'no-param-reassign': 0,
      'jsx-a11y/click-events-have-key-events': 0,
      'prefer-destructuring': [
        'error',
        {
          VariableDeclarator: {
            array: false,
            object: true,
          },
          AssignmentExpression: {
            array: false,
            object: false,
          },
        },
      ],
      'no-console': [
        'warn',
        { allow: ['warn', 'error', 'info'] }, // Allow warn, error, and info logs
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
