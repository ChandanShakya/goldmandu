import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  outDir: './dist',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssMinify: true,
      reportCompressedSize: false,
    },
  },
});
