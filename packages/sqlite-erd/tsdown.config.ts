import { defineConfig, type UserConfig } from 'tsdown';

const tsdownConfig: UserConfig = defineConfig({
  target: 'esnext',
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['react', 'react-dom'],
  },
  css: {
    transformer: 'postcss',
  },
});

export default tsdownConfig;
