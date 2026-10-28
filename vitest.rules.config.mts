import { defineConfig } from "vitest/config";

// Firestore/Storage 보안 규칙 테스트 — 에뮬레이터가 떠 있어야 하므로
// `npm run test:rules`(firebase emulators:exec 로 감쌈)로만 실행합니다.
// 모든 파일이 같은 에뮬레이터 DB를 쓰므로 파일 단위 병렬 실행을 끕니다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
