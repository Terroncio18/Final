// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'data/**', 'scripts/**'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json', './tsconfig.integration.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
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
    },
  },
  { files: ['tests/**/*.ts', 'integration/**/*.ts'], rules: { complexity: 'off' } },
);
