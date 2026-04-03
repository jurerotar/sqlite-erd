import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/sqlite-erd/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(
          /(href|content)="\/(favicon|sqlite-erd-logo)/g,
          '$1="/sqlite-erd/$2',
        );
      },
    },
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
