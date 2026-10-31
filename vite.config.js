import { defineConfig } from 'vite';

// Les assets du jeu vivent dans /assets et sont servis tels quels.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { target: 'es2022' },
});
