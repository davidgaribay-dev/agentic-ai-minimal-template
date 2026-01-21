import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import testingLibrary from 'eslint-plugin-testing-library'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    'src/routeTree.gen.ts',
    '*.tsbuildinfo',
    '.vite',
    'coverage',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow shadcn components to export variants alongside components
      'react-refresh/only-export-components': [
        'warn',
        { allowExportNames: ['badgeVariants', 'buttonVariants'] },
      ],
      // Allow setState in useEffect for syncing state with props/external data
      // This is a common and legitimate pattern
      'react-hooks/set-state-in-effect': 'off',
      // Allow unused variables prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Testing Library rules for test files
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    plugins: {
      'testing-library': testingLibrary,
    },
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      // Ensure await is used with async queries
      'testing-library/await-async-queries': 'error',
      // Ensure await is used with async utils (waitFor, etc.)
      'testing-library/await-async-utils': 'error',
      // Prefer screen queries over destructured queries
      'testing-library/prefer-screen-queries': 'warn',
      // Prefer user-event over fireEvent
      'testing-library/prefer-user-event': 'warn',
      // Avoid using container to query elements
      'testing-library/no-container': 'warn',
      // Avoid debugging test files
      'testing-library/no-debugging-utils': 'warn',
      // Ensure render result is not stored in a variable
      'testing-library/no-render-in-lifecycle': 'error',
      // Prefer findBy over waitFor + getBy
      'testing-library/prefer-find-by': 'warn',
    },
  },
  {
    // Disable react-refresh for UI components (shadcn generated)
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
