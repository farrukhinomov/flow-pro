import globals from 'globals'
import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist', 'src/components/ui'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginQuery.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Enforce type-only imports for TypeScript types
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      // Prevent duplicate imports from the same module
      'no-duplicate-imports': 'error',
    },
  },
  {
    files: [
      'src/context/**/*.{ts,tsx}',
      'src/features/access/session-provider.tsx',
      'src/features/users/components/users-provider.tsx',
      'src/routes/**/*.{ts,tsx}',
    ],
    rules: {
      // TanStack Router route modules and provider modules intentionally export
      // non-component helpers/hooks next to components. Keep this rule active
      // elsewhere so real Fast Refresh issues still surface.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/demo', '@/demo/*'],
              message:
                'Demo data is installed once from main.tsx. Import it dynamically inside a demo-gated branch, never statically.',
            },
            {
              group: [
                '@/components/*',
                '@/application/*',
                '@/context/*',
                '@/data/*',
                '@/features/*',
                '@/routes/*',
                '@/stores/*',
              ],
              message:
                'Domain code must stay framework-free. Move shared types or rules into src/domain, and keep UI/data imports outside this layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/demo', '@/demo/*'],
              message:
                'Demo data is installed once from main.tsx. Import it dynamically inside a demo-gated branch, never statically.',
            },
            {
              group: ['@/application/*', '@/components/*', '@/routes/*'],
              message:
                'Data modules must not import application services, UI components, or route modules. Put shared contracts in src/domain or src/contracts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/demo', '@/demo/*'],
              message:
                'Demo data is installed once from main.tsx. Import it dynamically inside a demo-gated branch, never statically.',
            },
            {
              group: [
                '@/components/*',
                '@/context/*',
                '@/features/*',
                '@/routes/*',
                '@/stores/*',
              ],
              message:
                'Application services coordinate workflows without depending on React, routes, stores, or UI components.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/demo', '@/demo/*'],
              message:
                'Demo data is installed once from main.tsx. Import it dynamically inside a demo-gated branch, never statically.',
            },
            {
              group: ['@/routes/*'],
              message:
                'Feature modules must be reusable outside router files. Pass route state in from the route instead of importing routes.',
            },
          ],
        },
      ],
    },
  }
)
