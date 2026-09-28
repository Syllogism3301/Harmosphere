import { defineConfig } from 'vitest/config';
export default defineConfig({
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 15000 },
});
