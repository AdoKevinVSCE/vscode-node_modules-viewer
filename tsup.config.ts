import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  shims: false,
  dts: false,
  noExternal: [/^(?!.*vscode).*$/],
  external: ['vscode'],
});
