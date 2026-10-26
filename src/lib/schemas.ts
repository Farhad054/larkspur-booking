import { z } from "zod";
import { isValidDateString } from "./slots";

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/, "Unknown service.");

export const dateSchema = z
  .string()
  .refine(isValidDateString, "Choose a valid date.");

export const bookingFormSchema = z.object({
  serviceSlug: slugSchema,
  start: z.iso.datetime({ message: "Choose a time slot." }),
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(120),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional(),
  // Honeypot
  company: z.string().max(0).optional(),
});
export type BookingFormInput = z.infer<typeof bookingFormSchema>;

export const referenceSchema = z
  .string()
  .regex(/^[A-Z2-9]{8}$/, "Invalid reference.");

export const adminFiltersSchema = z.object({
  status: z.enum(["ALL", "CONFIRMED", "CANCELLED"]).default("ALL"),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  q: z.string().trim().max(80).optional(),
});
export type AdminFilters = z.infer<typeof adminFiltersSchema>;

export const cancelSchema = z.object({ id: z.string().min(1).max(40) });

export const loginSchema = z.object({
  password: z.string().min(1, "Enter the password.").max(200),
});

/** Next.js searchParams values can be string | string[] | undefined; keep the first string. */
export function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
