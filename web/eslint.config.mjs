// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

// What a formatter cannot check. The rules written on purpose are the ones of
// `docs/estil.md`; the rest come from the recommended sets, which catch the
// things that are mistakes in any project —an unused variable, a promise
// nobody waits for— and not matters of taste.
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', '.angular/**', 'node_modules/**', 'public/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Style sheet, rule 1: the state first, then what can be asked of the
      // class, then how it does it. Which kind of field comes first —inputs,
      // injections, signals, derived— no rule can tell apart: that is kept by hand.
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'signature',
            'call-signature',
            'field',
            'static-initialization',
            'constructor',
            [
              'public-method',
              'public-get',
              'public-set',
              'protected-method',
              'protected-get',
              'protected-set',
            ],
            ['private-method', 'private-get', 'private-set', '#private-method'],
          ],
        },
      ],
      // Style sheet, rule 2: nothing inside a class without saying who can see it.
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      // Style sheet, rule 4: no spaghetti. The number is the alarm, not the goal.
      complexity: ['error', 15],
      // A promise nobody waits for is a failure nobody sees (§11.57).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message: 'Defineix el tipus concret de les dades: unknown no està permès al projecte.',
        },
      ],
      // Two unused names that are not mistakes: the key a rest pattern leaves
      // out on purpose, and a parameter kept with `_` to show the shape.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_$' },
      ],
      // The project's own prefixes for the selectors.
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // A test may be as long and as branching as the case it describes.
      complexity: 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
