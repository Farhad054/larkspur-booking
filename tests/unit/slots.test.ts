import { describe, expect, it } from "vitest";
import { BUSINESS } from "@/lib/config";
import {
  type BusinessConfig,
  dayBounds,
  getAvailableSlots,
  isSlotOffered,
  isValidDateString,
  localToday,
  overlaps,
} from "@/lib/slots";

// Business zone is America/New_York. 2026-11-01 is the DST-end Sunday, so Mon 2026-11-02 is EST (UTC-5).
const LONG_AGO = new Date("2026-10-01T12:00:00Z");
const MON = "2026-11-02";
const iv = (startIso: string, endIso: string) => ({
  start: new Date(startIso),
  end: new Date(endIso),
});
const labels = (r: ReturnType<typeof getAvailableSlots>) =>
  r.map((s) => s.label);
const slots = (over: Partial<Parameters<typeof getAvailableSlots>[0]> = {}) =>
  getAvailableSlots({
    date: MON,
    durationMin: 60,
    now: LONG_AGO,
    booked: [],
    config: BUSINESS,
    ...over,
  });

const allDays = (ranges: [string, string][]): BusinessConfig => ({
  ...BUSINESS,
  hours: {
    1: ranges,
    2: ranges,
    3: ranges,
    4: ranges,
    5: ranges,
    6: ranges,
    7: ranges,
  },
});

describe("opening hours and durations", () => {
  it("offers 30-minute-grid starts for a 60-minute service on a weekday", () => {
    const r = slots();
    expect(r).toHaveLength(15);
    expect(r[0]).toMatchObject({
      label: "9:00 AM",
      start: "2026-11-02T14:00:00.000Z",
      end: "2026-11-02T15:00:00.000Z",
    });
    expect(r.at(-1)?.label).toBe("4:00 PM");
  });

  it("stops offering starts that would run past closing time", () => {
    const r = slots({ durationMin: 90 });
    expect(r).toHaveLength(14);
    expect(r.at(-1)?.label).toBe("3:30 PM");
  });

  it("respects shorter Friday and Saturday hours", () => {
    expect(slots({ date: "2026-11-06" }).at(-1)?.label).toBe("2:00 PM");
    expect(labels(slots({ date: "2026-11-07" }))).toEqual([
      "10:00 AM",
      "10:30 AM",
      "11:00 AM",
      "11:30 AM",
      "12:00 PM",
      "12:30 PM",
      "1:00 PM",
    ]);
  });

  it("returns nothing on closed days", () => {
    expect(slots({ date: "2026-11-08" })).toEqual([]);
  });

  it("returns nothing when the service is longer than the whole day", () => {
    expect(slots({ durationMin: 9 * 60 })).toEqual([]);
  });
});

describe("overlapping bookings", () => {
  const booked10to11 = [iv("2026-11-02T15:00:00Z", "2026-11-02T16:00:00Z")]; // 10:00–11:00 local

  it("removes every slot that intersects an existing booking, keeps adjacent ones", () => {
    const r = labels(slots({ booked: booked10to11 }));
    expect(r).not.toContain("9:30 AM"); // 9:30–10:30 overlaps the tail
    expect(r).not.toContain("10:00 AM");
    expect(r).not.toContain("10:30 AM"); // 10:30–11:30 overlaps the head
    expect(r).toContain("9:00 AM"); // ends exactly when the booking starts
    expect(r).toContain("11:00 AM"); // starts exactly when the booking ends
  });

  it("lets a short service fit in the gap right before a booking", () => {
    const r = labels(slots({ durationMin: 30, booked: booked10to11 }));
    expect(r).toContain("9:30 AM");
    expect(r).not.toContain("10:00 AM");
    expect(r).not.toContain("10:30 AM");
    expect(r).toContain("11:00 AM");
  });

  it("blocks a long service that would swallow a booking entirely", () => {
    const r = labels(
      slots({
        durationMin: 90,
        booked: [iv("2026-11-02T15:30:00Z", "2026-11-02T16:00:00Z")],
      }),
    ); // 10:30–11:00
    expect(r).not.toContain("9:30 AM"); // 9:30–11:00 contains it
    expect(r).not.toContain("10:00 AM");
    expect(r).not.toContain("10:30 AM");
    expect(r).toContain("9:00 AM"); // 9:00–10:30 touches only
    expect(r).toContain("11:00 AM");
  });

  it("handles multiple bookings and back-to-back bookings", () => {
    const r = labels(
      slots({
        booked: [
          iv("2026-11-02T14:00:00Z", "2026-11-02T15:00:00Z"),
          iv("2026-11-02T15:00:00Z", "2026-11-02T16:00:00Z"),
        ], // 9–10, 10–11
      }),
    );
    expect(r.slice(0, 2)).toEqual(["11:00 AM", "11:30 AM"]);
  });

  it("ignores bookings on other days", () => {
    expect(
      slots({ booked: [iv("2026-11-03T15:00:00Z", "2026-11-03T16:00:00Z")] }),
    ).toHaveLength(15);
  });
});

describe("past dates, notice and booking horizon", () => {
  it("offers nothing for dates before today (business time)", () => {
    expect(
      slots({ date: "2026-11-01", now: new Date("2026-11-02T15:00:00Z") }),
    ).toEqual([]);
    expect(slots({ now: new Date("2026-11-10T15:00:00Z") })).toEqual([]);
  });

  it("applies minimum notice on the current day", () => {
    // 10:10 local; with 2 h notice the earliest start is 12:10, so first on-grid slot is 12:30.
    const r = slots({ now: new Date("2026-11-02T15:10:00Z") });
    expect(r[0].label).toBe("12:30 PM");
  });

  it("offers nothing once the day is over", () => {
    expect(slots({ now: new Date("2026-11-02T22:30:00Z") })).toEqual([]); // 5:30 PM local
  });

  it("includes the last allowed day and excludes the day after", () => {
    const now = new Date("2026-11-02T15:00:00Z"); // Mon 10:00 local
    expect(slots({ date: "2027-01-01", now }).length).toBeGreaterThan(0); // +60 days, a Friday
    expect(slots({ date: "2027-01-02", now })).toEqual([]); // +61 days
  });
});

describe("timezones", () => {
  it("decides 'today' in the business zone, not UTC", () => {
    // 03:00Z on Nov 3 is still 10 pm on Nov 2 in New York.
    const now = new Date("2026-11-03T03:00:00Z");
    expect(localToday(now, "America/New_York")).toBe("2026-11-02");
    expect(slots({ date: "2026-11-02", now })).toEqual([]); // today but after hours
    expect(slots({ date: "2026-11-03", now })).toHaveLength(15); // tomorrow, fully open
  });

  it("converts local opening hours to the right UTC instants across the DST change", () => {
    // Fri Oct 30 is EDT (UTC-4); Mon Nov 2 is EST (UTC-5). Same 9:00 local → different UTC hour.
    expect(slots({ date: "2026-10-30" })[0].start).toBe(
      "2026-10-30T13:00:00.000Z",
    );
    expect(slots({ date: "2026-11-02" })[0].start).toBe(
      "2026-11-02T14:00:00.000Z",
    );
  });

  it("skips wall-clock times that do not exist on spring-forward day", () => {
    const r = getAvailableSlots({
      date: "2026-03-08",
      durationMin: 60,
      now: new Date("2026-03-01T12:00:00Z"),
      booked: [],
      config: allDays([["01:00", "05:00"]]),
    });
    expect(labels(r)).toEqual([
      "1:00 AM",
      "1:30 AM",
      "3:00 AM",
      "3:30 AM",
      "4:00 AM",
    ]); // no 2:00 / 2:30
    expect(r.map((s) => s.start)).toEqual([
      "2026-03-08T06:00:00.000Z",
      "2026-03-08T06:30:00.000Z",
      "2026-03-08T07:00:00.000Z",
      "2026-03-08T07:30:00.000Z",
      "2026-03-08T08:00:00.000Z",
    ]);
  });

  it("never produces duplicate starts on fall-back day", () => {
    const r = getAvailableSlots({
      date: "2026-11-01",
      durationMin: 60,
      now: new Date("2026-10-20T12:00:00Z"),
      booked: [],
      config: allDays([["00:00", "04:00"]]),
    });
    const starts = r.map((s) => s.start);
    expect(new Set(starts).size).toBe(starts.length);
    expect([...starts].sort()).toEqual(starts);
  });

  it("measures durations in real elapsed time", () => {
    const r = getAvailableSlots({
      date: "2026-03-08",
      durationMin: 60,
      now: new Date("2026-03-01T12:00:00Z"),
      booked: [],
      config: allDays([["01:00", "05:00"]]),
    });
    for (const s of r)
      expect(new Date(s.end).getTime() - new Date(s.start).getTime()).toBe(
        3_600_000,
      );
  });
});

describe("input validation", () => {
  it("rejects impossible or malformed dates and durations", () => {
    expect(slots({ date: "2026-02-30" })).toEqual([]);
    expect(slots({ date: "11/02/2026" })).toEqual([]);
    expect(slots({ date: "" })).toEqual([]);
    expect(slots({ durationMin: 0 })).toEqual([]);
    expect(slots({ durationMin: -30 })).toEqual([]);
    expect(slots({ durationMin: 30.5 })).toEqual([]);
  });

  it("validates date strings", () => {
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
  });
});

describe("helpers", () => {
  it("overlaps is half-open", () => {
    const a = iv("2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z");
    expect(
      overlaps(a, iv("2026-11-02T11:00:00Z", "2026-11-02T12:00:00Z")),
    ).toBe(false);
    expect(
      overlaps(a, iv("2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z")),
    ).toBe(false);
    expect(
      overlaps(a, iv("2026-11-02T10:59:00Z", "2026-11-02T12:00:00Z")),
    ).toBe(true);
    expect(
      overlaps(a, iv("2026-11-02T10:15:00Z", "2026-11-02T10:45:00Z")),
    ).toBe(true);
  });

  it("dayBounds spans 23, 24 or 25 hours depending on DST", () => {
    const hours = (d: string) => {
      const b = dayBounds(d, "America/New_York")!;
      return (b.end.getTime() - b.start.getTime()) / 3_600_000;
    };
    expect(hours("2026-03-08")).toBe(23);
    expect(hours("2026-11-01")).toBe(25);
    expect(hours("2026-06-15")).toBe(24);
    expect(dayBounds("nope", "America/New_York")).toBeNull();
  });
});

describe("isSlotOffered (server-side guard)", () => {
  const base = { durationMin: 60, now: LONG_AGO, booked: [], config: BUSINESS };
  it("accepts a real slot", () => {
    expect(
      isSlotOffered({ ...base, start: new Date("2026-11-02T14:00:00Z") }),
    ).toBe(true);
  });
  it("rejects off-grid, out-of-hours, closed-day, past and overshooting starts", () => {
    expect(
      isSlotOffered({ ...base, start: new Date("2026-11-02T14:15:00Z") }),
    ).toBe(false); // 9:15
    expect(
      isSlotOffered({ ...base, start: new Date("2026-11-02T12:00:00Z") }),
    ).toBe(false); // 7:00
    expect(
      isSlotOffered({ ...base, start: new Date("2026-11-08T15:00:00Z") }),
    ).toBe(false); // Sunday
    expect(
      isSlotOffered({ ...base, start: new Date("2026-11-02T21:30:00Z") }),
    ).toBe(false); // 4:30 + 60 > close
    expect(
      isSlotOffered({
        ...base,
        now: new Date("2026-11-02T14:30:00Z"),
        start: new Date("2026-11-02T14:00:00Z"),
      }),
    ).toBe(false);
  });
  it("rejects a slot that is already taken", () => {
    const booked = [iv("2026-11-02T14:00:00Z", "2026-11-02T15:00:00Z")];
    expect(
      isSlotOffered({
        ...base,
        booked,
        start: new Date("2026-11-02T14:30:00Z"),
      }),
    ).toBe(false);
  });
});
