import { DateTime } from "luxon";
import { BUSINESS } from "./config";

const zone = BUSINESS.timeZone;

export function formatDay(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return DateTime.fromJSDate(d, { zone }).toFormat("cccc, LLLL d, yyyy");
}

export function formatTime(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return DateTime.fromJSDate(d, { zone }).toFormat("h:mm a");
}

export function formatRange(start: Date, end: Date): string {
  const tz = DateTime.fromJSDate(start, { zone }).offsetNameShort ?? "";
  return `${formatTime(start)} – ${formatTime(end)} ${tz}`.trim();
}

export function formatPrice(cents: number): string {
  return cents === 0
    ? "Free"
    : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function formatDuration(min: number): string {
  return min % 60 === 0
    ? `${min / 60} hr`
    : min > 60
      ? `${Math.floor(min / 60)} hr ${min % 60} min`
      : `${min} min`;
}
