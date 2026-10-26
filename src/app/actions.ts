"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createBooking } from "@/lib/bookings";
import { sendConfirmation } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { bookingFormSchema } from "@/lib/schemas";

export type BookingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "notes", string>>;
  /** Set when the chosen slot is gone, so the form can link back to pick another. */
  slotGone?: boolean;
};

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function createBookingAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const limited = rateLimit(`book:${await clientIp()}`, 10, 10 * 60_000);
  if (!limited.ok)
    return {
      error: "Too many attempts. Please wait a few minutes and try again.",
    };

  const raw = Object.fromEntries(formData.entries());
  // Honeypot: silently pretend to succeed without creating anything.
  if (typeof raw.company === "string" && raw.company) redirect("/");

  const parsed = bookingFormSchema.safeParse({
    ...raw,
    notes: raw.notes || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: NonNullable<BookingFormState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if ((k === "name" || k === "email" || k === "notes") && !fieldErrors[k])
        fieldErrors[k] = issue.message;
    }
    return {
      error: Object.keys(fieldErrors).length
        ? "Please fix the highlighted fields."
        : "That time slot isn't valid. Please pick another.",
      fieldErrors,
    };
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) {
    if (result.code === "SERVICE_NOT_FOUND")
      return { error: "That service is no longer available." };
    return {
      error: "Sorry, that time was just taken or is no longer available.",
      slotGone: true,
    };
  }

  await sendConfirmation(result.booking);
  redirect(`/booking/${result.booking.reference}`);
}
