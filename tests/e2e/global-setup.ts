import { execSync } from "node:child_process";
import { Client } from "pg";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("Set TEST_DATABASE_URL (or DATABASE_URL) for e2e tests");
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("TRUNCATE bookings, services CASCADE");
    await client.query(
      `INSERT INTO services (id, slug, name, description, duration_min, price_cents, sort_order) VALUES
        ('svc_intro', 'intro-chat', 'Free intro chat', 'A short call.', 30, 0, 1),
        ('svc_maths', 'maths-60', 'Maths tutoring', 'Algebra to calculus.', 60, 5500, 2),
        ('svc_prep', 'test-prep-90', 'Test prep intensive', 'Exam strategy.', 90, 8000, 3)`,
    );
  } finally {
    await client.end();
  }
}
