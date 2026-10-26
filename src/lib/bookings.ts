import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";
import { BUSINESS } from "./config";
import { db } from "./db";
import { newReference } from "./reference";
import {
  dayBounds,
  getAvailableSlots,
  isSlotOffered,
  type Slot,
} from "./slots";
import type { AdminFilters, BookingFormInput } from "./schemas";

export function listServices() {
  return db.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function getServiceBySlug(slug: string) {
  return db.service.findFirst({ where: { slug, active: true } });
}

/** Confirmed bookings that touch a local calendar day. */
async function bookedOnDay(date: string) {
  const bounds = dayBounds(date, BUSINESS.timeZone);
  if (!bounds) return [];
  const rows = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { lt: bounds.end },
      endsAt: { gt: bounds.start },
    },
    select: { startsAt: true, endsAt: true },
  });
  return rows.map((r) => ({ start: r.startsAt, end: r.endsAt }));
}

export async function getSlotsForDay(
  durationMin: number,
  date: string,
  now = new Date(),
): Promise<Slot[]> {
  const booked = await bookedOnDay(date);
  return getAvailableSlots({
    date,
    durationMin,
    now,
    booked,
    config: BUSINESS,
  });
}

export type CreateBookingResult =
  | { ok: true; booking: Awaited<ReturnType<typeof insert>> }
  | {
      ok: false;
      code: "SERVICE_NOT_FOUND" | "SLOT_UNAVAILABLE" | "SLOT_TAKEN";
    };

function insert(data: Prisma.BookingUncheckedCreateInput) {
  return db.booking.create({ data, include: { service: true } });
}

/** Postgres raised 23P01 (exclusion_violation) from the bookings_no_overlap constraint. */
export function isOverlapViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      meta?: unknown;
    };
    if (e.code === "23P01") return true;
    if (
      typeof e.message === "string" &&
      /bookings_no_overlap|exclusion constraint|23P01/.test(e.message)
    )
      return true;
    if (e.meta && JSON.stringify(e.meta).match(/23P01|bookings_no_overlap/))
      return true;
    cur = e.cause;
  }
  return false;
}

function isReferenceCollision(err: unknown): boolean {
  return /bookings_reference_key|reference/.test(
    String((err as { message?: unknown })?.message ?? ""),
  );
}

/**
 * Create a booking. Availability is checked first for good error messages, but the database
 * exclusion constraint is the real guarantee: if two requests race past the check, exactly one
 * insert succeeds and the other is reported as SLOT_TAKEN.
 */
export async function createBooking(
  input: BookingFormInput,
  now = new Date(),
): Promise<CreateBookingResult> {
  const service = await getServiceBySlug(input.serviceSlug);
  if (!service) return { ok: false, code: "SERVICE_NOT_FOUND" };

  const start = new Date(input.start);
  const date = DateTime.fromJSDate(start, {
    zone: BUSINESS.timeZone,
  }).toISODate()!;
  const booked = await bookedOnDay(date);
  const offered = isSlotOffered({
    start,
    durationMin: service.durationMin,
    now,
    booked,
    config: BUSINESS,
  });
  if (!offered) {
    // Distinguish "someone else just took it" from "never a valid slot".
    const valid = isSlotOffered({
      start,
      durationMin: service.durationMin,
      now,
      booked: [],
      config: BUSINESS,
    });
    return { ok: false, code: valid ? "SLOT_TAKEN" : "SLOT_UNAVAILABLE" };
  }

  const endsAt = DateTime.fromJSDate(start)
    .plus({ minutes: service.durationMin })
    .toJSDate();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const booking = await insert({
        reference: newReference(),
        serviceId: service.id,
        startsAt: start,
        endsAt,
        customerName: input.name,
        customerEmail: input.email,
        notes: input.notes || null,
      });
      return { ok: true, booking };
    } catch (err) {
      if (isOverlapViolation(err)) return { ok: false, code: "SLOT_TAKEN" };
      if (isReferenceCollision(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a booking reference");
}

export function getBookingByReference(reference: string) {
  return db.booking.findUnique({
    where: { reference },
    include: { service: true },
  });
}

export async function cancelBooking(id: string) {
  const res = await db.booking.updateMany({
    where: { id, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (res.count === 0) return null;
  return db.booking.findUnique({ where: { id }, include: { service: true } });
}

export const ADMIN_PAGE_SIZE = 100;

export async function listBookings(filters: AdminFilters) {
  const where: Prisma.BookingWhereInput = {};
  if (filters.status !== "ALL") where.status = filters.status;
  const range: Prisma.DateTimeFilter = {};
  if (filters.from)
    range.gte = dayBounds(filters.from, BUSINESS.timeZone)?.start;
  if (filters.to) range.lt = dayBounds(filters.to, BUSINESS.timeZone)?.end;
  if (range.gte || range.lt) where.startsAt = range;
  if (filters.q) {
    where.OR = [
      { customerName: { contains: filters.q, mode: "insensitive" } },
      { customerEmail: { contains: filters.q, mode: "insensitive" } },
      { reference: { contains: filters.q.toUpperCase() } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: ADMIN_PAGE_SIZE,
      include: { service: true },
    }),
    db.booking.count({ where }),
  ]);
  return { rows, total };
}
