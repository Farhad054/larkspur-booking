import type { BusinessConfig } from "./slots";

export const BRAND = {
  name: "Larkspur Learning Studio",
  tagline: "Calm, clear one-to-one tutoring.",
  email: "hello@larkspur.example",
} as const;

/** Opening hours by ISO weekday (1 = Monday … 7 = Sunday), local business time. */
export const BUSINESS: BusinessConfig = {
  timeZone: "America/New_York",
  hours: {
    1: [["09:00", "17:00"]],
    2: [["09:00", "17:00"]],
    3: [["09:00", "17:00"]],
    4: [["09:00", "17:00"]],
    5: [["09:00", "15:00"]],
    6: [["10:00", "14:00"]],
    7: null,
  },
  slotStepMin: 30,
  minNoticeMin: 120,
  maxAdvanceDays: 60,
};

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
