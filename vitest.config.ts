import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
