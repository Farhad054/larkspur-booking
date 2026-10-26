import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";
const TTL_MS = 8 * 60 * 60 * 1000;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function signingKey(): string {
  // SESSION_SECRET is preferred; otherwise derive a key from the admin password.
  return (
    process.env.SESSION_SECRET ||
    createHash("sha256")
      .update(`session:${process.env.ADMIN_PASSWORD ?? ""}`)
      .digest("hex")
  );
}

const sha = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time password comparison (hashing first equalises lengths). */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(sha(input), sha(expected));
}

function sign(exp: number): string {
  return createHmac("sha256", signingKey())
    .update(`admin.${exp}`)
    .digest("hex");
}

export function createToken(now = Date.now()): {
  value: string;
  expires: Date;
} {
  const exp = now + TTL_MS;
  return { value: `${exp}.${sign(exp)}`, expires: new Date(exp) };
}

export function verifyToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !isAdminConfigured()) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < now) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
