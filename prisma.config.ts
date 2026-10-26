import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    // Migrations should use a direct (non-pooled) connection when one is provided.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
