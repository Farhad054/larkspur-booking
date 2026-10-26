"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  checkPassword,
  createToken,
  isAdmin,
  isAdminConfigured,
} from "@/lib/admin-auth";
import { cancelBooking } from "@/lib/bookings";
import { sendCancellation } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { cancelSchema, loginSchema } from "@/lib/schemas";
import { clientIp } from "../actions";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAdminConfigured())
    return { error: "Admin is not configured. Set ADMIN_PASSWORD." };
  const limited = rateLimit(`login:${await clientIp()}`, 8, 10 * 60_000);
  if (!limited.ok)
    return { error: "Too many attempts. Try again in a few minutes." };

  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!checkPassword(parsed.data.password))
    return { error: "Incorrect password." };

  const token = createToken();
  (await cookies()).set(ADMIN_COOKIE, token.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: token.expires,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function cancelBookingAction(formData: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const cancelled = await cancelBooking(parsed.data.id);
  if (cancelled) await sendCancellation(cancelled);
  revalidatePath("/admin");
}
