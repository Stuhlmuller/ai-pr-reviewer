// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jestPlugin from 'eslint-plugin-jest'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import importPlugin from 'eslint-plugin-import'
import githubPlugin from 'eslint-plugin-github'
import globals from 'globals'

// Get GitHub flat configs
const githubConfigs = githubPlugin.getFlatConfigs()

export default [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: ['dist/', 'lib/', 'node_modules/', 'jest.config.js']
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // GitHub recommended config
  githubConfigs.recommended,

  // Import plugin configurations
  {
    name: 'import-config',
    plugins: {
      import: importPlugin
    },
    rules: {
      ...importPlugin.configs.errors.rules,
      ...importPlugin.configs.warnings.rules,
      ...importPlugin.configs.typescript.rules
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts']
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        },
        node: {
          extensions: ['.js', '.ts']
        }
      }
    }
  },

  // Prettier config (must be last to override formatting rules)
  prettierRecommended,

  // Global configuration for all TypeScript files
  {
    name: 'typescript-config',
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        globalThis: false
      }
    },
    rules: {
      'i18n-text/no-en': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      camelcase: 'off',
      'object-shorthand': 'warn',
      'github/array-foreach': 'warn',
      'import/no-namespace': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },

  // Test files configuration with Jest
  {
    name: 'test-files',
    files: ['__tests__/**/*.ts', '**/*.test.ts'],
    ...jestPlugin.configs['flat/recommended'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.jest
      }
    }
  }
]
