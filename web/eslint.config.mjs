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
      // Style sheet, rule 2: nothing inside a class without saying who can see it.
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      // Style sheet, rule 4: no spaghetti. The number is the alarm, not the goal.
      complexity: ['error', 15],
      // A promise nobody waits for is a failure nobody sees (§11.57).
      '@typescript-eslint/no-floating-promises': 'error',
      // The project's own prefixes for the selectors.
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
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
