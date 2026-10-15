import { defineConfig } from 'vite';

// Relative base so dist/ works from any static host or sub-path. Nothing from scripts/ or .env reaches the bundle.
export default defineConfig({
  base: './',
  envPrefix: 'WB_PUBLIC_', // XAI_API_KEY can never be exposed to client code
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { environment: 'node' },
} as never);
