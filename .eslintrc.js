module.exports = {
  extends: ['next/core-web-vitals'],
  ignorePatterns: [
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.agents/**',
    '.kiro/**',
    '.claude/**',
    'agent/**',
    'node_modules/**'
  ]
};
