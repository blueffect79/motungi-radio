import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/.dryforge/**'] }, clearScreen: false, server: { port: 1420, strictPort: true }, build: { target: ['es2022', 'safari16'] } });
