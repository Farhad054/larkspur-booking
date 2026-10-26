import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const auth = await import("@/lib/admin-auth");

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "correct horse";
  process.env.SESSION_SECRET = "test-secret-0123456789";
});
afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.SESSION_SECRET;
});

describe("admin auth", () => {
  it("checks the password in constant time and rejects wrong or empty ones", () => {
    expect(auth.checkPassword("correct horse")).toBe(true);
    expect(auth.checkPassword("correct horsE")).toBe(false);
    expect(auth.checkPassword("")).toBe(false);
  });
  it("is disabled when ADMIN_PASSWORD is not set", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(auth.isAdminConfigured()).toBe(false);
    expect(auth.checkPassword("anything")).toBe(false);
    expect(auth.verifyToken(auth.createToken().value)).toBe(false);
  });
  it("accepts a fresh token and rejects expired, tampered and garbage ones", () => {
    const t = auth.createToken(1_000_000);
    expect(auth.verifyToken(t.value, 1_000_001)).toBe(true);
    expect(auth.verifyToken(t.value, 1_000_000 + 9 * 3600_000)).toBe(false); // expired (8h TTL)
    const [exp, sig] = t.value.split(".");
    expect(auth.verifyToken(`${Number(exp) + 1}.${sig}`, 1_000_001)).toBe(
      false,
    ); // extended expiry
    expect(
      auth.verifyToken(`${exp}.${"0".repeat(sig.length)}`, 1_000_001),
    ).toBe(false);
    expect(auth.verifyToken("garbage", 1)).toBe(false);
    expect(auth.verifyToken(undefined, 1)).toBe(false);
  });
  it("rejects tokens signed with a different secret", () => {
    const t = auth.createToken(1_000_000);
    process.env.SESSION_SECRET = "another-secret-0123456789";
    expect(auth.verifyToken(t.value, 1_000_001)).toBe(false);
  });
});
