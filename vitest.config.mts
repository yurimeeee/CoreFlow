import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // 보안 규칙 테스트는 에뮬레이터가 필요해 `npm run test:rules` 로 따로 돌립니다.
    exclude: ["**/node_modules/**", "tests/rules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
