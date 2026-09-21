// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    // `functions/` es un proyecto Firebase aparte con su propio tsconfig.
    ignores: ['dist/**', 'functions/**', 'node_modules/**', '.angular/**', 'www/**', 'ios/**', 'android/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      // El objetivo de la Fase 0: CLAUDE.md exige pasar AXE y hoy nada lo medía.
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
);
