import { DateTime } from "luxon";

/** ISO weekday (1 = Monday … 7 = Sunday) → opening ranges as "HH:mm", or null when closed. */
export type OpeningHours = Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  [string, string][] | null
>;

export interface BusinessConfig {
  /** IANA zone the business operates in; all opening hours are interpreted here. */
  timeZone: string;
  hours: OpeningHours;
  /** Slot start times fall on this grid, in minutes from midnight (e.g. 30 → :00 and :30). */
  slotStepMin: number;
  /** A slot must start at least this long from now. */
  minNoticeMin: number;
  /** Slots further than this many local days ahead are not offered. */
  maxAdvanceDays: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface Slot {
  /** UTC instants, ISO 8601. */
  start: string;
  end: string;
  /** Local wall-clock label in the business zone, e.g. "9:30 AM". */
  label: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Calendar-valid "YYYY-MM-DD" check (rejects 2026-02-30). */
export function isValidDateString(date: string): boolean {
  return DATE_RE.test(date) && DateTime.fromISO(date, { zone: "utc" }).isValid;
}

/** Half-open interval overlap: back-to-back intervals do not overlap. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/** Today's date ("YYYY-MM-DD") in the business zone. */
export function localToday(now: Date, timeZone: string): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).toISODate()!;
}

/** UTC bounds of a local calendar day. DST days are 23 or 25 hours long, so don't assume 24. */
export function dayBounds(date: string, timeZone: string): Interval | null {
  if (!isValidDateString(date)) return null;
  const start = DateTime.fromISO(date, { zone: timeZone }).startOf("day");
  if (!start.isValid) return null;
  return {
    start: start.toJSDate(),
    end: start.plus({ days: 1 }).startOf("day").toJSDate(),
  };
}

function parseTime(t: string): { hour: number; minute: number } {
  const m = TIME_RE.exec(t);
  if (!m) throw new Error(`Invalid time "${t}" in opening hours`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * Every bookable slot for one local calendar day.
 *
 * Handles: closed days, past dates and minimum notice, the booking horizon, overlap with
 * existing bookings, and DST (wall-clock times that don't exist are skipped, and durations
 * are measured in real elapsed time, so a 1-hour slot across the spring-forward gap is
 * still exactly one hour).
 */
export function getAvailableSlots(opts: {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  durationMin: number;
  now: Date;
  /** Confirmed bookings (any that touch this day are fine; extras are ignored). */
  booked: Interval[];
  config: BusinessConfig;
}): Slot[] {
  const { date, durationMin, now, booked, config } = opts;
  if (
    !isValidDateString(date) ||
    !Number.isInteger(durationMin) ||
    durationMin <= 0
  )
    return [];

  const zone = config.timeZone;
  const day = DateTime.fromISO(date, { zone });
  if (!day.isValid) return [];

  const today = DateTime.fromJSDate(now, { zone }).startOf("day");
  if (day < today) return [];
  if (day.diff(today, "days").days > config.maxAdvanceDays) return [];

  const ranges = config.hours[day.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7];
  if (!ranges) return [];

  const earliest = now.getTime() + config.minNoticeMin * 60_000;
  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const [open, close] of ranges) {
    const o = parseTime(open);
    const c = parseTime(close);
    const closeAt = day.set({
      hour: c.hour,
      minute: c.minute,
      second: 0,
      millisecond: 0,
    });
    const openMin = o.hour * 60 + o.minute;
    const closeMin = c.hour * 60 + c.minute;

    for (let m = openMin; m < closeMin; m += config.slotStepMin) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const start = day.set({ hour, minute, second: 0, millisecond: 0 });
      // Skip wall-clock times swallowed by a spring-forward gap (Luxon shifts them).
      if (start.hour !== hour || start.minute !== minute) continue;
      const end = start.plus({ minutes: durationMin });
      if (end > closeAt) continue;

      const s = start.toMillis();
      if (seen.has(s) || s < earliest) continue;
      const interval = { start: start.toJSDate(), end: end.toJSDate() };
      if (booked.some((b) => overlaps(interval, b))) continue;

      seen.add(s);
      slots.push({
        start: start.toUTC().toISO()!,
        end: end.toUTC().toISO()!,
        label: start.toFormat("h:mm a"),
      });
    }
  }
  return slots;
}

/** The local calendar date (business zone) that an instant falls on. */
export function localDateOf(instant: Date, timeZone: string): string {
  return DateTime.fromJSDate(instant, { zone: timeZone }).toISODate()!;
}

/**
 * Is this exact start instant one of the offered slots? Used server-side to reject
 * tampered or stale submissions (off-grid times, closed hours, past times).
 */
export function isSlotOffered(opts: {
  start: Date;
  durationMin: number;
  now: Date;
  booked: Interval[];
  config: BusinessConfig;
}): boolean {
  const date = localDateOf(opts.start, opts.config.timeZone);
  return getAvailableSlots({ ...opts, date }).some(
    (s) => new Date(s.start).getTime() === opts.start.getTime(),
  );
}
