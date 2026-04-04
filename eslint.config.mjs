// eslint.config.js
import path from 'node:path'
import js from '@eslint/js'
import {configs as tsConfigs, parser as tsParser} from 'typescript-eslint'
import jestPlugin from 'eslint-plugin-jest'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import importPlugin from 'eslint-plugin-import'
import githubPlugin from 'eslint-plugin-github'
import globals from 'globals'

// Get GitHub flat configs
const githubConfigs = githubPlugin.getFlatConfigs()
const rootDir = path.resolve('.')
const tsconfigPath = path.join(rootDir, 'tsconfig.eslint.json')

export default [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: ['dist/', 'lib/', 'node_modules/', 'jest.config.js']
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tsConfigs.recommended,

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
          project: tsconfigPath
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
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: tsconfigPath,
        tsconfigRootDir: rootDir
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
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: rootDir
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.jest
      }
    }
  }
]
